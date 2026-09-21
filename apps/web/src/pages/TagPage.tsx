import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import ArticleList from '@/components/ArticleList';
import SeoHead from '@/components/SeoHead';
import { publicArticleRoutes } from '@/lib/public-routes';

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

export default function TagPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ['tag', slug, page],
    queryFn: () => apiFetch(`${publicArticleRoutes.tag(slug || '')}?page=${page}&limit=20`),
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

  return (
    <>
      <SeoHead
        title={`${slug?.replace(/-/g, ' ')} - BD News`}
        description={`Articles tagged with ${slug?.replace(/-/g, ' ')}`}
      />
      <div className="container-wide py-8 lg:py-12">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">
          #{slug?.replace(/-/g, ' ')}
        </h1>
        <p className="mb-8 text-sm text-gray-500">
          {meta ? `${meta.total} articles` : 'Loading...'}
        </p>
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
