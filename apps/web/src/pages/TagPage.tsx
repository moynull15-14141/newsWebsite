import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, isNotFoundError, withLang } from '@/lib/api';
import { localizedField } from '@/lib/localize';
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

interface TagTranslation {
  language?: { id: string; code: string } | null;
  name: string;
  slug: string;
}

interface TagDetail {
  id: string;
  name: string;
  slug: string;
  translations?: TagTranslation[];
}

export default function TagPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState(1);
  const { code, t, pathFor } = useLanguage();

  // Real taxonomy data (GET /tags/:slug is already public) — never a slug-derived guess, and this is
  // also the one query that tells us whether the tag genuinely exists (404 if not).
  const { data: tag, isLoading: tagLoading, error: tagError } = useQuery<TagDetail>({
    queryKey: ['tag-detail', slug],
    queryFn: () => apiFetch(`/public/tags/${encodeURIComponent(slug || '')}`),
    enabled: !!slug,
    retry: false,
  });

  const { data, isLoading: articlesLoading, error: articlesError } = useQuery<ArticlesResponse>({
    queryKey: ['tag', slug, page, code],
    queryFn: () => apiFetch(withLang(`${publicArticleRoutes.tag(slug || '')}?page=${page}&limit=20`, code)),
    enabled: !!slug && !!tag, // wait for the tag to be confirmed real before listing its articles
  });

  if (tagError && isNotFoundError(tagError)) return <NotFoundPage />;

  const isLoading = tagLoading || (!!tag && articlesLoading);
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

  if (tagError || articlesError) {
    return <Container className="py-16 text-center"><h1 className="text-xl font-bold">{t('common.somethingWrong')}</h1><p className="mt-2 text-neutral-600">{t('common.unableToLoad')}</p></Container>;
  }

  if (!tag) return <NotFoundPage />;

  const title = localizedField(tag.name, tag.translations, code, 'name') || tag.name;
  const articles = data?.data || [];
  const alternates = [
    { code: 'bn', url: pathFor(`/tag/${tag.translations?.find((item) => item.language?.code === 'bn')?.slug || tag.slug}`, 'bn') },
    ...((tag.translations || []).filter((item) => item.language?.code && item.language.code !== 'bn').map((item) => ({ code: item.language!.code, url: pathFor(`/tag/${item.slug}`, item.language!.code) }))),
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `#${title}`,
    inLanguage: code,
  };

  return <>
    <SeoHead
      title={`#${title} - BD News`}
      description={t('common.newsFrom', { name: `#${title}` })}
      url={typeof window !== 'undefined' ? `${window.location.origin}${pathFor(`/tag/${slug}`, code)}` : undefined}
      jsonLd={jsonLd}
      alternates={alternates}
    />
    <Container className="py-6 lg:py-8">
      <Breadcrumbs items={[{ label: `#${title}` }]} />
      <header className="mb-6 border-b-2 border-neutral-900 pb-3">
        <h1 className="text-3xl font-bold text-neutral-950 sm:text-4xl">#{title}</h1>
      </header>
      <DiscoveryFeed
        articles={articles}
        meta={data?.meta}
        onPageChange={setPage}
        title={`#${title}`}
        emptyMessage={t('common.noArticlesFound')}
        feedHeadingId="tag-latest"
      />
    </Container>
  </>;
}
