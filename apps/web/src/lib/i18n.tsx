/* eslint-disable react-refresh/only-export-components -- this file colocates the language context,
   its provider, its hook, and the small pure path helpers they share; splitting them into separate
   files would only serve Vite's fast-refresh heuristic, not the code. */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';
import { dictionaries, type TranslationKey } from './dictionaries';

/**
 * URL-driven, centralized language state. The current language is derived from the URL path (never
 * from stored preference alone), so a link is always self-describing and shareable: the default
 * language (bn) is the bare, unprefixed site; every other language gets an explicit prefix (`/en/...`).
 * This mirrors the API's own default-language convention (LanguagesService.getDefault()) and the
 * server-side sitemap (apps/api/src/modules/seo/seo.service.ts).
 */

export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  direction: string;
}

/** Used before the /languages fetch resolves, and as a safety net if it fails — keeps the header stable. */
const FALLBACK_LANGUAGES: LanguageInfo[] = [
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', direction: 'ltr' },
  { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr' },
];

/** Every language code that currently has a real URL prefix wired up in App.tsx (besides the default). */
const PREFIXED_CODES = ['en'] as const;

export const DEFAULT_LANGUAGE_CODE = 'bn';

/** The language implied by the current URL: `/en/...` => 'en'; anything else => the default (bare = bn). */
export function languageFromPath(pathname: string): string {
  const first = pathname.split('/')[1];
  return (PREFIXED_CODES as readonly string[]).includes(first) ? first : DEFAULT_LANGUAGE_CODE;
}

/** Strips a known language prefix, so callers can work with the "bare" path regardless of current language. */
export function stripLanguagePrefix(pathname: string): string {
  const first = pathname.split('/')[1];
  if (!(PREFIXED_CODES as readonly string[]).includes(first)) return pathname;
  const rest = pathname.slice(1 + first.length);
  return rest || '/';
}

/** Rebuilds `pathname` under `code`'s prefix (or bare, for the default language), preserving the rest of the path. */
export function withLanguagePrefix(pathname: string, code: string): string {
  const bare = stripLanguagePrefix(pathname);
  if (code === DEFAULT_LANGUAGE_CODE) return bare;
  return bare === '/' ? `/${code}` : `/${code}${bare}`;
}

interface LanguageContextValue {
  /** Active language code, always in sync with the URL. */
  code: string;
  direction: string;
  /** Active languages from the API (falls back to bn/en while loading or offline). */
  languages: LanguageInfo[];
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  /** Builds the equivalent of `pathname` under a different language. */
  pathFor: (pathname: string, code: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const code = languageFromPath(location.pathname);

  const { data: languages } = useQuery({
    queryKey: ['languages'],
    queryFn: () => apiFetch<LanguageInfo[]>('/languages'),
    staleTime: 60 * 60 * 1000,
  });
  const active = languages?.length ? languages : FALLBACK_LANGUAGES;
  const current = active.find((l) => l.code === code) ?? FALLBACK_LANGUAGES.find((l) => l.code === code) ?? FALLBACK_LANGUAGES[0];

  const t = useMemo(() => {
    const dict = dictionaries[code as keyof typeof dictionaries] ?? dictionaries[DEFAULT_LANGUAGE_CODE];
    return (key: TranslationKey, vars?: Record<string, string | number>) => {
      const template = dict[key] ?? dictionaries[DEFAULT_LANGUAGE_CODE][key] ?? key;
      if (!vars) return template;
      return Object.entries(vars).reduce((acc, [name, value]) => acc.split(`{${name}}`).join(String(value)), template);
    };
  }, [code]);

  const value: LanguageContextValue = { code, direction: current.direction, languages: active, t, pathFor: withLanguagePrefix };
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
