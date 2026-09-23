import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage, ApiError } from '@/lib/api';
import { useReaderAuthStore } from '@/stores/reader-auth-store';
import { useLanguage } from '@/lib/i18n';
import SeoHead from '@/components/SeoHead';
import type { LocationOption, MyMembership } from './types';

const STEPS = ['employer.onboarding.step1', 'employer.onboarding.step2', 'employer.onboarding.step3', 'employer.onboarding.step4'] as const;

/**
 * 5-visible-state wizard (4 input steps + a submitting/result state): (1) confirm the signed-in reader's
 * own info, (2) company info, (3) contact info, (4) review, then submit -> POST /employer-portal/register.
 * If the caller already has a membership we skip straight to the dashboard; if registration is disabled
 * platform-wide we show the backend's own reason rather than a broken form.
 */
export default function EmployerOnboardingPage() {
  const user = useReaderAuthStore((s) => s.user);
  const { t, code, pathFor } = useLanguage();
  const navigate = useNavigate();

  const { data: memberships, isLoading: loadingMe } = useQuery<MyMembership[]>({
    queryKey: ['employer-me'],
    queryFn: () => apiFetch('/employer-portal/me'),
    enabled: !!user,
  });
  const { data: locations = [] } = useQuery<LocationOption[]>({
    queryKey: ['public-locations'],
    queryFn: () => apiFetch('/public/locations'),
  });

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [foundedYear, setFoundedYear] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [contactPhone, setContactPhone] = useState('');
  const [locationId, setLocationId] = useState('');

  const register = useMutation({
    mutationFn: () =>
      apiFetch('/employer-portal/register', {
        method: 'POST',
        body: JSON.stringify({
          name,
          industry: industry || undefined,
          companySize: companySize || undefined,
          foundedYear: foundedYear ? Number(foundedYear) : undefined,
          description: description || undefined,
          website: website || undefined,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
          locationId: locationId || undefined,
        }),
      }),
    onSuccess: () => navigate(pathFor('/employer', code)),
  });

  if (!user) return <Navigate to={pathFor('/login', code)} replace />;

  if (loadingMe) {
    return <main className="container-narrow py-16 text-center text-neutral-500">{t('common.loading')}</main>;
  }

  const activeMembership = memberships?.find((m) => m.status === 'ACTIVE' || m.status === 'INVITED');
  if (activeMembership) return <Navigate to={pathFor('/employer', code)} replace />;

  const registrationDisabled = register.isError && register.error instanceof ApiError && register.error.status === 403;

  return (
    <>
      <SeoHead title={t('employer.onboarding.title')} noIndex />
      <main className="container-narrow py-10">
        <h1 className="text-3xl font-bold text-neutral-900">{t('employer.onboarding.title')}</h1>
        <p className="mt-2 text-neutral-500">{t('employer.onboarding.subtitle')}</p>

        {registrationDisabled ? (
          <div role="alert" className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-800">
            <p className="font-semibold">{t('employer.onboarding.unavailable')}</p>
            <p className="mt-1 text-sm">{getApiErrorMessage(register.error, t('employer.onboarding.unavailable'))}</p>
          </div>
        ) : (
          <>
            <ol className="mt-6 flex flex-wrap gap-2 text-xs font-medium text-neutral-500" aria-label={t('employer.onboarding.progress')}>
              {STEPS.map((key, idx) => (
                <li key={key} className={`rounded-full px-3 py-1 ${step === idx + 1 ? 'bg-primary-500 text-white' : step > idx + 1 ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100'}`}>
                  {idx + 1}. {t(key)}
                </li>
              ))}
            </ol>

            <form
              className="mt-6 space-y-5 rounded-lg border border-neutral-200 bg-white p-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (step < 4) setStep(step + 1);
                else register.mutate();
              }}
            >
              {step === 1 && (
                <section className="space-y-3">
                  <h2 className="text-lg font-semibold">{t('employer.onboarding.step1')}</h2>
                  <p className="text-sm text-neutral-500">{t('employer.onboarding.step1Body', { name: user.name, email: user.email })}</p>
                </section>
              )}

              {step === 2 && (
                <section className="space-y-3">
                  <h2 className="text-lg font-semibold">{t('employer.onboarding.step2')}</h2>
                  <div>
                    <label htmlFor="ob-name" className="block text-sm font-medium text-neutral-700">{t('employer.company.name')}</label>
                    <input id="ob-name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="ob-industry" className="block text-sm font-medium text-neutral-700">{t('employer.company.industry')}</label>
                      <input id="ob-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label htmlFor="ob-size" className="block text-sm font-medium text-neutral-700">{t('employer.company.size')}</label>
                      <input id="ob-size" value={companySize} onChange={(e) => setCompanySize(e.target.value)} placeholder="e.g. 11-50" className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="ob-founded" className="block text-sm font-medium text-neutral-700">{t('employer.company.founded')}</label>
                    <input id="ob-founded" type="number" min={1800} max={2100} value={foundedYear} onChange={(e) => setFoundedYear(e.target.value)} className="mt-1 w-full max-w-[10rem] rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="ob-description" className="block text-sm font-medium text-neutral-700">{t('employer.company.description')}</label>
                    <textarea id="ob-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                  </div>
                </section>
              )}

              {step === 3 && (
                <section className="space-y-3">
                  <h2 className="text-lg font-semibold">{t('employer.onboarding.step3')}</h2>
                  <div>
                    <label htmlFor="ob-website" className="block text-sm font-medium text-neutral-700">{t('employer.company.website')}</label>
                    <input id="ob-website" type="url" placeholder="https://example.com" value={website} onChange={(e) => setWebsite(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="ob-email" className="block text-sm font-medium text-neutral-700">{t('employer.company.contactEmail')}</label>
                      <input id="ob-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label htmlFor="ob-phone" className="block text-sm font-medium text-neutral-700">{t('employer.company.contactPhone')}</label>
                      <input id="ob-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="ob-location" className="block text-sm font-medium text-neutral-700">{t('employer.company.location')}</label>
                    <select id="ob-location" value={locationId} onChange={(e) => setLocationId(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
                      <option value="">{t('employer.company.locationUnset')}</option>
                      {locations.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
                    </select>
                  </div>
                </section>
              )}

              {step === 4 && (
                <section className="space-y-3">
                  <h2 className="text-lg font-semibold">{t('employer.onboarding.step4')}</h2>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <div><dt className="text-neutral-500">{t('employer.company.name')}</dt><dd className="font-medium">{name || '—'}</dd></div>
                    <div><dt className="text-neutral-500">{t('employer.company.industry')}</dt><dd className="font-medium">{industry || '—'}</dd></div>
                    <div><dt className="text-neutral-500">{t('employer.company.size')}</dt><dd className="font-medium">{companySize || '—'}</dd></div>
                    <div><dt className="text-neutral-500">{t('employer.company.founded')}</dt><dd className="font-medium">{foundedYear || '—'}</dd></div>
                    <div><dt className="text-neutral-500">{t('employer.company.website')}</dt><dd className="font-medium">{website || '—'}</dd></div>
                    <div><dt className="text-neutral-500">{t('employer.company.contactEmail')}</dt><dd className="font-medium">{contactEmail || '—'}</dd></div>
                    <div><dt className="text-neutral-500">{t('employer.company.contactPhone')}</dt><dd className="font-medium">{contactPhone || '—'}</dd></div>
                    <div><dt className="text-neutral-500">{t('employer.company.location')}</dt><dd className="font-medium">{locations.find((l) => l.id === locationId)?.name || '—'}</dd></div>
                  </dl>
                </section>
              )}

              {register.isError && !registrationDisabled && (
                <p role="alert" className="text-sm text-red-600">{getApiErrorMessage(register.error, t('employer.onboarding.submitError'))}</p>
              )}

              <div className="flex justify-between pt-2">
                <button type="button" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 disabled:opacity-40">
                  {t('common.previous')}
                </button>
                <button type="submit" disabled={(step === 2 && !name.trim()) || register.isPending} className="rounded-md bg-primary-500 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50">
                  {step < 4 ? t('common.next') : register.isPending ? t('common.loading') : t('employer.onboarding.submit')}
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </>
  );
}
