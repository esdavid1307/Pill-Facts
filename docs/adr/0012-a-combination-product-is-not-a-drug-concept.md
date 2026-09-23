# A Combination Product is not a Drug Concept, so Resolution drops it

A Drug Concept has exactly one Active Ingredient. RxNorm has no such rule: searching
"tylenol pm" matches the Brand Tylenol PM and several of its packagings, every one of
which relates to acetaminophen and diphenhydramine together. Resolution walks each match
to its Active Ingredients and keeps only the matches that have exactly one, so a
Combination Product contributes no candidate and the search lands on acetaminophen, via
the plain Tylenol match.

The alternative was to let a Combination Product resolve to each of its constituents in
turn. We rejected it: it would offer a reader looking up a two-ingredient product a page
about one of its ingredients, which is the error ADR-0005 exists to prevent, arriving by
a different route.

## Consequences

Someone searching a Combination Product by name gets a page about whichever
single-ingredient Drug Concept also matched, and is told nothing about the ingredient
that was dropped. For "tylenol pm" that is diphenhydramine, whose warnings are the
reason the product differs from plain Tylenol. The page is not wrong about what it
shows, but it is quietly incomplete about what the reader asked for, and it is worse
because a lone candidate navigates straight through without presenting a choice.

This is the known gap in Resolution. Making it legible — naming the Combination Product
that matched and saying Pill-Facts has no page for it — belongs with #7, which is where
Combination Products otherwise get their own separately labelled treatment.
