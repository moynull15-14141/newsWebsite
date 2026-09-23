import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import BreakingNewsBanner from './BreakingNewsBanner';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

function renderBanner(items: unknown[] | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (items !== undefined) client.setQueryData(['breaking-news-ticker'], items);
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <BreakingNewsBanner />
    </QueryClientProvider>,
  );
}

const soldItem = {
  id: 'bn-1',
  headline: 'Dhaka Metro announces new schedule',
  articleSlug: null,
  backgroundMode: 'SOLID',
  backgroundColor: '#D32F2F',
  gradientStart: null,
  gradientEnd: null,
  gradientDirection: null,
  textColor: '#FFFFFF',
  badgeBackgroundColor: '#FFFFFF',
  badgeTextColor: '#D32F2F',
  animationSpeedMs: 18000,
};

describe('BreakingNewsBanner', () => {
  it('renders nothing when there is no breaking news', () => {
    expect(renderBanner([])).toBe('');
  });

  it('renders nothing while still loading (no cached data yet)', () => {
    expect(renderBanner(undefined)).toBe('');
  });

  it('renders the Breaking badge and headline for a single item', () => {
    const markup = renderBanner([soldItem]);
    expect(markup).toContain('Breaking');
    expect(markup).toContain('Dhaka Metro announces new schedule');
  });

  it('renders every active item in the continuous strip, not just the first one', () => {
    const markup = renderBanner([soldItem, { ...soldItem, id: 'bn-2', headline: 'Second headline' }]);
    expect(markup).toContain('Dhaka Metro announces new schedule');
    expect(markup).toContain('Second headline');
  });

  it('wraps each duplicated set in its own flex-shrink-0 container, ready to receive a measured min-width floor — a single short headline must not just wiggle by its own text width instead of crossing the whole bar', () => {
    const markup = renderBanner([soldItem]);
    expect(markup.match(/class="flex shrink-0 items-center"/g)?.length).toBe(2); // one wrapper per duplicated set
  });

  it('duplicates the strip content once for a seamless loop (each headline appears twice)', () => {
    const markup = renderBanner([soldItem]);
    expect(markup.split('Dhaka Metro announces new schedule')).toHaveLength(3); // 2 occurrences -> 3 split parts
  });

  it('sums per-item speeds into the track\'s total loop duration, so more items take proportionally longer', () => {
    const markup = renderBanner([{ ...soldItem, animationSpeedMs: 10000 }, { ...soldItem, id: 'bn-2', animationSpeedMs: 8000 }]);
    expect(markup).toContain('animation-duration:18000ms');
  });

  it('renders the headline as a link to the article when one is linked and eligible', () => {
    const markup = renderBanner([{ ...soldItem, articleSlug: 'metro-opens' }]);
    expect(markup).toContain('href="/article/metro-opens"');
  });

  it('renders the headline as plain text (no link) when no article is linked', () => {
    const markup = renderBanner([soldItem]);
    expect(markup).not.toContain('<a');
  });

  it('applies admin-controlled solid background color', () => {
    const markup = renderBanner([{ ...soldItem, backgroundColor: '#123456' }]);
    expect(markup).toContain('background:#123456');
  });

  it('applies an admin-controlled gradient background', () => {
    const markup = renderBanner([{ ...soldItem, backgroundMode: 'GRADIENT', gradientStart: '#111111', gradientEnd: '#222222', gradientDirection: 'LEFT_RIGHT' }]);
    expect(markup).toContain('background:linear-gradient(to right, #111111, #222222)');
  });

  it('applies admin-controlled text and badge colors', () => {
    const markup = renderBanner([{ ...soldItem, textColor: '#ABCDEF', badgeBackgroundColor: '#111111', badgeTextColor: '#EEEEEE' }]);
    expect(markup).toContain('color:#ABCDEF');
    expect(markup).toContain('background-color:#111111');
    expect(markup).toContain('color:#EEEEEE');
  });

  it('includes the accessible region label', () => {
    const markup = renderBanner([soldItem]);
    expect(markup).toContain('aria-label="Breaking news"');
  });
});
