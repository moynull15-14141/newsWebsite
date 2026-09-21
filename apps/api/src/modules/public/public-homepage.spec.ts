import { FakeHomepagePrisma } from '../homepage/homepage-prisma.testkit';
import { serializeHomepageSections } from '../homepage/homepage.serializer';
import { PublicService } from './public.service';

const PAST = new Date('2026-01-01T00:00:00Z');
const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

function setup() {
  const db = new FakeHomepagePrisma();
  db.seedConfigurations();
  ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].forEach((id) => db.seedArticle({ id, status: 'PUBLISHED', publishedAt: PAST }));
  db.state.categories.push({ id: 'cat-bd', name: 'Bangladesh', slug: 'bangladesh' });

  const trending = { getTrending: jest.fn().mockResolvedValue([{ id: 'trending-algo' }]) };
  const mostRead = { getMostRead: jest.fn().mockResolvedValue([{ id: 'most-read-algo' }]) };
  const breaking = { getActiveBreakingNews: jest.fn().mockResolvedValue([{ id: 'breaking-algo' }]) };
  const service = new PublicService(db as any, {} as any, trending as any, mostRead as any, breaking as any);

  const active = (section: Parameters<FakeHomepagePrisma['seedSection']>[1]) => db.seedSection('cfg-active', section);
  const draft = (section: Parameters<FakeHomepagePrisma['seedSection']>[1]) => db.seedSection('cfg-draft', section);
  return { db, service, trending, mostRead, breaking, active, draft };
}

const ids = (articles: any[]) => articles.map((article) => article.id);

