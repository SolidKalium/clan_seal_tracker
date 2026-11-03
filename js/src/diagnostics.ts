export interface RequestDiagnostic {
  timestamp: number;
  url: string;
  attempt: number;
  durationMs: number;
  message: string;
  status?: number;
  statusText?: string;
  contentType?: string;
  retryAfter?: string;
  apiCode?: number;
  apiStatus?: string;
  apiMessage?: string;
  throttleSeconds?: number;
  responseLength?: number;
  bodyExcerpt?: string;
  bodyTruncated?: boolean;
  cause?: string;
  retrying?: boolean;
}
export const DIAGNOSTIC_LIMIT = 50;
export const EXCERPT_LIMIT = 2048;
