import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import Breadcrumbs from './Breadcrumbs';
import { LanguageProvider } from '@/lib/i18n';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/', search: '' }),
}));

function render(items: Parameters<typeof Breadcrumbs>[0]['items']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <Breadcrumbs items={items} />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe('Breadcrumbs', () => {
  it('always starts at Home', () => {
    const markup = render([{ label: 'World' }]);
    expect(markup).toContain('href="/"');
  });

  it('links every item except the last (current page)', () => {
    const markup = render([{ label: 'Bangladesh', href: '/bangladesh' }, { label: 'Barisal Division', href: '/division/barisal' }, { label: 'Barisal' }]);
    expect(markup).toContain('href="/bangladesh"');
    expect(markup).toContain('href="/division/barisal"');
    // The current page is plain text with aria-current, not a link: Home + 2 hrefed items = 3 anchors.
    expect(markup).toContain('aria-current="page"');
    expect((markup.match(/<a /g) || []).length).toBe(3);
  });

  it('renders a single-item trail for a top-level page', () => {
    const markup = render([{ label: 'World' }]);
    expect(markup).toContain('World');
    expect(markup).toContain('aria-current="page"');
  });
});
