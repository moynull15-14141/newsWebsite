import { evaluateBlockingIssues, evaluateStalenessAndScheduleWarnings } from './editorial-readiness';

const baseArticle = {
  title: 'A real headline',
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Some real body text here.' }] }] },
  status: 'DRAFT',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  scheduledAt: null as string | Date | null,
};

describe('evaluateBlockingIssues', () => {
  it('passes a title + real body content', () => {
    expect(evaluateBlockingIssues(baseArticle)).toEqual([]);
  });

  it('flags a missing title', () => {
    const issues = evaluateBlockingIssues({ ...baseArticle, title: '' });
    expect(issues.map((i) => i.code)).toContain('MISSING_TITLE');
  });

  it('flags empty TipTap content (no text nodes)', () => {
    const issues = evaluateBlockingIssues({ ...baseArticle, content: { type: 'doc', content: [{ type: 'paragraph' }] } });
    expect(issues.map((i) => i.code)).toContain('MISSING_CONTENT');
  });

  it('flags null content', () => {
    const issues = evaluateBlockingIssues({ ...baseArticle, content: null });
    expect(issues.map((i) => i.code)).toContain('MISSING_CONTENT');
  });
});

describe('evaluateStalenessAndScheduleWarnings', () => {
  const now = new Date('2026-02-01T00:00:00Z');

  it('warns about a draft older than 14 days', () => {
    const warnings = evaluateStalenessAndScheduleWarnings({ ...baseArticle, status: 'DRAFT', createdAt: new Date('2026-01-01T00:00:00Z') }, now);
    expect(warnings.map((w) => w.code)).toContain('STALE_DRAFT');
  });

  it('does not warn about a fresh draft', () => {
    const warnings = evaluateStalenessAndScheduleWarnings({ ...baseArticle, status: 'DRAFT', createdAt: new Date('2026-01-30T00:00:00Z') }, now);
    expect(warnings.map((w) => w.code)).not.toContain('STALE_DRAFT');
  });

  it('warns about an article awaiting review for more than 3 days', () => {
    const warnings = evaluateStalenessAndScheduleWarnings({ ...baseArticle, status: 'IN_REVIEW', updatedAt: new Date('2026-01-20T00:00:00Z') }, now);
    expect(warnings.map((w) => w.code)).toContain('STALE_REVIEW');
  });

  it('warns when a schedule is in the past', () => {
    const warnings = evaluateStalenessAndScheduleWarnings({ ...baseArticle, status: 'APPROVED', scheduledAt: new Date('2026-01-01T00:00:00Z') }, now);
    expect(warnings.map((w) => w.code)).toContain('SCHEDULE_IN_PAST');
  });

  it('warns when scheduled but not yet approved', () => {
    const warnings = evaluateStalenessAndScheduleWarnings({ ...baseArticle, status: 'DRAFT', scheduledAt: new Date('2026-03-01T00:00:00Z') }, now);
    expect(warnings.map((w) => w.code)).toContain('SCHEDULE_NOT_APPROVED');
  });

  it('has no schedule warnings for a future schedule on an approved article', () => {
    const warnings = evaluateStalenessAndScheduleWarnings({ ...baseArticle, status: 'APPROVED', scheduledAt: new Date('2026-03-01T00:00:00Z') }, now);
    expect(warnings.map((w) => w.code)).not.toContain('SCHEDULE_IN_PAST');
    expect(warnings.map((w) => w.code)).not.toContain('SCHEDULE_NOT_APPROVED');
  });
});
