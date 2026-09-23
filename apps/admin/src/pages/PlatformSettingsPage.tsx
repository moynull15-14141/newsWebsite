import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings2 } from 'lucide-react';
import { apiFetch, getApiErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';

// Mirrors PLATFORM_SETTING_KEYS in apps/api/src/modules/platform-settings/platform-settings.constants.ts —
// deliberately hardcoded here rather than fetched, since the set of togglable flags is a deploy-time
// decision, not runtime data; adding a new key means updating both places, same as any other DTO mirror
// in this codebase (see EmployerJobsPage/JobEditorPage's EMPLOYMENT_TYPES for the same convention).
const SETTINGS: Array<{ key: string; label: string; description: string }> = [
  { key: 'employer_platform_enabled', label: 'Employer platform', description: 'Master switch for the entire employer/third-party job posting platform.' },
  { key: 'employer_registration_enabled', label: 'Employer self-registration', description: 'Allow readers to register a new employer account from the public site.' },
  { key: 'company_profiles_enabled', label: 'Company profiles', description: 'Allow employers to view and edit their company profile.' },
  { key: 'third_party_job_posting_enabled', label: 'Third-party job posting', description: 'Allow employers to create job postings themselves.' },
  { key: 'free_job_posting_enabled', label: 'Free job posting', description: 'Allow employers to post jobs under the free plan.' },
  { key: 'paid_job_posting_enabled', label: 'Paid job posting', description: 'Activate paid plans for job postings (no payment gateway exists yet — this only unlocks paid plan selection).' },
  { key: 'featured_job_promotion_enabled', label: 'Featured job promotion', description: 'Allow featured/promoted job placements.' },
  { key: 'employer_application_access_enabled', label: 'Employer application access', description: 'Allow employers to view and manage applicants to their own jobs.' },
  { key: 'employer_dashboard_enabled', label: 'Employer dashboard', description: 'Allow employers to see their dashboard metrics.' },
  { key: 'require_employer_verification', label: 'Require employer verification', description: 'Require staff verification before an employer is treated as trusted.' },
  { key: 'require_admin_job_approval', label: 'Require admin job approval', description: 'Employer job postings must be approved by staff before publishing.' },
  { key: 'auto_publish', label: 'Auto-publish approved jobs', description: 'Automatically publish jobs as soon as they are approved.' },
];

export default function PlatformSettingsPage() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('platform.settings.manage');

  const { data, isLoading, isError } = useQuery<Record<string, boolean | null>>({
    queryKey: ['platform-settings'],
    queryFn: () => apiFetch('/platform-settings'),
  });

  const toggle = useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) => apiFetch(`/platform-settings/${key}`, { method: 'PATCH', body: JSON.stringify({ value }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-settings'] }),
  });

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Settings2 size={24} /> Platform Settings</h1>
      <p className="mt-1 text-sm text-gray-500">Feature flags controlling the employer/third-party job posting platform. Everything starts disabled by design.</p>
      {!canManage && (
        <p role="status" className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">You have view-only access to these settings. Ask an administrator with “platform.settings.manage” to change them.</p>
      )}
      {toggle.isError && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{getApiErrorMessage(toggle.error, 'Failed to update this setting')}</p>
      )}

      {isLoading ? (
        <div className="mt-8 text-center text-gray-500">Loading...</div>
      ) : isError || !data ? (
        <div className="mt-8 text-center text-gray-500">Failed to load settings</div>
      ) : (
        <div className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {SETTINGS.map((setting) => {
            const value = data[setting.key] === true;
            return (
              <div key={setting.key} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <label htmlFor={`setting-${setting.key}`} className="font-medium text-gray-900">{setting.label}</label>
                  <p className="mt-0.5 text-sm text-gray-500">{setting.description}</p>
                </div>
                <button
                  id={`setting-${setting.key}`}
                  type="button"
                  role="switch"
                  aria-checked={value}
                  aria-label={setting.label}
                  disabled={!canManage || toggle.isPending}
                  onClick={() => toggle.mutate({ key: setting.key, value: !value })}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${value ? 'bg-primary-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
