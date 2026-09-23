import { Link, useLocation, useParams } from 'react-router'
import type { Candidate } from '../api/search'

/**
 * A Drug Concept's page.
 *
 * Resolution (#3) gets the reader here and titles the page. The Safety Sections,
 * Alternatives and Provenance that fill it arrive with #4 and #5, which fetch the
 * payload by RxCUI; until then a search hands the resolved Candidate over in router
 * state, and a cold link has only the RxCUI to go on.
 */
export function DrugConceptPage() {
  const { rxcui } = useParams()
  const resolved = (useLocation().state as { candidate?: Candidate } | null)?.candidate

  return (
    <article>
      {/* Arriving via a Brand leads with that Brand, per ADR-0002. */}
      <h1>
        {resolved
          ? resolved.brand
            ? `${resolved.brand} (${resolved.name})`
            : resolved.name
          : `RxCUI ${rxcui}`}
      </h1>
      <p className="pending">
        The FDA&rsquo;s safety information for this medication isn&rsquo;t here yet.
      </p>
      <Link to="/">Search for another medication</Link>
    </article>
  )
}
