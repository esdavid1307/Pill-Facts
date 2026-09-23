/** The source, publisher and date behind one rendered claim. */
export type Provenance = {
  /** The Label the words come from, named as it is published. */
  label: string
  /** Who published it, absent where the Label does not say. */
  manufacturer?: string
  /** The date this version of the Label took effect, as an ISO date. */
  effectiveDate: string
  /** Where the Label can be read whole. */
  url: string
}

export type SafetySection = {
  /** The FDA's own name for the section. */
  heading: string
  /** The FDA's own words. */
  text: string
  provenance: Provenance
}

export type DrugConcept = {
  /** The ingredient-level RxCUI that identifies the Drug Concept. See ADR-0002. */
  rxcui: string
  /** The Active Ingredient's name. */
  name: string
  /** The strengths the drug is made in, absent where the Label omits them. */
  strengths?: string
  /**
   * The Safety Sections the Representative Label carries, in the order they are to be
   * read. A section the Label does not carry is simply not here — there is nothing to
   * check for and nothing to say about it. See ADR-0007.
   */
  sections: SafetySection[]
}

/**
 * Thrown where the RxCUI identifies no Drug Concept at all. That is an answer about the
 * address the reader followed, and is not the FDA being unreachable — the two are
 * different facts and are never worded as though they were the same one.
 */
export class NoSuchDrugConcept extends Error {}

/** Same-origin, like every other call the frontend makes. See ADR-0011. */
export async function fetchDrugConcept(rxcui: string): Promise<DrugConcept> {
  const response = await fetch(`/api/drug-concepts/${encodeURIComponent(rxcui)}`)
  if (response.status === 404) {
    throw new NoSuchDrugConcept(rxcui)
  }
  if (!response.ok) {
    throw new Error(`GET /api/drug-concepts/${rxcui} returned ${response.status}`)
  }
  return (await response.json()) as DrugConcept
}
