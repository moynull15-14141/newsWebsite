import { BadRequestException, ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PublicService } from '../public/public.service';
import { HomepageService } from './homepage.service';
import { FakeHomepagePrisma } from './homepage-prisma.testkit';

const PAST = new Date('2026-01-01T00:00:00Z');
const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

function setup(options: { liveSections?: boolean; draftConfig?: boolean } = {}) {
  const { liveSections = true, draftConfig = true } = options;
  const db = new FakeHomepagePrisma();
  db.seedConfigurations({ active: true, draft: draftConfig });

  ['a1', 'a2', 'a3', 'a4', 'a5'].forEach((id) => db.seedArticle({ id, status: 'PUBLISHED', publishedAt: PAST }));
  db.seedArticle({ id: 'draft-article', status: 'DRAFT', publishedAt: null });
  db.seedArticle({ id: 'review-article', status: 'IN_REVIEW', publishedAt: null });
  db.seedArticle({ id: 'approved-article', status: 'APPROVED', publishedAt: null });
  db.seedArticle({ id: 'archived-article', status: 'ARCHIVED', publishedAt: PAST });
  db.seedArticle({ id: 'future-article', status: 'PUBLISHED', publishedAt: FUTURE });

  if (liveSections) {
    // Same content in ACTIVE and DRAFT, exactly what the migration produces.
    for (const configurationId of draftConfig ? ['cfg-active', 'cfg-draft'] : ['cfg-active']) {
      db.seedSection(configurationId, { key: 'hero', type: 'HERO', title: 'Top story', maxItems: 1, articleIds: ['a1'] });
      db.seedSection(configurationId, { key: 'latest', type: 'LATEST', title: 'Latest', maxItems: 5, articleIds: ['a1', 'a2', 'a3'] });
      db.seedSection(configurationId, { key: 'bangladesh', type: 'BANGLADESH', title: 'Bangladesh', maxItems: 4, layoutType: 'THREE_UP', articleIds: ['a2', 'a3'] });
    }
  }

  const trending = { getTrending: jest.fn().mockResolvedValue([{ id: 'trend-1' }]) };
  const mostRead = { getMostRead: jest.fn().mockResolvedValue([{ id: 'read-1' }]) };
  const breaking = { getActiveBreakingNews: jest.fn().mockResolvedValue([]) };
  const publicService = new PublicService(db as any, {} as any, trending as any, mostRead as any, breaking as any);
  const service = new HomepageService(db as any, publicService);

  const draftSection = (key: string) => db.state.sections.find((s) => s.configurationId === 'cfg-draft' && s.key === key)!;
  const draftVersion = () => db.configuration('DRAFT')!.version as number;
  const activeVersion = () => db.configuration('ACTIVE')!.version as number;
  /** Compact view of what the public site would render right now. */
  const publicView = async (): Promise<{
    hero: string | null;
    latest: string[];
    sectionList: Array<{ key: string; title: string; layout: string; articles: string[] }>;
  }> => {
    const data: any = await publicService.getHomepageData();
    return {
      hero: data.hero?.id ?? null,
      latest: data.latest.map((a: any) => a.id),
      sectionList: (data.sectionList ?? []).map((s: any) => ({ key: s.key, title: s.title, layout: s.layout, articles: s.articles.map((a: any) => a.id) })),
    };
  };

  return { db, service, publicService, trending, mostRead, draftSection, draftVersion, activeVersion, publicView };
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as any;
  }
  throw new Error('expected the promise to reject');
}

