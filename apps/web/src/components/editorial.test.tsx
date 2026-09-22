import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup as renderToStaticMarkupBase } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BriefList, LeadStory, RankedList, SectionBody, StoryRow } from './editorial';
import { LanguageProvider } from '@/lib/i18n';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => ({ pathname: '/', search: '' }),
}));

/** Every editorial component reads the active language via context, so every render needs both providers. */
function renderToStaticMarkup(node: React.ReactElement): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkupBase(
    <QueryClientProvider client={client}>
      <LanguageProvider>{node}</LanguageProvider>
    </QueryClientProvider>,
  );
}

const article = { id: 'one', slug: 'one', title: 'Editorial headline', excerpt: 'Summary', media: { id: 'media', publicUrl: '/story.jpg' } };

describe('editorial story presentations', () => {
  it('renders the lead as a linked story using API media', () => {
    const markup = renderToStaticMarkup(<LeadStory article={article} />);
    expect(markup).toContain('href="/article/one"');
    expect(markup).toContain('src="/story.jpg"');
  });

  it('falls back to the shared placeholder, never a broken <img>, when the lead story has no image', () => {
    const noImage = { id: 'no-img', slug: 'no-img', title: 'Story with no photo', excerpt: 'Summary' };
    const markup = renderToStaticMarkup(<LeadStory article={noImage} />);

    expect(markup).not.toContain('<img');
    expect(markup).toContain('Story with no photo');
  });

  it('renders compact briefs and empty lists gracefully', () => {
    expect(renderToStaticMarkup(<BriefList title="Latest" articles={[article]} />)).toContain('Editorial headline');
    expect(renderToStaticMarkup(<BriefList title="Latest" articles={[]} />)).toBe('');
  });

  it('renders an ordered ranked list', () => {
    const markup = renderToStaticMarkup(<RankedList title="Most read" articles={[article, { ...article, id: 'two', slug: 'two' }]} />);
    expect(markup).toContain('<ol>');
    expect(markup).toContain('>1<');
    expect(markup).toContain('>2<');
  });

  it('renders compact story rows without nested links', () => {
    const markup = renderToStaticMarkup(<StoryRow article={article} compact />);
    expect(markup.match(/<a /g)).toHaveLength(1);
  });
});

