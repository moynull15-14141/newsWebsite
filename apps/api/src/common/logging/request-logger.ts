/**
 * Pure formatter for one structured request-log line (Phase 2M) — kept separate from the Express
 * middleware that calls it so the actual format (and the "never log this" list) is unit-testable
 * without a real HTTP request/response pair.
 */
export interface RequestLogInput {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  actorId?: string | null;
}

export function formatRequestLog(input: RequestLogInput): string {
  const parts = [
    `time=${new Date().toISOString()}`,
    `requestId=${input.requestId}`,
    `method=${input.method}`,
    `path=${input.path}`,
    `status=${input.statusCode}`,
    `durationMs=${input.durationMs}`,
  ];
  if (input.actorId) parts.push(`actorId=${input.actorId}`);
  return parts.join(' ');
}

/** Query strings can carry a search term or a password-reset token — strip them from what gets logged
 * rather than trying to guess which query params are sensitive on a case-by-case basis. */
export function sanitizePathForLogging(path: string): string {
  const queryIndex = path.indexOf('?');
  return queryIndex === -1 ? path : path.slice(0, queryIndex);
}
