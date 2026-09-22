/**
 * Builds the /search page's own URL (not an API call — SearchPage translates its `q` param into the
 * public API's `search` field itself; see SearchPage.tsx). Returns null for a blank/whitespace-only
 * query so the caller never navigates on a meaningless submission; trims and URL-encodes everything
 * else, Bangla included.
 */
export function buildSearchUrl(searchPagePath: string, rawQuery: string): string | null {
  const query = rawQuery.trim();
  if (!query) return null;
  return `${searchPagePath}?q=${encodeURIComponent(query)}`;
}
