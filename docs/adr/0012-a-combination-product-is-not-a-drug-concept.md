# A Combination Product is not a Drug Concept, so Resolution drops it

A Drug Concept has exactly one Active Ingredient. RxNorm has no such rule: searching
"tylenol pm" matches the Brand Tylenol PM and several of its packagings, every one of
which relates to acetaminophen and diphenhydramine together. Resolution walks each match
to its Active Ingredients and keeps only the matches that have exactly one, so a
Combination Product contributes no candidate. Of that search only the plain Tylenol match
is left, and it is acetaminophen.

The alternative was to let a Combination Product resolve to each of its constituents in
turn. We rejected it: it would offer a reader looking up a two-ingredient product a page
about one of its ingredients, which is the error ADR-0005 exists to prevent, arriving by
a different route.

## Consequences

Someone searching a Combination Product by name cannot be given a page for it, so the
best Pill-Facts can do is say so. Resolution keeps every dropped Combination Product
alongside the candidates, named and with its Active Ingredients listed, and the
Resolution page says Pill-Facts has no page for it. A lone remaining Candidate therefore
does not navigate straight through where a Combination Product was dropped: the reader
would otherwise land on acetaminophen having asked about Tylenol PM, told nothing about
diphenhydramine, whose warnings are the reason the product differs from plain Tylenol.

A dropped Combination Product is identified by its combination of Active Ingredients
rather than by the product, because the combination is what has no page and one Brand
occupies the approximate results many times over. Two different products sharing a
combination are reported once, under RxNorm's better-ranked name.

The reader is told which Active Ingredients the remaining candidates leave them nothing
for, not merely what the Combination Product contains. For "tylenol pm" that is
diphenhydramine, and naming it is the difference between a legible gap and a silent one.
