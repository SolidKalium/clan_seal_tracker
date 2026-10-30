export class ApiError extends Error {
  constructor(message: string, public readonly code?: number, public readonly retrySeconds = 0) { super(message); }
}
export interface Transport { api<T>(path: string): Promise<T>; resource<T>(path: string): Promise<T> }
export class BungieTransport implements Transport {
  private pauseUntil = 0;
  private disabledUntil = 0;
  constructor(private key: string) {}
  async api<T>(path: string): Promise<T> {
    if (Date.now() < this.disabledUntil) throw new ApiError('Bungie API is unavailable. Cached data is retained; retry in a moment.', 5);
    for (let attempt = 0; attempt < 2; attempt++) {
      const wait = this.pauseUntil - Date.now();
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, Math.min(wait, 60_000)));
      let response: Response;
      try {
        response = await fetch(`https://www.bungie.net/Platform${path}`, { cache: 'no-store', headers: { 'X-API-Key': this.key }, signal: AbortSignal.timeout(25_000) });
      } catch { throw new ApiError('Cannot reach Bungie. Check your connection and the registered browser origin. Cached data is retained.'); }
      const retry = Math.max(0, Number(response.headers.get('Retry-After')) || 0);
      if (response.status === 429) {
        this.pauseUntil = Date.now() + Math.min(60, Math.max(retry, 2)) * 1000;
        if (!attempt) continue;
        throw new ApiError('Bungie request limit reached. Please retry shortly.', 429, retry);
      }
      let body: { ErrorCode: number; ThrottleSeconds?: number; ErrorStatus?: string; Response?: T };
      try { body = await response.json(); } catch { throw new ApiError('Bungie returned an unreadable response.'); }
      if (body.ErrorCode === 2107) throw new ApiError('Bungie rejected this browser origin. Register ' + window.location.origin + ' for this API key in Bungie application settings, then refresh.', 2107);
      if (!response.ok) throw new ApiError(`Bungie returned HTTP ${response.status}${body.ErrorStatus ? ': ' + body.ErrorStatus : ''}.`, body.ErrorCode ?? response.status);
      if (body.ThrottleSeconds) this.pauseUntil = Date.now() + Math.min(60, body.ThrottleSeconds) * 1000;
      if (body.ErrorCode !== 1 || body.Response === undefined) {
        if (body.ErrorCode === 5) this.disabledUntil = Date.now() + 30_000;
        if (body.ThrottleSeconds && !attempt) continue;
        throw new ApiError(`Bungie: ${body.ErrorStatus || 'request failed'}.`, body.ErrorCode, body.ThrottleSeconds);
      }
      return body.Response;
    }
    throw new ApiError('Bungie is temporarily throttling requests.');
  }
  async resource<T>(path: string): Promise<T> {
    // Only manifest paths on Bungie's origin; never forward the API key to resource downloads.
    if (!path.startsWith('/common/destiny2_content/')) throw new ApiError('Invalid manifest resource path.');
    try {
      const response = await fetch(`https://www.bungie.net${path}`, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error();
      return await response.json() as T;
    } catch { throw new ApiError('Could not download definitions. The previous complete manifest is retained.'); }
  }
}
