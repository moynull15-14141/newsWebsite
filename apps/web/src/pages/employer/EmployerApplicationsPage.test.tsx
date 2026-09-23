import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import EmployerApplicationsPage from './EmployerApplicationsPage';
import EmployerApplicationDetailPage from './EmployerApplicationDetailPage';
import { LanguageProvider } from '@/lib/i18n';
import type { EmployerApplicationDetail, EmployerApplicationListItem, Paginated } from './types';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/en/employer/applications', search: '' }),
  useParams: () => ({ id: 'app-1' }),
  useNavigate: () => vi.fn(),
}));

type QueryResult = { data: unknown; isLoading?: boolean; isError?: boolean };
let listResult: QueryResult;
let detailResult: QueryResult;
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === 'employer-application') return detailResult;
    if (queryKey[0] === 'employer-applications') return listResult;
    return { data: { data: [] } };
  },
  useMutation: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

const application: EmployerApplicationListItem = {
  id: 'app-1', status: 'SUBMITTED', method: 'INTERNAL', notes: null, createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z', applicant: { id: 'u1', name: 'Karim Rahman', email: 'karim@example.com' },
  job: { id: 'job-1', title: 'Backend Engineer', slug: 'backend-engineer' }, resume: null, reviewedBy: null,
};

describe('EmployerApplicationsPage', () => {
  it('lists applications with their status', () => {
    listResult = { data: { data: [application], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } } as Paginated<EmployerApplicationListItem>, isLoading: false, isError: false };
    const markup = renderToStaticMarkup(<LanguageProvider><EmployerApplicationsPage /></LanguageProvider>);
    expect(markup).toContain('Karim Rahman');
    expect(markup).toContain('Backend Engineer');
  });

  it('shows an empty state with no applications', () => {
    listResult = { data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }, isLoading: false, isError: false };
    const markup = renderToStaticMarkup(<LanguageProvider><EmployerApplicationsPage /></LanguageProvider>);
    expect(markup).toContain('No applications yet');
  });
});

describe('EmployerApplicationDetailPage — status update control', () => {
  it('offers a status-change control for an active application', () => {
    detailResult = {
      data: { ...application, coverLetter: 'I would love to join.', job: { ...application.job, status: 'PUBLISHED' } } as EmployerApplicationDetail,
      isLoading: false, isError: false,
    };
    const markup = renderToStaticMarkup(<LanguageProvider><EmployerApplicationDetailPage /></LanguageProvider>);
    expect(markup).toContain('Change status');
    expect(markup).toContain('I would love to join.');
  });

  it('does not offer a status change for a withdrawn application', () => {
    detailResult = { data: { ...application, status: 'WITHDRAWN', coverLetter: null, job: { ...application.job, status: 'PUBLISHED' } }, isLoading: false, isError: false };
    const markup = renderToStaticMarkup(<LanguageProvider><EmployerApplicationDetailPage /></LanguageProvider>);
    expect(markup).not.toContain('Change status');
  });
});
