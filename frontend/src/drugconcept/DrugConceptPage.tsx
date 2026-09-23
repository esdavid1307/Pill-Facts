import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { fetchDrugConcept, type DrugConcept } from '../api/drugConcept'
import type { Candidate } from '../api/search'
import { SafetySections } from './SafetySections'

/**
 * What came back, and which Drug Concept it came back for. Navigating from one Drug
 * Concept to another keeps this component mounted, and an answer to the previous RxCUI
 * must never render under the new one's heading.
 */
type Loaded = { state: 'loaded'; rxcui: string; drugConcept: DrugConcept }
type Unreachable = { state: 'unreachable'; rxcui: string }
type Fetched = Loaded | Unreachable

/**
 * A Drug Concept's page: what the FDA says about the risks of one medication.
 *
 * The Brand a search matched is not in the URL and not in the payload, so it arrives in
 * router state and titles the page where a search got the reader here. A cold link has
 * the Active Ingredient's name, which the payload always carries.
 */
export function DrugConceptPage() {
  const { rxcui } = useParams()
  const matched = (useLocation().state as { candidate?: Candidate } | null)?.candidate
  const [fetched, setFetched] = useState<Fetched | null>(null)

  useEffect(() => {
    if (!rxcui) {
      return
    }
    let current = true
    fetchDrugConcept(rxcui)
      .then((drugConcept) => current && setFetched({ state: 'loaded', rxcui, drugConcept }))
      .catch(() => current && setFetched({ state: 'unreachable', rxcui }))
    return () => {
      current = false
    }
  }, [rxcui])

  // An answer for another RxCUI is no answer for this one, so it reads as still loading.
  const load = fetched?.rxcui === rxcui ? fetched : null
  const name = load?.state === 'loaded' ? load.drugConcept.name : matched?.name

  return (
    <article>
      {/* Arriving via a Brand leads with that Brand, per ADR-0002. */}
      <h1>{title(matched?.brand, name) ?? `RxCUI ${rxcui}`}</h1>

      {load === null && <p className="pending">Looking up the FDA&rsquo;s labelling&hellip;</p>}

      {/* Unreachable is a fact about an outage, and never worded as Unlabelled is. */}
      {load?.state === 'unreachable' && (
        <p role="alert">
          We couldn&rsquo;t reach the FDA&rsquo;s labelling just now, so there is nothing to show
          yet. Please try again.
        </p>
      )}

      {load?.state === 'loaded' && <Labelling drugConcept={load.drugConcept} />}

      <Link to="/">Search for another medication</Link>
    </article>
  )
}

function Labelling({ drugConcept }: { drugConcept: DrugConcept }) {
  // Unlabelled is a fact about the drug: the FDA publishes nothing, which is not the
  // same as our failing to fetch it, and is never worded as though it were. ADR-0007.
  if (drugConcept.sections.length === 0) {
    return (
      <p className="unlabelled">
        The FDA publishes no prescription labelling for {drugConcept.name}.
      </p>
    )
  }

  // Safety first, literally: nothing is allowed above the Boxed Warning.
  return (
    <>
      <SafetySections sections={drugConcept.sections} />
      {drugConcept.strengths && (
        <section aria-labelledby="strengths">
          <h2 id="strengths">Strengths</h2>
          <p>{drugConcept.strengths}</p>
        </section>
      )}
    </>
  )
}

function title(brand: string | undefined, name: string | undefined): string | undefined {
  if (!name) {
    return undefined
  }
  return brand ? `${brand} (${name})` : name
}
