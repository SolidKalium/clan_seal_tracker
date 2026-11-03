import { EXCERPT_LIMIT, type RequestDiagnostic } from './diagnostics';
export class ApiError extends Error {
  constructor(message: string, public readonly code?: number, public readonly retrySeconds = 0, public readonly diagnostic?: RequestDiagnostic) { super(message); }
}
export interface Transport { api<T>(path: string): Promise<T>; resource<T>(path: string): Promise<T> }
export class BungieTransport implements Transport {
  private pauseUntil = 0;
  private disabledUntil = 0;
  constructor(private key: string, private saveDiagnostic?: (diagnostic: RequestDiagnostic) => Promise<void>) {}
  private async failure(message: string, details: Omit<RequestDiagnostic, 'message'>, text?: string, code?: number, retrySeconds = 0) {
    const redact = (value: string) => this.key ? value.replaceAll(this.key, '[redacted]') : value;
    const diagnostic: RequestDiagnostic = { ...details, message: redact(message), cause: details.cause ? redact(details.cause) : undefined };
    if (text !== undefined) {
      diagnostic.responseLength = text.length;
      // A valid JSON error envelope is recorded through its status fields. Keep
      // excerpts for malformed/non-JSON bodies, never successful profile payloads.
      let envelope: { ErrorCode?: unknown; ErrorStatus?: unknown; Message?: unknown } | undefined;
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object' && typeof parsed.ErrorCode === 'number') envelope = parsed;
      } catch { /* Non-JSON failure bodies need the bounded excerpt. */ }
      if (envelope) {
        diagnostic.apiCode = envelope.ErrorCode as number;
        if (typeof envelope.ErrorStatus === 'string') diagnostic.apiStatus = envelope.ErrorStatus;
        if (typeof envelope.Message === 'string') diagnostic.apiMessage = envelope.Message.slice(0, 512);
      } else {
        const safe = redact(text);
        diagnostic.bodyExcerpt = safe.slice(0, EXCERPT_LIMIT);
        diagnostic.bodyTruncated = safe.length > EXCERPT_LIMIT;
      }
    }
    for (const field of Object.keys(diagnostic) as (keyof RequestDiagnostic)[]) {
      if (typeof diagnostic[field] === 'string') Object.assign(diagnostic, { [field]: redact(diagnostic[field] as string) });
    }
    console.warn('[Clan Seal Tracker] Request failed', diagnostic);
    try { await this.saveDiagnostic?.(diagnostic); } catch { /* Diagnostics must not mask the request error. */ }
    return new ApiError(diagnostic.message, code, retrySeconds, diagnostic);
  }
  async api<T>(path: string): Promise<T> {
    const url = `https://www.bungie.net/Platform${path}`;
    if (Date.now() < this.disabledUntil) throw await this.failure('Bungie API is unavailable. Cached data is retained; retry in a moment.', { url, timestamp: Date.now(), attempt: 0, durationMs: 0 }, undefined, 5);
    for (let attempt = 0; attempt < 2; attempt++) {
      const wait = this.pauseUntil - Date.now();
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, Math.min(wait, 60_000)));
      const started = Date.now();
      let response: Response, text: string;
      try {
        response = await fetch(url, { cache: 'no-store', headers: { 'X-API-Key': this.key }, signal: AbortSignal.timeout(25_000) });
      } catch (cause) {
        throw await this.failure('Cannot reach Bungie. Check your connection and the registered browser origin. Cached data is retained.', { url, timestamp: started, attempt: attempt + 1, durationMs: Date.now() - started, cause: cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause) });
      }
      const details = (): Omit<RequestDiagnostic, 'message'> => ({ url, timestamp: started, attempt: attempt + 1, durationMs: Date.now() - started, status: response.status, statusText: response.statusText, contentType: response.headers.get('Content-Type') ?? undefined, retryAfter: response.headers.get('Retry-After') ?? undefined });
      try { text = await response.text(); }
      catch (cause) {
        if (response.status === 429) text = '';
        else throw await this.failure('Bungie returned an unreadable response.', { ...details(), cause: cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause) });
      }
      const retry = Math.max(0, Number(response.headers.get('Retry-After')) || 0);
      if (response.status === 429) {
        this.pauseUntil = Date.now() + Math.min(60, Math.max(retry, 2)) * 1000;
        const error = await this.failure('Bungie request limit reached. Please retry shortly.', { ...details(), retrying: attempt === 0 }, text, 429, retry);
        if (!attempt) continue;
        throw error;
      }
      let body: { ErrorCode: number; ThrottleSeconds?: number; ErrorStatus?: string; Message?: string; Response?: T };
      try {
        body = JSON.parse(text);
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Expected an API response object.');
      } catch (cause) { throw await this.failure('Bungie returned an unreadable response.', { ...details(), cause: cause instanceof Error ? cause.message : String(cause) }, text); }
      const apiDetails = () => ({ ...details(), apiCode: body.ErrorCode, apiStatus: body.ErrorStatus, apiMessage: typeof body.Message === 'string' ? body.Message.slice(0, 512) : undefined, throttleSeconds: body.ThrottleSeconds });
      if (body.ErrorCode === 2107) throw await this.failure('Bungie rejected this browser origin. Register ' + window.location.origin + ' for this API key in Bungie application settings, then refresh.', apiDetails(), undefined, 2107);
      if (!response.ok) throw await this.failure(`Bungie returned HTTP ${response.status}${body.ErrorStatus ? ': ' + body.ErrorStatus : ''}.`, apiDetails(), undefined, body.ErrorCode ?? response.status);
      if (body.ThrottleSeconds) this.pauseUntil = Date.now() + Math.min(60, body.ThrottleSeconds) * 1000;
      if (body.ErrorCode !== 1 || body.Response === undefined) {
        if (body.ErrorCode === 5) this.disabledUntil = Date.now() + 30_000;
        const error = await this.failure(`Bungie: ${body.ErrorStatus || 'request failed'}.`, { ...apiDetails(), retrying: !!body.ThrottleSeconds && attempt === 0 }, undefined, body.ErrorCode, body.ThrottleSeconds);
        if (body.ThrottleSeconds && !attempt) continue;
        throw error;
      }
      return body.Response;
    }
    throw new ApiError('Bungie is temporarily throttling requests.');
  }
  async resource<T>(path: string): Promise<T> {
    // Never forward the API key to resource downloads.
    if (!path.startsWith('/common/destiny2_content/')) throw new ApiError('Invalid manifest resource path.');
    const url = `https://www.bungie.net${path}`, started = Date.now();
    let response: Response | undefined, text: string | undefined;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return JSON.parse(text) as T;
    } catch (cause) {
      throw await this.failure('Could not download definitions. The previous complete manifest is retained.', {
        url, timestamp: started, attempt: 1, durationMs: Date.now() - started, status: response?.status, statusText: response?.statusText,
        contentType: response?.headers.get('Content-Type') ?? undefined, cause: cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause),
      }, text);
    }
  }
}
