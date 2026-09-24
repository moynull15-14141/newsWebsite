import { describe, expect, it } from 'vitest';
import { draft, placement, section } from './fixtures';
import {
  availableSectionTypes,
  buildPickerPath,
  canMove,
  describeIssue,
  generalIssues,
  heroSection,
  issuesForSection,
  listedSections,
  describeSource,
  isManualSection,
  isManualSource,
  maxItemsBounds,
  requiredSourceLink,
  moveItem,
  placementIds,
  publishState,
  reorderSectionIds,
  resolveDefaultSourceForType,
  summarizeDraft,
  unselectableReason,
} from './logic';

describe('story ordering (up/down controls)', () => {
  it('moves an item one step and returns a new array', () => {
    const original = ['a', 'b', 'c'];
    expect(moveItem(original, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(original, 1, 1)).toEqual(['a', 'c', 'b']);
    expect(original).toEqual(['a', 'b', 'c']);
  });

  it('cannot move the first item up or the last item down', () => {
    expect(canMove(0, 3, -1)).toBe(false);
    expect(canMove(2, 3, 1)).toBe(false);
    expect(canMove(1, 3, -1)).toBe(true);
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });

  it('produces the placement id list that is sent to the placement API', () => {
    const latest = section('latest', 'LATEST', ['a1', 'a2', 'a3']);
    expect(placementIds(latest)).toEqual(['a1', 'a2', 'a3']);
    expect(moveItem(placementIds(latest), 2, -1)).toEqual(['a1', 'a3', 'a2']);
  });
});

describe('section ordering (batch reorder)', () => {
  const base = draft(); // hero, latest, world, business

  it('lists every section except the Hero', () => {
    expect(listedSections(base).map((s) => s.key)).toEqual(['latest', 'world', 'business']);
    expect(heroSection(base)?.key).toBe('hero');
  });

  it('swaps with the visible neighbour and always sends every section id, Hero included', () => {
    expect(reorderSectionIds(base, 'sec-world', -1)).toEqual(['sec-hero', 'sec-world', 'sec-latest', 'sec-business']);
    expect(reorderSectionIds(base, 'sec-latest', 1)).toEqual(['sec-hero', 'sec-world', 'sec-latest', 'sec-business']);
  });

  it('keeps the Hero in its slot even when it is not first', () => {
    const odd = draft({}, [section('latest', 'LATEST'), section('hero', 'HERO'), section('world', 'WORLD')]);
    expect(reorderSectionIds(odd, 'sec-world', -1)).toEqual(['sec-world', 'sec-hero', 'sec-latest']);
  });

  it('refuses impossible moves and unknown ids', () => {
    expect(reorderSectionIds(base, 'sec-latest', -1)).toBeNull();
    expect(reorderSectionIds(base, 'sec-business', 1)).toBeNull();
    expect(reorderSectionIds(base, 'sec-hero', 1)).toBeNull();
    expect(reorderSectionIds(base, 'nope', 1)).toBeNull();
  });
});

describe('publish state', () => {
  const state = (overrides: Parameters<typeof draft>[0], local = { pending: false, conflict: false }) => publishState(draft(overrides), local);

  it('is enabled only with unpublished changes, no validation issues, no request in flight and no conflict', () => {
    expect(state({ hasUnpublishedChanges: true, publishable: true })).toMatchObject({ canPublish: true, reason: 'ready', label: 'Unpublished changes' });
  });

  it('is disabled without unpublished changes', () => {
    expect(state({ hasUnpublishedChanges: false })).toMatchObject({ canPublish: false, reason: 'no-changes', label: 'No unpublished changes' });
  });

  it('is disabled with validation issues and says how many', () => {
    const issues = [{ code: 'ARTICLE_INELIGIBLE', message: 'x' }, { code: 'HERO_MULTIPLE', message: 'y' }];
    expect(state({ publishable: false, issues })).toMatchObject({ canPublish: false, reason: 'issues', label: 'Cannot publish — 2 validation issues', tone: 'danger' });
    expect(state({ publishable: false, issues: issues.slice(0, 1) }).label).toBe('Cannot publish — 1 validation issue');
  });

  it('is disabled while a mutation is in flight', () => {
    expect(state({}, { pending: true, conflict: false })).toMatchObject({ canPublish: false, reason: 'busy' });
  });

  it('is disabled after a conflict, which outranks every other state', () => {
    expect(state({ publishable: false, hasUnpublishedChanges: false }, { pending: true, conflict: true })).toMatchObject({ canPublish: false, reason: 'conflict', label: 'Conflict — reload required' });
  });

  it('trusts the server flags: an unpublishable draft with no changes is reported as unpublishable', () => {
    expect(state({ publishable: false, hasUnpublishedChanges: false, issues: [{ code: 'X', message: 'm' }] }).reason).toBe('issues');
  });
});

describe('draft summary for the publish confirmation', () => {
  it('counts sections, visible sections, stories and names the hero', () => {
    const d = draft({}, [section('hero', 'HERO', ['h1']), section('latest', 'LATEST', ['a1', 'a2']), section('world', 'WORLD', ['w1'], { enabled: false })]);
    expect(summarizeDraft(d)).toEqual({ sections: 3, enabledSections: 2, stories: 4, heroTitle: 'Headline h1' });
  });

  it('reports no hero when the slot is empty', () => {
    expect(summarizeDraft(draft({}, [section('hero', 'HERO', []), section('latest', 'LATEST', ['a1'])])).heroTitle).toBeNull();
    expect(summarizeDraft(draft({}, [section('latest', 'LATEST', ['a1'])])).heroTitle).toBeNull();
  });
});

describe('section type and limit rules', () => {
  it('does not offer singleton types that already exist, but always offers CUSTOM', () => {
    const types = availableSectionTypes(draft());
    expect(types).not.toContain('LATEST');
    expect(types).not.toContain('WORLD');
    expect(types).not.toContain('BUSINESS');
    expect(types).toContain('BANGLADESH');
    expect(types).toContain('CUSTOM');
    const withCustom = availableSectionTypes(draft({}, [section('custom-1', 'CUSTOM'), section('custom-2', 'CUSTOM')]));
    expect(withCustom).toContain('CUSTOM');
  });

  it('never offers HERO, TRENDING or MOST_READ (hero has its own panel; the others are algorithmic)', () => {
    const types = availableSectionTypes(draft({}, []));
    expect(types).not.toContain('HERO');
    expect(types).not.toContain('TRENDING');
    expect(types).not.toContain('MOST_READ');
  });

  it('fixes the Hero limit at one and stops other sections dropping below their placed stories', () => {
    expect(maxItemsBounds(section('hero', 'HERO', ['h1']))).toEqual({ min: 1, max: 1, fixed: true });
    expect(maxItemsBounds(section('latest', 'LATEST', ['a', 'b', 'c']))).toEqual({ min: 3, max: 24, fixed: false });
    expect(maxItemsBounds(section('world', 'WORLD', []))).toEqual({ min: 1, max: 24, fixed: false });
  });
});

describe('validation issues in editor language', () => {
  const d = draft({}, [section('hero', 'HERO', ['h1']), section('latest', 'LATEST', ['a1', 'a2'], { title: 'Latest' })]);

  it('names the story, the section and how to fix an ineligible article', () => {
    const text = describeIssue({ code: 'ARTICLE_INELIGIBLE', message: 'Article is archived.', sectionKey: 'latest', articleId: 'a2', reason: 'ARCHIVED' }, d);
    expect(text).toBe('“Headline a2” in “Latest” is archived. Remove or replace it.');
  });

  it('uses supplied titles for articles that are not in the draft yet', () => {
    const text = describeIssue({ code: 'ARTICLE_INELIGIBLE', message: 'm', sectionKey: 'latest', articleId: 'new', reason: 'NOT_PUBLISHED' }, d, { new: 'Brand new story' });
    expect(text).toBe('“Brand new story” in “Latest” is not published. Remove or replace it.');
  });

  it.each([
    ['HERO_MULTIPLE', /more than one Hero section/],
    ['HERO_PLACEMENT_LIMIT', /Hero can show only one story/],
    ['PLACEMENT_LIMIT_EXCEEDED', /more stories than it can show/],
    ['INVALID_LAYOUT', /layout that is not supported/],
    ['EMPTY_TITLE', /needs a title/],
    ['DUPLICATE_PLACEMENT', /more than once/],
  ])('explains %s', (code, pattern) => {
    expect(describeIssue({ code, message: 'server', sectionKey: 'latest' }, d)).toMatch(pattern);
  });

  it('falls back to the server message for unknown codes', () => {
    expect(describeIssue({ code: 'SOMETHING_NEW', message: 'A brand new server rule.' }, d)).toBe('A brand new server rule.');
  });

  it('associates issues with sections by key', () => {
    const withIssues = draft({ publishable: false, issues: [{ code: 'A', message: 'a', sectionKey: 'latest' }, { code: 'B', message: 'b', sectionKey: 'hero' }, { code: 'C', message: 'c' }] });
    expect(issuesForSection(withIssues, 'latest').map((i) => i.code)).toEqual(['A']);
    expect(generalIssues(withIssues).map((i) => i.code)).toEqual(['C']);
  });
});

describe('article picker rules', () => {
  it('always asks the catalogue for PUBLISHED stories, newest first', () => {
    const url = new URL(`http://x${buildPickerPath({ page: 1, search: '', categoryId: '' })}`);
    expect(url.pathname).toBe('/articles');
    expect(url.searchParams.get('status')).toBe('PUBLISHED');
    expect(url.searchParams.get('sort')).toBe('publishedAt');
    expect(url.searchParams.get('order')).toBe('desc');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.has('search')).toBe(false);
    expect(url.searchParams.has('categoryId')).toBe(false);
  });

  it('adds trimmed search, category and page, and keeps PUBLISHED regardless', () => {
    const url = new URL(`http://x${buildPickerPath({ page: 3, search: '  শিক্ষা  ', categoryId: 'cat-1' })}`);
    expect(url.searchParams.get('search')).toBe('শিক্ষা');
    expect(url.searchParams.get('categoryId')).toBe('cat-1');
    expect(url.searchParams.get('page')).toBe('3');
    expect(url.searchParams.get('status')).toBe('PUBLISHED');
  });

  it('greys out anything that is not publicly eligible, mirroring the API rule', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    expect(unselectableReason({ status: 'PUBLISHED', publishedAt: '2026-05-01T00:00:00Z' }, now)).toBeNull();
    expect(unselectableReason({ status: 'PUBLISHED', publishedAt: null }, now)).toBeNull();
    expect(unselectableReason({ status: 'PUBLISHED', publishedAt: '2026-07-01T00:00:00Z' }, now)).toBe('SCHEDULED');
    for (const status of ['DRAFT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED']) expect(unselectableReason({ status, publishedAt: null }, now)).toBe('NOT_PUBLISHED');
  });
});

