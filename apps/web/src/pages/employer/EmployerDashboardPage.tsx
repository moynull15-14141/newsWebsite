import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { useEmployerMembership } from './EmployerContext';
import type { DashboardSummary } from './types';

const VERIFICATION_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 border-amber-200 text-amber-800',
  VERIFIED: 'bg-green-50 border-green-200 text-green-800',
  REJECTED: 'bg-red-50 border-red-200 text-red-800',
};

export default function EmployerDashboardPage() {
  const { t } = useLanguage();
  const membership = useEmployerMembership();
  const { data, isLoading, isError } = useQuery<DashboardSummary>({
    queryKey: ['employer-dashboard'],
    queryFn: () => apiFetch('/employer-portal/dashboard'),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900">{t('employer.dashboard.title', { name: membership.employer.name })}</h1>

      {isLoading ? (
        <p className="mt-6 text-neutral-500">{t('common.loading')}</p>
      ) : isError || !data ? (
        <p className="mt-6 text-red-600">{t('common.somethingWrong')}</p>
      ) : (
        <>
          <div className={`mt-6 rounded-lg border p-4 text-sm ${VERIFICATION_STYLES[data.verificationStatus || 'PENDING']}`}>
            {data.verificationStatus === 'VERIFIED' && t('employer.dashboard.verified')}
            {data.verificationStatus === 'PENDING' && t('employer.dashboard.pendingVerification')}
            {data.verificationStatus === 'REJECTED' && t('employer.dashboard.rejectedVerification')}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard label={t('employer.dashboard.totalJobs')} value={data.totalJobs} />
            <StatCard label={t('employer.dashboard.totalApplications')} value={data.totalApplications} />
            {Object.entries(data.jobsByStatus).map(([status, count]) => (
              <StatCard key={status} label={status.replace(/_/g, ' ')} value={count} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
    </div>
  );
}
