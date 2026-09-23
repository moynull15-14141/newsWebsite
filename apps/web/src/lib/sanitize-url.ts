/**
 * A stored TipTap link mark's `href` is user-controlled content (whatever an editor pasted or typed)
 * rendered straight into a real `<a href>` for every reader (Phase 2M XSS audit). React already escapes
 * it as a string attribute, but that only stops HTML injection — it does nothing to stop the browser
 * from *navigating* to a `javascript:`/`vbscript:`/`data:` URL when the link is clicked, which runs
 * arbitrary script in the page's own origin exactly like an XSS payload would. `rel="noopener
 * noreferrer"` (already on every rendered link) protects against tabnabbing/referrer leaks — a
 * completely different concern — and does nothing here.
 *
 * Only allow the schemes a legitimate news-article link could actually need; anything else (or a
 * malformed/unparseable value) is treated as unsafe.
 */
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export function isSafeUrl(href: string | null | undefined): boolean {
  if (!href) return false;
  const trimmed = href.trim();
  if (!trimmed) return false;
  // A relative path ("/article/x", "#section") has no scheme to check and never executes script.
  if (/^[/#]/.test(trimmed)) return true;
  try {
    return SAFE_PROTOCOLS.has(new URL(trimmed, 'https://example.invalid').protocol);
  } catch {
    return false;
  }
}

/** Returns the href unchanged if safe, or `undefined` (renders a non-navigating link) otherwise. */
export function sanitizeHref(href: string | null | undefined): string | undefined {
  return isSafeUrl(href) ? (href as string) : undefined;
}
