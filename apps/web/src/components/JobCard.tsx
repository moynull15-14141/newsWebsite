import { Link } from 'react-router-dom';
import { MapPin, Briefcase, Clock } from 'lucide-react';
import { Badge } from './Badge';
import { Skeleton } from './Skeleton';
import { useLanguage } from '@/lib/i18n';

export interface JobCardJob {
  id: string;
  title: string;
  slug: string;
  summary?: string | null;
  employmentType: string;
  workplaceType: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryNegotiable?: boolean;
  deadline?: string | null;
  featured?: boolean;
  category?: { id: string; name: string; slug: string } | null;
  employer?: { id: string; name: string; slug: string; logo?: { publicUrl: string; altText?: string | null } | null } | null;
  location?: { id: string; name: string; slug: string } | null;
}

function formatSalary(job: JobCardJob): string | null {
  const cur = job.salaryCurrency || 'BDT';
  if (job.salaryMin && job.salaryMax) return `${cur} ${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()}`;
  if (job.salaryMin) return `${cur} ${job.salaryMin.toLocaleString()}+`;
  if (job.salaryMax) return `Up to ${cur} ${job.salaryMax.toLocaleString()}`;
  if (job.salaryNegotiable) return 'Negotiable';
  return null;
}

export type JobCardVariant = 'standard' | 'compact' | 'featured';

export function JobCard({ job, variant = 'standard' }: { job: JobCardJob; variant?: JobCardVariant }) {
  const { code, pathFor } = useLanguage();
  const salary = formatSalary(job);
  const deadlineSoon = job.deadline && new Date(job.deadline).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

  if (variant === 'compact') {
    return (
      <Link to={pathFor(`/jobs/${job.slug}`, code)} className="group block border-b border-neutral-100 py-3 last:border-0">
        <h3 lang={undefined} className="line-clamp-1 text-sm font-semibold text-neutral-800 group-hover:text-primary-500">{job.title}</h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
          {job.employer?.name && <span>{job.employer.name}</span>}
          {job.location?.name && <span className="flex items-center gap-1"><MapPin size={11} />{job.location.name}</span>}
        </p>
      </Link>
    );
  }

  return (
    <Link
      to={pathFor(`/jobs/${job.slug}`, code)}
      className={`group flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:border-primary-300 hover:bg-primary-50/30 ${job.featured ? 'border-amber-300 bg-amber-50/40' : 'border-neutral-200 bg-white'}`}
    >
      <div className="flex items-start gap-3">
        {job.employer?.logo?.publicUrl ? (
          <img src={job.employer.logo.publicUrl} alt={job.employer.logo.altText || job.employer.name} className="h-12 w-12 shrink-0 rounded object-contain" loading="lazy" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-neutral-100 text-neutral-400"><Briefcase size={20} /></div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-bold text-neutral-900 group-hover:text-primary-600">{job.title}</h3>
          <p className="mt-0.5 truncate text-sm font-medium text-neutral-600">{job.employer?.name}</p>
        </div>
        {job.featured && <Badge variant="warning">Featured</Badge>}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
        {job.location?.name && <span className="flex items-center gap-1"><MapPin size={12} />{job.location.name}</span>}
        <span className="flex items-center gap-1"><Briefcase size={12} />{job.employmentType.replace('_', ' ')}</span>
        {job.deadline && (
          <span className={`flex items-center gap-1 ${deadlineSoon ? 'font-semibold text-error-600' : ''}`}>
            <Clock size={12} />{new Date(job.deadline).toLocaleDateString()}
          </span>
        )}
      </div>
      {job.summary && <p className="line-clamp-2 text-sm text-neutral-600">{job.summary}</p>}
      <div className="flex items-center justify-between">
        {job.category?.name && <Badge variant="neutral">{job.category.name}</Badge>}
        {salary && <span className="text-sm font-semibold text-primary-600">{salary}</span>}
      </div>
    </Link>
  );
}

export function JobCardSkeleton({ variant = 'standard' }: { variant?: JobCardVariant }) {
  if (variant === 'compact') {
    return (
      <div className="border-b border-neutral-100 py-3 last:border-0">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mt-2 h-3 w-1/2" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-12 shrink-0 rounded" />
        <div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}
