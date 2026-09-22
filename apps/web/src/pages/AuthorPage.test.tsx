import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import AuthorPage from './AuthorPage';
import { LanguageProvider } from '@/lib/i18n';
import { ApiError } from '@/lib/api';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/author/author-1', search: '' }),
  useParams: () => ({ id: 'author-1' }),
}));

vi.mock('@/components/SeoHead', () => ({ default: () => null }));

type QueryResult = { data: unknown; isLoading: boolean; error: unknown };
let mockAuthorQuery: () => QueryResult;
let mockArticlesQuery: () => QueryResult;

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => (queryKey[0] === 'author-detail' ? mockAuthorQuery() : mockArticlesQuery()),
}));

const authorProfile = { id: 'author-1', name: 'Real Reporter Name' };
const article = { id: 'a1', title: 'A Reported Story', slug: 'a-reported-story', excerpt: 'Dek.', publishedAt: '2026-09-20T06:00:00.000Z' };

function renderAuthorPage() {
  return renderToStaticMarkup(
    <LanguageProvider>
      <AuthorPage />
    </LanguageProvider>,
  );
}

describe('AuthorPage loading state', () => {
  it('shows a skeleton while the author is loading', () => {
    mockAuthorQuery = () => ({ data: undefined, isLoading: true, error: null });
    mockArticlesQuery = () => ({ data: undefined, isLoading: true, error: null });
    expect(renderAuthorPage()).toContain('animate-pulse');
  });
});

describe('AuthorPage invalid author', () => {
  it('renders a real 404 for an unknown author id', () => {
    mockAuthorQuery = () => ({ data: undefined, isLoading: false, error: new ApiError(404) });
    mockArticlesQuery = () => ({ data: undefined, isLoading: false, error: null });
    expect(renderAuthorPage()).toContain('404');
  });
});

describe('AuthorPage error state', () => {
  it('shows a generic error (not a 404) for another failure', () => {
    mockAuthorQuery = () => ({ data: undefined, isLoading: false, error: new ApiError(500) });
    mockArticlesQuery = () => ({ data: undefined, isLoading: false, error: null });
    const markup = renderAuthorPage();
    expect(markup).toContain('কিছু ভুল হয়েছে');
    expect(markup).not.toContain('404');
  });
});

describe('AuthorPage published content', () => {
  it('uses the real author name, never inferred from a first article', () => {
    mockAuthorQuery = () => ({ data: authorProfile, isLoading: false, error: null });
    mockArticlesQuery = () => ({ data: { data: [article], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false, error: null });

    const markup = renderAuthorPage();
    expect(markup).toContain('Real Reporter Name');
    expect(markup).toContain('A Reported Story');
  });

  it('shows the real author name even with zero published articles — no placeholder fallback', () => {
    mockAuthorQuery = () => ({ data: authorProfile, isLoading: false, error: null });
    mockArticlesQuery = () => ({ data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }, isLoading: false, error: null });

    const markup = renderAuthorPage();
    expect(markup).toContain('Real Reporter Name');
    expect(markup).toContain('কোনো সংবাদ পাওয়া যায়নি');
  });

  it('renders a breadcrumb for the author', () => {
    mockAuthorQuery = () => ({ data: authorProfile, isLoading: false, error: null });
    mockArticlesQuery = () => ({ data: { data: [article], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false, error: null });

    expect(renderAuthorPage()).toContain('aria-label="Breadcrumb"');
  });
});
