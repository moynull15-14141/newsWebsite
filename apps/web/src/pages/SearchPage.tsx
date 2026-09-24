import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, withLang } from '@/lib/api';
import ArticleList from '@/components/ArticleList';
import SeoHead from '@/components/SeoHead';
import AdSlot from '@/components/AdSlot';
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

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Location {
  id: string;
  name: string;
  slug: string;
  type: string;
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { code, t } = useLanguage();
  const initialQuery = searchParams.get('q') || '';
  const [inputValue, setInputValue] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');

  const query = searchParams.get('q') || '';

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories', code],
    queryFn: () => apiFetch(withLang('/categories', code)),
  });

  const { data: locations } = useQuery<Location[]>({
    queryKey: ['locations', code],
    queryFn: () => apiFetch(withLang('/locations', code)),
  });

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ['search', query, page, category, location, dateFrom, dateTo, code],
    queryFn: () => {
      const params = new URLSearchParams();
      // The DTO field is `search`, not `q` — `q` is only this PAGE's own URL param (/search?q=...);
      // sending it straight through used to 400 (forbidNonWhitelisted rejects unknown properties).
      if (query) params.set('search', query);
      params.set('page', String(page));
      params.set('limit', '20');
      if (category) params.set('category', category);
      if (location) {
        const [type, slug] = location.split(':');
        params.set(type === 'DIVISION' ? 'division' : 'district', slug);
      }
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      return apiFetch(withLang(`/public/search?${params.toString()}`, code));
    },
    // Do not execute a meaningless search request before the reader has actually entered a term.
    enabled: !!query.trim(),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    const params: Record<string, string> = {};
    if (inputValue.trim()) params.q = inputValue.trim();
    if (category) params.category = category;
    if (location) params.location = location;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    setSearchParams(params);
  };

  const articles = data?.data || [];
  const meta = data?.meta;

  const divisions = locations?.filter((l) => l.type === 'DIVISION') || [];
  const districts = locations?.filter((l) => l.type === 'DISTRICT') || [];

  return (
    <>
      <SeoHead
        title={query ? `Search: ${query}` : t('search.title')}
        description={`Search results for ${query}`}
        noIndex
      />
      <div className="container-wide py-8 lg:py-12">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">{t('search.title')}</h1>

        <form onSubmit={handleSearch} className="mb-8 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t('search.placeholder')}
              aria-label={t('search.title')}
              maxLength={200}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <button
              type="submit"
              aria-label={t('search.button')}
              className="rounded-lg bg-primary-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-600"
            >
              {t('search.button')}
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label={t('search.allCategories')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">{t('search.allCategories')}</option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.slug}>{cat.name}</option>
              ))}
            </select>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              aria-label={t('search.allLocations')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">{t('search.allLocations')}</option>
              {divisions.map((div) => (
                <option key={div.id} value={`DIVISION:${div.slug}`}>{div.name}</option>
              ))}
              {districts.map((dist) => (
                <option key={dist.id} value={`DISTRICT:${dist.slug}`}>{dist.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder={t('search.fromDate')}
              aria-label={t('search.fromDate')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder={t('search.toDate')}
              aria-label={t('search.toDate')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </form>

        {meta && (
          <p className="mb-6 text-sm text-gray-500">
            {query
              ? t('search.resultsCountFor', { count: meta.total, query })
              : t('search.resultsCount', { count: meta.total })}
          </p>
        )}

        {!query && (
          <div className="py-12 text-center text-gray-500">
            {t('search.enterTerm')}
          </div>
        )}

        {query && isLoading && (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="h-32 w-40 flex-shrink-0 animate-pulse rounded bg-gray-200" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        )}

        {query && !isLoading && error && (
          <div className="py-12 text-center text-gray-500">
            <h2 className="text-lg font-semibold text-gray-900">{t('common.somethingWrong')}</h2>
            <p className="mt-2">{t('common.unableToLoad')}</p>
          </div>
        )}

        {query && !isLoading && !error && articles.length > 0 && (
          <AdSlot slot="SEARCH_INLINE" pageType="SEARCH" context={query} />
        )}

        {query && !isLoading && !error && (
          <ArticleList
            articles={articles}
            variant="horizontal"
            showPagination
            meta={meta}
            onPageChange={setPage}
            emptyMessage={t('search.noResults')}
          />
        )}
      </div>
    </>
  );
}
