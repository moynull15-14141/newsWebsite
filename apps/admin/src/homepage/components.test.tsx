import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';
import HomepagePreviewPage from '../pages/HomepagePreviewPage';
import { parseApiError } from '../lib/api-error';
import ConflictBanner from './ConflictBanner';
import ErrorAlert from './ErrorAlert';
import HeroPanel from './HeroPanel';
import IssuesPanel from './IssuesPanel';
import PreviewCanvas from './PreviewCanvas';
import SectionCard from './SectionCard';
import StatusBar from './StatusBar';
import StoryRow from './StoryRow';
import { draft, placement, section } from './fixtures';
import type { PreviewData } from './types';

const noop = () => undefined;
const render = (node: React.ReactElement) => renderToStaticMarkup(<StaticRouter location="/homepage">{node}</StaticRouter>);
/**
 * The first <button> whose markup matches, with the class attribute removed so a Tailwind `disabled:` variant
 * in the class list is never mistaken for the real `disabled` attribute.
 */
const button = (markup: string, label: RegExp) =>
  ([...markup.matchAll(/<button\b[^>]*>(.*?)<\/button>/gs)].map((m) => m[0]).find((html) => label.test(html)) ?? '').replace(/ class="[^"]*"/, '');

describe('StatusBar', () => {
  const bar = (overrides: Parameters<typeof draft>[0], local: { pending?: string | null; conflict?: boolean } = {}) =>
    render(<StatusBar draft={draft(overrides)} active={{ id: 'a', status: 'ACTIVE', version: 3, publishedAt: '2026-05-01T00:00:00Z', updatedAt: null, sections: [] }} pending={local.pending ?? null} conflict={local.conflict ? parseApiError(409, JSON.stringify({ code: 'HOMEPAGE_DRAFT_CONFLICT', message: 's', expectedVersion: 1, currentVersion: 2 })) : null} onReload={noop} onPublish={noop} />);

  it('enables Publish only when there are unpublished changes and the draft is publishable', () => {
    const markup = bar({ hasUnpublishedChanges: true, publishable: true });
    expect(button(markup, /Publish homepage/)).not.toMatch(/disabled/);
    expect(markup).toContain('Unpublished changes');
  });

  it('disables Publish and says so when there are no unpublished changes', () => {
    const markup = bar({ hasUnpublishedChanges: false });
    expect(button(markup, /Publish homepage/)).toMatch(/disabled/);
    expect(markup).toContain('No unpublished changes');
  });

  it('disables Publish and shows the issue count when the draft has validation issues', () => {
    const markup = bar({ publishable: false, issues: [{ code: 'X', message: 'm' }, { code: 'Y', message: 'n' }] });
    expect(button(markup, /Publish homepage/)).toMatch(/disabled/);
    expect(markup).toContain('Cannot publish — 2 validation issues');
  });

  it('disables Publish while a mutation is in flight', () => {
    const markup = bar({}, { pending: 'Saving…' });
    expect(button(markup, /Publish homepage/)).toMatch(/disabled/);
    expect(markup).toContain('Saving…');
  });

  it('shows the conflict state and disables Publish', () => {
    const markup = bar({}, { conflict: true });
    expect(markup).toContain('Conflict — reload required');
    // The banner (with its Reload button) lives INSIDE the sticky status bar so it stays visible while scrolled.
    expect(markup).toContain('The homepage draft changed since you loaded it.');
    expect(markup).toContain('Reload latest draft');
    expect(button(markup, /Publish homepage/)).toMatch(/disabled/);
  });

  it('distinguishes draft from live and shows versions, with a link to the DRAFT preview route', () => {
    const markup = bar({ version: 11 });
    expect(markup).toContain('Editing draft');
    expect(markup).toContain('Draft v11');
    expect(markup).toContain('Live: published');
    expect(markup).toContain('(v3)');
    expect(markup).toContain('href="/homepage/preview"');
  });

  it('describes why Publish is unavailable for assistive tech', () => {
    expect(bar({ hasUnpublishedChanges: false })).toContain('There are no unpublished changes to publish.');
  });
});

describe('IssuesPanel', () => {
  it('renders nothing for a clean draft', () => {
    expect(render(<IssuesPanel draft={draft()} />)).toBe('');
  });

  it('lists server issues in editor language and links to the affected section', () => {
    const d = draft({ publishable: false, issues: [{ code: 'ARTICLE_INELIGIBLE', message: 'm', sectionKey: 'latest', articleId: 'a2', reason: 'ARCHIVED' }, { code: 'HERO_MULTIPLE', message: 'm' }] });
    const markup = render(<IssuesPanel draft={d} />);
    expect(markup).toContain('2 problems must be fixed');
    expect(markup).toContain('“Headline a2” in “Latest” is archived. Remove or replace it.');
    expect(markup).toContain('more than one Hero section');
    expect(markup).toContain('href="#section-latest"');
  });
});

