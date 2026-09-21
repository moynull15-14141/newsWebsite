import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, isDraftConflict, parseApiError } from '../lib/api-error';
import { draft } from './fixtures';
import { draftRequests, fetchDraft, fetchPreview, homepageKeys, publishDraft, readDraftVersion, runDraftMutation } from './draft-client';

const apiFetch = vi.fn();
vi.mock('../lib/api', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));

const lastCall = () => {
  const [path, init] = apiFetch.mock.calls[apiFetch.mock.calls.length - 1] as [string, RequestInit | undefined];
  return { path, method: init?.method, body: init?.body ? JSON.parse(init.body as string) : undefined };
};

let client: QueryClient;
beforeEach(() => {
  apiFetch.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe('version handling', () => {
  it('sends the version that is in the cache and stores the server response, so the next call uses the new version', async () => {
    client.setQueryData(homepageKeys.draft, draft({ version: 4 }));
    apiFetch.mockResolvedValueOnce(draft({ version: 5 })).mockResolvedValueOnce(draft({ version: 6 }));

    await runDraftMutation(client, draftRequests.setPlacements('sec-latest', ['a1']));
    expect(lastCall()).toMatchObject({ path: '/homepage/draft/sections/sec-latest/placements', method: 'PUT', body: { expectedVersion: 4, articleIds: ['a1'] } });
    expect(readDraftVersion(client)).toBe(5);

    await runDraftMutation(client, draftRequests.updateSection('sec-latest', { title: 'New' }));
    expect(lastCall()).toMatchObject({ path: '/homepage/draft/sections/sec-latest', method: 'PATCH', body: { expectedVersion: 5, title: 'New' } });
    expect(readDraftVersion(client)).toBe(6);
  });

  it('reads the version at call time, not from a value captured earlier', async () => {
    client.setQueryData(homepageKeys.draft, draft({ version: 4 }));
    const staleBuilder = draftRequests.reorderSections(['a', 'b']); // built before the cache moves on
    client.setQueryData(homepageKeys.draft, draft({ version: 9 }));
    apiFetch.mockResolvedValueOnce(draft({ version: 10 }));

    await runDraftMutation(client, staleBuilder);

    expect(lastCall()).toMatchObject({ path: '/homepage/draft/sections/order', method: 'PUT', body: { expectedVersion: 9, sectionIds: ['a', 'b'] } });
  });

  it('puts the version in the query string for DELETE', async () => {
    client.setQueryData(homepageKeys.draft, draft({ version: 7 }));
    apiFetch.mockResolvedValueOnce(draft({ version: 8 }));
    await runDraftMutation(client, draftRequests.deleteSection('sec-world'));
    expect(lastCall()).toMatchObject({ path: '/homepage/draft/sections/sec-world?expectedVersion=7', method: 'DELETE', body: undefined });
  });

  it('creates a section with the current version', async () => {
    client.setQueryData(homepageKeys.draft, draft({ version: 2 }));
    apiFetch.mockResolvedValueOnce(draft({ version: 3 }));
    await runDraftMutation(client, draftRequests.createSection({ type: 'CUSTOM', title: 'Special Coverage', layoutType: 'THREE_UP', maxItems: 4 }));
    expect(lastCall()).toMatchObject({ path: '/homepage/draft/sections', method: 'POST', body: { expectedVersion: 2, type: 'CUSTOM', title: 'Special Coverage', layoutType: 'THREE_UP', maxItems: 4 } });
  });

  it('refuses to mutate before the draft has been loaded', async () => {
    await expect(runDraftMutation(client, draftRequests.deleteSection('x'))).rejects.toThrow(/not been loaded/);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('sends the Hero as exactly one article id', async () => {
    client.setQueryData(homepageKeys.draft, draft({ version: 4 }));
    apiFetch.mockResolvedValueOnce(draft({ version: 5 }));
    await runDraftMutation(client, draftRequests.setPlacements('sec-hero', ['only-one']));
    expect(lastCall().body.articleIds).toEqual(['only-one']);
  });
});

describe('conflicts and validation errors', () => {
  const conflict = () => parseApiError(409, JSON.stringify({ statusCode: 409, code: 'HOMEPAGE_DRAFT_CONFLICT', message: 'stale', expectedVersion: 4, currentVersion: 6 }));

  it('surfaces a 409 as a draft conflict and leaves the cached draft untouched (no silent retry, no overwrite)', async () => {
    const original = draft({ version: 4 });
    client.setQueryData(homepageKeys.draft, original);
    apiFetch.mockRejectedValueOnce(conflict());

    const error = await runDraftMutation(client, draftRequests.updateSection('sec-latest', { title: 'Mine' })).catch((e: unknown) => e);

    expect(isDraftConflict(error)).toBe(true);
    expect(error).toMatchObject({ expectedVersion: 4, currentVersion: 6 });
    expect(apiFetch).toHaveBeenCalledTimes(1); // not retried
    expect(client.getQueryData(homepageKeys.draft)).toBe(original);
  });

  it('propagates structured issues from a rejected mutation', async () => {
    client.setQueryData(homepageKeys.draft, draft({ version: 4 }));
    apiFetch.mockRejectedValueOnce(parseApiError(400, JSON.stringify({ code: 'HOMEPAGE_PLACEMENT_INVALID', message: 'Some articles cannot be placed in this section.', issues: [{ code: 'ARTICLE_INELIGIBLE', message: 'Article is archived.', articleId: 'a9', reason: 'ARCHIVED' }] })));
    const error = (await runDraftMutation(client, draftRequests.setPlacements('sec-latest', ['a9'])).catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('HOMEPAGE_PLACEMENT_INVALID');
    expect(error.issues).toEqual([expect.objectContaining({ code: 'ARTICLE_INELIGIBLE', articleId: 'a9', reason: 'ARCHIVED' })]);
    expect(readDraftVersion(client)).toBe(4);
  });
});

describe('publish', () => {
  it('sends the current version and only after the server confirms refetches draft and active', async () => {
    client.setQueryData(homepageKeys.draft, draft({ version: 8 }));
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    apiFetch.mockResolvedValueOnce({ published: true, publishedAt: '2026-05-01T00:00:00Z', activeVersion: 3, draftVersion: 9, sectionCount: 4, placementCount: 7 });

    const result = await publishDraft(client);

    expect(lastCall()).toMatchObject({ path: '/homepage/publish', method: 'POST', body: { expectedVersion: 8 } });
    expect(result.activeVersion).toBe(3);
    const invalidated = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(invalidated).toContain(JSON.stringify(homepageKeys.draft));
    expect(invalidated).toContain(JSON.stringify(homepageKeys.active));
  });

  it('is not optimistic: a failed publish (422) changes nothing and refetches nothing', async () => {
    const original = draft({ version: 8 });
    client.setQueryData(homepageKeys.draft, original);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    apiFetch.mockRejectedValueOnce(parseApiError(422, JSON.stringify({ code: 'HOMEPAGE_PUBLISH_VALIDATION_FAILED', message: 'no', issues: [{ code: 'HERO_MULTIPLE', message: 'two' }] })));

    const error = (await publishDraft(client).catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(422);
    expect(error.issues).toHaveLength(1);
    expect(client.getQueryData(homepageKeys.draft)).toBe(original);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('reports a publish conflict as a draft conflict', async () => {
    client.setQueryData(homepageKeys.draft, draft({ version: 8 }));
    apiFetch.mockRejectedValueOnce(parseApiError(409, JSON.stringify({ code: 'HOMEPAGE_DRAFT_CONFLICT', message: 'stale', expectedVersion: 8, currentVersion: 9 })));
    expect(isDraftConflict(await publishDraft(client).catch((e: unknown) => e))).toBe(true);
  });
});

describe('reads', () => {
  it('previews the DRAFT endpoint and never the public homepage', async () => {
    apiFetch.mockResolvedValue({});
    await fetchPreview();
    await fetchDraft();
    const paths = apiFetch.mock.calls.map(([path]) => path as string);
    expect(paths).toEqual(['/homepage/draft/preview', '/homepage/draft']);
    expect(paths.some((path) => path.includes('/public/'))).toBe(false);
  });
});
