import type { Draft, DraftSection, Placement, StoryArticle } from './types';

/** Test data factories for the homepage builder (kept out of production bundles: only tests import this). */

export const story = (id: string, overrides: Partial<StoryArticle> = {}): StoryArticle => ({
  id,
  title: `Headline ${id}`,
  slug: `headline-${id}`,
  status: 'PUBLISHED',
  publishedAt: '2026-05-01T06:00:00.000Z',
  media: { id: `m-${id}`, publicUrl: `http://localhost/${id}.png` },
  category: { id: 'c1', name: 'Bangladesh', slug: 'bangladesh' },
  author: { id: 'u1', name: 'Admin' },
  ...overrides,
});

export const placement = (id: string, position: number, overrides: Omit<Partial<Placement>, 'article'> & { article?: Partial<StoryArticle> } = {}): Placement => {
  const { article, ...rest } = overrides;
  return { articleId: id, sortOrder: position, eligible: true, article: story(id, article), ...rest };
};

export const section = (key: string, type: string, articleIds: string[] = [], overrides: Partial<DraftSection> = {}): DraftSection => ({
  id: `sec-${key}`,
  key,
  type,
  title: key.charAt(0).toUpperCase() + key.slice(1),
  enabled: true,
  sortOrder: 0,
  maxItems: type === 'HERO' ? 1 : 6,
  layoutType: 'FEATURED_STACK',
  categoryId: null,
  category: null,
  locationId: null,
  updatedAt: '2026-05-01T06:00:00.000Z',
  placements: articleIds.map((id, index) => placement(id, index)),
  ...overrides,
});

export const draft = (overrides: Partial<Draft> = {}, sections?: DraftSection[]): Draft => {
  const list = sections ?? [section('hero', 'HERO', ['h1']), section('latest', 'LATEST', ['a1', 'a2', 'a3']), section('world', 'WORLD', ['w1']), section('business', 'BUSINESS', ['b1', 'b2'])];
  return {
    id: 'draft-1',
    status: 'DRAFT',
    version: 4,
    updatedAt: '2026-05-01T06:00:00.000Z',
    layoutPresets: ['FEATURED_STACK', 'THREE_UP', 'COMPACT_LIST'],
    hasUnpublishedChanges: true,
    publishable: true,
    issues: [],
    sections: list.map((item, index) => ({ ...item, sortOrder: index })),
    ...overrides,
  };
};
