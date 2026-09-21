import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ArticleCard, { ArticleCardSkeleton, type ArticleCardVariant } from './ArticleCard';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
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
  return renderToStaticMarkup(
    <ArticleCard article={{ ...article, imageUrl }} variant="standard" />,
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

  it.each(variants)('renders a meaningful %s skeleton', (variant) => {
    const markup = renderToStaticMarkup(<ArticleCardSkeleton variant={variant} />);

    expect(markup).toContain(`data-variant="${variant}"`);
    expect(markup).toContain('animate-pulse');
  });
});
