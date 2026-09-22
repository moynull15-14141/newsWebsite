/**
 * Client-side mirror of the API's `localizedName` (apps/api/src/common/i18n/localize.ts): a translated
 * entity (Category/Tag/Location) keeps its base `name`/`description` as the canonical identity; a
 * translation row only changes what is displayed for the current site language. Used wherever a page
 * fetches an entity that already carries its own `translations` array (e.g. GET /categories/:slug)
 * instead of relying on a slug-derived guess.
 */

export interface LocalizableTranslation {
  language?: { code: string } | null;
  name: string;
  description?: string | null;
}

export function localizedField<K extends 'name' | 'description'>(
  base: string | null | undefined,
  translations: LocalizableTranslation[] | undefined,
  languageCode: string | undefined,
  field: K,
): string | null | undefined {
  if (!languageCode || !translations?.length) return base;
  const match = translations.find((row) => row.language?.code === languageCode);
  const value = match?.[field];
  return value !== undefined && value !== null && value !== '' ? value : base;
}
