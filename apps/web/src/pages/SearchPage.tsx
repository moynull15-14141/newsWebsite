import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import ArticleList from '@/components/ArticleList';
import SeoHead from '@/components/SeoHead';

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
  const initialQuery = searchParams.get('q') || '';
  const [inputValue, setInputValue] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');

  const query = searchParams.get('q') || '';

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => apiFetch('/categories'),
  });

  const { data: locations } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => apiFetch('/locations'),
  });

  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ['search', query, page, category, location, dateFrom, dateTo],
    queryFn: () => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      params.set('page', String(page));
      params.set('limit', '20');
      if (category) params.set('category', category);
      if (location) {
        const [type, slug] = location.split(':');
        params.set(type === 'DIVISION' ? 'division' : 'district', slug);
      }
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      return apiFetch(`/public/search?${params.toString()}`);
    },
    enabled: true,
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
        title={query ? `Search: ${query}` : 'Search'}
        description={`Search results for ${query}`}
        noIndex
      />
      <div className="container-wide py-8 lg:py-12">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">Search</h1>

        <form onSubmit={handleSearch} className="mb-8 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search articles..."
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <button
              type="submit"
              className="rounded-lg bg-primary-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-600"
            >
              Search
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All Categories</option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.slug}>{cat.name}</option>
              ))}
            </select>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All Locations</option>
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
              placeholder="From date"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To date"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </form>

        {meta && (
          <p className="mb-6 text-sm text-gray-500">
            {meta.total} result{meta.total !== 1 ? 's' : ''}
            {query && <> for &ldquo;{query}&rdquo;</>}
          </p>
        )}

        {!query && (
          <div className="py-12 text-center text-gray-500">
            Enter a search term to find articles.
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

        {query && !isLoading && (
          <ArticleList
            articles={articles}
            showPagination
            meta={meta}
            onPageChange={setPage}
          />
        )}
      </div>
    </>
  );
}
