# One Representative Label per Regulatory Class, and show every class

A Drug Concept has hundreds of Labels, so one must be chosen to speak for it. Within a
Regulatory Class the rule is: prefer the brand/NDA Label, falling back to the most
recently updated generic. Brand Labels are the fullest and best maintained, and the rule
is explainable on the page — "showing the FDA label for Lipitor, effective 2026-03-14".

We do not merge sections across Labels. Stitching together text from several
manufacturers produces a document no regulator ever approved while still carrying FDA
Provenance.

The harder case is that Regulatory Class is a property of the Label, not the Drug
Concept. Ibuprofen has 274 prescription Labels and 907 OTC ones; choosing a single
Representative Label for it would mean picking arbitrarily between 800mg prescription
labelling and an Advil box, and the same search would non-deterministically return
either. So a Drug Concept has one Representative Label per class it appears in, and the
page renders all of them — each under its own heading, with OTC first when both exist,
since a visitor is more often holding the drugstore box than a prescription.

## Consequences

A single Drug Concept page may run both renderers from ADR-0008, so neither may assume
it owns the page. Rejected: splitting ibuprofen into two Drug Concepts, which would
solve the selection problem by breaking the identity model in ADR-0002.
