import { HOMEPAGE_LAYOUT_PRESETS, isLayoutPreset, isRepeatableType, normalizeLayoutPreset } from './homepage.constants';
import { configurationSignature, validateHomepageSections, ValidatableSection } from './homepage.validation';

const NOW = new Date('2026-06-01T12:00:00Z');
const published = { status: 'PUBLISHED', publishedAt: new Date('2026-05-01T00:00:00Z') };

function section(overrides: Partial<ValidatableSection> = {}): ValidatableSection {
  return { key: 'latest', type: 'LATEST', title: 'Latest', layoutType: 'FEATURED_STACK', maxItems: 4, placements: [{ articleId: 'a1', article: published }], ...overrides };
}

const codes = (sections: ValidatableSection[]) => validateHomepageSections(sections, NOW).map((issue) => issue.code);

describe('layout presets', () => {
  it('exposes exactly the presets the web renders', () => {
    expect([...HOMEPAGE_LAYOUT_PRESETS]).toEqual([
      'FEATURED_STACK', 'TWO_UP', 'THREE_UP', 'FOUR_UP', 'GRID', 'COMPACT_LIST', 'HORIZONTAL_LIST', 'IMAGE_LED', 'TEXT_LED',
    ]);
  });

  it('validates and normalizes stored values', () => {
    expect(isLayoutPreset('THREE_UP')).toBe(true);
    expect(isLayoutPreset('GRID')).toBe(true);
    expect(isLayoutPreset('MOSAIC_XL')).toBe(false);
    expect(isLayoutPreset(undefined)).toBe(false);
    expect(normalizeLayoutPreset('COMPACT_LIST')).toBe('COMPACT_LIST');
    expect(normalizeLayoutPreset('MOSAIC_XL')).toBe('FEATURED_STACK'); // legacy free-text value
  });

  it('only CUSTOM sections are repeatable', () => {
    expect(isRepeatableType('CUSTOM')).toBe(true);
    ['HERO', 'LATEST', 'BANGLADESH', 'WORLD', 'POLITICS', 'BUSINESS', 'SPORTS', 'TECHNOLOGY', 'ENTERTAINMENT', 'TRENDING', 'MOST_READ'].forEach((type) => expect(isRepeatableType(type)).toBe(false));
  });
});

describe('validateHomepageSections', () => {
  it('accepts a healthy configuration', () => {
    expect(validateHomepageSections([section(), section({ key: 'hero', type: 'HERO', maxItems: 1 })], NOW)).toEqual([]);
  });

  it('accepts an empty configuration and sections without placements', () => {
    expect(validateHomepageSections([], NOW)).toEqual([]);
    expect(validateHomepageSections([section({ placements: [] })], NOW)).toEqual([]);
  });

  it('flags two HERO sections and more than one hero article', () => {
    expect(codes([section({ key: 'hero', type: 'HERO', maxItems: 1 }), section({ key: 'hero-2', type: 'HERO', maxItems: 1 })])).toContain('HERO_MULTIPLE');
    const twoArticles = section({ key: 'hero', type: 'HERO', maxItems: 3, placements: [{ articleId: 'a1', article: published }, { articleId: 'a2', article: published }] });
    expect(codes([twoArticles])).toContain('HERO_PLACEMENT_LIMIT');
  });

  it('flags duplicated singleton types but allows several CUSTOM sections', () => {
    expect(codes([section({ key: 'world', type: 'WORLD' }), section({ key: 'world-2', type: 'WORLD' })])).toContain('DUPLICATE_SECTION_TYPE');
    expect(codes([section({ key: 'custom-1', type: 'CUSTOM' }), section({ key: 'custom-2', type: 'CUSTOM' })])).toEqual([]);
  });

  it('flags duplicate keys', () => {
    expect(codes([section({ key: 'custom-1', type: 'CUSTOM' }), section({ key: 'custom-1', type: 'CUSTOM' })])).toContain('DUPLICATE_SECTION_KEY');
  });

  it('flags unknown layouts, blank titles and bad maxItems', () => {
    expect(codes([section({ layoutType: 'MOSAIC_XL' })])).toContain('INVALID_LAYOUT');
    expect(codes([section({ title: '   ' })])).toContain('EMPTY_TITLE');
    expect(codes([section({ maxItems: 0 })])).toContain('INVALID_MAX_ITEMS');
    expect(codes([section({ maxItems: 999 })])).toContain('INVALID_MAX_ITEMS');
  });

  it('flags more placements than maxItems and duplicate placements', () => {
    expect(codes([section({ maxItems: 1, placements: [{ articleId: 'a1', article: published }, { articleId: 'a2', article: published }] })])).toContain('PLACEMENT_LIMIT_EXCEEDED');
    expect(codes([section({ placements: [{ articleId: 'a1', article: published }, { articleId: 'a1', article: published }] })])).toContain('DUPLICATE_PLACEMENT');
  });

  it('reports each ineligible article with a reason, and collects all problems at once', () => {
    const issues = validateHomepageSections(
      [
        section({
          placements: [
            { articleId: 'ok', article: published },
            { articleId: 'draft', article: { status: 'DRAFT', publishedAt: null } },
            { articleId: 'gone', article: { status: 'ARCHIVED', publishedAt: published.publishedAt } },
            { articleId: 'soon', article: { status: 'PUBLISHED', publishedAt: new Date('2026-12-01T00:00:00Z') } },
            { articleId: 'missing', article: null },
          ],
        }),
      ],
      NOW,
    ).filter((issue) => issue.code === 'ARTICLE_INELIGIBLE');
    expect(issues.map((i) => [i.articleId, i.reason])).toEqual([
      ['draft', 'NOT_PUBLISHED'],
      ['gone', 'ARCHIVED'],
      ['soon', 'SCHEDULED'],
      ['missing', 'NOT_FOUND'],
    ]);
  });
});

describe('configurationSignature', () => {
  const full = (overrides: Record<string, unknown> = {}) => ({ ...section(), enabled: true, categoryId: null, locationId: null, ...overrides }) as any;

  it('is insensitive to ids and stored sortOrder values but sensitive to content and order', () => {
    const a = configurationSignature([full()]);
    expect(configurationSignature([full({ id: 'other', sortOrder: 9 })])).toBe(a);
    expect(configurationSignature([full({ title: 'Changed' })])).not.toBe(a);
    expect(configurationSignature([full({ enabled: false })])).not.toBe(a);
    expect(configurationSignature([full({ layoutType: 'THREE_UP' })])).not.toBe(a);
    const two = [{ articleId: 'a1', article: published }, { articleId: 'a2', article: published }];
    expect(configurationSignature([full({ placements: two })])).not.toBe(configurationSignature([full({ placements: [...two].reverse() })]));
  });
});
