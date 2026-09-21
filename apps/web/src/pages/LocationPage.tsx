import { useState } from 'react';
import { Link, useLocation as useRouteLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import ArticleList from '@/components/ArticleList';
import SeoHead from '@/components/SeoHead';
import { publicArticleRoutes } from '@/lib/public-routes';

interface LocationRow {
  id: string;
  name: string;
  slug: string;
  type: string;
  parentId?: string | null;
}

function DivisionDistrictBrowser() {
  const { data: locations } = useQuery<LocationRow[]>({
    queryKey: ['locations-browser'],
    queryFn: () => apiFetch('/locations'),
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
    <section className="mb-10 rounded-xl border border-gray-200 bg-gray-50 p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Browse by Division
      </h2>
      <div className="mb-6 flex flex-wrap gap-2">
        {divisions.map((div) => (
          <Link
            key={div.id}
            to={`/division/${div.slug}`}
            className="rounded-full bg-primary-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
          >
            {div.name}
          </Link>
        ))}
      </div>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Districts
      </h2>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {divisions.map((div) => (
          <div key={div.id}>
            <p className="mb-1 text-sm font-semibold text-gray-700">{div.name}</p>
            <div className="flex flex-wrap gap-1.5">
              {(districtsByDivision.get(div.id) || []).map((dist) => (
                <Link
                  key={dist.id}
                  to={`/district/${dist.slug}`}
                  className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600 transition hover:border-primary-400 hover:text-primary-700"
                >
                  {dist.name}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  publishedAt?: string;
  author?: { id: string; name: string };
  category?: { id: string; name: string; slug: string };
  imageUrl?: string;
  featuredImageUrl?: string;
}

interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ApiResponse {
  data: Article[];
  meta: Meta;
}

export default function LocationPage() {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const route = useRouteLocation();
  const [page, setPage] = useState(1);
  const locationType = route.pathname === '/bangladesh' ? 'COUNTRY' : route.pathname.startsWith('/division/') ? 'DIVISION' : route.pathname.startsWith('/district/') ? 'DISTRICT' : undefined;
  const slug = paramSlug || (locationType === 'COUNTRY' ? 'bangladesh' : '');

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ['location', slug, page],
    queryFn: () => apiFetch(`${publicArticleRoutes.location(slug)}?page=${page}&limit=20${locationType ? `&locationType=${locationType}` : ''}`),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="container-wide py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-gray-200" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="h-32 w-40 flex-shrink-0 rounded bg-gray-200" />
              <div className="flex-1 space-y-3">
                <div className="h-4 w-3/4 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-wide py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-900">Something went wrong</h2>
        <p className="mt-2 text-gray-600">Unable to load articles.</p>
      </div>
    );
  }

  const articles = data?.data || [];
  const meta = data?.meta;
  const displayName = slug?.replace(/-/g, ' ') || 'Location';

  return (
    <>
      <SeoHead
        title={`${displayName} - BD News`}
        description={`Latest news from ${displayName}`}
      />
      <div className="container-wide py-8 lg:py-12">
        <h1 className="mb-8 text-3xl font-bold capitalize text-gray-900">
          {displayName}
        </h1>
        <DivisionDistrictBrowser />
        <ArticleList
          articles={articles}
          showPagination
          meta={meta}
          onPageChange={setPage}
        />
      </div>
    </>
  );
}
