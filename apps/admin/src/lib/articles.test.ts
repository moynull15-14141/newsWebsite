import { describe, expect, it } from 'vitest';
import {
  buildArticleListQuery, countQueueWarnings, getArticleActions, validateArticleDraft,
  buildAutosaveStorageKey, serializeAutosaveDraft, parseAutosaveDraft, shouldOfferDraftRecovery,
} from './articles';

describe('buildArticleListQuery', () => {
  it('sends only page and limit when no filters are set', () => {
    expect(buildArticleListQuery({ page: 1 })).toBe('/articles?page=1&limit=20');
  });

  it('respects a custom limit', () => {
    expect(buildArticleListQuery({ page: 2, limit: 50 })).toBe('/articles?page=2&limit=50');
  });

  it('omits search when it is blank or only whitespace', () => {
    expect(buildArticleListQuery({ page: 1, search: '' })).toBe('/articles?page=1&limit=20');
    expect(buildArticleListQuery({ page: 1, search: '   ' })).toBe('/articles?page=1&limit=20');
  });

  it('trims and URL-encodes search', () => {
    const query = buildArticleListQuery({ page: 1, search: '  flood relief  ' });
    expect(query).toContain('search=flood+relief');
  });

  it('includes status, category and language filters when set', () => {
    const query = buildArticleListQuery({ page: 1, status: 'DRAFT', categoryId: 'cat-1', languageId: 'lang-bn' });
    expect(query).toContain('status=DRAFT');
    expect(query).toContain('categoryId=cat-1');
    expect(query).toContain('languageId=lang-bn');
  });

  it('combines search with status/category/language filters', () => {
    const query = buildArticleListQuery({ page: 3, search: 'dhaka', status: 'PUBLISHED', categoryId: 'cat-2', languageId: 'lang-en' });
    expect(query).toBe('/articles?page=3&limit=20&search=dhaka&status=PUBLISHED&categoryId=cat-2&languageId=lang-en');
  });
});

