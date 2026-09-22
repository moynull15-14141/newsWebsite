import { describe, expect, it } from 'vitest';
import { buildArticleListQuery, getArticleActions, validateArticleDraft } from './articles';

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
    // Draft -> submit-review has no permission gate on the API — only "is this my article?" matters.
    expect(actions.map((a) => a.action)).toEqual(['submit-review']);
  });

  it('never offers Submit Review on someone else\'s draft, even with article.edit', () => {
    const actions = getArticleActions(draftBySomeoneElse, allow('article.edit'), ME);
    expect(actions.map((a) => a.action)).not.toContain('submit-review');
  });

  it('shows Edit (from article.edit) alongside Submit Review for the author\'s own draft', () => {
    const actions = getArticleActions(draftByMe, allow('article.edit'), ME);
    expect(actions.map((a) => a.action)).toEqual(['edit', 'submit-review']);
  });

  it('shows Approve and Return to Draft for IN_REVIEW only with article.review', () => {
    const withoutReview = getArticleActions({ status: 'IN_REVIEW' }, allow('article.edit'), ME);
    expect(withoutReview.map((a) => a.action)).toEqual(['edit']);

    const withReview = getArticleActions({ status: 'IN_REVIEW' }, allow('article.edit', 'article.review'), ME);
    expect(withReview.map((a) => a.action)).toEqual(['edit', 'approve', 'return-to-draft']);
  });

  it('shows Publish for APPROVED only with article.publish', () => {
    const actions = getArticleActions({ status: 'APPROVED' }, allow('article.publish'), ME);
    expect(actions.map((a) => a.action)).toContain('publish');
  });

  it('shows Archive for PUBLISHED only with article.publish, never Publish again', () => {
    const actions = getArticleActions({ status: 'PUBLISHED' }, allow('article.publish'), ME);
    expect(actions.map((a) => a.action)).toEqual(['archive']);
  });

  it('never offers Publish or Approve for an ARCHIVED article regardless of permissions', () => {
    const actions = getArticleActions({ status: 'ARCHIVED' }, allow('article.edit', 'article.review', 'article.publish'), ME);
    expect(actions.map((a) => a.action)).toEqual(['edit']);
  });

  it('shows Delete only with article.delete, independent of status', () => {
    const withoutDelete = getArticleActions(draftByMe, allow('article.edit'), ME);
    expect(withoutDelete.map((a) => a.action)).not.toContain('delete');

    const withDelete = getArticleActions(draftByMe, allow('article.edit', 'article.delete'), ME);
    expect(withDelete.map((a) => a.action)).toContain('delete');
  });

  it('grants every action the viewer is entitled to, without a signed-in user id for submit-review', () => {
    const actions = getArticleActions(
      { status: 'IN_REVIEW' },
      allow('article.edit', 'article.review', 'article.publish', 'article.delete'),
      undefined,
    );
    expect(actions.map((a) => a.action)).toEqual(['edit', 'approve', 'return-to-draft', 'delete']);
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
