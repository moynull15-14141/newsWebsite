import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import Header from './Header';
import { getHeaderControlLabels } from './header-controls';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

function renderHeader() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <Header />
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
    expect(markup).toContain('aria-label="Search articles"');
    expect(markup.match(/aria-expanded="false"/g)).toHaveLength(2);
  });

  it('provides action-oriented labels for open disclosures', () => {
    expect(getHeaderControlLabels(true, true)).toEqual({
      search: 'Close search',
      menu: 'Close menu',
    });
  });

});