describe('placement fixtures sanity', () => {
  it('builds placements in order', () => {
    expect(placement('x', 2).sortOrder).toBe(2);
  });
});

describe('content sources', () => {
  it('recognises hand-picked sections', () => {
    expect(isManualSource('MANUAL')).toBe(true);
    for (const source of ['LATEST', 'CATEGORY', 'TAG', 'LOCATION']) expect(isManualSource(source)).toBe(false);
    expect(isManualSection(section('latest', 'LATEST', ['a1']))).toBe(true);
    expect(isManualSection(section('latest', 'LATEST', [], { sourceType: 'LATEST' }))).toBe(false);
  });

  it('states which link each source needs', () => {
    expect(requiredSourceLink('MANUAL')).toBeNull();
    expect(requiredSourceLink('LATEST')).toBeNull();
    expect(requiredSourceLink('CATEGORY')).toBe('categoryId');
    expect(requiredSourceLink('TAG')).toBe('tagId');
    expect(requiredSourceLink('LOCATION')).toBe('locationId');
  });

  it('describes each source for the section header', () => {
    expect(describeSource(section('s', 'CUSTOM', ['a1']))).toBe('Hand-picked');
    expect(describeSource(section('s', 'CUSTOM', [], { sourceType: 'LATEST' }))).toBe('Latest published');
    expect(describeSource(section('s', 'CUSTOM', [], { sourceType: 'CATEGORY', category: { id: 'c', name: 'Politics', slug: 'politics' } }))).toBe('Category: Politics');
    expect(describeSource(section('s', 'CUSTOM', [], { sourceType: 'TAG', tag: { id: 't', name: 'Election', slug: 'election' } }))).toBe('Tag: Election');
    expect(describeSource(section('s', 'CUSTOM', [], { sourceType: 'LOCATION', location: { id: 'l', name: 'Dhaka', slug: 'dhaka', type: 'DIVISION' } }))).toBe('Location: Dhaka');
  });

  it('says when an automatic source is missing its link', () => {
    expect(describeSource(section('s', 'CUSTOM', [], { sourceType: 'CATEGORY' }))).toBe('Category: not set');
    expect(describeSource(section('s', 'CUSTOM', [], { sourceType: 'TAG' }))).toBe('Tag: not set');
    expect(describeSource(section('s', 'CUSTOM', [], { sourceType: 'LOCATION' }))).toBe('Location: not set');
  });

  it('pins the story limit to placed stories only for hand-picked sections', () => {
    const manual = section('latest', 'LATEST', ['a1', 'a2', 'a3']);
    expect(maxItemsBounds(manual)).toMatchObject({ min: 3, fixed: false });

    // The same section switched to an automatic source holds no placements, so the floor drops to 1.
    expect(maxItemsBounds({ ...manual, sourceType: 'CATEGORY' })).toMatchObject({ min: 1, fixed: false });
  });

  it('keeps the Hero fixed at one story regardless of source', () => {
    expect(maxItemsBounds(section('hero', 'HERO', ['h1']))).toEqual({ min: 1, max: 1, fixed: true });
  });
});