describe('getArticleActions', () => {
  const allow = (...granted: string[]) => (permission: string) => granted.includes(permission);
  const ME = 'user-1';
  const draftByMe = { status: 'DRAFT', author: { id: ME } };
  const draftBySomeoneElse = { status: 'DRAFT', author: { id: 'user-2' } };

  it('shows nothing for a draft when the viewer has no permissions and is not the author', () => {
    const actions = getArticleActions(draftBySomeoneElse, allow(), ME);
    expect(actions).toEqual([]);
  });

  it('lets the author submit their own draft for review without any special permission', () => {
    const actions = getArticleActions(draftByMe, allow(), ME);
    // Draft -> submit-review is otherwise author-only — "is this my article?" or article.publish.
    expect(actions.map((a) => a.action)).toEqual(['submit-review']);
  });

  it('never offers Submit Review on someone else\'s draft from article.edit alone', () => {
    const actions = getArticleActions(draftBySomeoneElse, allow('article.edit'), ME);
    expect(actions.map((a) => a.action)).not.toContain('submit-review');
  });

  it('lets an article.publish holder submit someone else\'s draft — otherwise a restored article authored by someone else has no one who can move it forward', () => {
    const actions = getArticleActions(draftBySomeoneElse, allow('article.publish'), ME);
    expect(actions.map((a) => a.action)).toContain('submit-review');
  });

  it('shows Edit (from article.edit) alongside Submit Review for the author\'s own draft', () => {
    const actions = getArticleActions(draftByMe, allow('article.edit'), ME);
    expect(actions.map((a) => a.action)).toEqual(['edit', 'submit-review']);
  });

  it('shows Approve and Request Changes for IN_REVIEW only with article.review', () => {
    const withoutReview = getArticleActions({ status: 'IN_REVIEW' }, allow('article.edit'), ME);
    expect(withoutReview.map((a) => a.action)).toEqual(['edit']);

    const withReview = getArticleActions({ status: 'IN_REVIEW' }, allow('article.edit', 'article.review'), ME);
    expect(withReview.map((a) => a.action)).toEqual(['edit', 'approve', 'return-to-draft']);
  });

  it('shows Request Changes (but not Approve) for an already-APPROVED article, with article.review', () => {
    const actions = getArticleActions({ status: 'APPROVED' }, allow('article.review'), ME);
    expect(actions.map((a) => a.action)).toEqual(['return-to-draft']);
  });

  it('shows Publish for APPROVED only with article.publish', () => {
    const actions = getArticleActions({ status: 'APPROVED' }, allow('article.publish'), ME);
    expect(actions.map((a) => a.action)).toContain('publish');
  });

  it('shows Archive and Unpublish for PUBLISHED only with article.publish, never Publish again', () => {
    const actions = getArticleActions({ status: 'PUBLISHED' }, allow('article.publish'), ME);
    expect(actions.map((a) => a.action)).toEqual(['archive', 'unpublish']);
  });

  it('never offers Publish or Approve for an ARCHIVED article regardless of permissions, but offers Restore with article.publish', () => {
    const actions = getArticleActions({ status: 'ARCHIVED' }, allow('article.edit', 'article.review', 'article.publish'), ME);
    expect(actions.map((a) => a.action)).toEqual(['edit', 'restore']);
  });

  it('does not offer Restore on an ARCHIVED article without article.publish', () => {
    const actions = getArticleActions({ status: 'ARCHIVED' }, allow('article.edit'), ME);
    expect(actions.map((a) => a.action)).toEqual(['edit']);
  });

  it('shows Delete only with article.delete on a DRAFT — the API refuses to hard-delete anything still active', () => {
    const withoutDelete = getArticleActions(draftByMe, allow('article.edit'), ME);
    expect(withoutDelete.map((a) => a.action)).not.toContain('delete');

    const withDelete = getArticleActions(draftByMe, allow('article.edit', 'article.delete'), ME);
    expect(withDelete.map((a) => a.action)).toContain('delete');
  });

  it('never offers Delete on an article still active in the workflow (IN_REVIEW/APPROVED/PUBLISHED), even with article.delete', () => {
    for (const status of ['IN_REVIEW', 'APPROVED', 'PUBLISHED']) {
      const actions = getArticleActions({ status }, allow('article.delete'), ME);
      expect(actions.map((a) => a.action)).not.toContain('delete');
    }
  });

  it('offers Delete on an ARCHIVED article only with article.delete — permanently erasing a retired article is Super Admin/Admin only, even for its own author', () => {
    const archivedByMe = { status: 'ARCHIVED', author: { id: ME } };

    const withoutDelete = getArticleActions(archivedByMe, allow('article.edit', 'article.publish'), ME);
    expect(withoutDelete.map((a) => a.action)).not.toContain('delete');

    const withDelete = getArticleActions(archivedByMe, allow('article.delete'), ME);
    expect(withDelete.map((a) => a.action)).toContain('delete');
  });

  it('grants every action the viewer is entitled to, without a signed-in user id for submit-review', () => {
    const actions = getArticleActions(
      { status: 'IN_REVIEW' },
      allow('article.edit', 'article.review', 'article.publish', 'article.delete'),
      undefined,
    );
    expect(actions.map((a) => a.action)).toEqual(['edit', 'approve', 'return-to-draft']);
  });
});

describe('validateArticleDraft', () => {
  it('requires a non-empty title', () => {
    expect(validateArticleDraft({ title: '' })).toEqual(['Title is required.']);
  });

  it('rejects a whitespace-only title', () => {
    expect(validateArticleDraft({ title: '   ' })).toEqual(['Title is required.']);
  });

  it('accepts a real title', () => {
    expect(validateArticleDraft({ title: 'Flood relief reaches Sylhet' })).toEqual([]);
  });
});

