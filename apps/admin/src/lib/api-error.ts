/**
 * Typed error for failed API calls. It extends Error, so every existing consumer that only reads
 * `error.message` (or calls getApiErrorMessage) keeps working; new consumers can inspect the structured
 * fields the backend sends (HTTP status, machine-readable `code`, validation `issues`, version numbers).
 */

export interface ApiIssue {
  code: string;
  message: string;
  sectionKey?: string;
  articleId?: string;
  reason?: string;
}

export interface ApiErrorInit {
  status: number;
  message: string;
  code?: string;
  issues?: ApiIssue[];
  expectedVersion?: number;
  currentVersion?: number;
  /** Parsed JSON body when the server sent one (for debugging/inspection). */
  body?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly issues: ApiIssue[];
  readonly expectedVersion?: number;
  readonly currentVersion?: number;
  readonly body?: unknown;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.issues = init.issues ?? [];
    this.expectedVersion = init.expectedVersion;
    this.currentVersion = init.currentVersion;
    this.body = init.body;
  }
}

export const HOMEPAGE_DRAFT_CONFLICT = 'HOMEPAGE_DRAFT_CONFLICT';
export const ARTICLE_VERSION_CONFLICT = 'ARTICLE_VERSION_CONFLICT';

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** The homepage draft was changed by someone else (HTTP 409 + HOMEPAGE_DRAFT_CONFLICT). */
export function isDraftConflict(error: unknown): error is ApiError {
  return isApiError(error) && error.status === 409 && error.code === HOMEPAGE_DRAFT_CONFLICT;
}

/** Someone else saved this article since the editor loaded it (HTTP 409 + ARTICLE_VERSION_CONFLICT). */
export function isArticleVersionConflict(error: unknown): error is ApiError {
  return isApiError(error) && error.status === 409 && error.code === ARTICLE_VERSION_CONFLICT;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const asNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

function parseIssues(value: unknown): ApiIssue[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .filter((item) => typeof item.message === 'string')
    .map((item) => ({
      code: typeof item.code === 'string' ? item.code : 'UNKNOWN',
      message: item.message as string,
      sectionKey: typeof item.sectionKey === 'string' ? item.sectionKey : undefined,
      articleId: typeof item.articleId === 'string' ? item.articleId : undefined,
      reason: typeof item.reason === 'string' ? item.reason : undefined,
    }));
}

/**
 * Builds an ApiError from a failed response. Never throws: bodies may be JSON (Nest exceptions,
 * class-validator arrays), plain text, HTML from a proxy, or empty.
 */
export function parseApiError(status: number, rawBody: string): ApiError {
  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : undefined;
  } catch {
    body = undefined; // not JSON (e.g. an HTML 502 page)
  }

  if (isRecord(body)) {
    const message = Array.isArray(body.message)
      ? body.message.filter((part): part is string => typeof part === 'string').join('; ')
      : typeof body.message === 'string'
        ? body.message
        : '';
    return new ApiError({
      status,
      message: message || `Request failed (HTTP ${status})`,
      code: typeof body.code === 'string' ? body.code : undefined,
      issues: parseIssues(body.issues),
      expectedVersion: asNumber(body.expectedVersion),
      currentVersion: asNumber(body.currentVersion),
      body,
    });
  }
  return new ApiError({ status, message: `Request failed (HTTP ${status})` });
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