// Regression: picking the "Bangladesh" section type used to leave sourceType at its MANUAL/LATEST
// default, producing a section titled "Bangladesh" that actually showed unfiltered Latest stories — the
// exact bug reported ("added a Bangladesh section but it's not there"). resolveDefaultSourceForType is
// what SectionDialog's type picker now calls to scope the section correctly from the start.
describe('resolveDefaultSourceForType', () => {
  const categories = [{ id: 'cat-world', name: 'World', slug: 'world' }, { id: 'cat-biz', name: 'Business', slug: 'business' }];
  const locations = [
    { id: 'loc-bd', name: 'Bangladesh', slug: 'bangladesh', type: 'COUNTRY' },
    { id: 'loc-dhaka', name: 'Dhaka', slug: 'dhaka', type: 'DIVISION' },
  ];

  it('maps "Bangladesh" to the Location, not the like-named Category', () => {
    expect(resolveDefaultSourceForType('BANGLADESH', categories, locations)).toEqual({
      sourceType: 'LOCATION', categoryId: null, locationId: 'loc-bd',
    });
  });

  it('maps other presets (e.g. "World") to their matching Category', () => {
    expect(resolveDefaultSourceForType('WORLD', categories, locations)).toEqual({
      sourceType: 'CATEGORY', categoryId: 'cat-world', locationId: null,
    });
  });

  it('returns null for types with no sensible auto-link (LATEST, CUSTOM, HERO)', () => {
    expect(resolveDefaultSourceForType('LATEST', categories, locations)).toBeNull();
    expect(resolveDefaultSourceForType('CUSTOM', categories, locations)).toBeNull();
    expect(resolveDefaultSourceForType('HERO', categories, locations)).toBeNull();
  });

  it('returns null (never a wrong guess) when the matching category/location has not loaded yet', () => {
    expect(resolveDefaultSourceForType('BANGLADESH', categories, undefined)).toBeNull();
    expect(resolveDefaultSourceForType('WORLD', undefined, locations)).toBeNull();
  });

  it('only ever matches a COUNTRY-type location for a LOCATION preset, never a division/district sharing the slug', () => {
    const trickyLocations = [{ id: 'loc-bd-district', name: 'Bangladesh', slug: 'bangladesh', type: 'DISTRICT' }];
    expect(resolveDefaultSourceForType('BANGLADESH', categories, trickyLocations)).toBeNull();
  });
});
