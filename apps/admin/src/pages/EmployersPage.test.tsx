import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import EmployersPage from './EmployersPage';
import { useAuthStore } from '../stores/auth-store';

type QueryResult = { data: unknown; isLoading: boolean };
let mockListQuery: () => QueryResult;
let mockAuditQuery: () => QueryResult;
let mockMembersQuery: () => QueryResult;

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === 'employer-audit-log') return mockAuditQuery();
    if (queryKey[0] === 'employer-members') return mockMembersQuery();
    return mockListQuery();
  },
  useMutation: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

const employer = {
  id: 'e1', name: 'Acme Corp', slug: 'acme', website: null, industry: 'Tech', contactEmail: null,
  status: 'ACTIVE' as const, location: null, _count: { jobs: 3 }, isSelfService: true,
  verificationStatus: 'PENDING' as const, verificationNote: null,
};

function renderPage() {
  return renderToStaticMarkup(<EmployersPage />);
}

beforeEach(() => {
  mockListQuery = () => ({ data: { data: [employer], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false });
  mockAuditQuery = () => ({ data: { data: [] }, isLoading: false });
  mockMembersQuery = () => ({ data: [], isLoading: false });
  useAuthStore.getState().clearAuth();
});

describe('EmployersPage — verification and suspension controls', () => {
  it('hides verify/suspend controls for a caller without those permissions', () => {
    useAuthStore.getState().setAuth({ id: 'u1', name: 'Editor', email: 'e@test.local', status: 'ACTIVE', roles: [{ id: 'r1', name: 'Editor', permissions: ['job.read'] }] }, 't', 'r');
    const markup = renderPage();
    expect(markup).not.toContain('aria-label="Review verification for Acme Corp"');
    expect(markup).not.toContain('aria-label="Suspend Acme Corp"');
    useAuthStore.getState().clearAuth();
  });

  it('shows a Verify action for a PENDING employer to a caller with employer.verify', () => {
    useAuthStore.getState().setAuth({ id: 'u1', name: 'Admin', email: 'a@test.local', status: 'ACTIVE', roles: [{ id: 'r1', name: 'Admin', permissions: ['employer.verify'] }] }, 't', 'r');
    const markup = renderPage();
    expect(markup).toContain('aria-label="Review verification for Acme Corp"');
    useAuthStore.getState().clearAuth();
  });

  it('shows a Reject action instead, once the employer is already VERIFIED', () => {
    mockListQuery = () => ({ data: { data: [{ ...employer, verificationStatus: 'VERIFIED' }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false });
    useAuthStore.getState().setAuth({ id: 'u1', name: 'Admin', email: 'a@test.local', status: 'ACTIVE', roles: [{ id: 'r1', name: 'Admin', permissions: ['employer.verify'] }] }, 't', 'r');
    const markup = renderPage();
    expect(markup).toContain('aria-label="Reject verification for Acme Corp"');
    expect(markup).not.toContain('aria-label="Review verification for Acme Corp"');
    useAuthStore.getState().clearAuth();
  });

  it('shows Suspend for an ACTIVE employer and Reactivate for a SUSPENDED one, to a caller with employer.suspend', () => {
    useAuthStore.getState().setAuth({ id: 'u1', name: 'Admin', email: 'a@test.local', status: 'ACTIVE', roles: [{ id: 'r1', name: 'Admin', permissions: ['employer.suspend'] }] }, 't', 'r');
    let markup = renderPage();
    expect(markup).toContain('aria-label="Suspend Acme Corp"');
    expect(markup).not.toContain('aria-label="Reactivate Acme Corp"');

    mockListQuery = () => ({ data: { data: [{ ...employer, status: 'SUSPENDED' }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false });
    markup = renderPage();
    expect(markup).toContain('aria-label="Reactivate Acme Corp"');
    expect(markup).not.toContain('aria-label="Suspend Acme Corp"');
    useAuthStore.getState().clearAuth();
  });

  it('renders the employer’s verification status badge', () => {
    const markup = renderPage();
    expect(markup).toContain('PENDING');
  });
});
