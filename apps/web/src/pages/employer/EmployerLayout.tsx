import { Outlet, Navigate, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useReaderAuthStore } from '@/stores/reader-auth-store';
import { useLanguage } from '@/lib/i18n';
import SeoHead from '@/components/SeoHead';
import { EmployerMembershipContext } from './EmployerContext';
import type { MyMembership } from './types';

/**
 * Gate + chrome for every `/employer/*` page except onboarding itself. Being signed in as any reader is
 * enough to reach `/employer/onboarding`; every other page here additionally requires an ACTIVE or
 * INVITED EmployerMembership (resolved from `GET /employer-portal/me`) — otherwise we send the reader to
 * onboarding rather than showing a broken dashboard for an account they haven't registered yet.
 */
export default function EmployerLayout() {
  const user = useReaderAuthStore((s) => s.user);
  const { t, code, pathFor } = useLanguage();

  const { data: memberships, isLoading, isError } = useQuery<MyMembership[]>({
    queryKey: ['employer-me'],
    queryFn: () => apiFetch('/employer-portal/me'),
    enabled: !!user,
  });

  if (!user) {
    return <Navigate to={pathFor('/login', code)} replace />;
  }

  if (isLoading) {
    return (
      <main className="container-narrow py-16 text-center text-neutral-500">{t('common.loading')}</main>
    );
  }

  const active = memberships?.find((m) => m.status === 'ACTIVE' || m.status === 'INVITED');
  if (isError || !active) {
    return <Navigate to={pathFor('/employer/onboarding', code)} replace />;
  }

  const navItems: Array<[string, string]> = [
    ['/employer', t('employer.nav.dashboard')],
    ['/employer/jobs', t('employer.nav.jobs')],
    ['/employer/applications', t('employer.nav.applications')],
    ['/employer/team', t('employer.nav.team')],
    ['/employer/company', t('employer.nav.company')],
    ['/employer/billing', t('employer.nav.billing')],
  ];

  return (
    <EmployerMembershipContext.Provider value={active}>
      <SeoHead title={t('employer.nav.dashboard')} noIndex />
      <main className="container-wide py-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          <nav aria-label={t('employer.nav.aria')} className="flex shrink-0 flex-row gap-1 overflow-x-auto lg:w-56 lg:flex-col lg:overflow-visible">
            {navItems.map(([href, label]) => (
              <NavLink
                key={href}
                to={pathFor(href, code)}
                end={href === '/employer'}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-primary-50 text-primary-700' : 'text-neutral-600 hover:bg-neutral-100'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="min-w-0 flex-1">
            <Outlet />
          </div>
        </div>
      </main>
    </EmployerMembershipContext.Provider>
  );
}
