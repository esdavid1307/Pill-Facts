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

export type RegulatoryClass = 'OVER_THE_COUNTER' | 'PRESCRIPTION'

/** The part of a Drug Concept page spoken by one Representative Label. */
export type RegulatoryClassBlock = {
  regulatoryClass: RegulatoryClass
  /** The Representative Label behind claims carried directly by this block. */
  provenance: Provenance
  /** The strengths this Label states, absent where it states none. */
  strengths?: string
  /** The Safety Sections this Representative Label carries, in render order. */
  sections: SafetySection[]
}

/**
 * One product with a Drug Concept's Active Ingredient, in one strength and one dosage
 * form.
 *
 * It carries no prose, and none is written for it here either. An Alternative is a
 * statement about what a product is made of, never that a reader may take it instead of
 * what they looked up. See ADR-0005.
 */
export type Alternative = {
  /** RxNorm's own name for the product less its Brand: ingredient, strength, dosage form. */
  composition: string
  /** The Brands sold in exactly that composition, empty where it is sold without one. */
  brands: string[]
}

/**
 * A product with the Active Ingredient and at least one other.
 *
 * Written out separately from an Alternative because it is never one: RxNorm lists
 * Caduet, which is amlodipine as well as atorvastatin, among atorvastatin's brands. The
 * two shapes are identical, so TypeScript will not stop one being passed where the other
 * belongs — the backend sends them in two fields and the page renders them under two
 * headings, and that is where the separation is kept.
 */
export type CombinationProduct = {
  /** RxNorm's own name for the product less its Brand, naming every Active Ingredient in it. */
  composition: string
  /** The Brands sold in exactly that composition, empty where it is sold without one. */
  brands: string[]
}

export type DrugConcept = {
  /** The ingredient-level RxCUI that identifies the Drug Concept. See ADR-0002. */
  rxcui: string
  /** The Active Ingredient's name. */
  name: string
  /**
   * One block per Regulatory Class in which the FDA publishes a Label, OTC first. A
   * class without a Representative Label is absent rather than represented by an empty
   * placeholder. See ADR-0010.
   */
  labelling: RegulatoryClassBlock[]
  /** Other products of this Active Ingredient alone, absent where there are none. */
  alternatives?: Alternative[]
  /**
   * Products of this Active Ingredient and at least one other, absent where there are
   * none. Never among the Alternatives, and never rendered as though they were.
   */
  combinationProducts?: CombinationProduct[]
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
