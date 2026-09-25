import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { searchDrugConcepts, type Candidate } from '../api/search'
import { drugConceptPath } from '../drugconcept/drugConceptPath'

type Searching = { state: 'searching'; query: string }
type Choices = { state: 'choices'; query: string; candidates: Candidate[] }
type Failed = { state: 'failed'; query: string }
export type Resolution = Searching | Choices | Failed

/**
 * Resolving one query to one Drug Concept.
 *
 * A single Candidate means Resolution found the answer rather than a shortlist, so there
 * is no choice to present and the reader goes straight to the medication. That navigation
 * replaces the results entry in history: Back from a Drug Concept belongs on the landing,
 * not on a page that would immediately resolve and bounce them forward again.
 */
export function useResolution(query: string): Resolution {
  const navigate = useNavigate()
  const [resolution, setResolution] = useState<Resolution>({ state: 'searching', query })

  useEffect(() => {
    let current = true
    searchDrugConcepts(query)
      .then(({ candidates }) => {
        if (!current) {
          return
        }
        if (candidates.length === 1) {
          navigate(drugConceptPath(candidates[0]), {
            replace: true,
            state: { candidate: candidates[0] },
          })
          return
        }
        setResolution({ state: 'choices', query, candidates })
      })
      .catch(() => current && setResolution({ state: 'failed', query }))
    return () => {
      current = false
    }
  }, [query, navigate])

  /*
   * An answer to the previous query is no answer to this one, so it reads as still
   * searching rather than as a shortlist for something the reader did not type. Deriving it
   * here is also what lets the effect avoid setting state on the way in: the stale answer is
   * already not this query's answer, so there is nothing to reset.
   */
  return resolution.query === query ? resolution : { state: 'searching', query }
}
