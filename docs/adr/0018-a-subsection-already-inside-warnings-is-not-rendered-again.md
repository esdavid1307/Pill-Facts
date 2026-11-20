# A subsection already inside Warnings is not rendered again

On the Drug Facts panel, "Do not use", "Ask a doctor before use if", "When using this
product" and "Stop use and ask a doctor if" are subsections of Warnings. openFDA
publishes them two ways, depending on the manufacturer. Some Labels put only the top
matter in `warnings` and split the subsections out. Others put the whole panel in
`warnings` and split the subsections out as well, so a page rendering every field shows
the same sentences twice: once inside Warnings and once under their own heading.
Diphenhydramine's Representative Label, "Nighttime Sleep Aid Berry Flavor", does this
with all four, and on live openFDA aspirin's does it with "When using this product".

Where the `warnings` text contains a subsection's text verbatim, we render Warnings and
drop that subsection for that Label. Each subsection is checked on its own, so a Label
that nests some subsections and splits out others still shows the split-out ones.

This is the first case where two FDA renderings of the same facts overlap and one has to
be chosen. We kept the outer one because dropping the subsection means nothing gets cut
from inside a section. Every word on the page is still the FDA's, in the FDA's order, and ADR-0006
stands as written. The alternatives were worse:

- Leaving it verbatim twice. Repetition on a safety page is not cosmetic. A reader
  scanning for what applies to them meets the same warning twice under different
  headings, and the page looks automated in a way that undercuts its Provenance.
- Cutting the overlap out of `warnings` instead. That edits text out of the middle of a
  section, which is well past the cleanup ADR-0006 allows.
- Nesting the subsections under Warnings. This is closer to the printed box, but the
  text still repeats and the Safety Section shape would have to grow a hierarchy.

## Consequences

Nesting is the common case, not the exception. When this was decided, 44 of the 46
recorded OTC Labels nested at least one subsection, and the Representative Labels of
acetaminophen, ibuprofen and diphenhydramine all nest every subsection they carry. So
most OTC pages show a single Warnings section and none of the four headings, even though
the FDA publishes them. The headings are still there for the reader, because they are in
the Warnings text itself.

The match is exact. A Label whose two copies differ by so much as a space keeps both,
so this errs towards showing a repetition rather than hiding a warning.
