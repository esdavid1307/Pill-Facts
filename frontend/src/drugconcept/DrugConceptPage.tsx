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
import { Unreachable } from '../api/unreachable'
import { RelatedProducts } from './RelatedProducts'
import { SafetyFraming } from './SafetyFraming'
import { LabelProvenance, SafetySections } from './SafetySections'

/**
 * What came back, and which Drug Concept it came back for. Navigating from one Drug
 * Concept to another keeps this component mounted, and an answer to the previous RxCUI
 * must never render under the new one's heading.
 *
 * Nothing to show is kept apart all the way down, because "the FDA publishes nothing for
 * this drug", "there is no such drug" and "we couldn't reach the FDA" mean entirely
 * different things to someone looking up their medication. The backend tells them apart
 * in its response — Unlabelled is a page with no labelling, no such Drug Concept a 404,
 * and Unreachable a 503 — and this keeps them apart on the way to the reader.
 */
type Loaded = { state: 'loaded'; rxcui: string; drugConcept: DrugConcept }
type NoSuchConcept = { state: 'no-such-concept'; rxcui: string }
type Outage = { state: 'unreachable'; rxcui: string }
/** The backend out of reach, or a fault of its own: not known to be Unreachable. */
type NotLoaded = { state: 'not-loaded'; rxcui: string }
type Fetched = Loaded | NoSuchConcept | Outage | NotLoaded

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
          state:
            error instanceof NoSuchDrugConcept
              ? 'no-such-concept'
              : error instanceof Unreachable
                ? 'unreachable'
                : 'not-loaded',
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

      {/*
        * Above everything, and before the fetch has answered. What this page is and is
        * not holds whatever came back, so it is not conditional on anything.
        */}
      <SafetyFraming />

      {answer === null && <p className="pending">Looking up the FDA&rsquo;s labelling&hellip;</p>}

      {/*
        * An outage is a fact about us, and never worded as a fact about the drug. The
        * backend serves any copy it has, however old, so this is only ever reached with
        * none to serve.
        */}
      {answer?.state === 'unreachable' && (
        <p role="alert">
          Pill-Facts couldn&rsquo;t reach the FDA just now, and has no copy of this page saved.
          Please come back later.
        </p>
      )}

      {answer?.state === 'not-loaded' && (
        <p role="alert">Pill-Facts couldn&rsquo;t load this page. Please try again.</p>
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
          <FetchedDate on={answer.drugConcept.fetchedDate} />
        </>
      )}

      <Link to="/">Search for another medication</Link>
    </article>
  )
}

/**
 * When we last went and got this, which is a different fact from when any of the FDA's
 * labelling took effect and is worded so that the two can never be read as one. The
 * backend serves a page up to a week old, and an older one still while the FDA is
 * unreachable, so a reader is always told how old what they are reading is. See ADR-0003.
 */
function FetchedDate({ on }: { on: string }) {
  return (
    <p className="fetched">
      Pill-Facts retrieved this from the FDA on <time dateTime={on}>{on}</time>.
    </p>
  )
}

function Labelling({ drugConcept }: { drugConcept: DrugConcept }) {
  /*
   * Unlabelled: the Drug Concept resolved, and the FDA publishes no Label for it. That
   * is a fact about the drug, and the absence is the FDA's rather than ours, so the
   * sentence says whose it is. It says nothing about safety either way — the framing
   * above already says absence is not evidence of it, and anything said here would be
   * read as the answer to the question the reader came with.
   */
  if (drugConcept.labelling.length === 0) {
    return (
      <p className="unlabelled">
        The FDA publishes no Label for {drugConcept.name}, so there is no labelling here to
        show. That absence is the FDA&rsquo;s, not Pill-Facts&rsquo;.
      </p>
    )
  }

  /*
   * Not Unlabelled: the FDA does publish a Label, it just carries none of the Safety
   * Sections Pill-Facts reads. The reader is pointed at the Label itself rather than told
   * there is nothing.
   */
  if (drugConcept.labelling.every((block) => block.sections.length === 0)) {
    return (
      <>
        <p className="no-sections-read">
          The FDA&rsquo;s Label for {drugConcept.name} carries none of the sections Pill-Facts
          shows.
        </p>
        {drugConcept.labelling.map((block) => (
          <LabelProvenance key={block.regulatoryClass} provenance={block.provenance} />
        ))}
      </>
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