describe('homepage section layout presets', () => {
  const stories = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, slug: id, title: `Headline ${id}` }));

  it('FEATURED_STACK: one standard lead plus a compact stack of up to three rows', () => {
    const markup = renderToStaticMarkup(<SectionBody articles={stories} layout="FEATURED_STACK" />);
    expect(markup).toContain('Headline a');
    expect(markup).toContain('Headline d');
    expect(markup).not.toContain('Headline e');
    expect(markup).toContain('md:divide-x'); // two-column lead + stack composition
  });

  it('THREE_UP: at most three equal standard stories in a grid', () => {
    const markup = renderToStaticMarkup(<SectionBody articles={stories} layout="THREE_UP" />);
    expect(markup).toContain('lg:grid-cols-3');
    expect(markup).toContain('Headline c');
    expect(markup).not.toContain('Headline d');
  });

  it('COMPACT_LIST: every story as a compact row', () => {
    const markup = renderToStaticMarkup(<SectionBody articles={stories} layout="COMPACT_LIST" />);
    expect(markup.match(/<article /g)).toHaveLength(5);
    expect(markup).not.toContain('grid-cols-3');
  });

  it('TWO_UP and FOUR_UP: capped equal columns', () => {
    const two = renderToStaticMarkup(<SectionBody articles={stories} layout="TWO_UP" />);
    expect(two).toContain('sm:grid-cols-2');
    expect(two).toContain('Headline b');
    expect(two).not.toContain('Headline c');

    const four = renderToStaticMarkup(<SectionBody articles={stories} layout="FOUR_UP" />);
    expect(four).toContain('lg:grid-cols-4');
    expect(four).toContain('Headline d');
    expect(four).not.toContain('Headline e');
  });

  it('GRID: every story as an image-led card', () => {
    const markup = renderToStaticMarkup(<SectionBody articles={stories} layout="GRID" />);
    expect(markup).toContain('lg:grid-cols-3');
    expect(markup.match(/<article /g)).toHaveLength(5); // not capped like THREE_UP
    expect(markup).toContain('Headline e');
  });

  it('HORIZONTAL_LIST: every story as a horizontal card', () => {
    const markup = renderToStaticMarkup(<SectionBody articles={stories} layout="HORIZONTAL_LIST" />);
    expect(markup).toContain('divide-y');
    expect(markup.match(/<article /g)).toHaveLength(5);
  });

  it('TEXT_LED: headlines without any imagery', () => {
    const withMedia = stories.map((story) => ({ ...story, media: { id: 'm', publicUrl: '/story.jpg' } }));
    const markup = renderToStaticMarkup(<SectionBody articles={withMedia} layout="TEXT_LED" />);
    expect(markup).toContain('Headline a');
    expect(markup).not.toContain('<img');
    expect(markup).not.toContain('/story.jpg');
  });

  it('IMAGE_LED: a lead story followed by image-top cards', () => {
    const markup = renderToStaticMarkup(<SectionBody articles={stories} layout="IMAGE_LED" />);
    expect(markup).toContain('<h2'); // LeadStory heading level
    expect(markup).toContain('Headline a');
    expect(markup).toContain('Headline e'); // the rest are not capped
  });

  it('renders a lone story as a single row whatever the preset, and nothing for no stories', () => {
    const layouts = ['FEATURED_STACK', 'TWO_UP', 'THREE_UP', 'FOUR_UP', 'GRID', 'COMPACT_LIST', 'HORIZONTAL_LIST', 'IMAGE_LED', 'TEXT_LED'] as const;
    for (const layout of layouts) {
      expect(renderToStaticMarkup(<SectionBody articles={[stories[0]]} layout={layout} />).match(/<article /g)).toHaveLength(1);
      expect(renderToStaticMarkup(<SectionBody articles={[]} layout={layout} />)).toBe('');
    }
  });

  it('falls back to FEATURED_STACK for an unknown stored layout', () => {
    const markup = renderToStaticMarkup(<SectionBody articles={stories} layout={'MOSAIC_XL' as never} />);
    expect(markup).toContain('md:divide-x');
  });
});

describe('homepage section card presentation', () => {
  const stories = ['a', 'b', 'c', 'd'].map((id) => ({ id, slug: id, title: `Headline ${id}`, excerpt: `Summary ${id}` }));

  it('an explicit card variant overrides the layout composition', () => {
    const auto = renderToStaticMarkup(<SectionBody articles={stories} layout="FEATURED_STACK" cardVariant="AUTO" />);
    expect(auto).toContain('md:divide-x');

    const opinion = renderToStaticMarkup(<SectionBody articles={stories} layout="FEATURED_STACK" cardVariant="opinion" />);
    expect(opinion).toContain('Opinion'); // the opinion NewsCard variant's own badge
    expect(opinion).not.toContain('md:divide-x');
  });

  it('keeps the layout container while forcing the card variant', () => {
    const markup = renderToStaticMarkup(<SectionBody articles={stories} layout="THREE_UP" cardVariant="compact" />);
    expect(markup).toContain('lg:grid-cols-3'); // container from the layout
    expect(markup).toContain('Headline c');
    expect(markup).not.toContain('Headline d'); // still capped at three
  });

  it('renders a forced variant even for a single story', () => {
    const markup = renderToStaticMarkup(<SectionBody articles={[stories[0]]} layout="GRID" cardVariant="video" />);
    expect(markup).toContain('Headline a');
    expect(markup).toContain('<svg'); // the video variant's play badge
  });

  it('still renders nothing when there are no stories', () => {
    expect(renderToStaticMarkup(<SectionBody articles={[]} layout="GRID" cardVariant="image-top" />)).toBe('');
  });
});
