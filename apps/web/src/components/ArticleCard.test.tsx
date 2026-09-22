import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ArticleCard, { ArticleCardSkeleton, type ArticleCardVariant } from './ArticleCard';
import { LanguageProvider } from '@/lib/i18n';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/', search: '' }),
}));

const article = {
  id: 'article-1',
  slug: 'design-foundation',
  title: 'Design foundation',
  excerpt: 'A concise article summary.',
  publishedAt: '2026-09-21T08:00:00.000Z',
  author: { id: 'author-1', name: 'News Reporter' },
  category: { id: 'category-1', name: 'Bangladesh', slug: 'bangladesh' },
};

const variants: ArticleCardVariant[] = [
  'featured',
  'large',
  'horizontal',
  'compact',
  'image-top',
  'text-only',
  'video',
  'opinion',
  'standard',
];

function renderCard(imageUrl?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <ArticleCard article={{ ...article, imageUrl }} variant="standard" />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe('ArticleCard media behavior', () => {
  it('renders the shared placeholder when an image is missing', () => {
    const markup = renderCard();

    expect(markup).toContain('aspect-[4/3]');
    expect(markup).not.toContain('pb-[75%]');
    expect(markup).not.toContain('<img');
  });

  it('renders a lazy image when media is present', () => {
    const markup = renderCard('/media/story.jpg');

    expect(markup).toContain('<img');
    expect(markup).toContain('src="/media/story.jpg"');
    expect(markup).toContain('loading="lazy"');
  });

  it('links to the article under the current (bare, default-language) path', () => {
    const markup = renderCard();
    expect(markup).toContain('href="/article/design-foundation"');
  });

  it.each(variants)('renders a meaningful %s skeleton', (variant) => {
    const markup = renderToStaticMarkup(<ArticleCardSkeleton variant={variant} />);

    expect(markup).toContain(`data-variant="${variant}"`);
    expect(markup).toContain('animate-pulse');
  });
});
