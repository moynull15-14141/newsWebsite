/**
 * Shared localization helpers. A translated entity (Category/Tag/Location) always keeps its base
 * `name` (and, for Category/Tag, `slug`) as the canonical, language-agnostic identity; a translation
 * row only changes what is displayed for one language. This file is the one place that picks which
 * name wins for a given language, so no consumer re-implements the fallback rule differently.
 */

export interface TranslationRow {
  languageId: string;
  language?: { code: string } | null;
  name: string;
}

/**
 * `localized.name` for the requested language if a translation exists, else the base name.
 * `translations` may be omitted entirely (older queries that never selected them) — safe no-op then.
 */
export function localizedName<T extends { name: string }>(
  entity: T,
  translations: TranslationRow[] | undefined,
  languageCode: string | undefined,
): string {
  if (!languageCode || !translations?.length) return entity.name;
  const match = translations.find((row) => row.language?.code === languageCode);
  return match?.name ?? entity.name;
}

/** Attaches a `localizedName` field without discarding the original `name`/`translations`. */
export function withLocalizedName<T extends { name: string; translations?: TranslationRow[] }>(
  entity: T,
  languageCode: string | undefined,
): T & { localizedName: string } {
  return { ...entity, localizedName: localizedName(entity, entity.translations, languageCode) };
}
