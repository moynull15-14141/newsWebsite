import { ineligibleReason, isPubliclyEligible, publicArticleWhere } from './public-eligibility';

const NOW = new Date('2026-06-01T12:00:00Z');
const PAST = new Date('2026-05-01T00:00:00Z');
const FUTURE = new Date('2026-07-01T00:00:00Z');

describe('public article eligibility', () => {
  it.each([
    ['PUBLISHED in the past', { status: 'PUBLISHED', publishedAt: PAST }, null],
    ['PUBLISHED with null publishedAt (legacy row)', { status: 'PUBLISHED', publishedAt: null }, null],
    ['PUBLISHED exactly now', { status: 'PUBLISHED', publishedAt: NOW }, null],
    ['DRAFT', { status: 'DRAFT', publishedAt: null }, 'NOT_PUBLISHED'],
    ['IN_REVIEW', { status: 'IN_REVIEW', publishedAt: null }, 'NOT_PUBLISHED'],
    ['APPROVED (not yet published)', { status: 'APPROVED', publishedAt: null }, 'NOT_PUBLISHED'],
    ['APPROVED with a scheduled time', { status: 'APPROVED', publishedAt: null, scheduledAt: FUTURE }, 'NOT_PUBLISHED'],
    ['ARCHIVED', { status: 'ARCHIVED', publishedAt: PAST }, 'ARCHIVED'],
    ['PUBLISHED but publishedAt in the future', { status: 'PUBLISHED', publishedAt: FUTURE }, 'SCHEDULED'],
    ['missing article', null, 'NOT_FOUND'],
  ])('%s -> %s', (_label, article, reason) => {
    expect(ineligibleReason(article as any, NOW)).toBe(reason);
    expect(isPubliclyEligible(article as any, NOW)).toBe(reason === null);
  });

  it('accepts ISO strings for publishedAt (serialized rows)', () => {
    expect(isPubliclyEligible({ status: 'PUBLISHED', publishedAt: PAST.toISOString() }, NOW)).toBe(true);
    expect(isPubliclyEligible({ status: 'PUBLISHED', publishedAt: FUTURE.toISOString() }, NOW)).toBe(false);
  });

  it('builds the query-level filter with the same rule', () => {
    expect(publicArticleWhere(NOW)).toEqual({ status: 'PUBLISHED', OR: [{ publishedAt: null }, { publishedAt: { lte: NOW } }] });
  });
});
