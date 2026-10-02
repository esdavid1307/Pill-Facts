import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import type { Candidate, DroppedCombinationProduct } from '../api/search'
import { drugConceptPath } from '../drugconcept/drugConceptPath'
import { searchPath } from './searchPath'
import { useResolution } from './useResolution'

/**
 * The Resolution page: a shortlist where a query was genuinely ambiguous — "hydroxy"
 * matching two different substances, say — and the explanation where Resolution had to
 * drop a Combination Product.
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

      {/*
        * Unreachable and No match are different facts, and only one of them is about what
        * was typed. Worded alike, an outage would send the reader off to respell a name
        * that was right all along.
        */}
      {resolution.state === 'unreachable' && (
        <p role="alert">
          Pill-Facts couldn&rsquo;t reach the drug databases it searches just now, and has no
          earlier answer saved for this search. Please come back later.
        </p>
      )}

      {resolution.state === 'not-loaded' && (
        <p role="alert">Pill-Facts couldn&rsquo;t load this search. Please try again.</p>
      )}

      {resolution.state === 'choices' &&
        resolution.droppedCombinationProducts.map((product) => (
          // Keyed by the combination, which is what identifies the record; two products
          // sharing one are already reported as a single entry.
          <CombinationProduct
            key={product.activeIngredients.join(' / ')}
            product={product}
          />
        ))}

      {resolution.state === 'choices' &&
        resolution.candidates.length === 0 &&
        resolution.droppedCombinationProducts.length === 0 && (
          <p>Nothing matched &ldquo;{query}&rdquo;. Try another spelling.</p>
        )}

      {resolution.state === 'choices' && resolution.candidates.length > 0 && (
        <Shortlist
          candidates={resolution.candidates}
          dropped={resolution.droppedCombinationProducts}
        />
      )}
    </>
  )
}

/**
 * What a reader asked about and cannot be given a page for. It names every Active
 * Ingredient in the product, then separately names the ones the shortlist below leaves
 * them nothing for: for "tylenol pm" that is diphenhydramine, whose warnings are the
 * entire reason the product differs from plain Tylenol.
 */
function CombinationProduct({ product }: { product: DroppedCombinationProduct }) {
  /*
   * Where RxNorm published no name, the backend falls back to naming the product by its
   * Active Ingredients. Listing them again under that name would say the same thing
   * twice — "acetaminophen / diphenhydramine contains the Active Ingredients
   * acetaminophen and diphenhydramine" — so the sentence is dropped instead.
   */
  const namedByItsIngredients = product.name === product.activeIngredients.join(' / ')
  return (
    <section className="combination-product" aria-label={`Combination Product: ${product.name}`}>
      <h2>{product.name} is a Combination Product</h2>
      {!namedByItsIngredients && (
        <p>
          {product.name} contains the Active Ingredients{' '}
          {formatList(product.activeIngredients)}.
        </p>
      )}
      <p>Pill-Facts has no page for this Combination Product.</p>
      {product.activeIngredientsWithNoCandidate.length > 0 && (
        <p>
          This search offers nothing for{' '}
          {formatList(product.activeIngredientsWithNoCandidate)}.
        </p>
      )}
    </section>
  )
}

/**
 * The Drug Concepts the query might have meant.
 *
 * "Did you mean…" is the right question where the query was merely ambiguous and the
 * wrong one where a Combination Product was dropped: the reader did mean Tylenol PM, and
 * what they need is to be told these are something else rather than asked to pick one.
 */
function Shortlist({
  candidates,
  dropped,
}: {
  candidates: Candidate[]
  dropped: DroppedCombinationProduct[]
}) {
  const lone = candidates.length === 1
  return (
    <section aria-label="Search results">
      <h2>
        {dropped.length === 0 ? 'Did you mean…' : lone ? 'Another Drug Concept' : 'Other Drug Concepts'}
      </h2>
      {dropped.length > 0 && (
        <p>
          {lone
            ? 'The Drug Concept below also matched. Its page does not cover '
            : 'The Drug Concepts below also matched. Their pages do not cover '}
          {formatList(dropped.map((product) => product.name))}.
        </p>
      )}
      <ul className="candidates">
        {candidates.map((candidate) => (
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
  )
}

/** "acetaminophen and diphenhydramine", for prose rather than a list. */
function formatList(items: string[]): string {
  if (items.length < 2) {
    return items[0] ?? ''
  }
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}
