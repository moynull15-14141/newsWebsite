import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api';
import { ApiError, getApiErrorMessage, isApiError, isArticleVersionConflict, isDraftConflict, parseApiError } from './api-error';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('parseApiError', () => {
  it('parses a homepage draft conflict (409) with both versions', () => {
    const error = parseApiError(409, JSON.stringify({ statusCode: 409, code: 'HOMEPAGE_DRAFT_CONFLICT', message: 'The homepage draft was changed since you loaded it.', expectedVersion: 3, currentVersion: 5 }));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error); // existing consumers that only use Error keep working
    expect(error.status).toBe(409);
    expect(error.code).toBe('HOMEPAGE_DRAFT_CONFLICT');
    expect(error.expectedVersion).toBe(3);
    expect(error.currentVersion).toBe(5);
    expect(error.message).toBe('The homepage draft was changed since you loaded it.');
    expect(isDraftConflict(error)).toBe(true);
  });

  it('does not treat other 409s as a draft conflict', () => {
    expect(isDraftConflict(parseApiError(409, JSON.stringify({ message: 'Slug already exists' })))).toBe(false);
    expect(isDraftConflict(parseApiError(400, JSON.stringify({ code: 'HOMEPAGE_DRAFT_CONFLICT', message: 'x' })))).toBe(false);
    expect(isDraftConflict(new Error('HOMEPAGE_DRAFT_CONFLICT'))).toBe(false);
  });

  it('parses an article version conflict (409 + ARTICLE_VERSION_CONFLICT)', () => {
    const error = parseApiError(409, JSON.stringify({ code: 'ARTICLE_VERSION_CONFLICT', message: 'This article was changed by another user.' }));
    expect(isArticleVersionConflict(error)).toBe(true);
    expect(isDraftConflict(error)).toBe(false);
  });

  it('does not treat other 409s as an article version conflict', () => {
    expect(isArticleVersionConflict(parseApiError(409, JSON.stringify({ message: 'Slug already exists' })))).toBe(false);
    expect(isArticleVersionConflict(parseApiError(400, JSON.stringify({ code: 'ARTICLE_VERSION_CONFLICT', message: 'x' })))).toBe(false);
  });

  it('parses structured 422 validation issues', () => {
    const error = parseApiError(
      422,
      JSON.stringify({
        statusCode: 422,
        code: 'HOMEPAGE_PUBLISH_VALIDATION_FAILED',
        message: 'The draft cannot be published until the listed problems are fixed.',
        issues: [
          { code: 'ARTICLE_INELIGIBLE', message: 'Article is archived.', sectionKey: 'latest', articleId: 'a1', reason: 'ARCHIVED' },
          { code: 'HERO_MULTIPLE', message: 'Only one HERO section is allowed (found 2).' },
          { nonsense: true },
          'not-an-object',
        ],
      }),
    );
    expect(error.status).toBe(422);
    expect(error.code).toBe('HOMEPAGE_PUBLISH_VALIDATION_FAILED');
    expect(error.issues).toEqual([
      { code: 'ARTICLE_INELIGIBLE', message: 'Article is archived.', sectionKey: 'latest', articleId: 'a1', reason: 'ARCHIVED' },
      { code: 'HERO_MULTIPLE', message: 'Only one HERO section is allowed (found 2).', sectionKey: undefined, articleId: undefined, reason: undefined },
    ]);
  });

  it('keeps an ordinary { message } error simple', () => {
    const error = parseApiError(404, JSON.stringify({ statusCode: 404, message: 'Homepage section not found in the current draft' }));
    expect(error.message).toBe('Homepage section not found in the current draft');
    expect(error.code).toBeUndefined();
    expect(error.issues).toEqual([]);
  });

  it('joins class-validator message arrays', () => {
    const error = parseApiError(400, JSON.stringify({ message: ['expectedVersion must not be less than 1', 'title should not be empty'], error: 'Bad Request' }));
    expect(error.message).toBe('expectedVersion must not be less than 1; title should not be empty');
  });

  it.each([
    ['an HTML gateway page', '<html><body>502 Bad Gateway</body></html>'],
    ['plain text', 'upstream connect error'],
    ['an empty body', ''],
    ['a JSON array', '[1,2,3]'],
    ['JSON null', 'null'],
  ])('never throws on %s and still reports the HTTP status', (_label, raw) => {
    const error = parseApiError(502, raw);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.message).toBe('Request failed (HTTP 502)');
    expect(error.issues).toEqual([]);
  });

  it('ignores non-numeric version fields', () => {
    const error = parseApiError(409, JSON.stringify({ code: 'HOMEPAGE_DRAFT_CONFLICT', message: 'x', expectedVersion: '3', currentVersion: null }));
    expect(error.expectedVersion).toBeUndefined();
    expect(error.currentVersion).toBeUndefined();
  });
});

describe('getApiErrorMessage / isApiError (existing consumers)', () => {
  it('returns the message of any Error and the fallback otherwise', () => {
    expect(getApiErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
    expect(getApiErrorMessage(parseApiError(500, JSON.stringify({ message: 'db down' })), 'fallback')).toBe('db down');
    expect(getApiErrorMessage('nope', 'fallback')).toBe('fallback');
    expect(isApiError(new Error('x'))).toBe(false);
  });
});

describe('apiFetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('throws an ApiError carrying the structured 409 body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(409, { code: 'HOMEPAGE_DRAFT_CONFLICT', message: 'stale', expectedVersion: 1, currentVersion: 2 })));
    const error = await apiFetch('/homepage/publish', { method: 'POST' }).catch((e: unknown) => e);
    expect(isDraftConflict(error)).toBe(true);
    expect(error).toMatchObject({ status: 409, expectedVersion: 1, currentVersion: 2 });
  });

  it('throws an ApiError carrying 422 issues', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(422, { code: 'HOMEPAGE_PUBLISH_VALIDATION_FAILED', message: 'no', issues: [{ code: 'HERO_MULTIPLE', message: 'two heroes' }] })));
    const error = (await apiFetch('/homepage/publish').catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(422);
    expect(error.issues[0].code).toBe('HERO_MULTIPLE');
  });

  it('survives a non-JSON error body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })));
    const error = (await apiFetch('/anything').catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Request failed (HTTP 502)');
  });

  it('returns parsed JSON on success and tolerates an empty success body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(200, { ok: 1 })).mockResolvedValueOnce(new Response(null, { status: 204 })));
    await expect(apiFetch('/a')).resolves.toEqual({ ok: 1 });
    await expect(apiFetch('/b')).resolves.toBeUndefined();
  });
});
