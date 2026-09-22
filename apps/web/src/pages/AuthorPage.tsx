import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, isNotFoundError, withLang } from '@/lib/api';
import SeoHead from '@/components/SeoHead';
import { Skeleton } from '@/components/Skeleton';
import { Container } from '@/components/Container';
import Breadcrumbs from '@/components/Breadcrumbs';
import DiscoveryFeed from '@/components/DiscoveryFeed';
import { type EditorialArticle } from '@/components/editorial';
import { publicArticleRoutes } from '@/lib/public-routes';
import NotFoundPage from './NotFoundPage';
import { useLanguage } from '@/lib/i18n';

interface Meta { page: number; limit: number; total: number; totalPages: number }
interface ArticlesResponse { data: EditorialArticle[]; meta: Meta }

/** Deliberately just id + name — see PublicService.getAuthorProfile: there is no public bio/avatar field. */
interface AuthorProfile {
  id: string;
  name: string;
}

export default function AuthorPage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const { code, t, pathFor } = useLanguage();

  // Real author record (GET /public/authors/:id) — never inferred from the first article in the list,
  // which would wrongly fall back to a placeholder name for an author with zero published articles.
  // This is also the one query that tells us whether the author id genuinely exists (404 if not).
  const { data: author, isLoading: authorLoading, error: authorError } = useQuery<AuthorProfile>({
    queryKey: ['author-detail', id],
    queryFn: () => apiFetch(`/public/authors/${encodeURIComponent(id || '')}`),
    enabled: !!id,
    retry: false,
  });

  const { data, isLoading: articlesLoading, error: articlesError } = useQuery<ArticlesResponse>({
    queryKey: ['author', id, page, code],
    queryFn: () => apiFetch(withLang(`${publicArticleRoutes.author(id || '')}?page=${page}&limit=20`, code)),
    enabled: !!id && !!author, // wait for the author to be confirmed real before listing their articles
  });

  if (authorError && isNotFoundError(authorError)) return <NotFoundPage />;

  const isLoading = authorLoading || (!!author && articlesLoading);
  if (isLoading) {
    return (
      <Container className="py-8">
        <Skeleton className="mb-6 h-10 w-48" />
        <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
          <Skeleton className="aspect-video w-full" />
          <div className="space-y-5"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>
        </div>
      </Container>
    );
  }

  if (authorError || articlesError) {
    return <Container className="py-16 text-center"><h1 className="text-xl font-bold">{t('common.somethingWrong')}</h1><p className="mt-2 text-neutral-600">{t('common.unableToLoad')}</p></Container>;
  }

  if (!author) return <NotFoundPage />;

  const articles = data?.data || [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: author.name,
    inLanguage: code,
  };

  return <>
    <SeoHead
      title={`${author.name} - BD News`}
      description={t('common.newsFrom', { name: author.name })}
      url={typeof window !== 'undefined' ? `${window.location.origin}${pathFor(`/author/${id}`, code)}` : undefined}
      jsonLd={jsonLd}
    />
    <Container className="py-6 lg:py-8">
      <Breadcrumbs items={[{ label: author.name }]} />
      <header className="mb-6 border-b-2 border-neutral-900 pb-3">
        <h1 className="text-3xl font-bold text-neutral-950 sm:text-4xl">{author.name}</h1>
      </header>
      <DiscoveryFeed
        articles={articles}
        meta={data?.meta}
        onPageChange={setPage}
        title={author.name}
        emptyMessage={t('common.noArticlesFound')}
        feedHeadingId="author-latest"
      />
    </Container>
  </>;
}
