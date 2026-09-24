import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import {
  fetchDrugConcept,
  NoSuchDrugConcept,
  type DrugConcept,
  type RegulatoryClass,
  type RegulatoryClassBlock,
} from '../api/drugConcept'
import type { Candidate } from '../api/search'
import { RelatedProducts } from './RelatedProducts'
import { LabelProvenance, SafetySections } from './SafetySections'

/**
 * What came back, and which Drug Concept it came back for. Navigating from one Drug
 * Concept to another keeps this component mounted, and an answer to the previous RxCUI
 * must never render under the new one's heading.
 *
 * The three failures are kept apart all the way down, because "the FDA publishes nothing
 * for this drug", "there is no such drug" and "we couldn't reach the FDA" mean entirely
 * different things to someone looking up their medication. ADR-0007. Telling them apart
 * in the API response rather than only here is #9's work.
 */
type Loaded = { state: 'loaded'; rxcui: string; drugConcept: DrugConcept }
type NoSuchConcept = { state: 'no-such-concept'; rxcui: string }
type Unreachable = { state: 'unreachable'; rxcui: string }
type Fetched = Loaded | NoSuchConcept | Unreachable

/**
 * A Drug Concept's page: what the FDA says about the risks of one medication.
 *
 * The Brand a search matched is not in the URL and not in the payload, so it arrives in
 * router state and titles the page where a search got the reader here. A cold link has
 * the Active Ingredient's name, which the payload always carries.
 */
export function DrugConceptPage() {
  const { rxcui } = useParams()
  const resolved = (useLocation().state as { candidate?: Candidate } | null)?.candidate
  const [fetched, setFetched] = useState<Fetched | null>(null)

  useEffect(() => {
    if (!rxcui) {
      return
    }
    let current = true
    fetchDrugConcept(rxcui)
      .then((drugConcept) => current && setFetched({ state: 'loaded', rxcui, drugConcept }))
      .catch((error: unknown) => {
        if (!current) {
          return
        }
        setFetched({
          state: error instanceof NoSuchDrugConcept ? 'no-such-concept' : 'unreachable',
          rxcui,
        })
      })
    return () => {
      current = false
    }
  }, [rxcui])

  // An answer for another RxCUI is no answer for this one, so it reads as still loading.
  const answer = fetched?.rxcui === rxcui ? fetched : null
  const name = answer?.state === 'loaded' ? answer.drugConcept.name : resolved?.name

  return (
    <article>
      {/* Arriving via a Brand leads with that Brand, per ADR-0002. */}
      <h1>{title(resolved?.brand, name) ?? `RxCUI ${rxcui}`}</h1>

      {answer === null && <p className="pending">Looking up the FDA&rsquo;s labelling&hellip;</p>}

      {/* An outage is a fact about us, and never worded as a fact about the drug. */}
      {answer?.state === 'unreachable' && (
        <p role="alert">
          We couldn&rsquo;t reach the FDA&rsquo;s labelling just now, so there is nothing to show
          yet. Please try again.
        </p>
      )}

      {/* Nor is "we have never heard of this" a fact about the drug. */}
      {answer?.state === 'no-such-concept' && (
        <p role="alert">We don&rsquo;t have a medication at this address. Try searching again.</p>
      )}

      {answer?.state === 'loaded' && (
        <>
          <Labelling drugConcept={answer.drugConcept} />
          {/*
            * What else the Active Ingredient is sold in is a claim about composition
            * rather than about the labelling, so it is shown whether the FDA publishes a
            * Label or not.
            */}
          <RelatedProducts drugConcept={answer.drugConcept} />
        </>
      )}

      <Link to="/">Search for another medication</Link>
    </article>
  )
}

function Labelling({ drugConcept }: { drugConcept: DrugConcept }) {
  /*
   * Nothing to show is not the same as nothing to know, and must never read as though it
   * were. Both Regulatory Classes now have a renderer, so an empty list no longer means
   * "we don't render this kind of drug" — but it still runs two facts together, because
   * a Drug Concept the FDA publishes no Label for and a Label carrying none of the
   * sections we read arrive here identically. Until #9 gives the API the vocabulary to
   * tell them apart, this says only what is true of both: that the gap is ours to
   * explain, and that it is not a claim about the medication.
   */
  if (drugConcept.labelling.every((block) => block.sections.length === 0)) {
    return (
      <p className="unlabelled">
        Pill-Facts has no labelling to show for {drugConcept.name}. That is a gap in what we have,
        and not a statement that this medication has no known risks.
      </p>
    )
  }

  return (
    <>
      {drugConcept.labelling.map((block) => (
        <ClassLabelling key={block.regulatoryClass} block={block} />
      ))}
    </>
  )
}

const CLASS_HEADINGS: Record<RegulatoryClass, string> = {
  OVER_THE_COUNTER: 'Over-the-counter labelling',
  PRESCRIPTION: 'Prescription labelling',
}

/** One Representative Label, clearly bounded so its class cannot be mistaken. */
function ClassLabelling({ block }: { block: RegulatoryClassBlock }) {
  const id = `labelling-${block.regulatoryClass.toLowerCase().replaceAll('_', '-')}`
  return (
    <section className="regulatory-class" aria-labelledby={id}>
      <h2 id={id}>{CLASS_HEADINGS[block.regulatoryClass]}</h2>
      {/* Safety first within the class: no claim is allowed above a Boxed Warning. */}
      <SafetySections sections={block.sections} />
      {block.strengths && (
        <section aria-labelledby={`${id}-strengths`}>
          <h3 id={`${id}-strengths`}>Strengths</h3>
          <p>{block.strengths}</p>
          <LabelProvenance provenance={block.provenance} />
        </section>
      )}
    </section>
  )
}

function title(brand: string | undefined, name: string | undefined): string | undefined {
  if (!name) {
    return undefined
  }
  return brand ? `${brand} (${name})` : name
}
