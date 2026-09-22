import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, withLang } from '@/lib/api';
import ArticleList from '@/components/ArticleList';
import SeoHead from '@/components/SeoHead';
import { Skeleton } from '@/components/Skeleton';
import { Container } from '@/components/Container';
import { LeadStory, StoryRow, type EditorialArticle } from '@/components/editorial';
import { useLanguage } from '@/lib/i18n';

interface Meta { page: number; limit: number; total: number; totalPages: number }
interface ApiResponse { data: EditorialArticle[]; meta: Meta }

/**
 * The unfiltered published feed — every PUBLISHED article, newest first, across every category. Unlike
 * CategoryPage this has no taxonomy row behind it (see Header.tsx's FIXED_NAV comment), so it reuses the
 * plain GET /public/articles endpoint rather than a category-scoped one.
 */
export default function LatestPage() {
  const [page, setPage] = useState(1);
  const { code, t, pathFor } = useLanguage();
  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ['latest', page, code],
    queryFn: () => apiFetch(withLang(`/public/articles?page=${page}&limit=20`, code)),
  });

  if (isLoading) return <Container className="py-8"><Skeleton className="mb-6 h-10 w-48" /><div className="grid gap-8 md:grid-cols-[2fr_1fr]"><Skeleton className="aspect-video w-full" /><div className="space-y-5"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div></div></Container>;
  if (error) return <Container className="py-16 text-center"><h1 className="text-xl font-bold">{t('common.somethingWrong')}</h1><p className="mt-2 text-neutral-600">{t('common.unableToLoad')}</p></Container>;

  const title = t('common.latest');
  const articles = data?.data || [];
  const [lead, ...rest] = articles;
  const supporting = rest.slice(0, 2);
  const feed = rest.slice(2);

  return <>
    <SeoHead title={`${title} - BD News`} description={t('common.latestDescription')} url={typeof window !== 'undefined' ? `${window.location.origin}${pathFor('/latest', code)}` : undefined} alternates={[{ code: 'bn', url: '/latest' }, { code: 'en', url: '/en/latest' }]} />
    <Container className="py-6 lg:py-8">
      <header className="mb-6 border-b-2 border-neutral-900 pb-3"><h1 className="text-3xl font-bold text-neutral-950 sm:text-4xl">{title}</h1></header>
      {lead ? <>
        <section aria-label={`${title} top stories`} className="grid gap-7 border-b border-neutral-300 pb-8 md:grid-cols-[minmax(0,2fr)_minmax(15rem,1fr)] md:divide-x md:divide-neutral-300">
          <LeadStory article={lead} />
          <div className="md:pl-7">{supporting.map((article) => <StoryRow key={article.id} article={article} compact />)}</div>
        </section>
        {feed.length > 0 && <section aria-labelledby="latest-feed" className="mt-9">
          <h2 id="latest-feed" className="mb-5 border-y border-neutral-300 py-3 text-xl font-bold">{title}</h2>
          <ArticleList articles={feed} showPagination meta={data?.meta} onPageChange={setPage} />
        </section>}
      </> : <p className="py-16 text-center text-neutral-500">{t('common.noArticlesFound')}</p>}
    </Container>
  </>;
}
