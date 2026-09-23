import type { Candidate } from '../api/search'

/**
 * A Drug Concept's URL, keyed by its ingredient RxCUI because that is its identity.
 * See ADR-0002.
 *
 * <p>The Brand a search matched rides along in the query string: the page is
 * ingredient-canonical but brand-aware, so arriving via "Advil" must still lead with
 * "Advil". Without it, a shared link loses the Brand the reader searched for.
 */
export function drugConceptPath({ rxcui, brand }: Candidate): string {
  return brand ? `/drug/${rxcui}?brand=${encodeURIComponent(brand)}` : `/drug/${rxcui}`
}
