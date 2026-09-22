import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import CategoryPage from './CategoryPage';
import { LanguageProvider } from '@/lib/i18n';
import { ApiError } from '@/lib/api';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/category/world', search: '' }),
  useParams: () => ({ slug: 'world' }),
}));

vi.mock('@/components/AdSlot', () => ({ default: () => null }));
vi.mock('@/components/SeoHead', () => ({ default: () => null }));

type QueryResult = { data: unknown; isLoading: boolean; error: unknown };
let mockCategoryQuery: () => QueryResult;
let mockArticlesQuery: () => QueryResult;

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => (queryKey[0] === 'category-detail' ? mockCategoryQuery() : mockArticlesQuery()),
}));

const worldCategory = {
  id: 'cat-world',
  name: 'World',
  slug: 'world',
  description: null,
  parent: null,
  translations: [{ language: { id: 'lang-bn', code: 'bn' }, name: 'বিশ্ব', slug: 'world', description: 'বিশ্ব সংবাদ' }],
};

const worldArticle = { id: 'a1', title: 'A World Story', slug: 'a-world-story', excerpt: 'Dek text.', publishedAt: '2026-09-20T06:00:00.000Z' };

function renderCategoryPage() {
  return renderToStaticMarkup(
    <LanguageProvider>
      <CategoryPage />
    </LanguageProvider>,
  );
}

describe('CategoryPage loading state', () => {
  it('shows a skeleton while the category is loading', () => {
    mockCategoryQuery = () => ({ data: undefined, isLoading: true, error: null });
    mockArticlesQuery = () => ({ data: undefined, isLoading: true, error: null });

    const markup = renderCategoryPage();
    expect(markup).toContain('animate-pulse');
  });
});

describe('CategoryPage invalid category', () => {
  it('renders the real 404 page when the category genuinely does not exist', () => {
    mockCategoryQuery = () => ({ data: undefined, isLoading: false, error: new ApiError(404) });
    mockArticlesQuery = () => ({ data: undefined, isLoading: false, error: null });

    const markup = renderCategoryPage();
    expect(markup).toContain('404');
  });
});

describe('CategoryPage error state', () => {
  it('shows a generic error (not a 404) when the category call fails for another reason', () => {
    mockCategoryQuery = () => ({ data: undefined, isLoading: false, error: new ApiError(500) });
    mockArticlesQuery = () => ({ data: undefined, isLoading: false, error: null });

    const markup = renderCategoryPage();
    expect(markup).toContain('কিছু ভুল হয়েছে'); // common.somethingWrong (bn default)
    expect(markup).not.toContain('404');
  });
});

describe('CategoryPage published content', () => {
  it('uses the real localized category name/description, not a slug-derived guess', () => {
    mockCategoryQuery = () => ({ data: worldCategory, isLoading: false, error: null });
    mockArticlesQuery = () => ({ data: { data: [worldArticle], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false, error: null });

    const markup = renderCategoryPage();

    // Default site language is bn, so the translated name/description must appear — never "World" (the
    // slug-munged guess the old implementation would have shown).
    expect(markup).toContain('বিশ্ব');
    expect(markup).toContain('বিশ্ব সংবাদ');
    expect(markup).toContain('A World Story');
  });

  it('renders a breadcrumb with the parent category when one exists', () => {
    mockCategoryQuery = () => ({
      data: { ...worldCategory, parent: { id: 'cat-news', name: 'News', slug: 'news' } },
      isLoading: false,
      error: null,
    });
    mockArticlesQuery = () => ({ data: { data: [worldArticle], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false, error: null });

    const markup = renderCategoryPage();
    expect(markup).toContain('aria-label="Breadcrumb"');
    expect(markup).toContain('href="/category/news"');
  });

  it('shows the empty-section notice instead of fake articles when there are none', () => {
    mockCategoryQuery = () => ({ data: worldCategory, isLoading: false, error: null });
    mockArticlesQuery = () => ({ data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }, isLoading: false, error: null });

    const markup = renderCategoryPage();
    expect(markup).toContain('কোনো সংবাদ পাওয়া যায়নি'); // common.noArticlesFound (bn default)
    expect(markup).not.toContain('A World Story');
  });
});
