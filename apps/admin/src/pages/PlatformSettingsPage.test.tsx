import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import PlatformSettingsPage from './PlatformSettingsPage';
import { useAuthStore } from '../stores/auth-store';

type QueryResult = { data: unknown; isLoading: boolean; isError: boolean };
let mockQuery: () => QueryResult;

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => mockQuery(),
  useMutation: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

const settingsData = {
  employer_platform_enabled: true,
  employer_registration_enabled: false,
  company_profiles_enabled: false,
  third_party_job_posting_enabled: false,
  free_job_posting_enabled: false,
  paid_job_posting_enabled: false,
  featured_job_promotion_enabled: false,
  employer_application_access_enabled: false,
  employer_dashboard_enabled: false,
  require_employer_verification: false,
  require_admin_job_approval: true,
  auto_publish: false,
};

function renderPage() {
  return renderToStaticMarkup(<PlatformSettingsPage />);
}

beforeEach(() => {
  mockQuery = () => ({ data: settingsData, isLoading: false, isError: false });
  useAuthStore.getState().clearAuth();
});

describe('PlatformSettingsPage — view vs manage', () => {
  it('disables every toggle and shows a view-only notice for a caller with only platform.settings.view', () => {
    useAuthStore.getState().setAuth({ id: 'u1', name: 'Viewer', email: 'v@test.local', status: 'ACTIVE', accountType: 'STAFF', roles: [{ id: 'r1', name: 'Viewer', permissions: ['platform.settings.view'] }] }, 't', 'r');
    const markup = renderPage();
    expect(markup).toContain('view-only access');
    expect(markup).toContain('disabled=""');
    useAuthStore.getState().clearAuth();
  });

  it('enables the toggles for a caller with platform.settings.manage', () => {
    useAuthStore.getState().setAuth({ id: 'u1', name: 'Admin', email: 'a@test.local', status: 'ACTIVE', accountType: 'STAFF', roles: [{ id: 'r1', name: 'Admin', permissions: ['platform.settings.manage'] }] }, 't', 'r');
    const markup = renderPage();
    expect(markup).not.toContain('view-only access');
    expect(markup).not.toContain('disabled=""');
    useAuthStore.getState().clearAuth();
  });

  it('reflects each flag’s current on/off state via aria-checked', () => {
    useAuthStore.getState().setAuth({ id: 'u1', name: 'Admin', email: 'a@test.local', status: 'ACTIVE', accountType: 'STAFF', roles: [{ id: 'r1', name: 'Admin', permissions: ['platform.settings.manage'] }] }, 't', 'r');
    const markup = renderPage();
    expect(markup).toContain('aria-checked="true"');
    expect(markup).toContain('aria-checked="false"');
    useAuthStore.getState().clearAuth();
  });
});
