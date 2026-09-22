import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import Header from './Header';
import { getHeaderControlLabels } from './header-controls';
import { LanguageProvider } from '@/lib/i18n';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/', search: '' }),
}));

function renderHeader() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
