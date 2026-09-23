/** The closed set of platform feature-flag keys this phase knows about. Deliberately an allowlist
 * rather than free-form keys — PlatformSettingsController rejects any key outside this list so the
 * settings table can never accumulate arbitrary/typo'd config rows. Every value here is a boolean and
 * every default is safe-by-default: nothing that exposes the employer/third-party job platform to the
 * public starts enabled. */
export const PLATFORM_SETTING_KEYS = [
  'employer_platform_enabled',
  'employer_registration_enabled',
  'company_profiles_enabled',
  'third_party_job_posting_enabled',
  'free_job_posting_enabled',
  'paid_job_posting_enabled',
  'featured_job_promotion_enabled',
  'employer_application_access_enabled',
  'employer_dashboard_enabled',
  'require_employer_verification',
  'require_admin_job_approval',
  'auto_publish',
] as const;

export type PlatformSettingKey = (typeof PLATFORM_SETTING_KEYS)[number];

export function isKnownPlatformSettingKey(key: string): key is PlatformSettingKey {
  return (PLATFORM_SETTING_KEYS as readonly string[]).includes(key);
}
