import { describe, expect, it } from 'vitest';
import { buildJobListQuery, getJobActions, formatSalary } from './jobs';

describe('buildJobListQuery', () => {
  it('omits blank filters', () => {
    expect(buildJobListQuery({ page: 1 })).toBe('/jobs?page=1&limit=20');
  });

  it('includes provided filters', () => {
    const query = buildJobListQuery({ page: 2, search: 'engineer', status: 'PUBLISHED', categoryId: 'cat-1' });
    expect(query).toContain('page=2');
    expect(query).toContain('search=engineer');
    expect(query).toContain('status=PUBLISHED');
    expect(query).toContain('categoryId=cat-1');
  });

  it('trims search before sending', () => {
    expect(buildJobListQuery({ page: 1, search: '  hello  ' })).toContain('search=hello');
  });
});

describe('getJobActions', () => {
  const allow = (...perms: string[]) => (p: string) => perms.includes(p);

  it('lets the creator submit their own draft without any permission', () => {
    const actions = getJobActions({ status: 'DRAFT', createdBy: { id: 'u1' } }, allow(), 'u1');
    expect(actions.map((a) => a.action)).toContain('submit-review');
  });

  it('does not let a non-creator without job.publish submit someone else\'s draft', () => {
    const actions = getJobActions({ status: 'DRAFT', createdBy: { id: 'other' } }, allow(), 'u1');
    expect(actions.map((a) => a.action)).not.toContain('submit-review');
  });

  it('offers approve + return-to-draft for IN_REVIEW with job.review', () => {
    const actions = getJobActions({ status: 'IN_REVIEW' }, allow('job.review')).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['approve', 'return-to-draft']));
  });

  it('offers publish + schedule for APPROVED with job.publish', () => {
    const actions = getJobActions({ status: 'APPROVED' }, allow('job.publish')).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['publish', 'schedule']));
  });

  it('offers only delete for DRAFT with job.delete and no other permission', () => {
    const actions = getJobActions({ status: 'DRAFT', createdBy: { id: 'other' } }, allow('job.delete')).map((a) => a.action);
    expect(actions).toEqual(['delete']);
  });

  it('never offers delete for a published job', () => {
    const actions = getJobActions({ status: 'PUBLISHED' }, allow('job.delete', 'job.publish')).map((a) => a.action);
    expect(actions).not.toContain('delete');
  });
});

describe('formatSalary', () => {
  it('formats a range', () => {
    expect(formatSalary(30000, 50000, 'BDT')).toBe('BDT 30,000 - 50,000');
  });
  it('formats a minimum-only salary', () => {
    expect(formatSalary(30000, null, 'BDT')).toBe('BDT 30,000+');
  });
  it('formats negotiable with no numbers', () => {
    expect(formatSalary(null, null, 'BDT', true)).toBe('Negotiable');
  });
  it('falls back to not disclosed', () => {
    expect(formatSalary(null, null, 'BDT', false)).toBe('Not disclosed');
  });
});
