/**
 * Locale-aware date formatting (Part 24: dates must not be forced into one locale). Bangla renders with
 * Bengali numerals and month names via the `nu-beng` Unicode extension; English uses the US locale, as
 * the rest of the site already did before Phase 2C.
 */
export function formatLocalizedDate(
  dateStr: string | null | undefined,
  code: string,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' },
): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const locale = code === 'bn' ? 'bn-BD-u-nu-beng' : 'en-US';
  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', options).format(date);
  }
}

/** Short "12 Sep" style date, used on compact story rows and cards. */
export function formatLocalizedShortDate(dateStr: string | null | undefined, code: string): string {
  return formatLocalizedDate(dateStr, code, { day: 'numeric', month: 'short' });
}
