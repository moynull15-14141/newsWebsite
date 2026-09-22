import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import LocationPage from './LocationPage';
import { LanguageProvider } from '@/lib/i18n';
import { ApiError } from '@/lib/api';

let mockPathname = '/district/barisal';
let mockParamSlug = 'barisal';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: mockPathname, search: '' }),
  useParams: () => ({ slug: mockParamSlug }),
}));

vi.mock('@/components/SeoHead', () => ({ default: () => null }));

type QueryResult = { data: unknown; isLoading: boolean; error: unknown };
let mockLocationQuery: () => QueryResult;
let mockArticlesQuery: () => QueryResult;

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === 'location-detail') return mockLocationQuery();
    if (queryKey[0] === 'location') return mockArticlesQuery();
    return { data: undefined, isLoading: false, error: null }; // locations-browser widget, not under test here
  },
}));

const bangladesh = { id: 'loc-bd', name: 'Bangladesh', slug: 'bangladesh', type: 'COUNTRY', translations: [] };
const barisalDivision = { id: 'loc-div', name: 'Barisal Division', slug: 'barisal-division', type: 'DIVISION', parent: bangladesh, translations: [] };
const barisalDistrict = {
  id: 'loc-dist',
  name: 'Barisal',
  slug: 'barisal',
  type: 'DISTRICT',
  parent: barisalDivision,
  translations: [{ language: { id: 'lang-bn', code: 'bn' }, name: 'বরিশাল' }],
};

const article = { id: 'a1', title: 'A Barisal Story', slug: 'a-barisal-story', excerpt: 'Dek.', publishedAt: '2026-09-20T06:00:00.000Z' };

function renderLocationPage(pathname: string, slug: string) {
  mockPathname = pathname;
  mockParamSlug = slug;
  return renderToStaticMarkup(
    <LanguageProvider>
      <LocationPage />
    </LanguageProvider>,
  );
}

describe('LocationPage loading state', () => {
  it('shows a skeleton while the location is loading', () => {
    mockLocationQuery = () => ({ data: undefined, isLoading: true, error: null });
    mockArticlesQuery = () => ({ data: undefined, isLoading: true, error: null });
    expect(renderLocationPage('/district/barisal', 'barisal')).toContain('animate-pulse');
  });
});

describe('LocationPage invalid location', () => {
  it('renders a real 404 for an unknown location slug', () => {
    mockLocationQuery = () => ({ data: undefined, isLoading: false, error: new ApiError(404) });
    mockArticlesQuery = () => ({ data: undefined, isLoading: false, error: null });
    expect(renderLocationPage('/location/nowhere', 'nowhere')).toContain('404');
  });
});

describe('LocationPage district hierarchy', () => {
  it('shows the real localized district name and the full Bangladesh > Division > District breadcrumb', () => {
    mockLocationQuery = () => ({ data: barisalDistrict, isLoading: false, error: null });
    mockArticlesQuery = () => ({ data: { data: [article], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false, error: null });

    const markup = renderLocationPage('/district/barisal', 'barisal');

    expect(markup).toContain('বরিশাল'); // localized district name (bn default), not "Barisal"
    expect(markup).toContain('href="/bangladesh"');
    expect(markup).toContain('href="/division/barisal-division"');
    expect(markup).toContain('Barisal Division');
    expect(markup).toContain('A Barisal Story');
  });
});

describe('LocationPage division hierarchy', () => {
  it('shows Bangladesh > Division breadcrumb (two levels, not three)', () => {
    mockLocationQuery = () => ({ data: barisalDivision, isLoading: false, error: null });
    mockArticlesQuery = () => ({ data: { data: [article], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false, error: null });

    const markup = renderLocationPage('/division/barisal-division', 'barisal-division');

    expect(markup).toContain('href="/bangladesh"');
    expect(markup).toContain('Barisal Division');
  });
});

describe('LocationPage Bangladesh (country) page', () => {
  it('renders with no parent breadcrumb segment (Bangladesh is the root)', () => {
    mockLocationQuery = () => ({ data: bangladesh, isLoading: false, error: null });
    mockArticlesQuery = () => ({ data: { data: [article], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false, error: null });

    const markup = renderLocationPage('/bangladesh', '');

    expect(markup).toContain('Bangladesh');
    expect(markup).toContain('A Barisal Story');
  });

  it('shows the empty state, never fake articles, when Bangladesh has zero published stories', () => {
    mockLocationQuery = () => ({ data: bangladesh, isLoading: false, error: null });
    mockArticlesQuery = () => ({ data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }, isLoading: false, error: null });

    const markup = renderLocationPage('/bangladesh', '');
    expect(markup).toContain('কোনো সংবাদ পাওয়া যায়নি');
  });
});
