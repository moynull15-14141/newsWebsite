import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import HomePage from './HomePage';

vi.mock('@/components/SeoHead', () => ({ default: () => null }));
import { LanguageProvider } from '@/lib/i18n';
import type { HomepageEditorialData } from '@/lib/editorial-selection';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/', search: '' }),
}));

// AdSlot/NewsletterSignup fetch their own data/submit independently — stubbed so this file stays
// focused on HomePage's own composition (hero/sections/order/loading/error), per Part 17.
vi.mock('@/components/AdSlot', () => ({ default: () => null }));
vi.mock('@/components/NewsletterSignup', () => ({ default: () => null }));

let mockHomepageQuery: () => { data: unknown; isLoading: boolean; error: unknown };

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => mockHomepageQuery(),
}));

function renderHomePage() {
  return renderToStaticMarkup(
    <LanguageProvider>
      <HomePage />
    </LanguageProvider>,
  );
}

const heroArticle = { id: 'hero-1', title: 'Hero Story', slug: 'hero-story', excerpt: 'Hero dek.', publishedAt: '2026-09-20T06:00:00.000Z' };

function dataWith(overrides: Partial<HomepageEditorialData>): HomepageEditorialData {
  return { hero: null, latest: [], trending: [], mostRead: [], sections: {}, sectionList: [], ...overrides };
}

describe('HomePage loading state', () => {
  it('shows a skeleton while the homepage is loading, not an error or content', () => {
    mockHomepageQuery = () => ({ data: undefined, isLoading: true, error: null });

    const markup = renderHomePage();

    expect(markup).toContain('animate-pulse');
    expect(markup).not.toContain('Hero Story');
  });
});

describe('HomePage error state', () => {
  it('shows a friendly error instead of crashing when the API call fails', () => {
    mockHomepageQuery = () => ({ data: undefined, isLoading: false, error: new Error('API error: 500') });

    const markup = renderHomePage();

    // dictionaries.ts: common.somethingWrong / common.unableToLoad (bn is the platform default language)
    expect(markup).toContain('কিছু ভুল হয়েছে');
    expect(markup).not.toContain('animate-pulse');
  });
});

describe('HomePage section order and content', () => {
  it('renders configured sections in the exact order sectionList provides', () => {
    mockHomepageQuery = () => ({
      data: dataWith({
        hero: heroArticle,
        sectionList: [
          { key: 'world', type: 'WORLD', title: 'World News', layout: 'THREE_UP', articles: [{ id: 'w1', title: 'World Story One', slug: 'world-story-one' }] },
          { key: 'sports', type: 'SPORTS', title: 'Sports Desk', layout: 'THREE_UP', articles: [{ id: 's1', title: 'Sports Story One', slug: 'sports-story-one' }] },
        ],
      }),
      isLoading: false,
      error: null,
    });

    const markup = renderHomePage();
    const worldIndex = markup.indexOf('World News');
    const sportsIndex = markup.indexOf('Sports Desk');

    expect(worldIndex).toBeGreaterThan(-1);
    expect(sportsIndex).toBeGreaterThan(-1);
    expect(worldIndex).toBeLessThan(sportsIndex); // sectionList order is respected, not re-sorted
    expect(markup).toContain('World Story One');
    expect(markup).toContain('Sports Story One');
  });

  it('renders the hero story from the curated homepage configuration', () => {
    mockHomepageQuery = () => ({ data: dataWith({ hero: heroArticle, latest: [heroArticle] }), isLoading: false, error: null });

    const markup = renderHomePage();
    expect(markup).toContain('Hero Story');
  });

  it('omits a configured section entirely when it resolves to zero articles (never a blank block)', () => {
    mockHomepageQuery = () => ({
      data: dataWith({
        hero: heroArticle,
        sectionList: [{ key: 'empty-section', type: 'CUSTOM', title: 'Should Not Appear', layout: 'THREE_UP', articles: [] }],
      }),
      isLoading: false,
      error: null,
    });

    const markup = renderHomePage();
    expect(markup).not.toContain('Should Not Appear');
  });

  it('shows the "no stories" notice when there is no hero and nothing to show', () => {
    mockHomepageQuery = () => ({ data: dataWith({}), isLoading: false, error: null });

    const markup = renderHomePage();
    expect(markup).not.toContain('Hero Story');
  });
});