describe('PublicService.getHomepageData (configured homepage)', () => {
  it('reads only the ACTIVE configuration, inside a repeatable-read snapshot', async () => {
    const { db, service, active, draft } = setup();
    active({ key: 'hero', type: 'HERO', title: 'Live hero', maxItems: 1, articleIds: ['a1'] });
    draft({ key: 'hero', type: 'HERO', title: 'Draft hero', maxItems: 1, articleIds: ['a2'] });

    const data: any = await service.getHomepageData();

    expect(data.hero.id).toBe('a1');
    expect(db.isolationLevels).toContain('RepeatableRead');
  });

  it('ignores the draft entirely: every draft difference is invisible', async () => {
    const { service, active, draft } = setup();
    active({ key: 'hero', type: 'HERO', title: 'Live hero', maxItems: 1, articleIds: ['a1'] });
    active({ key: 'latest', type: 'LATEST', title: 'Live latest', maxItems: 3, articleIds: ['a1', 'a2'] });
    draft({ key: 'hero', type: 'HERO', title: 'Draft hero', maxItems: 1, articleIds: ['a5'] });
    draft({ key: 'latest', type: 'LATEST', title: 'Draft latest', maxItems: 3, layoutType: 'COMPACT_LIST', articleIds: ['a6', 'a5'] });
    draft({ key: 'sports', type: 'SPORTS', title: 'Draft only', maxItems: 3, articleIds: ['a4'] });

    const data: any = await service.getHomepageData();

    expect(data.hero.id).toBe('a1');
    expect(ids(data.latest)).toEqual(['a1', 'a2']);
    expect(data.sectionList.map((s: any) => s.key)).toEqual(['latest']);
    expect(data.sectionList[0]).toMatchObject({ title: 'Live latest', layout: 'FEATURED_STACK' });
    expect(data.sections.sports).toBeUndefined();
  });

  it('serves a curated hero, curated latest and configured sections in order', async () => {
    const { service, active } = setup();
    active({ key: 'hero', type: 'HERO', title: 'Top', maxItems: 1, sortOrder: 0, articleIds: ['a3'] });
    active({ key: 'latest', type: 'LATEST', title: 'Latest', maxItems: 4, sortOrder: 1, articleIds: ['a2', 'a1', 'a4'] });
    active({ key: 'world', type: 'WORLD', title: 'World', maxItems: 4, sortOrder: 3, articleIds: ['a6', 'a5'] });
    active({ key: 'bangladesh', type: 'BANGLADESH', title: 'Bangladesh', maxItems: 4, sortOrder: 2, articleIds: ['a4', 'a3'] });

    const data: any = await service.getHomepageData();

    expect(data.hero.id).toBe('a3');
    expect(ids(data.latest)).toEqual(['a2', 'a1', 'a4']); // placement order, not publishedAt order
    expect(data.sectionList.map((s: any) => s.key)).toEqual(['latest', 'bangladesh', 'world']); // section order
    expect(ids(data.sectionList[1].articles)).toEqual(['a4', 'a3']);
    expect(ids(data.sections.world)).toEqual(['a6', 'a5']);
  });

  it('exposes the section metadata contract: key, type, title, layout preset and category', async () => {
    const { service, active } = setup();
    active({ key: 'bangladesh', type: 'BANGLADESH', title: 'বাংলাদেশ', maxItems: 4, layoutType: 'THREE_UP', categoryId: 'cat-bd', articleIds: ['a1', 'a2'] });

    const data: any = await service.getHomepageData();

    expect(Object.keys(data.sectionList[0]).sort()).toEqual(['articles', 'category', 'key', 'layout', 'title', 'type']);
    expect(data.sectionList[0]).toMatchObject({
      key: 'bangladesh',
      type: 'BANGLADESH',
      title: 'বাংলাদেশ',
      layout: 'THREE_UP',
      category: { id: 'cat-bd', name: 'Bangladesh', slug: 'bangladesh' },
    });
    // No internal identifiers leak.
    expect(data.sectionList[0]).not.toHaveProperty('id');
    expect(data.sectionList[0]).not.toHaveProperty('configurationId');
    expect(data.sectionList[0]).not.toHaveProperty('sortOrder');
  });

  it('stays backward compatible: legacy top-level keys and the type-keyed sections map', async () => {
    const { service, active } = setup();
    active({ key: 'hero', type: 'HERO', title: 'Top', maxItems: 1, articleIds: ['a1'] });
    active({ key: 'latest', type: 'LATEST', title: 'Latest', maxItems: 3, articleIds: ['a1', 'a2'] });
    active({ key: 'business', type: 'BUSINESS', title: 'Business', maxItems: 3, articleIds: ['a3'] });

    const data: any = await service.getHomepageData();

    expect(Object.keys(data).sort()).toEqual(['breakingNews', 'hero', 'latest', 'mostRead', 'sectionList', 'sections', 'trending']);
    expect(Object.keys(data.sections)).toEqual(['latest', 'business']);
    expect(ids(data.sections.latest)).toEqual(['a1', 'a2']);
    expect(ids(data.sections.business)).toEqual(['a3']);
  });

  it('no longer lets CUSTOM sections overwrite each other', async () => {
    const { service, active } = setup();
    active({ key: 'custom-aaaa1111', type: 'CUSTOM', title: 'First special', maxItems: 2, articleIds: ['a1'] });
    active({ key: 'custom-bbbb2222', type: 'CUSTOM', title: 'Second special', maxItems: 2, articleIds: ['a2'] });

    const data: any = await service.getHomepageData();

    expect(data.sectionList.map((s: any) => [s.key, s.title, ids(s.articles)])).toEqual([
      ['custom-aaaa1111', 'First special', ['a1']],
      ['custom-bbbb2222', 'Second special', ['a2']],
    ]);
    expect(Object.keys(data.sections)).toEqual(['custom-aaaa1111', 'custom-bbbb2222']);
  });

  it('omits disabled sections', async () => {
    const { service, active } = setup();
    active({ key: 'latest', type: 'LATEST', title: 'Latest', maxItems: 3, articleIds: ['a1'] });
    active({ key: 'world', type: 'WORLD', title: 'World', maxItems: 3, enabled: false, articleIds: ['a2'] });
    const data: any = await service.getHomepageData();
    expect(data.sectionList.map((s: any) => s.key)).toEqual(['latest']);
    expect(data.sections.world).toBeUndefined();
  });

  describe('defense in depth: ineligible articles never leak', () => {
    const scenarios: Array<[string, Record<string, unknown>]> = [
      ['archived after placement', { status: 'ARCHIVED' }],
      ['moved back to DRAFT', { status: 'DRAFT', publishedAt: null }],
      ['moved to IN_REVIEW', { status: 'IN_REVIEW' }],
      ['scheduled for the future', { publishedAt: FUTURE }],
    ];

    it.each(scenarios)('drops an article that was %s (query filter)', async (_label, change) => {
      const { db, service, active } = setup();
      active({ key: 'hero', type: 'HERO', title: 'Top', maxItems: 1, articleIds: ['a1'] });
      active({ key: 'latest', type: 'LATEST', title: 'Latest', maxItems: 5, articleIds: ['a1', 'a2', 'a3'] });
      Object.assign(db.state.articles.find((a) => a.id === 'a2')!, change);

      const data: any = await service.getHomepageData();

      expect(ids(data.latest)).toEqual(['a1', 'a3']);
      expect(JSON.stringify(data)).not.toContain('"a2"');
    });

    it.each(scenarios)('drops an article that was %s (serializer re-check even if the query let it through)', async (_label, change) => {
      const { db, service, active } = setup();
      db.ignoreNestedWhere = true; // simulate the row changing after the query-level filter ran
      active({ key: 'hero', type: 'HERO', title: 'Top', maxItems: 1, articleIds: ['a2'] });
      active({ key: 'latest', type: 'LATEST', title: 'Latest', maxItems: 5, articleIds: ['a1', 'a2', 'a3'] });
      Object.assign(db.state.articles.find((a) => a.id === 'a2')!, change);

      const data: any = await service.getHomepageData();

      expect(data.hero).toBeNull(); // the curated hero is gone -> the web falls back on its own
      expect(ids(data.latest)).toEqual(['a1', 'a3']);
      expect(JSON.stringify(data)).not.toContain('"a2"');
    });

    it('fills maxItems with the next eligible articles instead of leaving holes', async () => {
      const { db, service, active } = setup();
      active({ key: 'latest', type: 'LATEST', title: 'Latest', maxItems: 2, articleIds: ['a1', 'a2', 'a3'] });
      db.state.articles.find((a) => a.id === 'a1')!.status = 'ARCHIVED';
      const data: any = await service.getHomepageData();
      expect(ids(data.latest)).toEqual(['a2', 'a3']);
    });
  });

  describe('empty or invalid optional sections', () => {
    it('does not publish a section whose articles are all ineligible, but keeps the legacy key empty', async () => {
      const { db, service, active } = setup();
      active({ key: 'latest', type: 'LATEST', title: 'Latest', maxItems: 3, articleIds: ['a1'] });
      active({ key: 'world', type: 'WORLD', title: 'World', maxItems: 3, articleIds: ['a2'] });
      db.state.articles.find((a) => a.id === 'a2')!.status = 'ARCHIVED';

      const data: any = await service.getHomepageData();

      expect(data.sectionList.map((s: any) => s.key)).toEqual(['latest']);
      expect(data.sections.world).toEqual([]);
    });

    it('treats a section without placements as empty and never throws', async () => {
      const { service, active } = setup();
      active({ key: 'latest', type: 'LATEST', title: 'Latest', maxItems: 3, articleIds: ['a1'] });
      active({ key: 'custom-empty', type: 'CUSTOM', title: 'Nothing yet', maxItems: 4 });
      const data: any = await service.getHomepageData();
      expect(data.sectionList.map((s: any) => s.key)).toEqual(['latest']);
    });

    it('degrades an unknown stored layout to the default preset instead of leaking it', async () => {
      const { service, active } = setup();
      active({ key: 'latest', type: 'LATEST', title: 'Latest', maxItems: 3, layoutType: 'GRID', articleIds: ['a1'] });
      const data: any = await service.getHomepageData();
      expect(data.sectionList[0].layout).toBe('FEATURED_STACK');
    });

    it('first HERO wins if legacy data somehow holds two', () => {
      const article = (id: string) => ({ id, status: 'PUBLISHED', publishedAt: PAST });
      const result = serializeHomepageSections([
        { key: 'hero', type: 'HERO', title: 'A', enabled: true, maxItems: 1, layoutType: 'FEATURED_STACK', placements: [{ article: article('first') }] },
        { key: 'hero-2', type: 'HERO', title: 'B', enabled: true, maxItems: 1, layoutType: 'FEATURED_STACK', placements: [{ article: article('second') }] },
      ]);
      expect(result.hero.id).toBe('first');
      expect(result.sectionList).toEqual([]);
    });
  });

  describe('algorithmic parts stay algorithmic', () => {
    it('takes trending, most-read and breaking news from their services, never from placements', async () => {
      const { service, active, trending, mostRead, breaking } = setup();
      active({ key: 'latest', type: 'LATEST', title: 'Latest', maxItems: 3, articleIds: ['a1'] });
      active({ key: 'trending', type: 'TRENDING', title: 'Curated trending?', maxItems: 3, articleIds: ['a2'] });
      active({ key: 'most_read', type: 'MOST_READ', title: 'Curated most read?', maxItems: 3, articleIds: ['a3'] });

      const data: any = await service.getHomepageData();

      expect(data.trending).toEqual([{ id: 'trending-algo' }]);
      expect(data.mostRead).toEqual([{ id: 'most-read-algo' }]);
      expect(data.breakingNews).toEqual([{ id: 'breaking-algo' }]);
      expect(trending.getTrending).toHaveBeenCalledWith({ limit: 6 });
      expect(mostRead.getMostRead).toHaveBeenCalledWith({ limit: 6, window: '24h' });
      expect(breaking.getActiveBreakingNews).toHaveBeenCalledWith(5);
    });
  });

  describe('no usable configuration -> safe dynamic fallback', () => {
    function withFallbackQueries(db: FakeHomepagePrisma) {
      const fallbackArticle = { id: 'fallback-1', status: 'PUBLISHED', publishedAt: PAST };
      const article = {
        findFirst: jest.fn().mockResolvedValue(fallbackArticle),
        findMany: jest.fn().mockResolvedValue([fallbackArticle]),
        count: jest.fn().mockResolvedValue(1),
      };
      (db as any).article = article;
      (db as any).category = { findUnique: jest.fn().mockResolvedValue({ id: 'c', slug: 'x' }) };
      return article;
    }

    it('falls back when there is no ACTIVE configuration at all', async () => {
      const { db, service } = setup();
      db.state.configurations = db.state.configurations.filter((c) => c.status !== 'ACTIVE');
      db.seedSection('cfg-draft', { key: 'hero', type: 'HERO', title: 'Draft hero', maxItems: 1, articleIds: ['a1'] });
      withFallbackQueries(db);

      const data: any = await service.getHomepageData();

      expect(data.hero.id).toBe('fallback-1'); // draft is NOT used as a substitute
      expect(data.sectionList).toBeUndefined();
      expect(Object.keys(data.sections)).toEqual(['bangladesh', 'world', 'politics', 'business', 'sports', 'technology', 'entertainment']);
    });

    it('falls back when the ACTIVE configuration has no enabled sections', async () => {
      const { db, service, active } = setup();
      active({ key: 'latest', type: 'LATEST', title: 'Latest', maxItems: 3, enabled: false, articleIds: ['a1'] });
      withFallbackQueries(db);
      const data: any = await service.getHomepageData();
      expect(data.hero.id).toBe('fallback-1');
    });

    it('falls back when the ACTIVE configuration is empty', async () => {
      const { db, service } = setup();
      withFallbackQueries(db);
      const data: any = await service.getHomepageData();
      expect(data.hero.id).toBe('fallback-1');
    });
  });
});
