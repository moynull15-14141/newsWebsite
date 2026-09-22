import { useState } from 'react';
import { Link, useLocation as useRouteLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, isNotFoundError, withLang } from '@/lib/api';
import { localizedField } from '@/lib/localize';
import SeoHead from '@/components/SeoHead';
import { Skeleton } from '@/components/Skeleton';
import { Container } from '@/components/Container';
import Breadcrumbs, { type BreadcrumbItem } from '@/components/Breadcrumbs';
import DiscoveryFeed from '@/components/DiscoveryFeed';
import { type EditorialArticle } from '@/components/editorial';
import { publicArticleRoutes } from '@/lib/public-routes';
import NotFoundPage from './NotFoundPage';
import { useLanguage } from '@/lib/i18n';

interface LocationRow {
  id: string;
  name: string;
  slug: string;
  type: string;
  parentId?: string | null;
  translations?: LocationTranslation[];
}

function DivisionDistrictBrowser() {
  const { code, t, pathFor } = useLanguage();
  const { data: locations } = useQuery<LocationRow[]>({
    queryKey: ['locations-browser'],
    queryFn: () => apiFetch('/public/locations'),
    staleTime: 5 * 60_000,
  });
  if (!locations || locations.length === 0) return null;
  const divisions = locations.filter((l) => l.type === 'DIVISION');
  const districtsByDivision = new Map<string, LocationRow[]>();
  for (const d of locations.filter((l) => l.type === 'DISTRICT')) {
    const list = districtsByDivision.get(d.parentId || '') || [];
    list.push(d);
    districtsByDivision.set(d.parentId || '', list);
  }
  return (
    <section className="mb-10 min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {t('common.browseByDivision')}
      </h2>
      <div className="mb-6 flex flex-wrap gap-2">
        {divisions.map((div) => (
          <Link
            key={div.id}
            to={pathFor(`/division/${div.slug}`, code)}
            className="rounded-full bg-primary-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
          >
            {localizedField(div.name, div.translations, code, 'name') || div.name}
          </Link>
        ))}
      </div>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {t('common.districts')}
      </h2>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {divisions.map((div) => (
          <div key={div.id} className="min-w-0">
            <p className="mb-1 break-words text-sm font-semibold text-gray-700">{localizedField(div.name, div.translations, code, 'name') || div.name}</p>
            <div className="flex flex-wrap gap-1.5">
              {(districtsByDivision.get(div.id) || []).map((dist) => (
                <Link
                  key={dist.id}
                  to={pathFor(`/district/${dist.slug}`, code)}
                  className="max-w-full break-words rounded border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600 transition hover:border-primary-400 hover:text-primary-700"
                >
                  {localizedField(dist.name, dist.translations, code, 'name') || dist.name}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

interface Meta { page: number; limit: number; total: number; totalPages: number }
interface ArticlesResponse { data: EditorialArticle[]; meta: Meta }

interface LocationTranslation {
  language?: { id: string; code: string } | null;
  name: string;
}

interface LocationAncestor {
  id: string;
  name: string;
  slug: string;
  type: string;
  parent?: LocationAncestor | null;
  translations?: LocationTranslation[];
}

interface LocationDetail extends LocationAncestor {
  description?: string | null;
}

/** `/bangladesh` is the one location with its own dedicated route; every other location (including
 *  other countries in the global hierarchy) links through the generic /location/:slug route. */
function hrefFor(loc: { type: string; slug: string }): string {
  if (loc.type === 'COUNTRY' && loc.slug === 'bangladesh') return '/bangladesh';
  if (loc.type === 'DIVISION') return `/division/${loc.slug}`;
  if (loc.type === 'DISTRICT') return `/district/${loc.slug}`;
  return `/location/${loc.slug}`;
}

export default function LocationPage() {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const route = useRouteLocation();
  const [page, setPage] = useState(1);
  const { code, t, pathFor } = useLanguage();
  // Route matching stays language-agnostic: the /en prefix (if any) is already consumed by the router
  // before this component sees the path, so these checks work the same under either language.
  const locationType = route.pathname.endsWith('/bangladesh') ? 'COUNTRY' : route.pathname.includes('/division/') ? 'DIVISION' : route.pathname.includes('/district/') ? 'DISTRICT' : undefined;
  const slug = paramSlug || (locationType === 'COUNTRY' ? 'bangladesh' : '');

  // Real location data (GET /locations/:slug is already public, and nests up to the grandparent —
  // enough for a real Bangladesh > Division > District breadcrumb). Also the one query that tells us
  // whether this slug genuinely exists (404 if not).
  const { data: location, isLoading: locationLoading, error: locationError } = useQuery<LocationDetail>({
    queryKey: ['location-detail', slug, locationType],
    queryFn: () => apiFetch(`/public/locations/${encodeURIComponent(slug)}${locationType ? `?locationType=${locationType}` : ''}`),
    enabled: !!slug,
    retry: false,
  });

  const { data, isLoading: articlesLoading, error: articlesError } = useQuery<ArticlesResponse>({
    queryKey: ['location', slug, page, code, locationType],
    queryFn: () => apiFetch(withLang(`${publicArticleRoutes.location(slug)}?page=${page}&limit=20${locationType ? `&locationType=${locationType}` : ''}`, code)),
    enabled: !!slug && !!location,
  });

  if (locationError && isNotFoundError(locationError)) return <NotFoundPage />;

  const isLoading = locationLoading || (!!location && articlesLoading);
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

  if (locationError || articlesError) {
    return <Container className="py-16 text-center"><h1 className="text-xl font-bold">{t('common.somethingWrong')}</h1><p className="mt-2 text-neutral-600">{t('common.unableToLoad')}</p></Container>;
  }

  if (!location) return <NotFoundPage />;

  const title = localizedField(location.name, location.translations, code, 'name') || location.name;
  const articles = data?.data || [];

  const breadcrumbItems: BreadcrumbItem[] = [];
  if (location.parent) {
    const grandparent = location.parent.parent;
    if (grandparent) {
      breadcrumbItems.push({ label: localizedField(grandparent.name, grandparent.translations, code, 'name') || grandparent.name, href: hrefFor(grandparent) });
    }
    breadcrumbItems.push({ label: localizedField(location.parent.name, location.parent.translations, code, 'name') || location.parent.name, href: hrefFor(location.parent) });
  }
  breadcrumbItems.push({ label: title });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    inLanguage: code,
  };

  return (
    <>
      <SeoHead
        title={`${title} - BD News`}
        description={t('common.newsFrom', { name: title })}
        url={typeof window !== 'undefined' ? `${window.location.origin}${pathFor(hrefFor(location), code)}` : undefined}
        jsonLd={jsonLd}
      />
      <Container className="py-6 lg:py-8">
        <Breadcrumbs items={breadcrumbItems} />
        <header className="mb-6 border-b-2 border-neutral-900 pb-3">
          <h1 className="text-3xl font-bold text-neutral-950 sm:text-4xl">{title}</h1>
        </header>
        <DivisionDistrictBrowser />
        <DiscoveryFeed
          articles={articles}
          meta={data?.meta}
          onPageChange={setPage}
          title={title}
          emptyMessage={t('common.noArticlesFound')}
          feedHeadingId="location-latest"
        />
      </Container>
    </>
  );
}
