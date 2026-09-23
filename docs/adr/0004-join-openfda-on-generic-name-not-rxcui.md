# Join openFDA on generic_name, not RxCUI

openFDA Labels carry an `openfda.rxcui` field, so joining RxNorm to openFDA on RxCUI
looks like the obvious and correct thing to do. It does not work. That field holds
*clinical drug* RxCUIs (259255, "atorvastatin 10 MG oral tablet"), not the
*ingredient* RxCUI that identifies a Drug Concept (83367). Querying openFDA by
ingredient RxCUI returns `NOT_FOUND`, and walking ingredient to clinical drug first is
sparse — of four RxCUIs tested for atorvastatin, two had no Label at all.

We therefore join on `openfda.generic_name`, with `brand_name` as a secondary. RxCUI
remains our primary key and the spine of every RxNorm-side relationship, but it is a
filter against openFDA, never the join key.

This is recorded because the next person to read the code will see an unused `rxcui`
field on the Label response and try to "fix" the join.

## Consequences

`openfda.generic_name` is a text field, so the join matches Labels that merely *contain*
the Active Ingredient as well as Labels *for* it. Searching atorvastatin returns Caduet,
an amlodipine-and-atorvastatin Combination Product, and returns it ahead of Lipitor
because it is published more recently. A Representative Label chosen without care would
therefore put amlodipine's warnings on atorvastatin's page under the FDA's name.

Labels are filtered to those naming exactly one substance before any of them is allowed
to speak for a Drug Concept, which follows from ADR-0012: a Label describing two Active
Ingredients describes two Drug Concepts and is the Representative Label of neither.