describe('HomepageService', () => {
  describe('draft lifecycle', () => {
    it('creates the draft as a clone of ACTIVE when none exists', async () => {
      const { db, service } = setup({ draftConfig: false });
      expect(db.configuration('DRAFT')).toBeUndefined();

      const draft = await service.getDraft();

      expect(db.configuration('DRAFT')).toBeDefined();
      expect(draft.status).toBe('DRAFT');
      expect(draft.sections.map((s) => s.key)).toEqual(['hero', 'latest', 'bangladesh']);
      expect(draft.sections.find((s) => s.key === 'latest')!.placements.map((p) => p.articleId)).toEqual(['a1', 'a2', 'a3']);
      expect(draft.hasUnpublishedChanges).toBe(false);
      // Cloned, not shared: the copy has its own section ids.
      const activeIds = new Set(db.state.sections.filter((s) => s.configurationId === 'cfg-active').map((s) => s.id));
      expect(draft.sections.every((s) => !activeIds.has(s.id))).toBe(true);
    });

    it('returns the draft with version, layout presets and readiness', async () => {
      const { service } = setup();
      const draft = await service.getDraft();
      expect(draft.version).toBe(1);
      expect(draft.layoutPresets).toEqual(['FEATURED_STACK', 'THREE_UP', 'COMPACT_LIST']);
      expect(draft.publishable).toBe(true);
      expect(draft.issues).toEqual([]);
    });

    it('returns an empty (non-null) active view when nothing was ever published', async () => {
      const db = new FakeHomepagePrisma();
      const service = new HomepageService(db as any, {} as any);
      await expect(service.getActive()).resolves.toMatchObject({ id: null, status: 'ACTIVE', version: 0, sections: [] });
    });

    it('exposes the live configuration read-only through getActive', async () => {
      const { service } = setup();
      const active = await service.getActive();
      expect(active.status).toBe('ACTIVE');
      expect(active.sections.map((s) => s.key)).toEqual(['hero', 'latest', 'bangladesh']);
    });
  });

  describe('draft isolation', () => {
    it('does not change the public homepage until publish, whatever the draft edit', async () => {
      const { service, publicView, draftSection, draftVersion } = setup();
      const before = await publicView();
      expect(before.hero).toBe('a1');

      let version = draftVersion();
      await service.updateSection(draftSection('latest').id, { expectedVersion: version++, title: 'EDITED TITLE', layoutType: 'COMPACT_LIST' });
      await service.updateSection(draftSection('bangladesh').id, { expectedVersion: version++, enabled: false });
      await service.reorderSections({ expectedVersion: version++, sectionIds: [draftSection('bangladesh').id, draftSection('latest').id, draftSection('hero').id] });
      await service.setPlacements(draftSection('hero').id, { expectedVersion: version++, articleIds: ['a5'] });
      await service.setPlacements(draftSection('latest').id, { expectedVersion: version++, articleIds: ['a5', 'a4'] });
      await service.createSection({ expectedVersion: version++, type: 'CUSTOM', title: 'Brand new' });

      expect(await publicView()).toEqual(before);
      expect((await service.getDraft()).hasUnpublishedChanges).toBe(true);
    });

    it('shows the edits on the public homepage only after publish succeeds', async () => {
      const { service, publicView, draftSection, draftVersion } = setup();
      await service.updateSection(draftSection('latest').id, { expectedVersion: draftVersion(), title: 'EDITED TITLE', layoutType: 'COMPACT_LIST' });
      await service.setPlacements(draftSection('hero').id, { expectedVersion: draftVersion(), articleIds: ['a5'] });
      expect((await publicView()).hero).toBe('a1');

      await service.publish(draftVersion());

      const after = await publicView();
      expect(after.hero).toBe('a5');
      expect(after.sectionList.find((s) => s.key === 'latest')).toMatchObject({ title: 'EDITED TITLE', layout: 'COMPACT_LIST' });
      expect((await service.getDraft()).hasUnpublishedChanges).toBe(false);
    });
  });

  describe('placement eligibility', () => {
    it('accepts published articles and stores the client order as normalized 0..n-1', async () => {
      const { db, service, draftSection, draftVersion } = setup();
      const section = draftSection('latest');
      const view = await service.setPlacements(section.id, { expectedVersion: draftVersion(), articleIds: ['a3', 'a1', 'a5'] });

      const rows = db.state.placements.filter((p) => p.sectionId === section.id).sort((a, b) => a.sortOrder - b.sortOrder);
      expect(rows.map((p) => [p.articleId, p.sortOrder])).toEqual([['a3', 0], ['a1', 1], ['a5', 2]]);
      expect(view.sections.find((s) => s.key === 'latest')!.placements.map((p) => p.articleId)).toEqual(['a3', 'a1', 'a5']);
    });

    it('can clear a section by replacing it with an empty list', async () => {
      const { db, service, draftSection, draftVersion } = setup();
      await service.setPlacements(draftSection('latest').id, { expectedVersion: draftVersion(), articleIds: [] });
      expect(db.state.placements.filter((p) => p.sectionId === draftSection('latest').id)).toHaveLength(0);
    });

    it.each([
      ['draft-article', 'NOT_PUBLISHED'],
      ['review-article', 'NOT_PUBLISHED'],
      ['approved-article', 'NOT_PUBLISHED'],
      ['archived-article', 'ARCHIVED'],
      ['future-article', 'SCHEDULED'],
      ['does-not-exist', 'NOT_FOUND'],
    ])('rejects %s (%s) without writing anything', async (articleId, reason) => {
      const { db, service, draftSection, draftVersion } = setup();
      const section = draftSection('latest');
      const before = db.snapshot('DRAFT');
      const version = draftVersion();

      const error = await rejection(service.setPlacements(section.id, { expectedVersion: version, articleIds: ['a1', articleId] }));

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toMatchObject({ code: 'HOMEPAGE_PLACEMENT_INVALID', issues: [expect.objectContaining({ code: 'ARTICLE_INELIGIBLE', articleId, reason })] });
      expect(db.snapshot('DRAFT')).toEqual(before);
      expect(draftVersion()).toBe(version); // the rejected mutation did not consume a version
    });

    it('reports every ineligible article in one response', async () => {
      const { service, draftSection, draftVersion } = setup();
      const error = await rejection(service.setPlacements(draftSection('latest').id, { expectedVersion: draftVersion(), articleIds: ['draft-article', 'archived-article', 'nope'] }));
      expect(error.getResponse().issues.map((i: any) => i.articleId)).toEqual(['draft-article', 'archived-article', 'nope']);
    });

    it('rejects the same article twice in one section', async () => {
      const { service, draftSection, draftVersion } = setup();
      const error = await rejection(service.setPlacements(draftSection('latest').id, { expectedVersion: draftVersion(), articleIds: ['a1', 'a2', 'a1'] }));
      expect(error.getResponse().issues).toEqual([expect.objectContaining({ code: 'DUPLICATE_PLACEMENT', articleId: 'a1' })]);
    });

    it('allows the same article in different sections', async () => {
      const { db, service, draftSection, draftVersion } = setup();
      await service.setPlacements(draftSection('bangladesh').id, { expectedVersion: draftVersion(), articleIds: ['a1'] });
      expect(db.snapshot('DRAFT')!.filter((s) => s.articleIds.includes('a1')).map((s) => s.key)).toEqual(['hero', 'latest', 'bangladesh']);
    });

    it('rejects more placements than the section shows', async () => {
      const { service, draftSection, draftVersion } = setup();
      const error = await rejection(service.setPlacements(draftSection('bangladesh').id, { expectedVersion: draftVersion(), articleIds: ['a1', 'a2', 'a3', 'a4', 'a5'] }));
      expect(error.getResponse().issues).toEqual([expect.objectContaining({ code: 'PLACEMENT_LIMIT_EXCEEDED' })]);
    });

    it('404s for a section that is not part of the draft (e.g. an ACTIVE section id)', async () => {
      const { db, service, draftVersion } = setup();
      const activeSection = db.state.sections.find((s) => s.configurationId === 'cfg-active')!;
      await expect(service.setPlacements(activeSection.id, { expectedVersion: draftVersion(), articleIds: ['a1'] })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('hero and section-type rules', () => {
    it('rejects more than one article in the HERO section', async () => {
      const { service, draftSection, draftVersion } = setup();
      const error = await rejection(service.setPlacements(draftSection('hero').id, { expectedVersion: draftVersion(), articleIds: ['a1', 'a2'] }));
      const codes = error.getResponse().issues.map((i: any) => i.code);
      expect(codes).toEqual(expect.arrayContaining(['HERO_PLACEMENT_LIMIT']));
    });

    it('rejects a second HERO section', async () => {
      const { service, draftVersion } = setup();
      const error = await rejection(service.createSection({ expectedVersion: draftVersion(), type: 'HERO', title: 'Another hero' }));
      expect(error.getResponse()).toMatchObject({ code: 'HERO_MULTIPLE' });
    });

    it('rejects a duplicate of any other singleton type', async () => {
      const { service, draftVersion } = setup();
      const error = await rejection(service.createSection({ expectedVersion: draftVersion(), type: 'BANGLADESH', title: 'Dup' }));
      expect(error.getResponse()).toMatchObject({ code: 'DUPLICATE_SECTION_TYPE' });
    });

    it('forces a created HERO to show exactly one article and keeps it that way', async () => {
      const { db, service, draftVersion, draftSection } = setup({ liveSections: false });
      await service.createSection({ expectedVersion: draftVersion(), type: 'HERO', title: 'Top', maxItems: 9 });
      expect(db.state.sections.find((s) => s.type === 'HERO')!.maxItems).toBe(1);
      const error = await rejection(service.updateSection(db.state.sections[0].id, { expectedVersion: draftVersion(), maxItems: 3 }));
      expect(error.getResponse()).toMatchObject({ code: 'HERO_PLACEMENT_LIMIT' });
      expect(draftSection).toBeDefined();
    });

    it('allows several CUSTOM sections with distinct stable keys', async () => {
      const { db, service, draftVersion } = setup();
      await service.createSection({ expectedVersion: draftVersion(), type: 'CUSTOM', title: 'Special one' });
      await service.createSection({ expectedVersion: draftVersion(), type: 'CUSTOM', title: 'Special two' });
      const customKeys = db.snapshot('DRAFT')!.filter((s) => s.type === 'CUSTOM').map((s) => s.key);
      expect(customKeys).toHaveLength(2);
      expect(new Set(customKeys).size).toBe(2);
      customKeys.forEach((key) => expect(key).toMatch(/^custom-[0-9a-f]{8}$/));
    });

    it('refuses to publish a draft that already contains two HERO sections (legacy data)', async () => {
      const { db, service, draftVersion, activeVersion } = setup();
      db.seedSection('cfg-draft', { key: 'hero-legacy', type: 'HERO', title: 'Old hero', maxItems: 1, articleIds: ['a2'] });
      const activeBefore = db.snapshot('ACTIVE');
      const error = await rejection(service.publish(draftVersion()));
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect(error.getResponse().issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'HERO_MULTIPLE' })]));
      expect(db.snapshot('ACTIVE')).toEqual(activeBefore);
      expect(activeVersion()).toBe(1);
    });
  });

  describe('section metadata and ordering', () => {
    it('appends new sections at the end with the default layout preset', async () => {
      const { db, service, draftVersion } = setup();
      await service.createSection({ expectedVersion: draftVersion(), type: 'SPORTS', title: 'Sports' });
      const sports = db.snapshot('DRAFT')!.find((s) => s.key === 'sports')!;
      expect(sports).toMatchObject({ sortOrder: 3, layoutType: 'FEATURED_STACK', maxItems: 4 });
    });

    it('rejects a category that does not exist', async () => {
      const { service, draftVersion } = setup();
      const error = await rejection(service.createSection({ expectedVersion: draftVersion(), type: 'WORLD', title: 'World', categoryId: 'missing' }));
      expect(error.getResponse()).toMatchObject({ code: 'CATEGORY_NOT_FOUND' });
    });

    it('refuses to lower maxItems below the number of placed articles', async () => {
      const { service, draftSection, draftVersion } = setup();
      const error = await rejection(service.updateSection(draftSection('latest').id, { expectedVersion: draftVersion(), maxItems: 2 }));
      expect(error.getResponse()).toMatchObject({ code: 'PLACEMENT_LIMIT_EXCEEDED' });
    });

    it('reorders sections in one batch and normalizes sortOrder to 0..n-1', async () => {
      const { db, service, draftSection, draftVersion } = setup();
      // Corrupt the stored order (duplicate values) to prove the client cannot smuggle them through.
      db.state.sections.filter((s) => s.configurationId === 'cfg-draft').forEach((s) => (s.sortOrder = 7));
      const ids = [draftSection('bangladesh').id, draftSection('hero').id, draftSection('latest').id];

      const view = await service.reorderSections({ expectedVersion: draftVersion(), sectionIds: ids });

      expect(view.sections.map((s) => [s.key, s.sortOrder])).toEqual([['bangladesh', 0], ['hero', 1], ['latest', 2]]);
    });

    it.each([
      ['duplicate ids', (ids: string[]) => [ids[0], ids[0], ids[1], ids[2]], 'duplicates'],
      ['a foreign id', (ids: string[]) => [...ids, 'foreign-section'], 'foreign'],
      ['a missing id', (ids: string[]) => ids.slice(1), 'missing'],
    ])('rejects a reorder with %s and changes nothing', async (_label, mutate, field) => {
      const { db, service, draftSection, draftVersion } = setup();
      const ids = [draftSection('hero').id, draftSection('latest').id, draftSection('bangladesh').id];
      const before = db.snapshot('DRAFT');
      const version = draftVersion();

      const error = await rejection(service.reorderSections({ expectedVersion: version, sectionIds: mutate(ids) }));

      expect(error.getResponse()).toMatchObject({ code: 'HOMEPAGE_REORDER_INVALID' });
      expect(error.getResponse()[field].length).toBeGreaterThan(0);
      expect(db.snapshot('DRAFT')).toEqual(before);
      expect(draftVersion()).toBe(version);
    });

    it('rejects sections that belong to ACTIVE (never editable through the draft)', async () => {
      const { db, service, draftSection, draftVersion } = setup();
      const activeId = db.state.sections.find((s) => s.configurationId === 'cfg-active')!.id;
      const error = await rejection(service.reorderSections({ expectedVersion: draftVersion(), sectionIds: [activeId, draftSection('latest').id, draftSection('bangladesh').id] }));
      expect(error.getResponse().foreign).toEqual([activeId]);
    });

    it('rolls the whole reorder back if it fails part-way (transactional)', async () => {
      const { db, service, draftSection, draftVersion } = setup();
      const before = db.snapshot('DRAFT');
      const version = draftVersion();
      db.failOn('homepageSection.update', 1); // second per-section update blows up

      await expect(service.reorderSections({ expectedVersion: version, sectionIds: [draftSection('bangladesh').id, draftSection('latest').id, draftSection('hero').id] })).rejects.toThrow('injected failure');

      expect(db.snapshot('DRAFT')).toEqual(before);
      expect(draftVersion()).toBe(version);
    });

    it('deletes a draft section (with placements) and repacks the order', async () => {
      const { db, service, draftSection, draftVersion } = setup();
      const latestId = draftSection('latest').id;
      await service.deleteSection(latestId, draftVersion());
      expect(db.state.placements.some((p) => p.sectionId === latestId)).toBe(false);
      expect(db.snapshot('DRAFT')!.map((s) => [s.key, s.sortOrder])).toEqual([['hero', 0], ['bangladesh', 1]]);
    });
  });

  describe('conflict / version protection', () => {
    it('bumps the draft version by one per successful mutation', async () => {
      const { service, draftSection, draftVersion } = setup();
      expect(draftVersion()).toBe(1);
      await service.updateSection(draftSection('latest').id, { expectedVersion: 1, title: 'A' });
      expect(draftVersion()).toBe(2);
      await service.updateSection(draftSection('latest').id, { expectedVersion: 2, title: 'B' });
      expect(draftVersion()).toBe(3);
    });

    it('rejects a stale editor with 409 and applies nothing (no silent last-write-wins)', async () => {
      const { db, service, draftSection, draftVersion } = setup();
      // Editor A and editor B both loaded version 1.
      await service.updateSection(draftSection('latest').id, { expectedVersion: 1, title: 'Editor A' });
      const before = db.snapshot('DRAFT');

      const error = await rejection(service.updateSection(draftSection('latest').id, { expectedVersion: 1, title: 'Editor B' }));

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({ statusCode: 409, code: 'HOMEPAGE_DRAFT_CONFLICT', expectedVersion: 1, currentVersion: 2 });
      expect(db.snapshot('DRAFT')).toEqual(before);
      expect(draftSection('latest').title).toBe('Editor A');
      expect(draftVersion()).toBe(2);
    });

    it.each([
      ['updateSection', (s: HomepageService, id: (k: string) => string) => s.updateSection(id('latest'), { expectedVersion: 99, title: 'x' })],
      ['setPlacements', (s: HomepageService, id: (k: string) => string) => s.setPlacements(id('latest'), { expectedVersion: 99, articleIds: ['a1'] })],
      ['reorderSections', (s: HomepageService, id: (k: string) => string) => s.reorderSections({ expectedVersion: 99, sectionIds: [id('hero'), id('latest'), id('bangladesh')] })],
      ['createSection', (s: HomepageService) => s.createSection({ expectedVersion: 99, type: 'CUSTOM', title: 'x' })],
      ['deleteSection', (s: HomepageService, id: (k: string) => string) => s.deleteSection(id('latest'), 99)],
      ['publish', (s: HomepageService) => s.publish(99)],
    ])('%s honours the version check', async (_name, call) => {
      const { db, service, draftSection } = setup();
      const draftBefore = db.snapshot('DRAFT');
      const activeBefore = db.snapshot('ACTIVE');

      const error = await rejection(call(service, (key) => draftSection(key).id));

      expect(error).toBeInstanceOf(ConflictException);
      expect(db.snapshot('DRAFT')).toEqual(draftBefore);
      expect(db.snapshot('ACTIVE')).toEqual(activeBefore);
    });

    it('serializes two publishes that used the same version: exactly one wins', async () => {
      const { service, draftVersion, activeVersion } = setup();
      const version = draftVersion();
      await service.publish(version);
      await expect(service.publish(version)).rejects.toBeInstanceOf(ConflictException);
      expect(activeVersion()).toBe(2);
    });
  });

  describe('publish', () => {
    it('atomically replaces ACTIVE with the complete draft', async () => {
      const { db, service, draftSection, draftVersion, activeVersion } = setup();
      let version = draftVersion();
      await service.updateSection(draftSection('latest').id, { expectedVersion: version++, title: 'New latest', layoutType: 'THREE_UP' });
      await service.setPlacements(draftSection('latest').id, { expectedVersion: version++, articleIds: ['a5', 'a4', 'a3'] });
      await service.reorderSections({ expectedVersion: version++, sectionIds: [draftSection('bangladesh').id, draftSection('hero').id, draftSection('latest').id] });
      const draftSnapshot = db.snapshot('DRAFT');
      const oldActiveIds = db.state.sections.filter((s) => s.configurationId === 'cfg-active').map((s) => s.id);

      const result = await service.publish(version);

      expect(db.snapshot('ACTIVE')).toEqual(draftSnapshot);
      expect(db.snapshot('DRAFT')).toEqual(draftSnapshot); // draft stays as the editable working copy
      expect(result).toMatchObject({ published: true, activeVersion: 2, sectionCount: 3, placementCount: 6 });
      expect(activeVersion()).toBe(2);
      expect(db.configuration('ACTIVE')!.publishedAt).toBeInstanceOf(Date);
      // Active rows were rebuilt from the draft: nothing of the old set is left behind.
      expect(db.state.sections.filter((s) => s.configurationId === 'cfg-active').every((s) => !oldActiveIds.includes(s.id))).toBe(true);
      expect(db.state.sections.filter((s) => s.configurationId === 'cfg-active')).toHaveLength(3);
    });

    it('creates the ACTIVE configuration when none exists yet', async () => {
      const { db, service, draftVersion } = setup();
      db.state.sections = db.state.sections.filter((s) => s.configurationId !== 'cfg-active');
      db.state.configurations = db.state.configurations.filter((c) => c.status !== 'ACTIVE');
      await service.publish(draftVersion());
      expect(db.configuration('ACTIVE')).toBeDefined();
      expect(db.snapshot('ACTIVE')).toEqual(db.snapshot('DRAFT'));
    });

    it('fails validation when a placed article stopped being public, leaving ACTIVE untouched', async () => {
      const { db, service, draftVersion, activeVersion, publicView } = setup();
      const before = await publicView();
      const activeBefore = db.snapshot('ACTIVE');
      const version = draftVersion();
      db.state.articles.find((a) => a.id === 'a2')!.status = 'ARCHIVED'; // archived after it was placed in the draft

      const error = await rejection(service.publish(version));

      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect(error.getResponse()).toMatchObject({ code: 'HOMEPAGE_PUBLISH_VALIDATION_FAILED' });
      expect(error.getResponse().issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'ARTICLE_INELIGIBLE', articleId: 'a2', reason: 'ARCHIVED' })]));
      expect(db.snapshot('ACTIVE')).toEqual(activeBefore);
      expect(activeVersion()).toBe(1);
      expect(draftVersion()).toBe(version); // failed publish does not consume a draft version
      // The configuration is untouched; the public page only differs because a2 itself is archived
      // (read-time eligibility filtering), not because anything was published.
      const without = (ids: string[]) => ids.filter((id) => id !== 'a2');
      const after = await publicView();
      expect(after.latest).toEqual(without(before.latest));
      expect(after.sectionList.map((s) => [s.key, s.title, s.layout])).toEqual(before.sectionList.map((s) => [s.key, s.title, s.layout]));
    });

    it('validates the whole draft, not just the parts that changed', async () => {
      const { db, service, draftVersion } = setup();
      db.state.sections.find((s) => s.configurationId === 'cfg-draft' && s.key === 'bangladesh')!.layoutType = 'NOT_A_PRESET';
      const error = await rejection(service.publish(draftVersion()));
      expect(error.getResponse().issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INVALID_LAYOUT', sectionKey: 'bangladesh' })]));
    });

    it('leaves the old ACTIVE homepage fully intact if the write crashes half-way', async () => {
      const { db, service, draftSection, draftVersion, activeVersion, publicView } = setup();
      await service.setPlacements(draftSection('hero').id, { expectedVersion: draftVersion(), articleIds: ['a5'] });
      const before = await publicView();
      const activeBefore = db.snapshot('ACTIVE');
      const activeIdsBefore = db.state.sections.filter((s) => s.configurationId === 'cfg-active').map((s) => s.id);
      const version = draftVersion();
      db.failOn('homepageSection.create', 1); // ACTIVE sections are already deleted and the first one recreated when this throws

      await expect(service.publish(version)).rejects.toThrow('injected failure');

      expect(db.snapshot('ACTIVE')).toEqual(activeBefore);
      expect(db.state.sections.filter((s) => s.configurationId === 'cfg-active').map((s) => s.id)).toEqual(activeIdsBefore);
      expect(activeVersion()).toBe(1);
      expect(draftVersion()).toBe(version);
      expect(await publicView()).toEqual(before);
      expect(before.hero).toBe('a1'); // the un-published hero edit never leaked
    });
  });

  describe('preview', () => {
    it('renders the DRAFT through the public composition while the public site still shows ACTIVE', async () => {
      const { service, draftSection, draftVersion, publicView, trending, mostRead } = setup();
      await service.updateSection(draftSection('latest').id, { expectedVersion: draftVersion(), title: 'Draft-only title', layoutType: 'COMPACT_LIST' });
      await service.setPlacements(draftSection('hero').id, { expectedVersion: draftVersion(), articleIds: ['a5'] });

      const preview: any = await service.previewDraft();

      expect(preview.hero.id).toBe('a5');
      expect(preview.latest.map((a: any) => a.id)).toEqual(['a1', 'a2', 'a3']);
      expect(preview.sectionList.find((s: any) => s.key === 'latest')).toMatchObject({ title: 'Draft-only title', layout: 'COMPACT_LIST' });
      expect(preview.preview).toMatchObject({ status: 'DRAFT', version: 3, source: 'CONFIGURED' });
      // Same contract as public: algorithmic parts are present and unchanged.
      expect(preview.trending).toEqual([{ id: 'trend-1' }]);
      expect(preview.mostRead).toEqual([{ id: 'read-1' }]);
      expect(trending.getTrending).toHaveBeenCalled();
      expect(mostRead.getMostRead).toHaveBeenCalled();
      expect((await publicView()).hero).toBe('a1');
    });

    it('never shows ineligible draft articles in the preview', async () => {
      const { db, service } = setup();
      db.state.articles.find((a) => a.id === 'a3')!.status = 'ARCHIVED';
      const preview: any = await service.previewDraft();
      expect(preview.latest.map((a: any) => a.id)).toEqual(['a1', 'a2']);
    });
  });
});
