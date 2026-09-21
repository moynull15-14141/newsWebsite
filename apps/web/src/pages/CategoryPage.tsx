import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import ArticleList from '@/components/ArticleList';
import SeoHead from '@/components/SeoHead';
import AdSlot from '@/components/AdSlot';
import { Skeleton } from '@/components/Skeleton';
import { Container } from '@/components/Container';
import { LeadStory, StoryRow, type EditorialArticle } from '@/components/editorial';

interface Meta { page: number; limit: number; total: number; totalPages: number }
interface ApiResponse { data: EditorialArticle[]; meta: Meta }

function categoryTitle(slug?: string) {
  return slug?.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'News';
}

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery<ApiResponse>({ queryKey: ['category', slug, page], queryFn: () => apiFetch(`/public/categories/${slug}/articles?page=${page}&limit=20`), enabled: !!slug });
  const title = categoryTitle(slug);

  if (isLoading) return <Container className="py-8"><Skeleton className="mb-6 h-10 w-48" /><div className="grid gap-8 md:grid-cols-[2fr_1fr]"><Skeleton className="aspect-video w-full" /><div className="space-y-5"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div></div></Container>;
  if (error) return <Container className="py-16 text-center"><h1 className="text-xl font-bold">Something went wrong</h1><p className="mt-2 text-neutral-600">Unable to load articles.</p></Container>;

  const articles = data?.data || [];
  const [lead, ...rest] = articles;
  const supporting = rest.slice(0, 2);
  const feed = rest.slice(2);

  return <>
    <SeoHead title={`${title} - BD News`} description={`Latest ${title} news and articles from BD News`} />
    <Container className="py-6 lg:py-8">
      <header className="mb-6 border-b-2 border-neutral-900 pb-3"><h1 className="text-3xl font-bold text-neutral-950 sm:text-4xl">{title}</h1></header>
      <AdSlot slot="CATEGORY_TOP" pageType="category" />
      {lead ? <>
        <section aria-label={`${title} top stories`} className="grid gap-7 border-b border-neutral-300 pb-8 md:grid-cols-[minmax(0,2fr)_minmax(15rem,1fr)] md:divide-x md:divide-neutral-300">
          <LeadStory article={lead} />
          <div className="md:pl-7">{supporting.map((article) => <StoryRow key={article.id} article={article} compact />)}</div>
        </section>
        {feed.length > 0 && <section aria-labelledby="category-latest" className="mt-9 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div><h2 id="category-latest" className="mb-5 border-y border-neutral-300 py-3 text-xl font-bold">Latest in {title}</h2><ArticleList articles={feed} showPagination meta={data?.meta} onPageChange={setPage} /></div>
          <aside className="hidden border-l border-neutral-300 pl-8 lg:block" aria-label="Category archive"><p className="border-t-4 border-primary-600 py-3 text-lg font-bold">Browse {title}</p><p className="text-sm leading-6 text-neutral-600">Page {data?.meta.page} of {data?.meta.totalPages || 1}<br />{data?.meta.total || 0} published stories</p></aside>
        </section>}
      </> : <p className="py-16 text-center text-neutral-500">No articles found.</p>}
    </Container>
  </>;
}
