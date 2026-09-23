import { describe, expect, it } from 'vitest';
import { isSafeUrl, sanitizeHref } from './sanitize-url';

describe('isSafeUrl', () => {
  it('allows http/https/mailto/tel links', () => {
    expect(isSafeUrl('https://example.com/article')).toBe(true);
    expect(isSafeUrl('http://example.com')).toBe(true);
    expect(isSafeUrl('mailto:tips@bdnews.com')).toBe(true);
    expect(isSafeUrl('tel:+8801700000000')).toBe(true);
  });

  it('allows relative paths and in-page anchors', () => {
    expect(isSafeUrl('/article/some-story')).toBe(true);
    expect(isSafeUrl('#section-2')).toBe(true);
  });

  it('rejects javascript: URLs — the actual XSS vector this exists to stop', () => {
    expect(isSafeUrl('javascript:alert(document.cookie)')).toBe(false);
    expect(isSafeUrl('JavaScript:alert(1)')).toBe(false); // case-insensitive scheme
    expect(isSafeUrl('  javascript:alert(1)')).toBe(false); // leading whitespace trick
  });

  it('rejects other dangerous/unexpected schemes', () => {
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects empty, null, or undefined values', () => {
    expect(isSafeUrl('')).toBe(false);
    expect(isSafeUrl('   ')).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
  });
});

describe('sanitizeHref', () => {
  it('returns the href unchanged when safe', () => {
    expect(sanitizeHref('https://example.com')).toBe('https://example.com');
  });

  it('returns undefined for an unsafe href, so the rendered <a> gets no href at all', () => {
    expect(sanitizeHref('javascript:alert(1)')).toBeUndefined();
  });
});
