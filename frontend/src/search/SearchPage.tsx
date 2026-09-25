import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { drugConceptPath } from '../drugconcept/drugConceptPath'
import { searchPath } from './searchPath'
import { useResolution } from './useResolution'

/**
 * The shortlist a reader sees only when their query was genuinely ambiguous — "hydroxy"
 * matching two different substances, say.
 *
 * It is plain, scrollable, document-flow text at a readable size on purpose. Choosing
 * between two medications is the moment a reader can least afford a composition scaled
 * to fit a window. See ADR-0014.
 */
export function SearchPage() {
  const [params] = useSearchParams()
  const query = params.get('q') ?? ''
  const resolution = useResolution(query)
  const navigate = useNavigate()
  const [refined, setRefined] = useState(query)

  function submit(event: FormEvent) {
    event.preventDefault()
    const next = refined.trim()
    if (next) {
      navigate(searchPath(next))
    }
  }

  return (
    <>
      <form onSubmit={submit} role="search">
        <label htmlFor="q">Search a medication by brand or ingredient name</label>
        <input
          id="q"
          type="search"
          value={refined}
          onChange={(event) => setRefined(event.target.value)}
          placeholder="Lipitor, ibuprofen&hellip;"
        />
        <button type="submit">Search</button>
      </form>

      {resolution.state === 'searching' && <p className="pending">Searching&hellip;</p>}

      {resolution.state === 'failed' && (
        <p role="alert">We couldn&rsquo;t reach the backend. Please try again.</p>
      )}

      {resolution.state === 'choices' && resolution.candidates.length === 0 && (
        <p>Nothing matched &ldquo;{query}&rdquo;. Try another spelling.</p>
      )}

      {resolution.state === 'choices' && resolution.candidates.length > 0 && (
        <section aria-label="Search results">
          <h2>Did you mean&hellip;</h2>
          <ul className="candidates">
            {resolution.candidates.map((candidate) => (
              <li key={candidate.rxcui}>
                <Link to={drugConceptPath(candidate)} state={{ candidate }}>
                  {candidate.brand ? (
                    <>
                      <strong>{candidate.brand}</strong> <span>({candidate.name})</span>
                    </>
                  ) : (
                    <strong>{candidate.name}</strong>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
