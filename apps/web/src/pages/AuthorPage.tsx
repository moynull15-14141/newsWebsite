import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, withLang } from '@/lib/api';
import ArticleList from '@/components/ArticleList';
import SeoHead from '@/components/SeoHead';
import { publicArticleRoutes } from '@/lib/public-routes';
import { useLanguage } from '@/lib/i18n';

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

export default function AuthorPage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const { code, t } = useLanguage();

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ['author', id, page, code],
    queryFn: () => apiFetch(withLang(`${publicArticleRoutes.author(id || '')}?page=${page}&limit=20`, code)),
    enabled: !!id,
  });

  const authorName = data?.data?.[0]?.author?.name || t('author.defaultName');

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
        <h2 className="text-xl font-semibold text-gray-900">{t('common.somethingWrong')}</h2>
        <p className="mt-2 text-gray-600">{t('common.unableToLoad')}</p>
      </div>
    );
  }

  const articles = data?.data || [];
  const meta = data?.meta;

  return (
    <>
      <SeoHead
        title={`${authorName} - BD News`}
        description={`Articles by ${authorName}`}
      />
      <div className="container-wide py-8 lg:py-12">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">
          {authorName}
        </h1>
        <p className="mb-8 text-sm text-gray-500">
          {meta ? `${meta.total} ${t('author.articles')}` : t('common.loading')}
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
