import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, isNotFoundError, withLang } from '@/lib/api';
import { localizedField } from '@/lib/localize';
import SeoHead from '@/components/SeoHead';
import AdSlot from '@/components/AdSlot';
import { Skeleton } from '@/components/Skeleton';
import { Container } from '@/components/Container';
import Breadcrumbs from '@/components/Breadcrumbs';
import DiscoveryFeed from '@/components/DiscoveryFeed';
import { type EditorialArticle } from '@/components/editorial';
import NotFoundPage from './NotFoundPage';
import { useLanguage } from '@/lib/i18n';

interface Meta { page: number; limit: number; total: number; totalPages: number }
interface ArticlesResponse { data: EditorialArticle[]; meta: Meta }

interface CategoryTranslation {
  language?: { id: string; code: string } | null;
  name: string;
  slug: string;
  description?: string | null;
}

interface CategoryDetail {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parent?: { id: string; name: string; slug: string } | null;
  translations?: CategoryTranslation[];
}

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState(1);
  const { code, t, pathFor } = useLanguage();

  // Real taxonomy data (GET /categories/:slug is already public) — never a slug-derived guess, and this
  // is also the one query that tells us whether the category genuinely exists (404 if not).
  const { data: category, isLoading: categoryLoading, error: categoryError } = useQuery<CategoryDetail>({
    queryKey: ['category-detail', slug],
    queryFn: () => apiFetch(`/categories/${slug}`),
    enabled: !!slug,
    retry: false,
  });

  const { data, isLoading: articlesLoading, error: articlesError } = useQuery<ArticlesResponse>({
    queryKey: ['category', slug, page, code],
    queryFn: () => apiFetch(withLang(`/public/categories/${slug}/articles?page=${page}&limit=20`, code)),
    enabled: !!slug && !!category, // wait for the category to be confirmed real before listing its articles
  });

  if (categoryError && isNotFoundError(categoryError)) return <NotFoundPage />;

  const isLoading = categoryLoading || (!!category && articlesLoading);
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

  if (categoryError || articlesError) {
    return <Container className="py-16 text-center"><h1 className="text-xl font-bold">{t('common.somethingWrong')}</h1><p className="mt-2 text-neutral-600">{t('common.unableToLoad')}</p></Container>;
  }

  if (!category) return <NotFoundPage />;

  const title = localizedField(category.name, category.translations, code, 'name') || category.name;
  const description = localizedField(category.description, category.translations, code, 'description');
  const alternates = [
    { code: 'bn', url: pathFor(`/category/${category.translations?.find((item) => item.language?.code === 'bn')?.slug || category.slug}`, 'bn') },
    ...((category.translations || []).filter((item) => item.language?.code && item.language.code !== 'bn').map((item) => ({ code: item.language!.code, url: pathFor(`/category/${item.slug}`, item.language!.code) }))),
  ];

  const articles = data?.data || [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description: description || undefined,
    inLanguage: code,
  };

  return <>
    <SeoHead
      title={`${title} - BD News`}
      description={description || t('common.newsFrom', { name: title })}
      url={typeof window !== 'undefined' ? `${window.location.origin}${pathFor(`/category/${slug}`, code)}` : undefined}
      section={title}
      jsonLd={jsonLd}
      alternates={alternates}
    />
    <Container className="py-6 lg:py-8">
      <Breadcrumbs items={[
        ...(category.parent ? [{ label: category.parent.name, href: `/category/${category.parent.slug}` }] : []),
        { label: title },
      ]} />
      <header className="mb-6 border-b-2 border-neutral-900 pb-3">
        <h1 className="text-3xl font-bold text-neutral-950 sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-neutral-600">{description}</p>}
      </header>
      <AdSlot slot="CATEGORY_TOP" pageType="category" categoryId={category.id} />
      <DiscoveryFeed
        articles={articles}
        meta={data?.meta}
        onPageChange={setPage}
        title={title}
        emptyMessage={t('common.noArticlesFound')}
        feedHeadingId="category-latest"
      />
    </Container>
  </>;
}
