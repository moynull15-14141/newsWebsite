import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/dictionaries';
import {
  EMPLOYMENT_TYPES, WORKPLACE_TYPES, APPLICATION_METHODS, humanize,
  type EmployerJobDetail, type JobCategoryOption, type LocationOption,
} from './types';

/** Turns a plain textarea's lines into the minimal TipTap-shaped doc the public renderer/admin editor
 * expect for `responsibilities`/`requirements`/`qualifications`/`description` — apps/web has no rich text
 * editor dependency (that's admin-only), so employer job forms use plain textareas for every content
 * field rather than pulling TipTap into this app just for this form. */
function textToDoc(text: string): unknown {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return undefined;
  return { type: 'doc', content: lines.map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] })) };
}
interface TiptapTextNode { text?: string }
interface TiptapDocNode { content?: TiptapTextNode[] }
function docToText(doc: unknown): string {
  if (!doc || typeof doc !== 'object' || !Array.isArray((doc as { content?: unknown }).content)) return '';
  return ((doc as { content: TiptapDocNode[] }).content)
    .map((node) => (node.content || []).map((n) => n.text || '').join(''))
    .join('\n');
}

const STATUS_ACTIONS: Record<string, Array<{ action: string; labelKey: TranslationKey }>> = {
  DRAFT: [{ action: 'submit', labelKey: 'employer.jobForm.submitForReview' }],
  IN_REVIEW: [{ action: 'withdraw', labelKey: 'employer.jobForm.withdraw' }],
  PUBLISHED: [{ action: 'archive', labelKey: 'employer.jobForm.archive' }],
  EXPIRED: [{ action: 'archive', labelKey: 'employer.jobForm.archive' }],
};

