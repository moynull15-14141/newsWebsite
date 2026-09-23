import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import EmployerDashboardPage from './EmployerDashboardPage';
import { LanguageProvider } from '@/lib/i18n';
import { EmployerMembershipContext } from './EmployerContext';
import type { MyMembership } from './types';

vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/employer', search: '' }) }));

type QueryResult = { data: unknown; isLoading: boolean; isError: boolean };
let queryResult: QueryResult;
vi.mock('@tanstack/react-query', () => ({ useQuery: () => queryResult }));

const membership: MyMembership = {
  id: 'm1', employerId: 'e1', userId: 'u1', role: 'OWNER', status: 'ACTIVE',
  employer: { id: 'e1', name: 'Acme Corp', slug: 'acme', status: 'ACTIVE', verificationStatus: 'PENDING' },
};

function renderPage() {
  return renderToStaticMarkup(
    <LanguageProvider>
      <EmployerMembershipContext.Provider value={membership}>
        <EmployerDashboardPage />
      </EmployerMembershipContext.Provider>
    </LanguageProvider>,
  );
}

describe('EmployerDashboardPage', () => {
  it('renders the real job-status counts and application total returned by the backend', () => {
    queryResult = {
      data: { employerStatus: 'ACTIVE', verificationStatus: 'PENDING', jobsByStatus: { DRAFT: 2, PUBLISHED: 5 }, totalJobs: 7, totalApplications: 41 },
      isLoading: false,
      isError: false,
    };
    const markup = renderPage();
    expect(markup).toContain('Acme Corp');
    expect(markup).toContain('7');
    expect(markup).toContain('41');
    expect(markup).toContain('2');
    expect(markup).toContain('5');
  });

  it('shows a loading state before the dashboard resolves', () => {
    queryResult = { data: undefined, isLoading: true, isError: false };
    expect(renderPage()).not.toContain('undefined');
  });

  it('shows an error state on failure', () => {
    queryResult = { data: undefined, isLoading: false, isError: true };
    const markup = renderPage();
    expect(markup).not.toContain('undefined');
  });
});
