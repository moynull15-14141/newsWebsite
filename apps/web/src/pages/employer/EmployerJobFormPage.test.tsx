import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import EmployerJobFormPage from './EmployerJobFormPage';
import { LanguageProvider } from '@/lib/i18n';
import type { EmployerJobDetail } from './types';

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/en/employer/jobs/job-1/edit', search: '' }),
  useParams: () => ({ id: 'job-1' }),
  useNavigate: () => vi.fn(),
}));

type QueryResult = { data: unknown; isLoading?: boolean };
let jobResult: QueryResult;
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === 'employer-job') return jobResult;
    return { data: [] };
  },
  useMutation: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

function baseJob(overrides: Partial<EmployerJobDetail>): EmployerJobDetail {
  return {
    id: 'job-1', title: 'Backend Engineer', slug: 'backend-engineer', summary: null,
    description: undefined, responsibilities: undefined, requirements: undefined, qualifications: undefined,
    experience: null, salaryMin: null, salaryMax: null, salaryCurrency: 'BDT', salaryNegotiable: false,
    employmentType: 'FULL_TIME', workplaceType: 'ON_SITE', vacancies: 1,
    categoryId: 'cat-1', locationId: null, applicationMethod: 'INTERNAL', externalApplyUrl: null,
    applicationEmail: null, applicationInstructions: null, deadline: null, status: 'DRAFT',
    ...overrides,
  };
}

function renderPage() {
  return renderToStaticMarkup(
    <LanguageProvider>
      <EmployerJobFormPage />
    </LanguageProvider>,
  );
}

describe('EmployerJobFormPage — action buttons per status', () => {
  it('shows "submit for review" only while DRAFT, and allows editing', () => {
    jobResult = { data: baseJob({ status: 'DRAFT' }) };
    const markup = renderPage();
    expect(markup).toContain('Submit for review');
    expect(markup).not.toContain('This job can only be edited');
  });

  it('shows "withdraw" while IN_REVIEW and makes the form read-only', () => {
    jobResult = { data: baseJob({ status: 'IN_REVIEW' }) };
    const markup = renderPage();
    expect(markup).toContain('Withdraw to draft');
    expect(markup).toContain('This job can only be edited');
    expect(markup).not.toContain('Submit for review');
  });

  it('shows "archive" while PUBLISHED', () => {
    jobResult = { data: baseJob({ status: 'PUBLISHED' }) };
    const markup = renderPage();
    expect(markup).toContain('Archive');
    expect(markup).not.toContain('Withdraw to draft');
  });

  it('shows no status actions once ARCHIVED', () => {
    jobResult = { data: baseJob({ status: 'ARCHIVED' }) };
    const markup = renderPage();
    expect(markup).not.toContain('Submit for review');
    expect(markup).not.toContain('Withdraw to draft');
    expect(markup).not.toContain('>Archive<');
  });
});
