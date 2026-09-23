import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import EmployerOnboardingPage from './EmployerOnboardingPage';
import { LanguageProvider } from '@/lib/i18n';
import { ApiError } from '@/lib/api';

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/employer/onboarding', search: '' }),
}));
vi.mock('@/components/SeoHead', () => ({ default: () => null }));

// `useReaderAuthStore` is a zustand `persist` store; under `renderToStaticMarkup` (no DOM/window), zustand's
// SSR snapshot always reflects the store's initial state rather than any `setAuth()` call made from the
// test body (this is the same hydration-mismatch guard persist uses in a real SSR app) — see the debugging
// notes in this PR's report. Mocking the module directly, like other external deps in this test suite, is
// the only way to exercise the "signed in" branch of this page.
let mockUser: { id: string; name: string; email: string } | null;
vi.mock('@/stores/reader-auth-store', () => ({
  useReaderAuthStore: (selector: (s: { user: typeof mockUser }) => unknown) => selector({ user: mockUser }),
}));

type QueryResult = { data: unknown; isLoading: boolean; isError?: boolean };
let queryResults: Record<string, QueryResult>;
let mutationState: { isPending: boolean; isError: boolean; error?: unknown };

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => queryResults[queryKey[0] as string] ?? { data: undefined, isLoading: false },
  useMutation: () => ({ mutate: vi.fn(), ...mutationState }),
}));

function renderPage() {
  return renderToStaticMarkup(
    <LanguageProvider>
      <EmployerOnboardingPage />
    </LanguageProvider>,
  );
}

function resetDefaults() {
  mockUser = { id: 'u1', name: 'Jane Doe', email: 'jane@example.com' };
  queryResults = { 'employer-me': { data: [], isLoading: false }, 'public-locations': { data: [], isLoading: false } };
  mutationState = { isPending: false, isError: false };
}

describe('EmployerOnboardingPage — not signed in', () => {
  it('redirects to login', () => {
    resetDefaults();
    mockUser = null;
    const markup = renderPage();
    expect(markup).toContain('data-testid="navigate"');
    expect(markup).toContain('/login');
  });
});

describe('EmployerOnboardingPage — already registered', () => {
  it('redirects to the dashboard when an active membership already exists', () => {
    resetDefaults();
    queryResults['employer-me'] = {
      data: [{ id: 'm1', employerId: 'e1', userId: 'u1', role: 'OWNER', status: 'ACTIVE', employer: { id: 'e1', name: 'Acme', slug: 'acme', status: 'ACTIVE', verificationStatus: 'PENDING' } }],
      isLoading: false,
    };
    const markup = renderPage();
    expect(markup).toContain('data-testid="navigate"');
    expect(markup).toContain('/employer');
  });
});

describe('EmployerOnboardingPage — wizard', () => {
  it('shows step 1 with the signed-in user’s own info', () => {
    resetDefaults();
    const markup = renderPage();
    expect(markup).toContain('Jane Doe');
    expect(markup).toContain('jane@example.com');
  });
});

describe('EmployerOnboardingPage — registration disabled', () => {
  it('shows the backend’s own reason instead of a broken form', () => {
    resetDefaults();
    mutationState = { isPending: false, isError: true, error: new ApiError(403) };
    const markup = renderPage();
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('API error: 403');
    // The form itself should not render once registration is known to be disabled.
    expect(markup).not.toContain('<form');
  });
});
