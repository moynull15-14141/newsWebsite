import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import Dialog from '../components/Dialog';
import { apiFetch } from '../lib/api';
import ErrorAlert from './ErrorAlert';
import Thumb from './Thumb';
import { useDebouncedValue } from './useDebouncedValue';
import { buildPickerPath, contentLang, formatDate, toStoryArticle, unselectableReason } from './logic';
import type { CatalogueArticle, CataloguePage, Draft, StoryArticle } from './types';

interface Category {
  id: string;
  name: string;
}

interface ArticlePickerProps {
  title: string;
  description?: string;
  /** single: exactly one story (Hero, Replace). multiple: add several to a section. */
  mode: 'single' | 'multiple';
  /** multiple mode: how many more stories the section can take. */
  capacity?: number;
  /** Stories already in the target section: shown but not selectable (except the one being replaced). */
  excludeIds?: string[];
  confirmLabel: string;
  busy?: boolean;
  /** Error from the mutation triggered by the last confirm, shown inline so the selection is kept. */
  error?: unknown;
  draft?: Draft;
  onConfirm: (articles: StoryArticle[]) => void;
  onClose: () => void;
  onReload?: () => void;
}

const reasonText = { NOT_PUBLISHED: 'Not published', SCHEDULED: 'Scheduled for the future', IN_SECTION: 'Already in this section', FULL: 'Section is full' } as const;

/**
 * Chooses PUBLISHED stories from the existing article catalogue (GET /articles). Opening it changes
 * nothing: the draft is only mutated by the caller after the editor confirms.
 */
export default function ArticlePicker({ title, description, mode, capacity = 1, excludeIds = [], confirmLabel, busy, error, draft, onConfirm, onClose, onReload }: ArticlePickerProps) {
  const [searchInput, setSearchInput] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Map<string, CatalogueArticle>>(new Map());
  const search = useDebouncedValue(searchInput, 300);

  const { data: categories } = useQuery<Category[]>({ queryKey: ['categories'], queryFn: () => apiFetch('/categories') });
  const listing = useQuery({
    queryKey: ['homepage', 'picker', { page, search, categoryId }],
    queryFn: () => apiFetch<CataloguePage>(buildPickerPath({ page, search, categoryId })),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  const limit = mode === 'single' ? 1 : capacity;
  const items = listing.data?.data ?? [];
  const meta = listing.data?.meta;

  const blocked = (article: CatalogueArticle) => {
    const inherent = unselectableReason(article);
    if (inherent) return reasonText[inherent];
    if (excluded.has(article.id)) return reasonText.IN_SECTION;
    if (mode === 'multiple' && !selected.has(article.id) && selected.size >= limit) return reasonText.FULL;
    return null;
  };

  const toggle = (article: CatalogueArticle) =>
    setSelected((current) => {
      if (mode === 'single') return new Map([[article.id, article]]);
      const next = new Map(current);
      if (next.has(article.id)) next.delete(article.id);
      else next.set(article.id, article);
      return next;
    });

  const articleTitles = useMemo(() => Object.fromEntries([...selected.values()].map((article) => [article.id, article.title])), [selected]);
  const resetFilters = () => {
    setSearchInput('');
    setCategoryId('');
    setPage(1);
  };

  return (
    <Dialog
      title={title}
      description={description}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-sm text-gray-600" role="status" aria-live="polite">
            {selected.size === 0 ? 'Nothing selected' : mode === 'single' ? '1 story selected' : `${selected.size} of ${limit} selected`}
          </span>
          <button type="button" onClick={onClose} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            disabled={selected.size === 0 || busy}
            onClick={() => onConfirm([...selected.values()].map(toStoryArticle))}
            className="rounded bg-primary-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Saving…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <label htmlFor="picker-search" className="sr-only">Search published stories</label>
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" aria-hidden="true" />
            <input
              id="picker-search"
              data-autofocus
              type="search"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setPage(1);
              }}
              placeholder="Search published stories by headline…"
              className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label htmlFor="picker-category" className="sr-only">Filter by category</label>
            <select
              id="picker-category"
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setPage(1);
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All categories</option>
              {categories?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-500">Only published stories can be placed on the homepage.</p>

        {error != null && <ErrorAlert error={error} draft={draft} articleTitles={articleTitles} onReload={onReload} />}

        <div aria-busy={listing.isFetching} className="min-h-[18rem]">
          {listing.isLoading ? (
            <ul className="divide-y divide-gray-100 rounded border border-gray-200" aria-label="Loading stories">
              {[0, 1, 2, 3, 4].map((row) => (
                <li key={row} className="flex items-center gap-3 px-3 py-3"><span className="h-12 w-16 animate-pulse rounded bg-gray-100" /><span className="h-4 flex-1 animate-pulse rounded bg-gray-100" /></li>
              ))}
            </ul>
          ) : listing.isError ? (
            <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
              <p>Could not load stories: {listing.error instanceof Error ? listing.error.message : 'unknown error'}</p>
              <button type="button" onClick={() => listing.refetch()} className="mt-2 rounded border border-red-300 bg-white px-2 py-1 text-xs font-semibold">Try again</button>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded border border-dashed border-gray-300 p-8 text-center text-sm text-gray-600">
              <p className="font-medium text-gray-800">No published stories match.</p>
              <p className="mt-1">Try a different search or category.</p>
              {(searchInput || categoryId) && <button type="button" onClick={resetFilters} className="mt-3 rounded border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">Clear search and filters</button>}
            </div>
          ) : (
            <ul className={`divide-y divide-gray-100 rounded border border-gray-200 ${listing.isFetching ? 'opacity-70' : ''}`}>
              {items.map((article) => {
                const reason = blocked(article);
                const isSelected = selected.has(article.id);
                const inputId = `picker-${article.id}`;
                return (
                  <li key={article.id} className={isSelected ? 'bg-primary-50' : ''}>
                    <label htmlFor={inputId} className={`flex items-center gap-3 px-3 py-2 ${reason && !isSelected ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-50'}`}>
                      <input
                        id={inputId}
                        type={mode === 'single' ? 'radio' : 'checkbox'}
                        name="picker-selection"
                        checked={isSelected}
                        disabled={!!reason && !isSelected}
                        onChange={() => toggle(article)}
                        className="h-4 w-4 shrink-0"
                      />
                      <Thumb url={article.media?.publicUrl} />
                      <span className="min-w-0 flex-1">
                        <span lang={contentLang(article.title)} className="block truncate text-sm font-medium text-gray-900">{article.title}</span>
                        <span className="block truncate text-xs text-gray-500">{[article.category?.name, article.author?.name, formatDate(article.publishedAt)].filter(Boolean).join(' · ')}</span>
                      </span>
                      {reason && <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600">{reason}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {meta && meta.totalPages > 0 && (
          <nav aria-label="Story pages" className="flex items-center justify-between text-xs text-gray-600">
            <span>{meta.total} published {meta.total === 1 ? 'story' : 'stories'} · Page {meta.page} of {meta.totalPages}</span>
            <span className="flex gap-1">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 font-semibold disabled:opacity-40">
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> Previous
              </button>
              <button type="button" onClick={() => setPage((current) => current + 1)} disabled={page >= meta.totalPages} className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 font-semibold disabled:opacity-40">
                Next <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </span>
          </nav>
        )}
      </div>
    </Dialog>
  );
}
