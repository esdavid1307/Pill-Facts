import type { Alternative, CombinationProduct, DrugConcept } from '../api/drugConcept'

/**
 * What else an Active Ingredient is sold in: the other products made of it, and the
 * products that combine it with something else.
 *
 * Both lists say only what a product is made of. ADR-0005 puts that constraint in the
 * wording rather than in a footer, so nothing here reads as "you can take this instead":
 * no sentence compares two products, and every strength and dosage form stays attached
 * to the product it belongs to.
 *
 * The two are never one list. RxNorm lists Caduet, which is amlodipine as well as
 * atorvastatin, among atorvastatin's brands, and a reader who took that for another
 * atorvastatin tablet would be taking a blood-pressure drug they were not looking for.
 *
 * A Drug Concept RxNorm relates to no other product shows no heading for one: an empty
 * section reads as "there are none", which is not what an absent list means.
 */
export function RelatedProducts({ drugConcept }: { drugConcept: DrugConcept }) {
  const { name, alternatives, combinationProducts } = drugConcept
  return (
    <>
      {alternatives && alternatives.length > 0 && (
        <Alternatives name={name} alternatives={alternatives} />
      )}
      {combinationProducts && combinationProducts.length > 0 && (
        <CombinationProducts name={name} combinationProducts={combinationProducts} />
      )}
    </>
  )
}

/**
 * Products of this Active Ingredient alone, one line per strength and dosage form.
 *
 * The heading and the lines are the whole of what is said. ADR-0005 wants the constraint
 * in the wording rather than in a disclaimer below it, and a sentence explaining that
 * these are not substitutes would be a disclaimer, and would raise the idea it exists to
 * put down.
 */
function Alternatives({
  name,
  alternatives,
}: {
  name: string
  alternatives: Alternative[]
}) {
  return (
    <section className="products" aria-labelledby="alternatives">
      <h2 id="alternatives">Other products made with {name}</h2>
      <p className="composition-note">What each of these is made of, as RxNorm records it.</p>
      <ProductList products={alternatives} />
    </section>
  )
}

/**
 * The products a reader must not mistake for the list above, said so in the heading. The
 * note under it is a fact about whose labelling the page has been showing, which is the
 * one thing the heading cannot carry.
 */
function CombinationProducts({
  name,
  combinationProducts,
}: {
  name: string
  combinationProducts: CombinationProduct[]
}) {
  return (
    <section className="products" aria-labelledby="combination-products">
      <h2 id="combination-products">Products that combine {name} with another medication</h2>
      <p className="composition-note">
        Each of these contains {name} and at least one other active ingredient. The labelling
        above is for {name}, and describes none of them.
      </p>
      <ProductList products={combinationProducts} />
    </section>
  )
}

/**
 * One product per line, each naming its own strength and dosage form. A Brand sold in
 * four strengths is four lines, because a line covering all four would be a claim that
 * the strength does not matter.
 */
function ProductList({ products }: { products: { composition: string; brands: string[] }[] }) {
  return (
    <ul className="compositions">
      {products.map((product) => (
        <li key={product.composition}>
          {product.composition}
          {product.brands.length > 0 && <span> &mdash; sold as {product.brands.join(', ')}</span>}
        </li>
      ))}
    </ul>
  )
}
