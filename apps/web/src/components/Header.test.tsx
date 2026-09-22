import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import Header from './Header';
import { getHeaderControlLabels } from './header-controls';
import { LanguageProvider } from '@/lib/i18n';
import { buildSearchUrl } from '@/lib/search-url';

let mockPathname = '/';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: mockPathname, search: '' }),
}));

const worldCategory = { id: 'cat-world', name: 'World', slug: 'world', translations: [{ language: { code: 'bn' }, name: 'বিশ্ব' }] };
const bangladeshCategory = { id: 'cat-bd', name: 'Bangladesh', slug: 'bangladesh', translations: [] };

function renderHeader(options: { categories?: unknown[]; pathname?: string } = {}) {
  mockPathname = options.pathname ?? '/';
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (options.categories) client.setQueryData(['nav-categories'], options.categories);
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <Header />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe('Header accessibility', () => {
  it('connects collapsed disclosure buttons to their controlled regions', () => {
    const markup = renderHeader();

    expect(markup).toContain('aria-label="Search"');
    expect(markup).toContain('aria-controls="site-search"');
    expect(markup).toContain('aria-label="Menu"');
    expect(markup).toContain('aria-controls="mobile-navigation"');
    // Default language is bn, so the search field's own label is Bangla — this asserts the
    // aria-label/aria-controls WIRING, not a specific language's text.
    expect(markup).toContain('aria-label="সংবাদ অনুসন্ধান করুন"');
    expect(markup.match(/aria-expanded="false"/g)).toHaveLength(2);
  });

  it('provides action-oriented labels for open disclosures', () => {
    expect(getHeaderControlLabels(true, true)).toEqual({
      search: 'Close search',
      menu: 'Close menu',
    });
  });

  it('renders a Bangla/English language switcher, defaulting to bn as the active language', () => {
    const markup = renderHeader();
    expect(markup).toContain('aria-label="Language"');
    expect(markup).toContain('বাংলা');
    expect(markup).toContain('English');
    // bn is active (the bare/default path) and is not itself a link.
    expect(markup).toContain('aria-current="true"');
  });

  it('links to the English homepage under the /en prefix', () => {
    const markup = renderHeader();
    expect(markup).toContain('href="/en"');
  });
});

describe('Header navigation', () => {
  it('always shows Latest and Bangladesh (the location, not the category) even with no categories loaded', () => {
    const markup = renderHeader({ categories: [] });
    expect(markup).toContain('href="/latest"');
    expect(markup).toContain('href="/bangladesh"');
    // Never the Bangladesh CATEGORY route — Bangladesh in nav means the location page.
    expect(markup).not.toContain('href="/category/bangladesh"');
  });

  it('renders real category data with its localized (bn) name, not a hardcoded label', () => {
    const markup = renderHeader({ categories: [worldCategory] });
    expect(markup).toContain('href="/category/world"');
    expect(markup).toContain('বিশ্ব'); // the translation, not the base English "World"
  });

  it('never lists the Bangladesh category a second time (the fixed location entry already covers it)', () => {
    const markup = renderHeader({ categories: [bangladeshCategory, worldCategory] });
    expect(markup).not.toContain('href="/category/bangladesh"');
    // Desktop nav + mobile nav both render (CSS toggles which is visible), so exactly one /bangladesh
    // link per nav — two total, never three (which would mean the category slipped in a second time).
    const bangladeshHrefCount = (markup.match(/href="\/bangladesh"/g) || []).length;
    expect(bangladeshHrefCount).toBe(2);
  });

  it('marks the current section as the active nav item', () => {
    const markup = renderHeader({ categories: [worldCategory], pathname: '/category/world' });
    const worldLinkMatch = markup.match(/<a href="\/category\/world"[^>]*>বিশ্ব<\/a>/);
    expect(worldLinkMatch?.[0]).toContain('aria-current="page"');
    expect(worldLinkMatch?.[0]).toContain('text-primary-600');
  });

  it('does not mark an inactive section as current', () => {
    const markup = renderHeader({ categories: [worldCategory], pathname: '/latest' });
    const worldLinkMatch = markup.match(/<a href="\/category\/world"[^>]*>বিশ্ব<\/a>/);
    expect(worldLinkMatch?.[0]).not.toContain('aria-current');
  });

  it('gives the nav landmarks an accessible name', () => {
    const markup = renderHeader({ categories: [] });
    expect(markup).toContain('aria-label="প্রধান মেনু"');
  });

  it('wraps the search box in a real <form> (Enter submits, not just the button)', () => {
    const markup = renderHeader();
    expect(markup).toContain('id="site-search"');
    expect(markup).toContain('<form');
    expect(markup).toContain('type="submit"');
  });
});

describe('buildSearchUrl (Header search submission)', () => {
  it('builds the /search page URL with the trimmed, encoded query', () => {
    expect(buildSearchUrl('/search', '  bangladesh flood  ')).toBe('/search?q=bangladesh%20flood');
  });

  it('encodes Bangla text correctly', () => {
    expect(buildSearchUrl('/search', 'বাংলাদেশ')).toBe(`/search?q=${encodeURIComponent('বাংলাদেশ')}`);
  });

  it('respects the language-prefixed search page path', () => {
    expect(buildSearchUrl('/en/search', 'world')).toBe('/en/search?q=world');
  });

  it('returns null for an empty query, so the caller never navigates on a meaningless submission', () => {
    expect(buildSearchUrl('/search', '')).toBeNull();
  });

  it('returns null for a whitespace-only query', () => {
    expect(buildSearchUrl('/search', '   ')).toBeNull();
  });

  it('encodes special/URL-unsafe characters in the query', () => {
    expect(buildSearchUrl('/search', 'a&b=c')).toBe('/search?q=a%26b%3Dc');
  });
});
