import { describe, expect, it } from 'vitest';
import { selectHomepageSections, selectHomepageStories, uniqueArticles } from './editorial-selection';

const story = (id: string) => ({ id, slug: id, title: `Story ${id}` });

describe('homepage section selection', () => {
  it('uses the API sectionList: real titles, layout presets and category links', () => {
    const sections = selectHomepageSections({
      sections: { bangladesh: [story('legacy')] },
      sectionList: [
        { key: 'bangladesh', type: 'BANGLADESH', title: 'বাংলাদেশ', layout: 'THREE_UP', category: { id: 'c1', name: 'Bangladesh', slug: 'bangladesh-news' }, articles: [story('a'), story('b')] },
        { key: 'custom-1a2b3c4d', type: 'CUSTOM', title: 'Special report', layout: 'COMPACT_LIST', category: null, articles: [story('c')] },
        { key: 'latest', type: 'LATEST', title: 'সর্বশেষ', layout: 'FEATURED_STACK', category: null, articles: [story('d')] },
        { key: 'sports', type: 'SPORTS', title: 'খেলা', layout: 'FEATURED_STACK', category: null, articles: [story('e')] },
      ],
    });
    expect(sections.map((s) => [s.key, s.title, s.layout, s.href])).toEqual([
      ['bangladesh', 'বাংলাদেশ', 'THREE_UP', '/category/bangladesh-news'],
      ['custom-1a2b3c4d', 'Special report', 'COMPACT_LIST', undefined],
      ['latest', 'সর্বশেষ', 'FEATURED_STACK', undefined],
      ['sports', 'খেলা', 'FEATURED_STACK', '/category/sports'],
    ]);
    expect(sections.flatMap((s) => s.articles.map((a) => a.id))).not.toContain('legacy');
  });

  it('skips sections without articles and keeps several custom sections apart', () => {
    const sections = selectHomepageSections({
      sectionList: [
        { key: 'custom-one', type: 'CUSTOM', title: 'One', layout: 'THREE_UP', articles: [story('a')] },
        { key: 'custom-two', type: 'CUSTOM', title: 'Two', layout: 'THREE_UP', articles: [] },
        { key: 'custom-three', type: 'CUSTOM', title: 'Three', layout: 'THREE_UP', articles: [story('b')] },
      ],
    });
    expect(sections.map((s) => s.key)).toEqual(['custom-one', 'custom-three']);
  });

  it('renders nothing extra when the API sends an empty sectionList (it is authoritative)', () => {
    expect(selectHomepageSections({ sections: { world: [story('a')] }, sectionList: [] })).toEqual([]);
  });

  it('degrades to the legacy sections map with the original alternating layout for older API responses', () => {
    const sections = selectHomepageSections({ sections: { latest: [story('a')], bangladesh: [story('b')], world: [story('c')], empty: [], custom: [story('d')] } });
    expect(sections.map((s) => [s.key, s.title, s.layout, s.href])).toEqual([
      ['latest', 'latest', 'FEATURED_STACK', undefined],
      ['bangladesh', 'Bangladesh', 'THREE_UP', '/category/bangladesh'],
      ['world', 'World', 'FEATURED_STACK', '/category/world'],
      ['custom', 'custom', 'THREE_UP', undefined],
    ]);
  });

  it('handles missing data', () => {
    expect(selectHomepageSections(undefined)).toEqual([]);
    expect(selectHomepageSections({})).toEqual([]);
  });
});

describe('editorial homepage selection', () => {
  it('prefers the curated hero over the latest story', () => {
    const result = selectHomepageStories({ hero: story('curated'), latest: [story('latest')] });
    expect(result.hero?.id).toBe('curated');
  });

  it('falls back through latest, trending and most-read data', () => {
    expect(selectHomepageStories({ latest: [story('latest')] }).hero?.id).toBe('latest');
    expect(selectHomepageStories({ trending: [story('trending')] }).hero?.id).toBe('trending');
    expect(selectHomepageStories({ mostRead: [story('read')] }).hero?.id).toBe('read');
  });

  it('does not repeat the lead story in surrounding selections', () => {
    const repeated = story('lead');
    const result = selectHomepageStories({ hero: repeated, latest: [repeated, story('two')], trending: [repeated, story('three')], mostRead: [repeated, story('four')] });
    const surrounding = [...result.briefs, ...result.secondary, ...result.ranked];
    expect(surrounding.some((article) => article.id === 'lead')).toBe(false);
    expect(new Set(surrounding.map((article) => article.id)).size).toBe(surrounding.length);
  });

  it('keeps only the first occurrence of an article', () => {
    expect(uniqueArticles([story('one'), story('one'), story('two')]).map((item) => item.id)).toEqual(['one', 'two']);
  });
});
