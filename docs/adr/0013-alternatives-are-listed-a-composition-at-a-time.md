# Alternatives are listed a composition at a time, because a Drug Concept has no strength

An Alternative is defined by matching an Active Ingredient, a strength and a dosage form
(ADR-0005). A Drug Concept has only the first of those: it is ingredient-level by
ADR-0002, and `/api/drug-concepts/83367` is atorvastatin rather than any particular
tablet. There is nothing to match a strength against.

So the page does not match. It lists every composition RxNorm relates to the Active
Ingredient — one entry per strength and dosage form, carrying the Brands sold in exactly
that one. "atorvastatin 10 MG Oral Tablet, sold as Lipitor" and "atorvastatin 20 MG Oral
Tablet, sold as Lipitor" are two entries, never one entry naming Lipitor and two
strengths.

The alternative was to make strength part of a Drug Concept's identity, so that a page
could match one. That is a different product: a reader would have to know their strength
before they could read the warnings, and the warnings are the same either way.

## Consequences

An Alternative is an entry in a list rather than a comparison between two products, and
the grouping is what enforces ADR-0005 in the shape rather than in the wording. No entry
spans two strengths, so nothing in the payload can be rendered as "Lipitor, in whatever
strength".

A reader holding a 10 mg tablet sees the 20 mg and 80 mg tablets in the same list, and
the page does not tell them which is theirs. It is a list of what the ingredient is made
in, and every line says its own strength.

Which products are Combination Products is read from RxNorm's normalised name, where the
components of a multi-ingredient product are separated by " / " and a strength writes its
own slash without spaces. That is a naming contract rather than a field, and it is the
only thing standing between Caduet and atorvastatin's Alternatives. A name that broke it
would put a Combination Product in the wrong list, which is why #12's nightly contract
check is the place that has to notice.
