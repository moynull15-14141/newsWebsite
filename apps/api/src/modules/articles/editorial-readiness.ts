import { hasBodyContent } from '@news-platform/seo';

/**
 * Deterministic editorial readiness rules (Phase 2H). Blocking issues gate workflow transitions
 * server-side; warnings are advisory only. Duplicate-title/slug/description and most metadata
 * completeness checks already live in the SEO Intelligence analyzer (Phase 2G) — this module adds
 * only what that analyzer doesn't cover: workflow-stage blocking and staleness/scheduling warnings.
 */

export interface ReadinessIssue {
  code: string;
  message: string;
}

export interface ReadinessArticleInput {
  title?: string | null;
  content?: unknown;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  scheduledAt?: Date | string | null;
}

const STALE_DRAFT_DAYS = 14;
const STALE_REVIEW_DAYS = 3;
const daysBetween = (a: Date, b: Date) => (a.getTime() - b.getTime()) / 86_400_000;

/** A missing title is already enforced by the create/update DTO; checked again here so the same
 * function is authoritative for both "can I submit this?" and "can I publish this?". */
export function evaluateBlockingIssues(article: ReadinessArticleInput): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  if (!article.title?.trim()) {
    issues.push({ code: 'MISSING_TITLE', message: 'Title is required.' });
  }
  if (!hasBodyContent(article.content)) {
    issues.push({ code: 'MISSING_CONTENT', message: 'Article body is empty — write the story before it can move forward.' });
  }
  return issues;
}

/** Cheap warnings computable from fields already loaded by the article list/detail queries — safe to
 * compute for every row of the Review Queue without any extra database round trip. */
export function evaluateStalenessAndScheduleWarnings(article: ReadinessArticleInput, now = new Date()): ReadinessIssue[] {
  const warnings: ReadinessIssue[] = [];
  const nowDate = now;

  if (article.status === 'DRAFT') {
    const ageDays = daysBetween(nowDate, new Date(article.createdAt));
    if (ageDays > STALE_DRAFT_DAYS) {
      warnings.push({ code: 'STALE_DRAFT', message: `Draft has been sitting untouched for ${Math.floor(ageDays)} days.` });
    }
  }

  if (article.status === 'IN_REVIEW') {
    const waitingDays = daysBetween(nowDate, new Date(article.updatedAt));
    if (waitingDays > STALE_REVIEW_DAYS) {
      warnings.push({ code: 'STALE_REVIEW', message: `Awaiting review for ${Math.floor(waitingDays)} days.` });
    }
  }

  if (article.scheduledAt) {
    const scheduled = new Date(article.scheduledAt);
    if (scheduled.getTime() <= nowDate.getTime() && article.status !== 'PUBLISHED') {
      warnings.push({ code: 'SCHEDULE_IN_PAST', message: 'Scheduled time has already passed.' });
    } else if (article.status !== 'APPROVED' && article.status !== 'PUBLISHED') {
      warnings.push({ code: 'SCHEDULE_NOT_APPROVED', message: 'A schedule is set but the article is not yet approved, so it will not auto-publish.' });
    }
  }

  return warnings;
}
