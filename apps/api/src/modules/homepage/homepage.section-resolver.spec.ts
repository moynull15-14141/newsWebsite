import { FakeHomepagePrisma } from './homepage-prisma.testkit';
import { resolveSectionArticles, ResolvableSection } from './homepage.section-resolver';

const OLD = new Date('2026-01-01T00:00:00Z');
const NEWER = new Date('2026-02-01T00:00:00Z');
const NEWEST = new Date('2026-03-01T00:00:00Z');
const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

function section(overrides: Partial<ResolvableSection> & { id: string }): ResolvableSection {
  return {
    sourceType: 'MANUAL',
    categoryId: null,
    locationId: null,
    tagId: null,
    maxItems: 4,
    placements: [],
    ...overrides,
  };
}

function db() {
  const prisma = new FakeHomepagePrisma();
  prisma.state.categories.push({ id: 'cat-politics', name: 'Politics', slug: 'politics' });
  prisma.state.tags.push({ id: 'tag-election', name: 'Election', slug: 'election' });
  prisma.state.locations.push(
    { id: 'loc-dhaka', name: 'Dhaka', slug: 'dhaka', type: 'DIVISION', parentId: null },
    { id: 'loc-gazipur', name: 'Gazipur', slug: 'gazipur', type: 'DISTRICT', parentId: 'loc-dhaka' },
    { id: 'loc-sylhet', name: 'Sylhet', slug: 'sylhet', type: 'DIVISION', parentId: null },
  );
  return prisma;
}

const ids = (articles: any[]) => articles.map((article) => article.id);

