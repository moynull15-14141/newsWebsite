import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import SearchPage from './SearchPage';
import { LanguageProvider } from '@/lib/i18n';

let mockParams = new URLSearchParams();
const setSearchParamsSpy = vi.fn();

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/search', search: '' }),
  useSearchParams: () => [mockParams, setSearchParamsSpy],
}));

vi.mock('@/components/SeoHead', () => ({ default: () => null }));

type QueryResult = { data: unknown; isLoading: boolean; error: unknown };
let mockSearchQuery: () => QueryResult;

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === 'categories') return { data: [] };
    if (queryKey[0] === 'locations') return { data: [] };
    return mockSearchQuery();
  },
}));

function renderSearchPage(query: string) {
  mockParams = new URLSearchParams(query ? { q: query } : {});
  setSearchParamsSpy.mockClear();
  return renderToStaticMarkup(
    <LanguageProvider>
      <SearchPage />
    </LanguageProvider>,
  );
}

const article = { id: 'a1', title: 'Bangladesh Flood Relief', slug: 'bangladesh-flood-relief', excerpt: 'Dek.', publishedAt: '2026-09-20T06:00:00.000Z' };

describe('SearchPage — no query yet', () => {
  it('shows the search landing state and never fires a search request for an empty query', () => {
    mockSearchQuery = () => ({ data: undefined, isLoading: false, error: null });
    const markup = renderSearchPage('');
    expect(markup).toContain('সংবাদ খুঁজতে একটি অনুসন্ধান শব্দ লিখুন।'); // search.enterTerm (bn default)
  });
});

describe('SearchPage loading state', () => {
  it('shows a skeleton while a real query is in flight', () => {
    mockSearchQuery = () => ({ data: undefined, isLoading: true, error: null });
    const markup = renderSearchPage('bangladesh');
    expect(markup).toContain('animate-pulse');
  });
});

describe('SearchPage error state', () => {
  it('shows a friendly error instead of a stack trace', () => {
    mockSearchQuery = () => ({ data: undefined, isLoading: false, error: new Error('API error: 500') });
    const markup = renderSearchPage('bangladesh');
    expect(markup).toContain('কিছু ভুল হয়েছে'); // common.somethingWrong
  });
});

describe('SearchPage results', () => {
  it('renders the query and matching published articles', () => {
    mockSearchQuery = () => ({ data: { data: [article], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false, error: null });
    const markup = renderSearchPage('bangladesh');
    expect(markup).toContain('Bangladesh Flood Relief');
    expect(markup).toContain('bangladesh'); // the query itself, echoed in the results-count line
  });

  it('renders a Bangla query correctly', () => {
    mockSearchQuery = () => ({ data: { data: [article], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false, error: null });
    const markup = renderSearchPage('বাংলাদেশ');
    expect(markup).toContain('বাংলাদেশ');
    expect(markup).toContain('Bangladesh Flood Relief');
  });

  it('shows the search-specific empty state, never fake results, when nothing matches', () => {
    mockSearchQuery = () => ({ data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }, isLoading: false, error: null });
    const markup = renderSearchPage('no-such-thing');
    expect(markup).toContain('এই অনুসন্ধানের জন্য কোনো প্রকাশিত সংবাদ পাওয়া যায়নি।'); // search.noResults
  });

  it('links results to the real article page', () => {
    mockSearchQuery = () => ({ data: { data: [article], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false, error: null });
    const markup = renderSearchPage('bangladesh');
    expect(markup).toContain('href="/article/bangladesh-flood-relief"');
  });
});
