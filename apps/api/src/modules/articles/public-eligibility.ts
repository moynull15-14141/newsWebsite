import { Prisma } from '@prisma/client';

/**
 * Single definition of "an article that may be shown publicly on the homepage".
 *
 * It matches the strictest rule already used by the project (reader/collections): the article must be
 * PUBLISHED and its publishedAt must not be in the future (null is accepted for legacy rows).
 * Scheduled articles stay APPROVED until PublishingService publishes them, so they are never eligible
 * before their time; ARCHIVED and every pre-publication state are ineligible.
 */
export function publicArticleWhere(now: Date = new Date()): Prisma.ArticleWhereInput {
  return { status: 'PUBLISHED', OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] };
}

export interface EligibilityCandidate {
  status: string;
  publishedAt?: Date | string | null;
}

export type IneligibleReason = 'NOT_FOUND' | 'NOT_PUBLISHED' | 'ARCHIVED' | 'SCHEDULED';

/** In-memory mirror of {@link publicArticleWhere}, used for defense-in-depth on already loaded rows. */
export function isPubliclyEligible(article: EligibilityCandidate | null | undefined, now: Date = new Date()): boolean {
  return ineligibleReason(article, now) === null;
}

/** Why an article cannot be placed/shown, or null when it is eligible. */
export function ineligibleReason(article: EligibilityCandidate | null | undefined, now: Date = new Date()): IneligibleReason | null {
  if (!article) return 'NOT_FOUND';
  if (article.status === 'ARCHIVED') return 'ARCHIVED';
  if (article.status !== 'PUBLISHED') return 'NOT_PUBLISHED';
  if (article.publishedAt && new Date(article.publishedAt).getTime() > now.getTime()) return 'SCHEDULED';
  return null;
}
