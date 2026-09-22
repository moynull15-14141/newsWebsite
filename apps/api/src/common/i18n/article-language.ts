import { Prisma } from '@prisma/client';

export interface LanguageFilter {
  id: string;
  isDefault: boolean;
}

/**
 * Single definition of "this article belongs to language X" for public reads. Rows created before
 * Phase 2C have `languageId: null` — they are treated as the DEFAULT language rather than excluded, so
 * existing content keeps appearing once a default language is configured, with no backfill required.
 */
export function articleLanguageWhere(language: LanguageFilter): Prisma.ArticleWhereInput {
  return language.isDefault ? { OR: [{ languageId: language.id }, { languageId: null }] } : { languageId: language.id };
}

/** True when `articleLanguageId` (possibly null/legacy) counts as belonging to `language`. */
export function matchesLanguage(articleLanguageId: string | null | undefined, language: LanguageFilter): boolean {
  if (articleLanguageId === language.id) return true;
  return language.isDefault && !articleLanguageId;
}
