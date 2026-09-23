import { Prisma } from '@prisma/client';

/**
 * Single definition of "a job that may be shown publicly" — mirrors public-eligibility.ts's
 * publicArticleWhere() exactly, with one job-specific addition: a job whose deadline has passed must
 * not be presented as actively accepting applications even if its status row hasn't been swept to
 * EXPIRED yet by the scheduler (defense in depth — the scheduler is the source of truth for the
 * *status*, this WHERE is the source of truth for *public visibility* at read time).
 */
export function publicJobWhere(now: Date = new Date()): Prisma.JobWhereInput {
  return {
    status: 'PUBLISHED',
    OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
    AND: [{ OR: [{ deadline: null }, { deadline: { gt: now } }] }],
  };
}

export interface JobEligibilityCandidate {
  status: string;
  publishedAt?: Date | string | null;
  deadline?: Date | string | null;
}

export type JobIneligibleReason = 'NOT_FOUND' | 'NOT_PUBLISHED' | 'ARCHIVED' | 'SCHEDULED' | 'EXPIRED';

/** In-memory mirror of {@link publicJobWhere}, used for defense-in-depth on already loaded rows. */
export function isJobPubliclyEligible(job: JobEligibilityCandidate | null | undefined, now: Date = new Date()): boolean {
  return jobIneligibleReason(job, now) === null;
}

export function jobIneligibleReason(job: JobEligibilityCandidate | null | undefined, now: Date = new Date()): JobIneligibleReason | null {
  if (!job) return 'NOT_FOUND';
  if (job.status === 'ARCHIVED') return 'ARCHIVED';
  if (job.status === 'EXPIRED') return 'EXPIRED';
  if (job.status !== 'PUBLISHED') return 'NOT_PUBLISHED';
  if (job.publishedAt && new Date(job.publishedAt).getTime() > now.getTime()) return 'SCHEDULED';
  if (job.deadline && new Date(job.deadline).getTime() <= now.getTime()) return 'EXPIRED';
  return null;
}