describe('ErrorAlert', () => {
  it('explains a conflict and offers to reload the latest draft, without blaming the user', () => {
    const conflict = parseApiError(409, JSON.stringify({ code: 'HOMEPAGE_DRAFT_CONFLICT', message: 'stale', expectedVersion: 1, currentVersion: 2 }));
    const markup = render(<ErrorAlert error={conflict} onReload={noop} />);
    expect(markup).toContain('The homepage draft changed since you loaded it.');
    expect(markup).toContain('Nothing was overwritten');
    expect(markup).toContain('Reload latest draft');
  });

  it('renders 422 issues instead of a generic failure', () => {
    const error = parseApiError(422, JSON.stringify({ code: 'HOMEPAGE_PUBLISH_VALIDATION_FAILED', message: 'The draft cannot be published.', issues: [{ code: 'ARTICLE_INELIGIBLE', message: 'm', sectionKey: 'latest', articleId: 'a1', reason: 'NOT_PUBLISHED' }] }));
    const markup = render(<ErrorAlert error={error} draft={draft()} />);
    expect(markup).toContain('The draft cannot be published.');
    expect(markup).toContain('“Headline a1” in “Latest” is not published. Remove or replace it.');
    expect(markup).not.toContain('Something went wrong');
  });

  it('shows an ordinary server message, and a fallback for non-Error values', () => {
    expect(render(<ErrorAlert error={parseApiError(404, JSON.stringify({ message: 'Homepage section not found' }))} />)).toContain('Homepage section not found');
    expect(render(<ErrorAlert error="weird" />)).toContain('The request failed.');
  });
});

describe('ConflictBanner', () => {
  it('tells the editor what happened and how to recover', () => {
    const markup = render(<ConflictBanner conflict={parseApiError(409, JSON.stringify({ code: 'HOMEPAGE_DRAFT_CONFLICT', message: 's', expectedVersion: 2, currentVersion: 5 }))} busy={false} onReload={noop} />);
    expect(markup).toContain('The homepage draft changed since you loaded it.');
    expect(markup).toContain('you had v2, the latest is v5');
    expect(markup).toContain('Reload latest draft');
    expect(markup).toContain('role="alert"');
  });
});

describe('HeroPanel', () => {
  it('shows an intentional empty state with a way to choose a hero', () => {
    const markup = render(<HeroPanel disabled={false} onChoose={noop} onRemove={noop} onShow={noop} />);
    expect(markup).toContain('No hero story is selected.');
    expect(markup).toContain('Choose hero article');
    expect(markup).not.toContain('Replace article');
  });

  it('shows the selected story with thumbnail, headline, category, author, date and replace/remove actions', () => {
    const hero = section('hero', 'HERO', ['h1']);
    const markup = render(<HeroPanel section={hero} disabled={false} onChoose={noop} onRemove={noop} onShow={noop} />);
    expect(markup).toContain('Headline h1');
    expect(markup).toContain('src="http://localhost/h1.png"');
    expect(markup).toContain('Bangladesh · Admin · 1 May 2026');
    expect(markup).toContain('Replace article');
    expect(markup).toContain('Remove');
    expect(markup).not.toContain('Choose hero article');
  });

  it('uses the Bengali language tag for Bengali headlines', () => {
    const hero = section('hero', 'HERO', [], { placements: [placement('b1', 0, { article: { title: 'গ্রন্থাগার থেকে ডিজিটাল শ্রেণিকক্ষ' }})] });
    expect(render(<HeroPanel section={hero} disabled={false} onChoose={noop} onRemove={noop} onShow={noop} />)).toContain('lang="bn"');
  });

  it('warns when the hero story is no longer eligible and when the hero section is hidden', () => {
    const bad = section('hero', 'HERO', [], { enabled: false, placements: [placement('h1', 0, { eligible: false, article: { status: 'ARCHIVED' } })] });
    const markup = render(<HeroPanel section={bad} disabled={false} onChoose={noop} onRemove={noop} onShow={noop} />);
    expect(markup).toContain('Archived — this story can no longer be the Hero');
    expect(markup).toContain('The Hero is hidden in this draft');
  });

  it('disables actions while saving', () => {
    const markup = render(<HeroPanel section={section('hero', 'HERO', ['h1'])} disabled onChoose={noop} onRemove={noop} onShow={noop} />);
    expect(button(markup, /Replace article/)).toMatch(/disabled/);
    expect(button(markup, />Remove</)).toMatch(/disabled/);
  });
});

