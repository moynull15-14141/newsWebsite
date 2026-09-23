import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import SeoHead from '@/components/SeoHead';
import { Container } from '@/components/Container';
import { JobCard, JobCardSkeleton, type JobCardJob } from '@/components/JobCard';
import { Search } from 'lucide-react';

interface Meta { page: number; limit: number; total: number; totalPages: number }
interface JobsResponse { data: JobCardJob[]; meta: Meta }
interface JobCategoryOption { id: string; name: string; slug: string }

export default function JobsListPage() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [employmentType, setEmploymentType] = useState('');

  const { data: categories = [] } = useQuery<JobCategoryOption[]>({ queryKey: ['job-categories'], queryFn: () => apiFetch('/public/job-categories') });

  const { data, isLoading } = useQuery<JobsResponse>({
    queryKey: ['jobs', page, search, category, employmentType],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '12' });
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (employmentType) params.set('employmentType', employmentType);
      return apiFetch(`/public/jobs?${params.toString()}`);
    },
  });

  const { data: featured } = useQuery<JobCardJob[]>({ queryKey: ['jobs-featured'], queryFn: () => apiFetch('/public/jobs/featured?limit=4') });
  const { data: deadlineNear } = useQuery<JobCardJob[]>({ queryKey: ['jobs-deadline-near'], queryFn: () => apiFetch('/public/jobs/deadline-near?limit=4') });

  const jobs = data?.data || [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t('jobs.title'),
    description: t('jobs.subtitle'),
  };

  return (
    <>
      <SeoHead title={t('jobs.title')} description={t('jobs.subtitle')} url="/jobs" jsonLd={jsonLd} />
      <Container className="py-6 lg:py-8">
        <header className="mb-6 border-b-2 border-neutral-900 pb-3">
          <h1 className="text-3xl font-bold text-neutral-950 sm:text-4xl">{t('jobs.title')}</h1>
          <p className="mt-2 max-w-2xl text-neutral-600">{t('jobs.subtitle')}</p>
        </header>

        {!!featured?.length && (
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-bold text-neutral-900">{t('jobs.featured')}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((job) => (<JobCard key={job.id} job={job} variant="featured" />))}
            </div>
          </section>
        )}

        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div>
            <form onSubmit={(e) => { e.preventDefault(); setPage(1); }} className="mb-4 flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder={t('jobs.searchPlaceholder')}
                  aria-label={t('jobs.searchPlaceholder')}
                  className="w-full rounded-lg border border-neutral-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                aria-label={t('jobs.allCategories')}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">{t('jobs.allCategories')}</option>
                {categories.map((c) => (<option key={c.id} value={c.slug}>{c.name}</option>))}
              </select>
              <select
                value={employmentType}
                onChange={(e) => { setEmploymentType(e.target.value); setPage(1); }}
                aria-label={t('jobs.allTypes')}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">{t('jobs.allTypes')}</option>
                {['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'FREELANCE'].map((v) => (<option key={v} value={v}>{v.replace('_', ' ')}</option>))}
              </select>
            </form>

            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => (<JobCardSkeleton key={i} />))}</div>
            ) : !jobs.length ? (
              <p className="py-12 text-center text-neutral-500">{t('jobs.noJobsFound')}</p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {jobs.map((job) => (<JobCard key={job.id} job={job} />))}
                </div>
                {data?.meta && data.meta.totalPages > 1 && (
                  <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50">{t('common.previous')}</button>
                    <span className="text-sm text-neutral-600">{t('common.page')} {data.meta.page} {t('common.of')} {data.meta.totalPages}</span>
                    <button onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))} disabled={page === data.meta.totalPages} className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50">{t('common.next')}</button>
                  </nav>
                )}
              </>
            )}
          </div>

          <aside>
            {!!deadlineNear?.length && (
              <section className="rounded-lg border border-neutral-200 bg-white p-4">
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-500">{t('jobs.deadlineNear')}</h2>
                {deadlineNear.map((job) => (<JobCard key={job.id} job={job} variant="compact" />))}
              </section>
            )}
          </aside>
        </div>
      </Container>
    </>
  );
}
