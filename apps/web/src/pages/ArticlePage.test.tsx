import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ArticlePage from './ArticlePage';
import { LanguageProvider } from '@/lib/i18n';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/article/flood-relief-reaches-sylhet', search: '' }),
  useParams: () => ({ slug: 'flood-relief-reaches-sylhet' }),
}));

// Child sections fetch their own data (comments, ads, bookmarks) — stubbed out so this file stays
// focused on ArticlePage's own rendering (headline/dek/metadata/body/tags/404), per Part 16.
vi.mock('@/components/CommentsSection', () => ({ default: () => null }));
vi.mock('@/components/AdSlot', () => ({ default: () => null }));
vi.mock('@/components/BookmarkButton', () => ({ default: () => <button type="button">Save</button> }));
vi.mock('@/components/TiptapRenderer', () => ({ default: ({ content }: { content: unknown }) => <div data-testid="body">{JSON.stringify(content)}</div> }));
vi.mock('@/components/ArticleCard', () => ({ default: ({ article }: { article: { title: string } }) => <div data-testid="related-card">{article.title}</div> }));
vi.mock('@/components/SeoHead', () => ({ default: () => null }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(() => Promise.resolve(undefined)) }));

type QueryResult = { data: unknown; isLoading: boolean; error: unknown };
let mockArticleQuery: () => QueryResult;
let mockRelatedQuery: () => QueryResult;

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => (queryKey[0] === 'article' ? mockArticleQuery() : mockRelatedQuery()),
}));

const publishedArticle = {
  id: 'article-1',
  title: 'Flood Relief Reaches Sylhet',
  slug: 'flood-relief-reaches-sylhet',
  excerpt: 'Aid convoys arrived overnight as water levels began to recede.',
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Relief teams distributed supplies across the district.' }] }] },
  publishedAt: '2026-09-20T06:00:00.000Z',
  author: { id: 'author-1', name: 'News Desk' },
  category: { id: 'cat-1', name: 'Bangladesh', slug: 'bangladesh' },
  location: { id: 'loc-1', name: 'Sylhet', slug: 'sylhet', type: 'DISTRICT' },
  articleTags: [{ tag: { id: 'tag-1', name: 'Flood', slug: 'flood' } }],
  language: { id: 'lang-bn', code: 'bn', name: 'Bangla', nativeName: 'বাংলা' },
};

function renderArticlePage() {
  return renderToStaticMarkup(
    <LanguageProvider>
      <ArticlePage />
    </LanguageProvider>,
  );
}

describe('ArticlePage loading state', () => {
  it('shows a skeleton while the article is loading, not an error or content', () => {
    mockArticleQuery = () => ({ data: undefined, isLoading: true, error: null });
    mockRelatedQuery = () => ({ data: undefined, isLoading: true, error: null });

    const markup = renderArticlePage();

    expect(markup).toContain('animate-pulse');
    expect(markup).not.toContain('Flood Relief Reaches Sylhet');
  });
});

describe('ArticlePage error / not-found state', () => {
  it('renders a 404 notice when the fetch errors (e.g. draft/unpublished article)', () => {
    mockArticleQuery = () => ({ data: undefined, isLoading: false, error: new Error('API error: 404') });
    mockRelatedQuery = () => ({ data: undefined, isLoading: false, error: null });

    const markup = renderArticlePage();

    expect(markup).toContain('404');
    expect(markup).not.toContain('Flood Relief Reaches Sylhet');
  });

  it('renders a 404 notice when there is no error but also no article data', () => {
    mockArticleQuery = () => ({ data: undefined, isLoading: false, error: null });
    mockRelatedQuery = () => ({ data: undefined, isLoading: false, error: null });

    const markup = renderArticlePage();

    expect(markup).toContain('404');
  });
});

describe('ArticlePage published article content', () => {
  it('renders the editorial hierarchy: category, headline, dek, author/date, body, tags', () => {
    mockArticleQuery = () => ({ data: publishedArticle, isLoading: false, error: null });
    mockRelatedQuery = () => ({ data: [], isLoading: false, error: null });

    const markup = renderArticlePage();

    expect(markup).toContain('Bangladesh'); // category context
    expect(markup).toContain('Flood Relief Reaches Sylhet'); // headline
    expect(markup).toContain('Aid convoys arrived overnight'); // dek/summary
    expect(markup).toContain('News Desk'); // author metadata
    expect(markup).toContain('Relief teams distributed supplies'); // body, via the (mocked) TiptapRenderer
    expect(markup).toContain('href="/tag/flood"'); // tag chip links to the tag page
    expect(markup).toContain('Flood'); // tag name
  });

  it('renders related articles when the API supplies them', () => {
    mockArticleQuery = () => ({ data: publishedArticle, isLoading: false, error: null });
    mockRelatedQuery = () => ({ data: [{ id: 'a2', title: 'Second Story', slug: 'second-story' }], isLoading: false, error: null });

    const markup = renderArticlePage();

    expect(markup).toContain('related-card');
    expect(markup).toContain('Second Story');
  });

  it('omits the related section entirely when none are returned', () => {
    mockArticleQuery = () => ({ data: publishedArticle, isLoading: false, error: null });
    mockRelatedQuery = () => ({ data: [], isLoading: false, error: null });

    const markup = renderArticlePage();

    expect(markup).not.toContain('related-card');
  });
});

describe('ArticlePage featured image', () => {
  it('renders the real featured image URL from the Media Library', () => {
    mockArticleQuery = () => ({ data: { ...publishedArticle, featuredImageUrl: 'http://localhost:3001/api/v1/media/files/media/flood.jpg' }, isLoading: false, error: null });
    mockRelatedQuery = () => ({ data: [], isLoading: false, error: null });

    const markup = renderArticlePage();

    expect(markup).toContain('src="http://localhost:3001/api/v1/media/files/media/flood.jpg"');
  });

  it('falls back to media.publicUrl when featuredImageUrl is absent', () => {
    mockArticleQuery = () => ({ data: { ...publishedArticle, media: { id: 'm1', publicUrl: 'http://localhost/media/fallback.jpg' } }, isLoading: false, error: null });
    mockRelatedQuery = () => ({ data: [], isLoading: false, error: null });

    const markup = renderArticlePage();

    expect(markup).toContain('src="http://localhost/media/fallback.jpg"');
  });

  it('renders no image figure at all when the article has no image — no broken placeholder', () => {
    mockArticleQuery = () => ({ data: publishedArticle, isLoading: false, error: null }); // no image field set
    mockRelatedQuery = () => ({ data: [], isLoading: false, error: null });

    const markup = renderArticlePage();

    expect(markup).not.toContain('<figure');
    expect(markup).not.toContain('<img');
  });
});
