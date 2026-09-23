import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { useEmployerMembership } from './EmployerContext';
import type { CompanyProfile, LocationOption } from './types';

export default function EmployerCompanyPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const membership = useEmployerMembership();
  const canEdit = membership.role === 'OWNER' || membership.role === 'ADMIN';

  const { data: company, isLoading, isError } = useQuery<CompanyProfile>({ queryKey: ['employer-company'], queryFn: () => apiFetch('/employer-portal/company') });
  const { data: locations = [] } = useQuery<LocationOption[]>({ queryKey: ['public-locations'], queryFn: () => apiFetch('/public/locations') });

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [foundedYear, setFoundedYear] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [locationId, setLocationId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    if (!company) return;
    setName(company.name); setIndustry(company.industry || ''); setCompanySize(company.companySize || '');
    setFoundedYear(company.foundedYear?.toString() || ''); setDescription(company.description || '');
    setWebsite(company.website || ''); setContactEmail(company.contactEmail || ''); setContactPhone(company.contactPhone || '');
    setLocationId(company.locationId || '');
  }, [company]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch('/employer-portal/company', {
        method: 'PATCH',
        body: JSON.stringify({
          name, industry: industry || undefined, companySize: companySize || undefined,
          foundedYear: foundedYear ? Number(foundedYear) : undefined, description: description || undefined,
          website: website || undefined, contactEmail: contactEmail || undefined, contactPhone: contactPhone || undefined,
          locationId: locationId || undefined,
        }),
      }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employer-company'] }); setSavedMessage(true); setFormError(null); },
    onError: (err: unknown) => setFormError(getApiErrorMessage(err, t('employer.company.saveError'))),
  });

  const submitVerification = useMutation({
    mutationFn: () => apiFetch('/employer-portal/company/submit-verification', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employer-company'] }),
    onError: (err: unknown) => setFormError(getApiErrorMessage(err, t('employer.company.verificationError'))),
  });

  if (isLoading) return <p className="text-neutral-500">{t('common.loading')}</p>;
  if (isError || !company) return <p className="text-red-600">{t('common.somethingWrong')}</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900">{t('employer.company.title')}</h1>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            company.verificationStatus === 'VERIFIED' ? 'bg-green-100 text-green-700' : company.verificationStatus === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {t('employer.company.verificationLabel')}: {company.verificationStatus}
        </span>
        {company.verificationStatus === 'REJECTED' && company.verificationNote && (
          <span className="text-sm text-neutral-600">{company.verificationNote}</span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => submitVerification.mutate()}
            disabled={company.verificationStatus === 'VERIFIED' || submitVerification.isPending}
            className="ml-auto rounded-md border border-primary-500 px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('employer.company.submitVerification')}
          </button>
        )}
      </div>

      <form
        className="mt-6 space-y-4 rounded-lg border border-neutral-200 bg-white p-5"
        onSubmit={(e) => { e.preventDefault(); setSavedMessage(false); save.mutate(); }}
      >
        <fieldset disabled={!canEdit} className="space-y-4">
          <div>
            <label htmlFor="co-name" className="block text-sm font-medium text-neutral-700">{t('employer.company.name')}</label>
            <input id="co-name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="co-industry" className="block text-sm font-medium text-neutral-700">{t('employer.company.industry')}</label>
              <input id="co-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="co-size" className="block text-sm font-medium text-neutral-700">{t('employer.company.size')}</label>
              <input id="co-size" value={companySize} onChange={(e) => setCompanySize(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label htmlFor="co-founded" className="block text-sm font-medium text-neutral-700">{t('employer.company.founded')}</label>
            <input id="co-founded" type="number" min={1800} max={2100} value={foundedYear} onChange={(e) => setFoundedYear(e.target.value)} className="mt-1 w-full max-w-[10rem] rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="co-description" className="block text-sm font-medium text-neutral-700">{t('employer.company.description')}</label>
            <textarea id="co-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="co-website" className="block text-sm font-medium text-neutral-700">{t('employer.company.website')}</label>
            <input id="co-website" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="co-email" className="block text-sm font-medium text-neutral-700">{t('employer.company.contactEmail')}</label>
              <input id="co-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="co-phone" className="block text-sm font-medium text-neutral-700">{t('employer.company.contactPhone')}</label>
              <input id="co-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label htmlFor="co-location" className="block text-sm font-medium text-neutral-700">{t('employer.company.location')}</label>
            <select id="co-location" value={locationId} onChange={(e) => setLocationId(e.target.value)} className="mt-1 w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm">
              <option value="">{t('employer.company.locationUnset')}</option>
              {locations.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
            </select>
          </div>
        </fieldset>

        {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
        {savedMessage && !formError && <p role="status" className="text-sm text-green-700">{t('employer.company.saved')}</p>}

        {canEdit && (
          <button type="submit" disabled={save.isPending} className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50">
            {t('employer.company.save')}
          </button>
        )}
      </form>
    </div>
  );
}
