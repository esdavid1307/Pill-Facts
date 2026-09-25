/**
 * The results page's URL for a query.
 *
 * The query lives in the URL rather than in router state because Resolution is the one
 * step a reader retries: a reload, a shared link and a Back from the wrong medication
 * should all put the same shortlist back on screen. See ADR-0014.
 */
export function searchPath(query: string): string {
  return `/search?q=${encodeURIComponent(query)}`
}
