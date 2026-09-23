import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiFetch, isNotFoundError } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { useReaderAuthStore } from '@/stores/reader-auth-store';
import SeoHead from '@/components/SeoHead';
import { Container } from '@/components/Container';
import Breadcrumbs from '@/components/Breadcrumbs';
import { Skeleton } from '@/components/Skeleton';
import TiptapRenderer from '@/components/TiptapRenderer';
import SaveJobButton from '@/components/SaveJobButton';
import { JobCard, type JobCardJob } from '@/components/JobCard';
import NotFoundPage from './NotFoundPage';
import { MapPin, Briefcase, Clock, Users, Share2, X } from 'lucide-react';

interface JobDetail extends JobCardJob {
  description?: unknown;
  responsibilities?: unknown;
  requirements?: unknown;
  qualifications?: unknown;
  experience?: string | null;
  vacancies?: number | null;
  applicationMethod: string;
  externalApplyUrl?: string | null;
  applicationEmail?: string | null;
  applicationInstructions?: string | null;
  publishedAt?: string | null;
  status: string;
  employer?: JobCardJob['employer'] & { description?: string | null; website?: string | null };
  related: JobCardJob[];
}

interface Resume { id: string; fileName: string; isDefault: boolean }

function ApplyDialog({ job, onClose }: { job: JobDetail; onClose: () => void }) {
  const { t } = useLanguage();
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeId, setResumeId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { data: resumes } = useQuery<Resume[]>({ queryKey: ['resumes'], queryFn: () => apiFetch('/reader/resumes') });

  const applyMutation = useMutation({
    mutationFn: () => apiFetch(`/reader/job-applications/${job.id}`, { method: 'POST', body: JSON.stringify({ coverLetter: coverLetter || undefined, resumeId: resumeId || undefined }) }),
    onSuccess: () => setSuccess(true),
    onError: (err: unknown) => setError(err instanceof Error && err.message.includes('already applied') ? t('jobs.alreadyApplied') : 'Could not submit your application. Please try again.'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="apply-dialog-title" className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 id="apply-dialog-title" className="text-lg font-semibold text-neutral-900">{t('jobs.applyDialogTitle', { title: job.title })}</h2>
          <button onClick={onClose} aria-label="Close dialog" className="rounded p-1 text-neutral-400 hover:bg-neutral-100"><X className="h-5 w-5" /></button>
        </div>
        {success ? (
          <div className="mt-4">
            <p role="status" className="text-sm font-medium text-green-700">{t('jobs.applicationSubmitted')}</p>
            <button onClick={onClose} className="mt-4 w-full rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600">OK</button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); applyMutation.mutate(); }} className="mt-4 space-y-3">
            <div>
              <label htmlFor="apply-resume" className="block text-sm font-medium text-neutral-700">{t('jobs.selectResume')}</label>
              {resumes?.length ? (
                <select id="apply-resume" value={resumeId} onChange={(e) => setResumeId(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
                  <option value="">{resumes.find((r) => r.isDefault)?.fileName || t('jobs.selectResume')}</option>
                  {resumes.map((r) => (<option key={r.id} value={r.id}>{r.fileName}</option>))}
                </select>
              ) : (
                <p className="mt-1 text-sm text-neutral-500">{t('jobs.noResume')} — <a href="/account/settings" className="text-primary-600 underline">{t('jobs.uploadResume')}</a></p>
              )}
            </div>
            <div>
              <label htmlFor="apply-cover-letter" className="block text-sm font-medium text-neutral-700">{t('jobs.coverLetter')}</label>
              <textarea id="apply-cover-letter" value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} rows={5} maxLength={5000} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            </div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Cancel</button>
              <button type="submit" disabled={applyMutation.isPending} className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50">{t('jobs.submitApplication')}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function JobDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t, code, pathFor } = useLanguage();
  const user = useReaderAuthStore((s) => s.user);
  const [applyOpen, setApplyOpen] = useState(false);

  const { data: job, isLoading, error } = useQuery<JobDetail>({
    queryKey: ['job', slug],
    queryFn: () => apiFetch(`/public/jobs/${slug}`),
    enabled: !!slug,
    retry: false,
  });

  if (error && isNotFoundError(error)) return <NotFoundPage />;

  if (isLoading) {
    return (
      <Container className="py-8">
        <Skeleton className="mb-4 h-8 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </Container>
    );
  }

  if (!job) return <NotFoundPage />;

  const isExpired = job.status === 'EXPIRED' || !!(job.deadline && new Date(job.deadline).getTime() < Date.now());

  const handleApplyClick = () => {
    if (!user) return navigate(pathFor('/login', code));
    setApplyOpen(true);
  };

  const salaryText = job.salaryMin && job.salaryMax
    ? `${job.salaryCurrency || 'BDT'} ${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()}`
    : job.salaryNegotiable ? 'Negotiable' : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.summary || job.title,
    datePosted: job.publishedAt || undefined,
    validThrough: job.deadline || undefined,
    employmentType: job.employmentType,
    hiringOrganization: job.employer ? { '@type': 'Organization', name: job.employer.name, sameAs: (job.employer as any).website || undefined } : undefined,
    jobLocation: job.location ? { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.location.name, addressCountry: 'BD' } } : undefined,
    baseSalary: job.salaryMin ? { '@type': 'MonetaryAmount', currency: job.salaryCurrency || 'BDT', value: { '@type': 'QuantitativeValue', minValue: job.salaryMin, maxValue: job.salaryMax || job.salaryMin, unitText: 'MONTH' } } : undefined,
  };

  return (
    <>
      <SeoHead
        title={`${job.title} at ${job.employer?.name || ''}`}
        description={job.summary || job.title}
        url={`/jobs/${job.slug}`}
        type="article"
        publishedTime={job.publishedAt || undefined}
        jsonLd={jsonLd}
        noIndex={isExpired}
      />
      <Container className="py-6 lg:py-8">
        <Breadcrumbs items={[{ label: t('jobs.title'), href: '/jobs' }, { label: job.title }]} />

        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div>
            <header className="border-b border-neutral-200 pb-5">
              <div className="flex items-start gap-4">
                {job.employer?.logo?.publicUrl ? (
                  <img src={job.employer.logo.publicUrl} alt={job.employer.logo.altText || job.employer.name} className="h-16 w-16 shrink-0 rounded object-contain" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-neutral-100 text-neutral-400"><Briefcase size={28} /></div>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-neutral-950 sm:text-3xl">{job.title}</h1>
                  <p className="mt-1 text-lg font-medium text-neutral-700">{job.employer?.name}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-neutral-600">
                {job.location?.name && <span className="flex items-center gap-1.5"><MapPin size={15} />{job.location.name}</span>}
                <span className="flex items-center gap-1.5"><Briefcase size={15} />{job.employmentType.replace('_', ' ')} · {job.workplaceType.replace('_', ' ')}</span>
                {job.deadline && <span className="flex items-center gap-1.5"><Clock size={15} />{t('jobs.deadline')}: {new Date(job.deadline).toLocaleDateString()}</span>}
                {job.vacancies && <span className="flex items-center gap-1.5"><Users size={15} />{job.vacancies} {t('jobs.vacancies')}</span>}
              </div>

              {isExpired && (
                <p role="status" className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{t('jobs.expired')}</p>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {!isExpired && job.applicationMethod === 'INTERNAL' && (
                  <button onClick={handleApplyClick} className="rounded-md bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600">
                    {user ? t('jobs.applyNow') : t('jobs.signInToApply')}
                  </button>
                )}
                {!isExpired && job.applicationMethod === 'EXTERNAL_URL' && job.externalApplyUrl && (
                  <a href={job.externalApplyUrl} target="_blank" rel="noopener noreferrer nofollow" className="rounded-md bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600">
                    {t('jobs.applyOnEmployerSite')}
                  </a>
                )}
                {!isExpired && job.applicationMethod === 'EMAIL' && job.applicationEmail && (
                  <a href={`mailto:${job.applicationEmail}?subject=${encodeURIComponent(`Application for ${job.title}`)}`} className="rounded-md bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600">
                    {t('jobs.applyByEmail')}
                  </a>
                )}
                <SaveJobButton jobId={job.id} />
                <button
                  onClick={() => { if (navigator.share) navigator.share({ title: job.title, url: window.location.href }); else navigator.clipboard?.writeText(window.location.href); }}
                  className="inline-flex items-center gap-2 rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  <Share2 size={16} /> {t('jobs.share')}
                </button>
              </div>
            </header>

            {salaryText && (
              <p className="mt-4 text-lg font-semibold text-primary-600">{t('jobs.salary')}: {salaryText}</p>
            )}

            {!!job.description && (
              <section className="mt-6">
                <h2 className="text-lg font-bold text-neutral-900">{t('jobs.description')}</h2>
                <TiptapRenderer content={job.description as any} />
              </section>
            )}
            {!!job.responsibilities && (
              <section className="mt-6">
                <h2 className="text-lg font-bold text-neutral-900">{t('jobs.responsibilities')}</h2>
                <TiptapRenderer content={job.responsibilities as any} />
              </section>
            )}
            {!!job.requirements && (
              <section className="mt-6">
                <h2 className="text-lg font-bold text-neutral-900">{t('jobs.requirements')}</h2>
                <TiptapRenderer content={job.requirements as any} />
              </section>
            )}
            {!!job.qualifications && (
              <section className="mt-6">
                <h2 className="text-lg font-bold text-neutral-900">{t('jobs.qualifications')}</h2>
                <TiptapRenderer content={job.qualifications as any} />
              </section>
            )}
            {job.experience && (
              <p className="mt-4 text-sm text-neutral-600"><span className="font-semibold">{t('jobs.experience')}:</span> {job.experience}</p>
            )}
            {job.applicationInstructions && job.applicationMethod !== 'INTERNAL' && (
              <section className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4">
                <h2 className="text-sm font-bold text-neutral-900">{t('jobs.applicationInstructions')}</h2>
                <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">{job.applicationInstructions}</p>
              </section>
            )}
          </div>

          <aside>
            {!!job.related?.length && (
              <section className="rounded-lg border border-neutral-200 bg-white p-4">
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-500">{t('jobs.relatedJobs')}</h2>
                {job.related.map((r) => (<JobCard key={r.id} job={r} variant="compact" />))}
              </section>
            )}
          </aside>
        </div>
      </Container>

      {applyOpen && <ApplyDialog job={job} onClose={() => setApplyOpen(false)} />}
    </>
  );
}
