import { BadRequestException } from '@nestjs/common';
import { PublicService } from '../public/public.service';
import { FakeHomepagePrisma, fakeLanguagesService } from './homepage-prisma.testkit';
import { HomepageService } from './homepage.service';

/**
 * Phase 2B: a section's stories can come from a query instead of hand-picked placements.
 * These cover the Admin -> API -> resolved public homepage path for every source type.
 */

const PAST = new Date('2026-01-01T00:00:00Z');

function setup(options: { liveSections?: boolean } = {}) {
  const { liveSections = true } = options;
  const db = new FakeHomepagePrisma();
  db.seedConfigurations();

  ['a1', 'a2', 'a3'].forEach((id) => db.seedArticle({ id, status: 'PUBLISHED', publishedAt: PAST }));

  // Reference data the automatic sources query by.
  db.state.categories.push({ id: 'cat-politics', name: 'Politics', slug: 'politics' });
  db.state.tags.push({ id: 'tag-election', name: 'Election', slug: 'election' });
  db.state.locations.push(
    { id: 'loc-dhaka', name: 'Dhaka', slug: 'dhaka', type: 'DIVISION', parentId: null },
    { id: 'loc-gazipur', name: 'Gazipur', slug: 'gazipur', type: 'DISTRICT', parentId: 'loc-dhaka' },
  );

  if (liveSections) {
    for (const configurationId of ['cfg-active', 'cfg-draft']) {
      db.seedSection(configurationId, { key: 'latest', type: 'LATEST', title: 'Latest', maxItems: 5, articleIds: ['a1', 'a2', 'a3'] });
    }
  }

  const trending = { getTrending: jest.fn().mockResolvedValue([]) };
  const mostRead = { getMostRead: jest.fn().mockResolvedValue([]) };
  const breaking = { getActiveBreakingNews: jest.fn().mockResolvedValue([]) };
  const publicService = new PublicService(db as any, {} as any, trending as any, mostRead as any, breaking as any, fakeLanguagesService() as any);
  const service = new HomepageService(db as any, publicService, fakeLanguagesService() as any);

  const draftSection = (key: string) => db.state.sections.find((s) => s.configurationId === 'cfg-draft' && s.key === key)!;
  const draftVersion = () => db.configuration('DRAFT')!.version as number;

  return { db, service, publicService, draftSection, draftVersion };
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as any;
  }
  throw new Error('expected the promise to reject');
}

const ids = (articles: any[]) => articles.map((article) => article.id);

