import { jobIneligibleReason, isJobPubliclyEligible, publicJobWhere } from './job-eligibility';

const NOW = new Date('2026-06-01T12:00:00Z');
const PAST = new Date('2026-05-01T00:00:00Z');
const FUTURE = new Date('2026-07-01T00:00:00Z');

describe('public job eligibility', () => {
  it.each([
    ['PUBLISHED, no deadline', { status: 'PUBLISHED', publishedAt: PAST, deadline: null }, null],
    ['PUBLISHED with a future deadline', { status: 'PUBLISHED', publishedAt: PAST, deadline: FUTURE }, null],
    ['PUBLISHED with null publishedAt (legacy row)', { status: 'PUBLISHED', publishedAt: null, deadline: null }, null],
    ['DRAFT', { status: 'DRAFT', publishedAt: null, deadline: null }, 'NOT_PUBLISHED'],
    ['IN_REVIEW', { status: 'IN_REVIEW', publishedAt: null, deadline: null }, 'NOT_PUBLISHED'],
    ['APPROVED (not yet published)', { status: 'APPROVED', publishedAt: null, deadline: null }, 'NOT_PUBLISHED'],
    ['SCHEDULED (not yet published)', { status: 'SCHEDULED', publishedAt: null, deadline: null }, 'NOT_PUBLISHED'],
    ['ARCHIVED', { status: 'ARCHIVED', publishedAt: PAST, deadline: null }, 'ARCHIVED'],
    ['EXPIRED status', { status: 'EXPIRED', publishedAt: PAST, deadline: PAST }, 'EXPIRED'],
    ['PUBLISHED but publishedAt in the future', { status: 'PUBLISHED', publishedAt: FUTURE, deadline: null }, 'SCHEDULED'],
    ['PUBLISHED but deadline already passed (not yet swept to EXPIRED)', { status: 'PUBLISHED', publishedAt: PAST, deadline: PAST }, 'EXPIRED'],
    ['PUBLISHED with deadline exactly now', { status: 'PUBLISHED', publishedAt: PAST, deadline: NOW }, 'EXPIRED'],
    ['missing job', null, 'NOT_FOUND'],
  ])('%s -> %s', (_label, job, reason) => {
    expect(jobIneligibleReason(job as any, NOW)).toBe(reason);
    expect(isJobPubliclyEligible(job as any, NOW)).toBe(reason === null);
  });

  it('accepts ISO strings for publishedAt/deadline (serialized rows)', () => {
    expect(isJobPubliclyEligible({ status: 'PUBLISHED', publishedAt: PAST.toISOString(), deadline: FUTURE.toISOString() }, NOW)).toBe(true);
    expect(isJobPubliclyEligible({ status: 'PUBLISHED', publishedAt: PAST.toISOString(), deadline: PAST.toISOString() }, NOW)).toBe(false);
  });

  it('builds the query-level filter with the same rule', () => {
    expect(publicJobWhere(NOW)).toEqual({
      status: 'PUBLISHED',
      OR: [{ publishedAt: null }, { publishedAt: { lte: NOW } }],
      AND: [{ OR: [{ deadline: null }, { deadline: { gt: NOW } }] }],
    });
  });
});
