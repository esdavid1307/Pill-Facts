# A Representative Label is taken by mouth where one can be

Ibuprofen's page was spoken for by NeoProfen: an intravenous ibuprofen lysine given to
premature infants. Its Label passes every rule before this one. It names one Active
Ingredient, so ADR-0012 keeps it, and RxNorm calls ibuprofen lysine a precise
ingredient (`PIN`) of ibuprofen (36761, related to 5640), so by ADR-0002 it is the same Drug Concept. The
next brand Label down is Caldolor, a hospital infusion. Both are ibuprofen; neither is
what a reader holding a box of Advil or a bottle of 800 mg tablets is holding.

So within a Regulatory Class, a Label whose route includes oral is preferred over one
that does not, and that preference comes before ADR-0010's brand one: an oral brand
Label, then an oral generic, then ADR-0010's rule unchanged over every route. A Drug
Concept with no oral Label in its class — insulin, an infusion-only antibiotic — still
gets a page, from whatever Label ADR-0010 would have chosen.

We rejected deciding by substance name. Rejecting salt forms would throw out
atorvastatin calcium and warfarin sodium, which are right, and an allowlist of
acceptable salts is Pill-Facts re-deciding identity against an unbounded list, which is
what ADR-0002 hands to RxNorm. RxNorm's own answer, asked in #16, is that ibuprofen
lysine is ibuprofen, so identity was never the problem: the route was.

## Consequences

The same rule moves other pages. Acetaminophen's OTC brand Labels that name it alone are
suppositories, so an oral generic now speaks for it, and diphenhydramine's prescription
page moves from an injection to an oral capsule.

Selection reads the same two searches as before, but the generic one now runs whenever
no brand Label is taken by mouth, not only when there is no brand Label at all. Those
searches read one page of Labels, so an oral Label sorting below ten non-oral ones is
not seen, and the fallback to any route picks one of those instead.