describe('HomepageService content sources', () => {
  describe('creating sourced sections', () => {
    it('defaults a new section to MANUAL selection with the AUTO card variant', async () => {
      const { service, draftVersion } = setup();
      const draft = await service.createSection({ expectedVersion: draftVersion(), type: 'CUSTOM', title: 'Special' } as any);
      expect(draft.sections.at(-1)).toMatchObject({ sourceType: 'MANUAL', cardVariant: 'AUTO' });
    });

    it('resolves a CATEGORY section on the public homepage after publishing', async () => {
      const { db, service, publicService, draftVersion } = setup({ liveSections: false });
      db.seedArticle({ id: 'pol-1', status: 'PUBLISHED', publishedAt: PAST, categoryId: 'cat-politics' });

      await service.createSection({
        expectedVersion: draftVersion(),
        type: 'POLITICS',
        title: 'Politics',
        sourceType: 'CATEGORY',
        categoryId: 'cat-politics',
        maxItems: 3,
        layoutType: 'THREE_UP',
      } as any);
      await service.publish(draftVersion());

      const data: any = await publicService.getHomepageData();
      const politics = data.sectionList.find((s: any) => s.key === 'politics');
      expect(politics).toMatchObject({ sourceType: 'CATEGORY', layout: 'THREE_UP' });
      expect(ids(politics.articles)).toEqual(['pol-1']);
    });

    it('resolves a TAG section by tag', async () => {
      const { db, service, draftVersion } = setup({ liveSections: false });
      db.seedArticle({ id: 'tagged', status: 'PUBLISHED', publishedAt: PAST, tagIds: ['tag-election'] });

      const draft = await service.createSection({
        expectedVersion: draftVersion(), type: 'CUSTOM', title: 'Election', sourceType: 'TAG', tagId: 'tag-election',
      } as any);
      expect(draft.sections.at(-1)).toMatchObject({ sourceType: 'TAG', tagId: 'tag-election' });

      const preview: any = await service.previewDraft();
      expect(ids(preview.sectionList.find((s: any) => s.title === 'Election').articles)).toEqual(['tagged']);
    });

    it('resolves a LOCATION section including its child districts', async () => {
      const { db, service, draftVersion } = setup({ liveSections: false });
      db.seedArticle({ id: 'gazipur-story', status: 'PUBLISHED', publishedAt: PAST, locationId: 'loc-gazipur' });

      await service.createSection({
        expectedVersion: draftVersion(), type: 'CUSTOM', title: 'Dhaka Division', sourceType: 'LOCATION', locationId: 'loc-dhaka',
      } as any);

      const preview: any = await service.previewDraft();
      expect(ids(preview.sectionList.find((s: any) => s.title === 'Dhaka Division').articles)).toEqual(['gazipur-story']);
    });

    it('creates a LATEST section without needing any link', async () => {
      const { service, draftVersion } = setup({ liveSections: false });
      const draft = await service.createSection({
        expectedVersion: draftVersion(), type: 'CUSTOM', title: 'Just in', sourceType: 'LATEST', maxItems: 2,
      } as any);
      expect(draft.sections.at(-1)).toMatchObject({ sourceType: 'LATEST', categoryId: null, tagId: null, locationId: null });
    });
  });

  describe('invalid source configuration', () => {
    it.each([
      ['CATEGORY', 'categoryId'],
      ['TAG', 'tagId'],
      ['LOCATION', 'locationId'],
    ])('rejects a %s section created without its link', async (sourceType, required) => {
      const { service, draftVersion } = setup();
      const error = await rejection(
        service.createSection({ expectedVersion: draftVersion(), type: 'CUSTOM', title: 'Broken', sourceType } as any),
      );
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toMatchObject({ code: 'SOURCE_LINK_MISSING', sourceType, required });
    });

    it('rejects a source link that does not exist', async () => {
      const { service, draftVersion } = setup();
      const error = await rejection(
        service.createSection({ expectedVersion: draftVersion(), type: 'CUSTOM', title: 'x', sourceType: 'TAG', tagId: 'nope' } as any),
      );
      expect(error.getResponse()).toMatchObject({ code: 'TAG_NOT_FOUND' });
    });

    it('rejects switching a section to an automatic source without a link', async () => {
      const { service, draftSection, draftVersion } = setup();
      const error = await rejection(
        service.updateSection(draftSection('latest').id, { expectedVersion: draftVersion(), sourceType: 'CATEGORY' } as any),
      );
      expect(error.getResponse()).toMatchObject({ code: 'SOURCE_LINK_MISSING', required: 'categoryId' });
    });

    it('accepts the switch when the link arrives in the same request', async () => {
      const { service, draftSection, draftVersion } = setup();
      const draft = await service.updateSection(draftSection('latest').id, {
        expectedVersion: draftVersion(), sourceType: 'CATEGORY', categoryId: 'cat-politics',
      } as any);
      expect(draft.sections.find((s) => s.key === 'latest')).toMatchObject({ sourceType: 'CATEGORY', categoryId: 'cat-politics' });
    });
  });

  describe('manual and automatic are mutually exclusive', () => {
    it('clears placements when a manual section becomes automatic', async () => {
      const { db, service, draftSection, draftVersion } = setup();
      const sectionId = draftSection('latest').id;
      expect(db.state.placements.filter((p: any) => p.sectionId === sectionId)).toHaveLength(3);

      const draft = await service.updateSection(sectionId, {
        expectedVersion: draftVersion(), sourceType: 'CATEGORY', categoryId: 'cat-politics',
      } as any);

      expect(db.state.placements.filter((p: any) => p.sectionId === sectionId)).toHaveLength(0);
      expect(draft.sections.find((s) => s.key === 'latest')!.placements).toEqual([]);
    });

    it('refuses manual placements on an automatically sourced section', async () => {
      const { service, draftSection, draftVersion } = setup();
      const sectionId = draftSection('latest').id;
      await service.updateSection(sectionId, { expectedVersion: draftVersion(), sourceType: 'LATEST' } as any);

      const error = await rejection(service.setPlacements(sectionId, { expectedVersion: draftVersion(), articleIds: ['a1'] }));

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toMatchObject({ code: 'SECTION_NOT_MANUAL', sourceType: 'LATEST' });
    });

    it('lets an automatic section publish with no placements at all', async () => {
      const { service, draftVersion } = setup({ liveSections: false });
      await service.createSection({
        expectedVersion: draftVersion(), type: 'CUSTOM', title: 'Politics feed', sourceType: 'CATEGORY', categoryId: 'cat-politics',
      } as any);

      const draft = await service.getDraft();
      expect(draft.publishable).toBe(true);
      expect(draft.issues).toEqual([]);
      await expect(service.publish(draftVersion())).resolves.toMatchObject({ published: true });
    });
  });

  describe('publishing and draft state', () => {
    it('carries source configuration, layout and card variant through publish', async () => {
      const { service, draftVersion } = setup({ liveSections: false });
      await service.createSection({
        expectedVersion: draftVersion(),
        type: 'CUSTOM',
        title: 'Politics feed',
        sourceType: 'CATEGORY',
        categoryId: 'cat-politics',
        cardVariant: 'opinion',
        layoutType: 'TEXT_LED',
      } as any);
      await service.publish(draftVersion());

      const active = await service.getActive();
      expect(active.sections[0]).toMatchObject({
        sourceType: 'CATEGORY', categoryId: 'cat-politics', cardVariant: 'opinion', layoutType: 'TEXT_LED',
      });
    });

    it('counts a source change as an unpublished change', async () => {
      const { service, draftSection, draftVersion } = setup();
      expect((await service.getDraft()).hasUnpublishedChanges).toBe(false);

      await service.updateSection(draftSection('latest').id, {
        expectedVersion: draftVersion(), sourceType: 'CATEGORY', categoryId: 'cat-politics',
      } as any);

      expect((await service.getDraft()).hasUnpublishedChanges).toBe(true);
    });

    it('counts a card-variant change as an unpublished change', async () => {
      const { service, draftSection, draftVersion } = setup();
      await service.updateSection(draftSection('latest').id, { expectedVersion: draftVersion(), cardVariant: 'compact' } as any);
      expect((await service.getDraft()).hasUnpublishedChanges).toBe(true);
    });

    it('tells the builder which sources and card variants it may choose', async () => {
      const { service } = setup();
      const draft = await service.getDraft();
      expect(draft.sourceTypes).toEqual(['MANUAL', 'LATEST', 'CATEGORY', 'TAG', 'LOCATION']);
      expect(draft.cardVariants).toContain('AUTO');
      expect(draft.cardVariants).toContain('opinion');
    });

    it('keeps an automatic section out of the public payload when it resolves to nothing', async () => {
      const { service, publicService, draftVersion } = setup({ liveSections: false });
      await service.createSection({
        expectedVersion: draftVersion(), type: 'CUSTOM', title: 'Empty feed', sourceType: 'CATEGORY', categoryId: 'cat-politics',
      } as any);
      await service.publish(draftVersion());

      const data: any = await publicService.getHomepageData();
      // No stories in that category -> the section is not rendered, and the page still builds.
      expect((data.sectionList ?? []).map((s: any) => s.title)).not.toContain('Empty feed');
    });
  });
});
