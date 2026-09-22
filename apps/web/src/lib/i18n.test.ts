import { describe, expect, it } from 'vitest';
import { DEFAULT_LANGUAGE_CODE, languageFromPath, stripLanguagePrefix, withLanguagePrefix } from './i18n';

describe('languageFromPath', () => {
  it('defaults to bn for the bare site', () => {
    expect(languageFromPath('/')).toBe(DEFAULT_LANGUAGE_CODE);
    expect(languageFromPath('/category/bangladesh')).toBe('bn');
  });

  it('detects the /en prefix', () => {
    expect(languageFromPath('/en')).toBe('en');
    expect(languageFromPath('/en/category/world')).toBe('en');
  });

  it('does not treat an unrelated first segment as a language prefix', () => {
    expect(languageFromPath('/english-language-day')).toBe('bn');
  });
});

describe('stripLanguagePrefix', () => {
  it('leaves a bare path untouched', () => {
    expect(stripLanguagePrefix('/category/world')).toBe('/category/world');
  });

  it('removes a known language prefix', () => {
    expect(stripLanguagePrefix('/en/category/world')).toBe('/category/world');
    expect(stripLanguagePrefix('/en')).toBe('/');
  });
});

describe('withLanguagePrefix', () => {
  it('rebuilds a path under the default language as the bare path', () => {
    expect(withLanguagePrefix('/en/article/foo', 'bn')).toBe('/article/foo');
    expect(withLanguagePrefix('/en', 'bn')).toBe('/');
  });

  it('rebuilds a path under a non-default language with its prefix', () => {
    expect(withLanguagePrefix('/article/foo', 'en')).toBe('/en/article/foo');
    expect(withLanguagePrefix('/', 'en')).toBe('/en');
  });

  it('re-prefixes a path that already carries a different language prefix', () => {
    expect(withLanguagePrefix('/en/category/world', 'en')).toBe('/en/category/world');
  });
});
