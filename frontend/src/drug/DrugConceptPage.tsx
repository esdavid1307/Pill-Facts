import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import type { Candidate } from '../api/search'

/**
 * A Drug Concept's page.
 *
 * <p>Resolution (#3) gets the reader here and titles the page. The Safety Sections,
 * Alternatives and Provenance that fill it arrive with #4 and #5, which fetch the
 * payload by RxCUI; until then a search hands the resolved Candidate over in router
 * state, and a cold link has only the RxCUI to go on.
 */
export function DrugConceptPage() {
  const { rxcui } = useParams()
  const [params] = useSearchParams()
  const resolved = (useLocation().state as { candidate?: Candidate } | null)?.candidate

  const name = resolved?.name
  // The Brand survives a shared link because it is in the URL, not only in router state.
  const brand = params.get('brand') ?? resolved?.brand

  return (
    <article>
      {name ? (
        <h1>{brand ? `${brand} (${name})` : name}</h1>
      ) : (
        <h1>{brand ?? `RxCUI ${rxcui}`}</h1>
      )}
      <p className="pending">
        The FDA&rsquo;s safety information for this medication isn&rsquo;t here yet.
      </p>
      <Link to="/">Search for another medication</Link>
    </article>
  )
}
