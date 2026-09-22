import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import LatestPage from './LatestPage';
import { LanguageProvider } from '@/lib/i18n';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/latest', search: '' }),
}));

vi.mock('@/components/SeoHead', () => ({ default: () => null }));

let mockLatestQuery: () => { data: unknown; isLoading: boolean; error: unknown };
vi.mock('@tanstack/react-query', () => ({ useQuery: () => mockLatestQuery() }));

function renderLatestPage() {
  return renderToStaticMarkup(
    <LanguageProvider>
      <LatestPage />
    </LanguageProvider>,
  );
}

const article = { id: 'a1', title: 'Fresh Story One', slug: 'fresh-story-one', excerpt: 'Dek.', publishedAt: '2026-09-22T06:00:00.000Z' };

describe('LatestPage', () => {
  it('shows a skeleton while loading', () => {
    mockLatestQuery = () => ({ data: undefined, isLoading: true, error: null });
    const markup = renderLatestPage();
    expect(markup).toContain('animate-pulse');
  });

  it('shows a friendly error instead of crashing', () => {
    mockLatestQuery = () => ({ data: undefined, isLoading: false, error: new Error('API error: 500') });
    const markup = renderLatestPage();
    expect(markup).toContain('কিছু ভুল হয়েছে');
  });

  it('renders the unfiltered published feed, newest first, with no category filter applied', () => {
    mockLatestQuery = () => ({
      data: { data: [article], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } },
      isLoading: false,
      error: null,
    });
    const markup = renderLatestPage();
    expect(markup).toContain('Fresh Story One');
    expect(markup).toContain('সর্বশেষ'); // common.latest (bn default) heading
  });

  it('shows the empty-state notice, never fake articles, when nothing is published yet', () => {
    mockLatestQuery = () => ({ data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }, isLoading: false, error: null });
    const markup = renderLatestPage();
    expect(markup).toContain('কোনো সংবাদ পাওয়া যায়নি');
  });
});
