# The Drug Concept, not the product or the Label, is the unit of identity

A search for "Lipitor" matches four Health Canada products, hundreds of FDA Labels, and
a dozen RxNorm concepts at different levels of specificity. Something has to be the
thing a user lands on. We chose the active-ingredient-level RxNorm concept: one page per
Drug Concept, keyed by ingredient RxCUI, with Brands, strengths and manufacturers listed
beneath it.

The alternatives were a page per product (accurate to the source, unusable as a UI) and
a page per Label (hundreds of near-identical pages per drug). Choosing the ingredient
level is what makes brand and generic searches converge, what makes Alternatives
expressible, and what would later let a Canadian and a US concept be matched. It is also
close to irreversible: it sets the URL scheme, the cache key, and the shape of every
query in the system.

## Consequences

A user who searched a Brand must still see that Brand. The page is ingredient-canonical
but brand-aware: arriving via "Advil" leads with "Advil (ibuprofen)". Without this the
model is correct and the product feels broken.