describe('countQueueWarnings', () => {
  const now = new Date('2026-02-01T00:00:00Z');
  const complete = {
    status: 'PUBLISHED',
    excerpt: 'A solid excerpt',
    featuredImageId: 'media-1',
    seoDescription: 'A solid meta description',
    createdAt: '2026-01-30T00:00:00Z',
    updatedAt: '2026-01-30T00:00:00Z',
    scheduledAt: null,
  };

  it('counts zero warnings for a fully complete published article', () => {
    expect(countQueueWarnings(complete, now)).toBe(0);
  });

  it('counts missing featured image, excerpt and SEO description separately', () => {
    expect(countQueueWarnings({ ...complete, featuredImageId: null, excerpt: '', seoDescription: null }, now)).toBe(3);
  });

  it('flags a draft older than 14 days as stale', () => {
    expect(countQueueWarnings({ ...complete, status: 'DRAFT', createdAt: '2026-01-01T00:00:00Z' }, now)).toBe(1);
  });

  it('does not flag a fresh draft as stale', () => {
    expect(countQueueWarnings({ ...complete, status: 'DRAFT', createdAt: '2026-01-30T00:00:00Z' }, now)).toBe(0);
  });

  it('flags an article awaiting review for more than 3 days', () => {
    expect(countQueueWarnings({ ...complete, status: 'IN_REVIEW', updatedAt: '2026-01-20T00:00:00Z' }, now)).toBe(1);
  });

  it('flags a schedule that has already passed', () => {
    expect(countQueueWarnings({ ...complete, status: 'APPROVED', scheduledAt: '2026-01-01T00:00:00Z' }, now)).toBe(1);
  });

  it('flags a schedule set on an article that is not yet approved', () => {
    expect(countQueueWarnings({ ...complete, status: 'DRAFT', createdAt: '2026-01-30T00:00:00Z', scheduledAt: '2026-03-01T00:00:00Z' }, now)).toBe(1);
  });

  it('does not flag a future schedule on an approved article', () => {
    expect(countQueueWarnings({ ...complete, status: 'APPROVED', scheduledAt: '2026-03-01T00:00:00Z' }, now)).toBe(0);
  });
});

describe('autosave draft helpers', () => {
  it('keys a saved article by id and a new article by a fixed slot', () => {
    expect(buildAutosaveStorageKey('article-1')).toBe('bd-news-autosave-article-1');
    expect(buildAutosaveStorageKey(undefined)).toBe('bd-news-autosave-new');
  });

  it('round-trips fields and the base server version through serialize/parse', () => {
    const raw = serializeAutosaveDraft({ title: 'Draft title' }, '2026-01-01T00:00:00Z');
    const parsed = parseAutosaveDraft(raw);
    expect(parsed?.fields).toEqual({ title: 'Draft title' });
    expect(parsed?.baseUpdatedAt).toBe('2026-01-01T00:00:00Z');
    expect(typeof parsed?.savedAt).toBe('number');
  });

  it('never lets missing, corrupt or foreign localStorage values through as draft data', () => {
    expect(parseAutosaveDraft(null)).toBeNull();
    expect(parseAutosaveDraft(undefined)).toBeNull();
    expect(parseAutosaveDraft('not valid json {{{')).toBeNull();
    expect(parseAutosaveDraft('"just a string"')).toBeNull();
    expect(parseAutosaveDraft(JSON.stringify({ somethingElse: true }))).toBeNull();
  });

  it('offers recovery only when the draft was based on the version currently on the server', () => {
    const draft = { baseUpdatedAt: '2026-01-01T00:00:00Z', savedAt: Date.now(), fields: {} };
    expect(shouldOfferDraftRecovery(draft, '2026-01-01T00:00:00Z')).toBe(true);
  });

  it('discards a draft that is stale against a newer server save instead of offering to overwrite it', () => {
    const draft = { baseUpdatedAt: '2026-01-01T00:00:00Z', savedAt: Date.now(), fields: {} };
    expect(shouldOfferDraftRecovery(draft, '2026-02-01T00:00:00Z')).toBe(false);
  });

  it('offers a new-article draft that has no server version to compare against', () => {
    const draft = { baseUpdatedAt: null, savedAt: Date.now(), fields: {} };
    expect(shouldOfferDraftRecovery(draft, null)).toBe(true);
  });

  it('never offers recovery when there is no draft at all', () => {
    expect(shouldOfferDraftRecovery(null, '2026-01-01T00:00:00Z')).toBe(false);
  });
});
