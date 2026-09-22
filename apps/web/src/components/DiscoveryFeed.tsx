import ArticleList from '@/components/ArticleList';
import { LeadStory, StoryRow, type EditorialArticle } from '@/components/editorial';
import { useLanguage } from '@/lib/i18n';

interface Meta { page: number; limit: number; total: number; totalPages: number }

interface DiscoveryFeedProps {
  articles: EditorialArticle[];
  meta?: Meta;
  onPageChange: (page: number) => void;
  /** The page's own display name (category/tag/author/location name) — drives the aria-labels, the
   *  "Latest in X" heading and the archive aside. Never a slug-derived guess; the caller already
   *  resolved real, localized metadata before rendering this. */
  title: string;
  /** Shown instead of the lead+feed layout when there are no published stories at all. */
  emptyMessage: string;
  feedHeadingId: string;
}

/**
 * The lead-story + supporting + paginated-feed + archive-aside layout shared by every discovery page
 * (Category/Tag/Author/Location/Division/District) — extracted so each page only owns its own data
 * fetch (a different entity, a different endpoint) while the editorial presentation stays consistent
 * across the whole site (Part 1/11).
 */
export default function DiscoveryFeed({ articles, meta, onPageChange, title, emptyMessage, feedHeadingId }: DiscoveryFeedProps) {
  const { t } = useLanguage();
  const [lead, ...rest] = articles;
  const supporting = rest.slice(0, 2);
  const feed = rest.slice(2);

  if (!lead) {
    return <p className="py-16 text-center text-neutral-500">{emptyMessage}</p>;
  }

  return (
    <>
      <section aria-label={`${title} top stories`} className="grid gap-7 border-b border-neutral-300 pb-8 md:grid-cols-[minmax(0,2fr)_minmax(15rem,1fr)] md:divide-x md:divide-neutral-300">
        <LeadStory article={lead} />
        <div className="md:pl-7">{supporting.map((article) => <StoryRow key={article.id} article={article} compact />)}</div>
      </section>
      {(feed.length > 0 || (meta?.totalPages ?? 0) > 1) && (
        <section aria-labelledby={feedHeadingId} className="mt-9 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <h2 id={feedHeadingId} className="mb-5 border-y border-neutral-300 py-3 text-xl font-bold">{t('common.latestIn', { name: title })}</h2>
            <ArticleList articles={feed.length ? feed : articles} showPagination meta={meta} onPageChange={onPageChange} />
          </div>
          <aside className="hidden border-l border-neutral-300 pl-8 lg:block" aria-label={`${title} archive`}>
            <p className="border-t-4 border-primary-600 py-3 text-lg font-bold">{t('common.browse')} {title}</p>
            <p className="text-sm leading-6 text-neutral-600">
              {t('common.page')} {meta?.page} {t('common.of')} {meta?.totalPages || 1}
              <br />
              {meta?.total || 0} {t('common.publishedStories')}
            </p>
          </aside>
        </section>
      )}
    </>
  );
}
