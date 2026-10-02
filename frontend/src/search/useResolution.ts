import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  searchDrugConcepts,
  type Candidate,
  type DroppedCombinationProduct,
} from '../api/search'
import { TooManyRequests } from '../api/tooManyRequests'
import { Unreachable } from '../api/unreachable'
import { drugConceptPath } from '../drugconcept/drugConceptPath'

type Searching = { state: 'searching'; query: string }
type Choices = {
  state: 'choices'
  query: string
  candidates: Candidate[]
  droppedCombinationProducts: DroppedCombinationProduct[]
}
/**
 * The data behind the search could not be retrieved and the backend had no earlier answer
 * cached. A fact about an outage, and never about what was typed.
 */
type Outage = { state: 'unreachable'; query: string }
/**
 * Anything else that went wrong: the backend out of reach, or a fault of its own. Neither
 * says whether an answer is cached, so neither is worded as Unreachable.
 */
type NotLoaded = { state: 'not-loaded'; query: string }
/** Refused for asking too often: a fact about the reader's requests, and about nothing else. */
type Refused = { state: 'refused'; query: string; refusal: TooManyRequests }
export type Resolution = Searching | Choices | Outage | NotLoaded | Refused

/**
 * Resolving one query to one Drug Concept.
 *
 * A single Candidate means Resolution found the answer rather than a shortlist only when
 * no Combination Product was dropped. Then there is no choice to present and the reader
 * goes straight to the Drug Concept. A dropped Combination Product keeps the Resolution
 * page visible even beside one Candidate, so the reader can see what that page omits.
 *
 * Straight-through navigation replaces the results entry in history: Back from a Drug
 * Concept belongs on the landing, not on a page that would immediately resolve and bounce
 * the reader forward again.
 */
export function useResolution(query: string): Resolution {
  const navigate = useNavigate()
  const [resolution, setResolution] = useState<Resolution>({ state: 'searching', query })

  useEffect(() => {
    let current = true
    searchDrugConcepts(query)
      .then(({ candidates, droppedCombinationProducts }) => {
        if (!current) {
          return
        }
        if (candidates.length === 1 && droppedCombinationProducts.length === 0) {
          navigate(drugConceptPath(candidates[0]), {
            replace: true,
            state: { candidate: candidates[0] },
          })
          return
        }
        setResolution({ state: 'choices', query, candidates, droppedCombinationProducts })
      })
      .catch((error: unknown) => {
        if (!current) {
          return
        }
        setResolution(
          error instanceof TooManyRequests
            ? { state: 'refused', query, refusal: error }
            : { state: error instanceof Unreachable ? 'unreachable' : 'not-loaded', query },
        )
      })
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
