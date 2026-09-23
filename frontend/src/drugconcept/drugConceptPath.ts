import type { Candidate } from '../api/search'

/**
 * A Drug Concept's URL, keyed by its ingredient RxCUI because that is its identity.
 * See ADR-0002.
 *
 * The Brand a search matched is deliberately not in the URL. The page renders it as a
 * heading, and a Brand that arrived as URL text is text a stranger can choose: a link
 * could put any wording where the reader expects a Brand. It travels in router state
 * instead, and a cold link has the RxCUI to fetch the real thing with.
 */
export function drugConceptPath({ rxcui }: Candidate): string {
  return `/drug-concepts/${rxcui}`
}
