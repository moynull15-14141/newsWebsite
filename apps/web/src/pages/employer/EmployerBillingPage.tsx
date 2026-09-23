import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import type { EmployerJobListItem, JobPostingPlan, Paginated } from './types';

/**
 * Shows available plans and lets an employer create a PENDING order for a job. There is no payment
 * gateway in this phase (see JobPostingOrder's schema comment) — a created order is always PENDING, and
 * this page never claims a payment succeeded, only that the request to post under that plan was recorded.
 */
export default function EmployerBillingPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState('');
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const { data: plans, isLoading, isError } = useQuery<JobPostingPlan[]>({ queryKey: ['employer-plans'], queryFn: () => apiFetch('/employer-portal/plans') });
  const { data: jobsResp } = useQuery<Paginated<EmployerJobListItem>>({ queryKey: ['employer-jobs', 'draft-for-billing'], queryFn: () => apiFetch('/employer-portal/jobs?status=DRAFT&limit=100') });

  const createOrder = useMutation({
    mutationFn: (planId: string) => apiFetch(`/employer-portal/jobs/${selectedJobId}/orders`, { method: 'POST', body: JSON.stringify({ planId }) }),
    onSuccess: () => { setOrderMessage(t('employer.billing.orderCreated')); setOrderError(null); queryClient.invalidateQueries({ queryKey: ['employer-jobs'] }); },
    onError: (err: unknown) => { setOrderError(getApiErrorMessage(err, t('employer.billing.orderError'))); setOrderMessage(null); },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900">{t('employer.billing.title')}</h1>
      <p className="mt-2 text-sm text-neutral-500">{t('employer.billing.subtitle')}</p>

      <div className="mt-4 max-w-sm">
        <label htmlFor="billing-job" className="block text-sm font-medium text-neutral-700">{t('employer.billing.selectJob')}</label>
        <select id="billing-job" value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
          <option value="">{t('employer.billing.selectJobPlaceholder')}</option>
          {jobsResp?.data?.map((j) => (<option key={j.id} value={j.id}>{j.title}</option>))}
        </select>
      </div>

      {isLoading ? (
        <p className="mt-6 text-neutral-500">{t('common.loading')}</p>
      ) : isError || !plans ? (
        <p className="mt-6 text-red-600">{t('common.somethingWrong')}</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className="flex flex-col rounded-lg border border-neutral-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-neutral-900">{plan.name}</h2>
                {!plan.available && <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-500">{t('employer.billing.comingSoon')}</span>}
              </div>
              <p className="mt-2 text-2xl font-bold text-neutral-900">
                {plan.type === 'FREE' ? t('employer.billing.free') : `${plan.priceAmount} ${plan.priceCurrency}`}
              </p>
              <p className="mt-1 text-sm text-neutral-500">{t('employer.billing.duration', { n: plan.durationDays })}</p>
              {plan.isFeatured && <p className="mt-1 text-xs font-semibold uppercase text-primary-600">{t('employer.billing.featured')}</p>}
              <button
                type="button"
                disabled={!plan.available || !selectedJobId || createOrder.isPending}
                onClick={() => { setOrderMessage(null); setOrderError(null); createOrder.mutate(plan.id); }}
                className="mt-4 rounded-md border border-primary-500 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {plan.available ? t('employer.billing.selectPlan') : t('employer.billing.comingSoon')}
              </button>
            </div>
          ))}
        </div>
      )}

      {orderMessage && <p role="status" className="mt-4 text-sm text-green-700">{orderMessage}</p>}
      {orderError && <p role="alert" className="mt-4 text-sm text-red-600">{orderError}</p>}
    </div>
  );
}
