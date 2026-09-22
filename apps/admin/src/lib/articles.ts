/**
 * Pure, framework-free helpers for the Admin article list and editor. Kept separate from the page
 * components (same split the homepage module uses: logic.ts vs components) so the editorial workflow
 * rules — which action is available in which status, for which permission, and how the list query
 * string is built — are unit-testable without rendering React or mocking fetch.
 */

export type ArticleStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';

export interface ArticleListFilters {
  page: number;
  limit?: number;
  search?: string;
  status?: string;
  categoryId?: string;
  languageId?: string;
}

/** Builds the `/articles` list query string. Empty/blank filters are omitted rather than sent as `=`. */
export function buildArticleListQuery(filters: ArticleListFilters): string {
  const params = new URLSearchParams();
  params.set('page', String(filters.page));
  params.set('limit', String(filters.limit ?? 20));
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.status) params.set('status', filters.status);
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  if (filters.languageId) params.set('languageId', filters.languageId);
  return `/articles?${params.toString()}`;
}

export interface WorkflowArticle {
  status: string;
  author?: { id: string };
}

export interface ArticleAction {
  label: string;
  action: 'edit' | 'submit-review' | 'approve' | 'return-to-draft' | 'publish' | 'archive' | 'delete';
}

/**
 * The set of actions available for an article, given the viewer's permissions and identity. Mirrors the
 * API's own enforcement exactly (see ArticlesController/ArticlesService) — this list only decides what
 * to *show*; the server independently re-checks every one of these on the actual request, so a stale/
 * forged action here can never mutate anything it shouldn't.
 *
 * `submit-review` in particular has no permission override on the API (`submitReview()` accepts only the
 * article's own author, unconditionally), so it's gated on `currentUserId` rather than a permission name.
 */
export function getArticleActions(
  article: WorkflowArticle,
  hasPermission: (permission: string) => boolean,
  currentUserId?: string,
): ArticleAction[] {
  const actions: ArticleAction[] = [];

  if (hasPermission('article.edit')) {
    actions.push({ label: 'Edit', action: 'edit' });
  }

  if (article.status === 'DRAFT' && !!currentUserId && article.author?.id === currentUserId) {
    actions.push({ label: 'Submit Review', action: 'submit-review' });
  }
  if (article.status === 'IN_REVIEW' && hasPermission('article.review')) {
    actions.push({ label: 'Approve', action: 'approve' });
    actions.push({ label: 'Return to Draft', action: 'return-to-draft' });
  }
  if (article.status === 'APPROVED' && hasPermission('article.publish')) {
    actions.push({ label: 'Publish', action: 'publish' });
  }
  if (article.status === 'PUBLISHED' && hasPermission('article.publish')) {
    actions.push({ label: 'Archive', action: 'archive' });
  }
  if (hasPermission('article.delete')) {
    actions.push({ label: 'Delete', action: 'delete' });
  }

  return actions;
}

export interface ArticleDraftInput {
  title: string;
}

/**
 * Client-side pre-check before hitting the API. Deliberately minimal — it only asserts what the server
 * DTO actually requires (a non-empty title; everything else is genuinely optional at draft time), so it
 * can never reject something the API would accept. Slug/category/etc conflicts are still the server's
 * call (see the update()/create() slug-collision handling) and surface via the mutation error, not here.
 */
export function validateArticleDraft(input: ArticleDraftInput): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) {
    errors.push('Title is required.');
  }
  return errors;
}