describe('StoryRow (accessible up/down controls)', () => {
  const row = (index: number, count: number, extra: Partial<Parameters<typeof StoryRow>[0]> = {}) =>
    render(<ul><StoryRow placement={placement(`s${index}`, index)} index={index} count={count} sectionTitle="Latest" disabled={false} onMove={noop} onReplace={noop} onRemove={noop} {...extra} /></ul>);

  it('disables Move up on the first story and Move down on the last', () => {
    const first = row(0, 3);
    expect(button(first, /Move “Headline s0” up/)).toMatch(/disabled/);
    expect(button(first, /Move “Headline s0” down/)).not.toMatch(/disabled/);
    const last = row(2, 3);
    expect(button(last, /Move “Headline s2” down/)).toMatch(/disabled/);
    expect(button(last, /Move “Headline s2” up/)).not.toMatch(/disabled/);
  });

  it('disables both moves for a lone story', () => {
    const markup = row(0, 1);
    expect(button(markup, /up in/)).toMatch(/disabled/);
    expect(button(markup, /down in/)).toMatch(/disabled/);
  });

  it('gives every icon-only control an accessible name that includes the story and section', () => {
    const markup = row(1, 3);
    for (const label of ['Move “Headline s1” up in “Latest”', 'Move “Headline s1” down in “Latest”', 'Replace “Headline s1” in “Latest”', 'Remove “Headline s1” from “Latest”']) {
      expect(markup).toContain(`aria-label="${label}`);
    }
  });

  it('shows position, thumbnail (or placeholder), category and date; flags ineligible stories', () => {
    expect(row(0, 2)).toContain('Bangladesh · Admin · 1 May 2026');
    const noImage = render(<ul><StoryRow placement={placement('x', 0, { article: { media: null } })} index={0} count={1} sectionTitle="Latest" disabled={false} onMove={noop} onReplace={noop} onRemove={noop} /></ul>);
    expect(noImage).toContain('aria-label="No image"');
    const stale = render(<ul><StoryRow placement={placement('x', 0, { eligible: false, article: { status: 'ARCHIVED' } })} index={0} count={1} sectionTitle="Latest" disabled={false} onMove={noop} onReplace={noop} onRemove={noop} /></ul>);
    expect(stale).toContain('Archived — not eligible for the homepage');
  });

  it('disables every action while a save is in flight', () => {
    const markup = row(1, 3, { disabled: true });
    for (const label of [/up in/, /down in/, /Replace/, /Remove/]) expect(button(markup, label)).toMatch(/disabled/);
  });
});

describe('SectionCard', () => {
  const card = (overrides: Partial<Parameters<typeof SectionCard>[0]> = {}) => {
    const latest = section('latest', 'LATEST', ['a1', 'a2'], { title: 'Latest', maxItems: 3 });
    return render(<SectionCard section={latest} draft={draft()} index={1} total={3} issues={[]} disabled={false} onMove={noop} onToggle={noop} onEdit={noop} onDelete={noop} onAddStories={noop} onMoveStory={noop} onReplaceStory={noop} onRemoveStory={noop} {...overrides} />);
  };

  it('shows title, type, friendly layout name, story count and ordering controls', () => {
    const markup = card();
    expect(markup).toContain('>Latest<');
    expect(markup).toContain('Featured + List');
    expect(markup).not.toContain('FEATURED_STACK');
    expect(markup).toContain('2 of 3 stories');
    expect(markup).toContain('aria-label="Move section “Latest” up (now position 2 of 3)"');
    expect(markup).toContain('aria-label="Move section “Latest” down (now position 2 of 3)"');
    expect(markup).toContain('Curated: stories appear in the order you set here');
  });

  it('disables section Move up at the top and Move down at the bottom', () => {
    expect(button(card({ index: 0 }), /Move section “Latest” up/)).toMatch(/disabled/);
    expect(button(card({ index: 2 }), /Move section “Latest” down/)).toMatch(/disabled/);
  });

  it('presents visibility as an accessible switch and distinguishes hidden from deleted', () => {
    const visible = card();
    expect(visible).toContain('role="switch"');
    expect(visible).toContain('aria-checked="true"');
    const hidden = card({ section: section('latest', 'LATEST', ['a1'], { title: 'Latest', enabled: false }) });
    expect(hidden).toContain('aria-checked="false"');
    expect(hidden).toContain('Hidden in draft');
  });

  it('explains an empty section and offers to add stories', () => {
    const markup = card({ section: section('world', 'WORLD', [], { title: 'World' }) });
    expect(markup).toContain('No stories yet.');
    expect(button(markup, /Add stories/)).not.toMatch(/disabled/);
  });

  it('blocks adding stories to a full section and says why', () => {
    const markup = card({ section: section('world', 'WORLD', ['w1', 'w2'], { title: 'World', maxItems: 2 }) });
    expect(button(markup, /Add stories/)).toMatch(/disabled/);
    expect(markup).toContain('Section is full (2)');
  });

  it('shows the section’s own validation problems', () => {
    const markup = card({ issues: [{ code: 'INVALID_LAYOUT', message: 'm', sectionKey: 'latest' }] });
    expect(markup).toContain('layout that is not supported');
  });

  it('shows the linked category for custom sections', () => {
    const custom = section('custom-1', 'CUSTOM', ['a1'], { title: 'Special Coverage', category: { id: 'c9', name: 'Politics', slug: 'politics' }, categoryId: 'c9' });
    expect(card({ section: custom })).toContain('Links to Politics');
  });
});

