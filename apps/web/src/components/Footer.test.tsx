import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import Footer from './Footer';
import { LanguageProvider } from '@/lib/i18n';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/', search: '' }),
}));

const worldCategory = { id: 'cat-world', name: 'World', slug: 'world', translations: [{ language: { code: 'bn' }, name: 'বিশ্ব' }] };
const bangladeshCategory = { id: 'cat-bd', name: 'Bangladesh', slug: 'bangladesh', translations: [] };

function renderFooter(categories: unknown[] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['nav-categories'], categories);
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <Footer />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe('Footer quick links', () => {
  it('always includes Latest and Bangladesh (the location) even with no categories loaded', () => {
    const markup = renderFooter([]);
    expect(markup).toContain('href="/latest"');
    expect(markup).toContain('href="/bangladesh"');
  });

  it('renders real category data with its localized name, never the Bangladesh category a second time', () => {
    const markup = renderFooter([bangladeshCategory, worldCategory]);
    expect(markup).toContain('href="/category/world"');
    expect(markup).toContain('বিশ্ব');
    expect(markup).not.toContain('href="/category/bangladesh"');
  });
});
