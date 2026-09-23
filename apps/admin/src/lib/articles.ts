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
  action: 'edit' | 'submit-review' | 'approve' | 'return-to-draft' | 'publish' | 'archive' | 'unpublish' | 'restore' | 'delete';
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

  // Mirrors the API: the author can always submit their own draft, and article.publish holders (the
  // same permission that gates archive/unpublish/restore) can also submit it — otherwise a restored
  // article authored by someone else would have no one left who could move it forward.
  if (article.status === 'DRAFT' && ((!!currentUserId && article.author?.id === currentUserId) || hasPermission('article.publish'))) {
    actions.push({ label: 'Submit Review', action: 'submit-review' });
  }
  if (['IN_REVIEW', 'APPROVED'].includes(article.status) && hasPermission('article.review')) {
    if (article.status === 'IN_REVIEW') actions.push({ label: 'Approve', action: 'approve' });
    actions.push({ label: 'Request Changes', action: 'return-to-draft' });
  }
  if (article.status === 'APPROVED' && hasPermission('article.publish')) {
    actions.push({ label: 'Publish', action: 'publish' });
  }
  if (article.status === 'PUBLISHED' && hasPermission('article.publish')) {
    actions.push({ label: 'Archive', action: 'archive' });
    actions.push({ label: 'Unpublish', action: 'unpublish' });
  }
  // Restoring is the archive/unpublish workflow in reverse — same permission, same reversibility
  // guarantee: it re-enters DRAFT rather than jumping straight back to PUBLISHED (Phase 2I).
  if (article.status === 'ARCHIVED' && hasPermission('article.publish')) {
    actions.push({ label: 'Restore', action: 'restore' });
  }
  // Hard-delete is only safe for a draft or an already-archived article — anything still active
  // (reviewed/approved/published) has real editorial history the API refuses to erase (Phase 2H), so
  // don't offer a button that would just 400. Deleting an ARCHIVED article is the more consequential
  // of the two (it permanently erases that article's audit history, not just an unfinished draft), so
  // the API additionally requires article.delete there even for the article's own author.
  if ((article.status === 'DRAFT' || article.status === 'ARCHIVED') && hasPermission('article.delete')) {
    actions.push({ label: 'Delete', action: 'delete' });
  }

  return actions;
}

export interface QueueWarningArticle {
  status: string;
  excerpt?: string | null;
  featuredImageId?: string | null;
  seoDescription?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  scheduledAt?: string | null;
}

const STALE_DRAFT_DAYS = 14;
const STALE_REVIEW_DAYS = 3;

/**
 * Cheap, deterministic warning count for a Review Queue row — computed only from fields the list
 * query already returns, so showing it never costs an extra request per row (mirrors the server's
 * `evaluateStalenessAndScheduleWarnings`/metadata checks at a glance; the full duplicate-content and
 * SEO-derived warnings only run in the single-article Editor's `/articles/:id/readiness` call).
 */
export function countQueueWarnings(article: QueueWarningArticle, now = new Date()): number {
  let count = 0;
  if (!article.featuredImageId) count += 1;
  if (!article.excerpt?.trim()) count += 1;
  if (!article.seoDescription?.trim()) count += 1;

  const daysSince = (iso: string) => (now.getTime() - new Date(iso).getTime()) / 86_400_000;
  if (article.status === 'DRAFT' && daysSince(article.createdAt) > STALE_DRAFT_DAYS) count += 1;
  if (article.status === 'IN_REVIEW' && daysSince(article.updatedAt || article.createdAt) > STALE_REVIEW_DAYS) count += 1;

  if (article.scheduledAt) {
    const scheduled = new Date(article.scheduledAt).getTime();
    if (scheduled <= now.getTime() && article.status !== 'PUBLISHED') count += 1;
    else if (!['APPROVED', 'PUBLISHED'].includes(article.status)) count += 1;
  }

  return count;
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

/**
 * Autosave / draft-recovery (Phase 2L). The editor already sends `expectedUpdatedAt` on every manual
 * save so the API rejects a stale write instead of clobbering a newer one — autosave reuses that exact
 * same save path on a debounce timer, so these helpers only cover the piece that didn't exist before:
 * a local safety copy that survives a crashed tab/browser between periodic autosaves, and the logic for
 * deciding whether it is still safe to offer restoring it.
 */
export interface AutosaveDraft {
  /** The server `updatedAt` this draft was edited on top of — a new/never-saved article has none. */
  baseUpdatedAt: string | null;
  savedAt: number;
  fields: Record<string, unknown>;
}

/** One storage key per saved article; a brand-new, not-yet-created article has no id to key off yet,
 * so it gets a single fixed slot instead (there is only ever one "New Article" screen open at a time). */
export function buildAutosaveStorageKey(articleId: string | undefined): string {
  return `bd-news-autosave-${articleId || 'new'}`;
}

export function serializeAutosaveDraft(fields: Record<string, unknown>, baseUpdatedAt: string | null): string {
  const draft: AutosaveDraft = { baseUpdatedAt, savedAt: Date.now(), fields };
  return JSON.stringify(draft);
}

/** Never lets a corrupt/foreign localStorage value reach the editor as real draft data. */
export function parseAutosaveDraft(raw: string | null | undefined): AutosaveDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.fields && typeof parsed.fields === 'object') {
      return parsed as AutosaveDraft;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Only offer to restore a locally-saved draft when it was based on the exact server version that is
 * still current. If someone else has saved a newer version since (or the article was reloaded from a
 * different session), the local draft is stale relative to their work — silently discarding it is
 * safer than offering to overwrite a newer save with older content. A brand-new, never-saved article
 * has no server version to compare against, so any local draft found there is inherently safe to offer.
 */
export function shouldOfferDraftRecovery(draft: AutosaveDraft | null, serverUpdatedAt: string | null): boolean {
  if (!draft) return false;
  return draft.baseUpdatedAt === serverUpdatedAt;
}