describe('Draft preview', () => {
  const data: PreviewData = {
    hero: { id: 'h1', title: 'Draft hero story', slug: 'h', excerpt: 'Summary', media: { id: 'm', publicUrl: 'http://localhost/h.png' } },
    latest: [{ id: 'a1', title: 'Latest one', slug: 'a1' }, { id: 'a2', title: 'Latest two', slug: 'a2' }],
    trending: [{ id: 't1', title: 'Trending one', slug: 't1' }],
    mostRead: [{ id: 'r1', title: 'Most read one', slug: 'r1' }],
    sections: {},
    sectionList: [
      { key: 'world', type: 'WORLD', title: 'World', layout: 'THREE_UP', category: null, articles: [{ id: 'w1', title: 'World one', slug: 'w1' }, { id: 'w2', title: 'World two', slug: 'w2' }, { id: 'w3', title: 'World three', slug: 'w3' }] },
      { key: 'special', type: 'CUSTOM', title: 'Special Coverage', layout: 'COMPACT_LIST', category: null, articles: [{ id: 's1', title: 'Special one', slug: 's1' }, { id: 's2', title: 'Special two', slug: 's2' }] },
    ],
    preview: { status: 'DRAFT', configurationId: 'c', version: 5, updatedAt: '2026-05-01T00:00:00Z', source: 'CONFIGURED' },
  };

  it('renders the draft hero, section titles and layout presets', () => {
    const markup = renderToStaticMarkup(<PreviewCanvas data={data} mode="desktop" />);
    expect(markup).toContain('Draft hero story');
    expect(markup).toContain('>World<');
    expect(markup).toContain('>Special Coverage<');
    expect(markup).toContain('grid-cols-3'); // THREE_UP on desktop
    expect(markup).toContain('data-preview-mode="desktop"');
  });

  it('has a distinct mobile presentation that collapses the multi-column layouts', () => {
    const mobile = renderToStaticMarkup(<PreviewCanvas data={data} mode="mobile" />);
    expect(mobile).toContain('data-preview-mode="mobile"');
    expect(mobile).not.toContain('grid-cols-3');
    expect(mobile).toContain('grid-cols-1');
  });

  it('says most-read/trending are automatic and keeps the preview inert (no links)', () => {
    const markup = renderToStaticMarkup(<PreviewCanvas data={data} mode="desktop" />);
    expect(markup).toContain('automatic and are not part of the draft');
    expect(markup).not.toContain('<a ');
  });

  it('falls back to the first available story when the draft has no hero', () => {
    const markup = renderToStaticMarkup(<PreviewCanvas data={{ ...data, hero: null }} mode="desktop" />);
    expect(markup).toContain('Latest one');
  });

  it('labels the page DRAFT PREVIEW / Not live until published, with a size toggle and a way back', () => {
    const client = new QueryClient();
    const markup = renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location="/homepage"><HomepagePreviewPage /></StaticRouter></QueryClientProvider>);
    expect(markup).toContain('DRAFT PREVIEW');
    expect(markup).toContain('Not live until published');
    expect(markup).toContain('aria-label="Preview size"');
    expect(markup).toContain('Desktop');
    expect(markup).toContain('Mobile');
    expect(markup).toContain('href="/homepage"');
  });
});
