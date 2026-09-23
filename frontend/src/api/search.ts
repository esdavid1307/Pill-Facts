export type Candidate = {
  /** The ingredient-level RxCUI that identifies the Drug Concept. See ADR-0002. */
  rxcui: string
  /** The Active Ingredient's name. */
  name: string
  /** The Brand that matched, present only where the query matched one. */
  brand?: string
}

export type SearchResults = {
  candidates: Candidate[]
}

/**
 * The backend is same-origin everywhere: the Vite dev server proxies /api, nginx proxies
 * it in the built image, and a Pages Function proxies it in production. There is no API
 * base URL in the frontend to configure and no CORS anywhere. See ADR-0011.
 */
export async function searchDrugConcepts(query: string): Promise<SearchResults> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
  if (!response.ok) {
    throw new Error(`GET /api/search returned ${response.status}`)
  }
  return (await response.json()) as SearchResults
}