export default function EmployerJobFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, code, pathFor } = useLanguage();

  const { data: job } = useQuery<EmployerJobDetail>({ queryKey: ['employer-job', id], queryFn: () => apiFetch(`/employer-portal/jobs/${id}`), enabled: isEdit });
  const { data: categories = [] } = useQuery<JobCategoryOption[]>({ queryKey: ['public-job-categories'], queryFn: () => apiFetch('/public/job-categories') });
  const { data: locations = [] } = useQuery<LocationOption[]>({ queryKey: ['public-locations'], queryFn: () => apiFetch('/public/locations') });

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [requirements, setRequirements] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [experience, setExperience] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryNegotiable, setSalaryNegotiable] = useState(false);
  const [employmentType, setEmploymentType] = useState('FULL_TIME');
  const [workplaceType, setWorkplaceType] = useState('ON_SITE');
  const [vacancies, setVacancies] = useState('1');
  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [applicationMethod, setApplicationMethod] = useState('INTERNAL');
  const [externalApplyUrl, setExternalApplyUrl] = useState('');
  const [applicationEmail, setApplicationEmail] = useState('');
  const [applicationInstructions, setApplicationInstructions] = useState('');
  const [deadline, setDeadline] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!job) return;
    setTitle(job.title); setSummary(job.summary || '');
    setDescription(job.description ? docToText(job.description) : '');
    setResponsibilities(docToText(job.responsibilities)); setRequirements(docToText(job.requirements)); setQualifications(docToText(job.qualifications));
    setExperience(job.experience || ''); setSalaryMin(job.salaryMin?.toString() || ''); setSalaryMax(job.salaryMax?.toString() || '');
    setSalaryNegotiable(job.salaryNegotiable); setEmploymentType(job.employmentType); setWorkplaceType(job.workplaceType);
    setVacancies(job.vacancies?.toString() || '1'); setCategoryId(job.categoryId); setLocationId(job.locationId || '');
    setApplicationMethod(job.applicationMethod); setExternalApplyUrl(job.externalApplyUrl || ''); setApplicationEmail(job.applicationEmail || '');
    setApplicationInstructions(job.applicationInstructions || ''); setDeadline(job.deadline ? job.deadline.slice(0, 10) : '');
  }, [job]);

  const readOnly = isEdit && job && job.status !== 'DRAFT';

  const buildPayload = () => ({
    title,
    summary: summary || undefined,
    description: textToDoc(description),
    responsibilities: textToDoc(responsibilities),
    requirements: textToDoc(requirements),
    qualifications: textToDoc(qualifications),
    experience: experience || undefined,
    salaryMin: salaryMin ? Number(salaryMin) : undefined,
    salaryMax: salaryMax ? Number(salaryMax) : undefined,
    salaryNegotiable,
    employmentType,
    workplaceType,
    vacancies: vacancies ? Number(vacancies) : undefined,
    categoryId,
    locationId: locationId || undefined,
    applicationMethod,
    externalApplyUrl: applicationMethod === 'EXTERNAL_URL' ? externalApplyUrl : undefined,
    applicationEmail: applicationMethod === 'EMAIL' ? applicationEmail : undefined,
    applicationInstructions: applicationInstructions || undefined,
    deadline: deadline ? new Date(deadline).toISOString() : undefined,
  });

  const createMutation = useMutation({
    mutationFn: () => apiFetch<EmployerJobDetail>('/employer-portal/jobs', { method: 'POST', body: JSON.stringify(buildPayload()) }),
    onSuccess: (created) => { queryClient.invalidateQueries({ queryKey: ['employer-jobs'] }); navigate(pathFor(`/employer/jobs/${created.id}/edit`, code)); },
    onError: (err: unknown) => setFormError(getApiErrorMessage(err, t('employer.jobForm.createError'))),
  });
  const updateMutation = useMutation({
    mutationFn: () => apiFetch<EmployerJobDetail>(`/employer-portal/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(buildPayload()) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employer-jobs'] }); queryClient.invalidateQueries({ queryKey: ['employer-job', id] }); },
    onError: (err: unknown) => setFormError(getApiErrorMessage(err, t('employer.jobForm.saveError'))),
  });
  const actionMutation = useMutation({
    mutationFn: (action: string) => apiFetch(`/employer-portal/jobs/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employer-jobs'] }); queryClient.invalidateQueries({ queryKey: ['employer-job', id] }); },
    onError: (err: unknown) => setFormError(getApiErrorMessage(err, t('employer.jobForm.actionError'))),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) return setFormError(t('employer.jobForm.titleRequired'));
    if (!categoryId) return setFormError(t('employer.jobForm.categoryRequired'));
    if (applicationMethod === 'EXTERNAL_URL' && !externalApplyUrl) return setFormError(t('employer.jobForm.externalUrlRequired'));
    if (applicationMethod === 'EMAIL' && !applicationEmail) return setFormError(t('employer.jobForm.applicationEmailRequired'));
    if (isEdit) updateMutation.mutate(); else createMutation.mutate();
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const availableActions = job ? STATUS_ACTIONS[job.status] || [] : [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">{isEdit ? t('employer.jobForm.editTitle') : t('employer.jobForm.newTitle')}</h1>
        {job && <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">{job.status.replace(/_/g, ' ')}</span>}
      </div>

      {job && availableActions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {availableActions.map(({ action, labelKey }) => (
            <button
              key={action}
              type="button"
              onClick={() => actionMutation.mutate(action)}
              disabled={actionMutation.isPending}
              className="rounded-md border border-primary-500 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-50"
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      )}

      {readOnly ? (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5 text-sm text-neutral-600">
          {t('employer.jobForm.readOnlyNotice')}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <fieldset disabled={!!readOnly} className="space-y-6">
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{t('employer.jobForm.basicInfo')}</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="ej-title" className="block text-sm font-medium text-neutral-700">{t('employer.jobForm.jobTitle')}</label>
                <input id="ej-title" required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="ej-summary" className="block text-sm font-medium text-neutral-700">{t('employer.jobForm.summary')}</label>
                <textarea id="ej-summary" rows={2} maxLength={500} value={summary} onChange={(e) => setSummary(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="ej-category" className="block text-sm font-medium text-neutral-700">{t('employer.jobForm.category')}</label>
                <select id="ej-category" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mt-1 w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm">
                  <option value="">{t('employer.jobForm.selectCategory')}</option>
                  {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{t('employer.jobForm.details')}</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="ej-description" className="block text-sm font-medium text-neutral-700">{t('jobs.description')}</label>
                <textarea id="ej-description" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="ej-responsibilities" className="block text-sm font-medium text-neutral-700">{t('jobs.responsibilities')} <span className="font-normal text-neutral-400">({t('employer.jobForm.onePerLine')})</span></label>
                <textarea id="ej-responsibilities" rows={4} value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="ej-requirements" className="block text-sm font-medium text-neutral-700">{t('jobs.requirements')} <span className="font-normal text-neutral-400">({t('employer.jobForm.onePerLine')})</span></label>
                <textarea id="ej-requirements" rows={4} value={requirements} onChange={(e) => setRequirements(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="ej-qualifications" className="block text-sm font-medium text-neutral-700">{t('jobs.qualifications')} <span className="font-normal text-neutral-400">({t('employer.jobForm.onePerLine')})</span></label>
                <textarea id="ej-qualifications" rows={4} value={qualifications} onChange={(e) => setQualifications(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="ej-experience" className="block text-sm font-medium text-neutral-700">{t('jobs.experience')}</label>
                  <input id="ej-experience" value={experience} onChange={(e) => setExperience(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label htmlFor="ej-vacancies" className="block text-sm font-medium text-neutral-700">{t('jobs.vacancies')}</label>
                  <input id="ej-vacancies" type="number" min={1} value={vacancies} onChange={(e) => setVacancies(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="ej-employment-type" className="block text-sm font-medium text-neutral-700">{t('jobs.employmentType')}</label>
                  <select id="ej-employment-type" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
                    {EMPLOYMENT_TYPES.map((v) => (<option key={v} value={v}>{humanize(v)}</option>))}
                  </select>
                </div>
                <div>
                  <label htmlFor="ej-workplace-type" className="block text-sm font-medium text-neutral-700">{t('jobs.workplaceType')}</label>
                  <select id="ej-workplace-type" value={workplaceType} onChange={(e) => setWorkplaceType(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
                    {WORKPLACE_TYPES.map((v) => (<option key={v} value={v}>{humanize(v)}</option>))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="ej-salary-min" className="block text-sm font-medium text-neutral-700">{t('employer.jobForm.salaryMin')}</label>
                  <input id="ej-salary-min" type="number" min={0} value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label htmlFor="ej-salary-max" className="block text-sm font-medium text-neutral-700">{t('employer.jobForm.salaryMax')}</label>
                  <input id="ej-salary-max" type="number" min={0} value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={salaryNegotiable} onChange={(e) => setSalaryNegotiable(e.target.checked)} /> {t('employer.jobForm.negotiable')}
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{t('jobs.location')}</h2>
            <div className="mt-4">
              <label htmlFor="ej-location" className="block text-sm font-medium text-neutral-700">{t('jobs.location')}</label>
              <select id="ej-location" value={locationId} onChange={(e) => setLocationId(e.target.value)} className="mt-1 w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm">
                <option value="">{t('employer.company.locationUnset')}</option>
                {locations.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
              </select>
            </div>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{t('employer.jobForm.application')}</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="ej-deadline" className="block text-sm font-medium text-neutral-700">{t('jobs.deadline')}</label>
                <input id="ej-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-1 w-full max-w-[12rem] rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="ej-app-method" className="block text-sm font-medium text-neutral-700">{t('employer.jobForm.applicationMethod')}</label>
                <select id="ej-app-method" value={applicationMethod} onChange={(e) => setApplicationMethod(e.target.value)} className="mt-1 w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm">
                  {APPLICATION_METHODS.map((v) => (<option key={v} value={v}>{humanize(v)}</option>))}
                </select>
              </div>
              {applicationMethod === 'EXTERNAL_URL' && (
                <div>
                  <label htmlFor="ej-external-url" className="block text-sm font-medium text-neutral-700">{t('employer.jobForm.externalUrl')}</label>
                  <input id="ej-external-url" type="url" required value={externalApplyUrl} onChange={(e) => setExternalApplyUrl(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                </div>
              )}
              {applicationMethod === 'EMAIL' && (
                <div>
                  <label htmlFor="ej-app-email" className="block text-sm font-medium text-neutral-700">{t('employer.jobForm.applicationEmail')}</label>
                  <input id="ej-app-email" type="email" required value={applicationEmail} onChange={(e) => setApplicationEmail(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                </div>
              )}
              <div>
                <label htmlFor="ej-app-instructions" className="block text-sm font-medium text-neutral-700">{t('jobs.applicationInstructions')}</label>
                <textarea id="ej-app-instructions" rows={2} maxLength={2000} value={applicationInstructions} onChange={(e) => setApplicationInstructions(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
            </div>
          </section>
        </fieldset>

        {formError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

        {!readOnly && (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => navigate(pathFor('/employer/jobs', code))} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">{t('employer.jobForm.cancel')}</button>
            <button type="submit" disabled={saving} className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50">
              {isEdit ? t('employer.jobForm.saveChanges') : t('employer.jobForm.createJob')}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
