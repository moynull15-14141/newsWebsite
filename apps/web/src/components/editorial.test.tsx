import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BriefList, LeadStory, RankedList, SectionBody, StoryRow } from './editorial';

vi.mock('react-router-dom', () => ({ Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => <a href={to} {...props}>{children}</a> }));
const article = { id: 'one', slug: 'one', title: 'Editorial headline', excerpt: 'Summary', media: { id: 'media', publicUrl: '/story.jpg' } };

describe('editorial story presentations', () => {
  it('renders the lead as a linked story using API media', () => {
    const markup = renderToStaticMarkup(<LeadStory article={article} />);
    expect(markup).toContain('href="/article/one"');
    expect(markup).toContain('src="/story.jpg"');
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

  it('renders a lone story as a single row whatever the preset, and nothing for no stories', () => {
    for (const layout of ['FEATURED_STACK', 'THREE_UP', 'COMPACT_LIST'] as const) {
      expect(renderToStaticMarkup(<SectionBody articles={[stories[0]]} layout={layout} />).match(/<article /g)).toHaveLength(1);
      expect(renderToStaticMarkup(<SectionBody articles={[]} layout={layout} />)).toBe('');
    }
  });
});
