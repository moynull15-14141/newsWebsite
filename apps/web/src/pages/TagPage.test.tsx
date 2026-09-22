import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import TagPage from './TagPage';
import { LanguageProvider } from '@/lib/i18n';
import { ApiError } from '@/lib/api';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/tag/breaking-news', search: '' }),
  useParams: () => ({ slug: 'breaking-news' }),
}));

vi.mock('@/components/SeoHead', () => ({ default: () => null }));

type QueryResult = { data: unknown; isLoading: boolean; error: unknown };
let mockTagQuery: () => QueryResult;
let mockArticlesQuery: () => QueryResult;

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => (queryKey[0] === 'tag-detail' ? mockTagQuery() : mockArticlesQuery()),
}));

const tagDetail = {
  id: 'tag-1',
  name: 'Breaking News',
  slug: 'breaking-news',
  translations: [{ language: { id: 'lang-bn', code: 'bn' }, name: 'জরুরি সংবাদ', slug: 'breaking-news' }],
};

const tagArticle = { id: 'a1', title: 'A Breaking Story', slug: 'a-breaking-story', excerpt: 'Dek.', publishedAt: '2026-09-20T06:00:00.000Z' };

function renderTagPage() {
  return renderToStaticMarkup(
    <LanguageProvider>
      <TagPage />
    </LanguageProvider>,
  );
}

describe('TagPage loading state', () => {
  it('shows a skeleton while the tag is loading', () => {
    mockTagQuery = () => ({ data: undefined, isLoading: true, error: null });
    mockArticlesQuery = () => ({ data: undefined, isLoading: true, error: null });
    expect(renderTagPage()).toContain('animate-pulse');
  });
});

describe('TagPage invalid tag', () => {
  it('renders a real 404 when the tag does not exist', () => {
    mockTagQuery = () => ({ data: undefined, isLoading: false, error: new ApiError(404) });
    mockArticlesQuery = () => ({ data: undefined, isLoading: false, error: null });
    expect(renderTagPage()).toContain('404');
  });
});

describe('TagPage error state', () => {
  it('shows a generic error (not a 404) for another failure', () => {
    mockTagQuery = () => ({ data: undefined, isLoading: false, error: new ApiError(500) });
    mockArticlesQuery = () => ({ data: undefined, isLoading: false, error: null });
    const markup = renderTagPage();
    expect(markup).toContain('কিছু ভুল হয়েছে');
    expect(markup).not.toContain('404');
  });
});

describe('TagPage published content', () => {
  it('uses the real localized tag name, never a slug-formatted guess', () => {
    mockTagQuery = () => ({ data: tagDetail, isLoading: false, error: null });
    mockArticlesQuery = () => ({ data: { data: [tagArticle], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false, error: null });

    const markup = renderTagPage();

    // bn is the default site language — must show জরুরি সংবাদ, never "Breaking News" (base) or
    // "breaking news" (slug-formatted, the old bug).
    expect(markup).toContain('জরুরি সংবাদ');
    expect(markup).not.toContain('>Breaking News<');
    expect(markup).toContain('A Breaking Story');
  });

  it('renders a breadcrumb for the tag', () => {
    mockTagQuery = () => ({ data: tagDetail, isLoading: false, error: null });
    mockArticlesQuery = () => ({ data: { data: [tagArticle], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false, error: null });

    const markup = renderTagPage();
    expect(markup).toContain('aria-label="Breadcrumb"');
  });

  it('shows the empty state, never fake articles, for a real tag with zero published stories', () => {
    mockTagQuery = () => ({ data: tagDetail, isLoading: false, error: null });
    mockArticlesQuery = () => ({ data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }, isLoading: false, error: null });

    const markup = renderTagPage();
    expect(markup).toContain('কোনো সংবাদ পাওয়া যায়নি');
    expect(markup).not.toContain('404');
  });
});
