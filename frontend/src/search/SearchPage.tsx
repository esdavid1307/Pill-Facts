import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { searchDrugConcepts, type Candidate } from '../api/search'
import { drugConceptPath } from '../drugconcept/drugConceptPath'

type Idle = { state: 'idle' }
type Searching = { state: 'searching' }
type Choices = { state: 'choices'; candidates: Candidate[] }
type Failed = { state: 'failed' }
type Search = Idle | Searching | Choices | Failed

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<Search>({ state: 'idle' })
  const navigate = useNavigate()

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSearch({ state: 'searching' })
    try {
      const { candidates } = await searchDrugConcepts(query)
      // One candidate means Resolution found one Drug Concept, so there is no choice to
      // present. Several means there is, and guessing between them would be sending
      // someone to the wrong medication.
      if (candidates.length === 1) {
        navigate(drugConceptPath(candidates[0]), { state: { candidate: candidates[0] } })
        return
      }
      setSearch({ state: 'choices', candidates })
    } catch {
      setSearch({ state: 'failed' })
    }
  }

  return (
    <>
      <form onSubmit={submit} role="search">
        <label htmlFor="q">Search a medication by brand or ingredient name</label>
        <input
          id="q"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Lipitor, ibuprofen&hellip;"
          autoFocus
        />
        <button type="submit">Search</button>
      </form>

      {search.state === 'searching' && <p>Searching&hellip;</p>}

      {search.state === 'failed' && (
        <p role="alert">We couldn&rsquo;t reach the backend. Please try again.</p>
      )}

      {search.state === 'choices' && search.candidates.length === 0 && (
        <p>Nothing matched &ldquo;{query}&rdquo;. Try another spelling.</p>
      )}

      {search.state === 'choices' && search.candidates.length > 0 && (
        <section aria-label="Search results">
          <h2>Did you mean&hellip;</h2>
          <ul className="candidates">
            {search.candidates.map((candidate) => (
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