describe('resolveSectionArticles', () => {
  describe('MANUAL source', () => {
    it('keeps the editor placement order and never queries the article table', async () => {
      const prisma = db();
      const spy = jest.spyOn(prisma.article, 'findMany');
      const manual = section({
        id: 's1',
        placements: [
          { article: { id: 'c', status: 'PUBLISHED', publishedAt: OLD } },
          { article: { id: 'a', status: 'PUBLISHED', publishedAt: NEWEST } },
        ],
      });

      const resolved = await resolveSectionArticles(prisma as any, [manual]);

      expect(ids(resolved.get('s1')!)).toEqual(['c', 'a']); // placement order, not date order
      expect(spy).not.toHaveBeenCalled();
    });

    it('drops ineligible placements and caps to maxItems', async () => {
      const prisma = db();
      const manual = section({
        id: 's1',
        maxItems: 2,
        placements: [
          { article: { id: 'archived', status: 'ARCHIVED', publishedAt: OLD } },
          { article: { id: 'ok1', status: 'PUBLISHED', publishedAt: OLD } },
          { article: { id: 'scheduled', status: 'PUBLISHED', publishedAt: FUTURE } },
          { article: { id: 'ok2', status: 'PUBLISHED', publishedAt: OLD } },
          { article: { id: 'ok3', status: 'PUBLISHED', publishedAt: OLD } },
        ],
      });

      const resolved = await resolveSectionArticles(prisma as any, [manual]);

      expect(ids(resolved.get('s1')!)).toEqual(['ok1', 'ok2']);
    });
  });

  describe('LATEST source', () => {
    it('returns the newest published articles, capped to maxItems', async () => {
      const prisma = db();
      prisma.seedArticle({ id: 'old', status: 'PUBLISHED', publishedAt: OLD });
      prisma.seedArticle({ id: 'newest', status: 'PUBLISHED', publishedAt: NEWEST });
      prisma.seedArticle({ id: 'newer', status: 'PUBLISHED', publishedAt: NEWER });

      const resolved = await resolveSectionArticles(prisma as any, [section({ id: 's1', sourceType: 'LATEST', maxItems: 2 })]);

      expect(ids(resolved.get('s1')!)).toEqual(['newest', 'newer']);
    });

    it('excludes drafts, archived and future-dated articles', async () => {
      const prisma = db();
      prisma.seedArticle({ id: 'draft', status: 'DRAFT', publishedAt: null });
      prisma.seedArticle({ id: 'archived', status: 'ARCHIVED', publishedAt: OLD });
      prisma.seedArticle({ id: 'review', status: 'IN_REVIEW', publishedAt: OLD });
      prisma.seedArticle({ id: 'scheduled', status: 'PUBLISHED', publishedAt: FUTURE });
      prisma.seedArticle({ id: 'live', status: 'PUBLISHED', publishedAt: OLD });

      const resolved = await resolveSectionArticles(prisma as any, [section({ id: 's1', sourceType: 'LATEST', maxItems: 10 })]);

      expect(ids(resolved.get('s1')!)).toEqual(['live']);
    });
  });

  describe('CATEGORY source', () => {
    it('returns only that category, newest first', async () => {
      const prisma = db();
      prisma.seedArticle({ id: 'pol-old', status: 'PUBLISHED', publishedAt: OLD, categoryId: 'cat-politics' });
      prisma.seedArticle({ id: 'pol-new', status: 'PUBLISHED', publishedAt: NEWEST, categoryId: 'cat-politics' });
      prisma.seedArticle({ id: 'other', status: 'PUBLISHED', publishedAt: NEWEST, categoryId: 'cat-sports' });

      const resolved = await resolveSectionArticles(prisma as any, [
        section({ id: 's1', sourceType: 'CATEGORY', categoryId: 'cat-politics', maxItems: 5 }),
      ]);

      expect(ids(resolved.get('s1')!)).toEqual(['pol-new', 'pol-old']);
    });
  });

  describe('TAG source', () => {
    it('returns only articles carrying the tag', async () => {
      const prisma = db();
      prisma.seedArticle({ id: 'tagged', status: 'PUBLISHED', publishedAt: OLD, tagIds: ['tag-election', 'tag-other'] });
      prisma.seedArticle({ id: 'untagged', status: 'PUBLISHED', publishedAt: NEWEST, tagIds: [] });

      const resolved = await resolveSectionArticles(prisma as any, [
        section({ id: 's1', sourceType: 'TAG', tagId: 'tag-election', maxItems: 5 }),
      ]);

      expect(ids(resolved.get('s1')!)).toEqual(['tagged']);
    });
  });

  describe('LOCATION source', () => {
    it('includes the location and its child districts', async () => {
      const prisma = db();
      prisma.seedArticle({ id: 'dhaka', status: 'PUBLISHED', publishedAt: NEWEST, locationId: 'loc-dhaka' });
      prisma.seedArticle({ id: 'gazipur', status: 'PUBLISHED', publishedAt: NEWER, locationId: 'loc-gazipur' });
      prisma.seedArticle({ id: 'sylhet', status: 'PUBLISHED', publishedAt: OLD, locationId: 'loc-sylhet' });

      const resolved = await resolveSectionArticles(prisma as any, [
        section({ id: 's1', sourceType: 'LOCATION', locationId: 'loc-dhaka', maxItems: 5 }),
      ]);

      expect(ids(resolved.get('s1')!)).toEqual(['dhaka', 'gazipur']);
    });
  });

  describe('invalid and empty configuration', () => {
    it.each([
      ['CATEGORY without a category', 'CATEGORY'],
      ['TAG without a tag', 'TAG'],
      ['LOCATION without a location', 'LOCATION'],
    ])('resolves %s to nothing instead of falling back to unrelated stories', async (_label, sourceType) => {
      const prisma = db();
      prisma.seedArticle({ id: 'unrelated', status: 'PUBLISHED', publishedAt: OLD });
      const spy = jest.spyOn(prisma.article, 'findMany');

      const resolved = await resolveSectionArticles(prisma as any, [section({ id: 's1', sourceType })]);

      expect(resolved.get('s1')).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });

    it('resolves an unknown source type to nothing', async () => {
      const prisma = db();
      prisma.seedArticle({ id: 'unrelated', status: 'PUBLISHED', publishedAt: OLD });
      const resolved = await resolveSectionArticles(prisma as any, [section({ id: 's1', sourceType: 'SOMETHING_ELSE' })]);
      expect(resolved.get('s1')).toEqual([]);
    });

    it('returns an empty list for a source with no matching content, without throwing', async () => {
      const prisma = db();
      const resolved = await resolveSectionArticles(prisma as any, [
        section({ id: 's1', sourceType: 'CATEGORY', categoryId: 'cat-politics' }),
      ]);
      expect(resolved.get('s1')).toEqual([]);
    });

    it('returns an empty map for no sections', async () => {
      const resolved = await resolveSectionArticles(db() as any, []);
      expect(resolved.size).toBe(0);
    });
  });

  describe('query efficiency', () => {
    it('shares one query between sections asking for the same source', async () => {
      const prisma = db();
      prisma.seedArticle({ id: 'a1', status: 'PUBLISHED', publishedAt: NEWEST, categoryId: 'cat-politics' });
      prisma.seedArticle({ id: 'a2', status: 'PUBLISHED', publishedAt: NEWER, categoryId: 'cat-politics' });
      prisma.seedArticle({ id: 'a3', status: 'PUBLISHED', publishedAt: OLD, categoryId: 'cat-politics' });
      const spy = jest.spyOn(prisma.article, 'findMany');

      const resolved = await resolveSectionArticles(prisma as any, [
        section({ id: 'small', sourceType: 'CATEGORY', categoryId: 'cat-politics', maxItems: 1 }),
        section({ id: 'big', sourceType: 'CATEGORY', categoryId: 'cat-politics', maxItems: 3 }),
      ]);

      expect(spy).toHaveBeenCalledTimes(1);
      // The shared query takes the largest limit; each section slices its own share.
      expect(ids(resolved.get('small')!)).toEqual(['a1']);
      expect(ids(resolved.get('big')!)).toEqual(['a1', 'a2', 'a3']);
    });

    it('uses one query per distinct source, not one per section', async () => {
      const prisma = db();
      prisma.seedArticle({ id: 'a1', status: 'PUBLISHED', publishedAt: OLD, categoryId: 'cat-politics' });
      const spy = jest.spyOn(prisma.article, 'findMany');

      await resolveSectionArticles(prisma as any, [
        section({ id: 'm', placements: [{ article: { id: 'x', status: 'PUBLISHED', publishedAt: OLD } }] }),
        section({ id: 'l1', sourceType: 'LATEST' }),
        section({ id: 'l2', sourceType: 'LATEST' }),
        section({ id: 'c1', sourceType: 'CATEGORY', categoryId: 'cat-politics' }),
      ]);

      expect(spy).toHaveBeenCalledTimes(2); // LATEST + CATEGORY; MANUAL costs nothing
    });
  });

  it('resolves mixed manual and automatic sections in one pass', async () => {
    const prisma = db();
    prisma.seedArticle({ id: 'auto', status: 'PUBLISHED', publishedAt: NEWEST, categoryId: 'cat-politics' });

    const resolved = await resolveSectionArticles(prisma as any, [
      section({ id: 'manual', placements: [{ article: { id: 'picked', status: 'PUBLISHED', publishedAt: OLD } }] }),
      section({ id: 'auto', sourceType: 'CATEGORY', categoryId: 'cat-politics' }),
      section({ id: 'broken', sourceType: 'TAG' }),
    ]);

    expect(ids(resolved.get('manual')!)).toEqual(['picked']);
    expect(ids(resolved.get('auto')!)).toEqual(['auto']);
    expect(resolved.get('broken')).toEqual([]);
  });
});
