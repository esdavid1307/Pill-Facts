# OTC and prescription Labels need separate renderers

Prescription and OTC Labels share almost no Safety Section vocabulary. A Prescription
Label has `adverse_reactions`, `warnings_and_cautions` and `contraindications`. An OTC
Label has essentially none of those — it has `warnings`, `do_not_use`, `when_using`,
`stop_use` and `ask_doctor`. Of acetaminophen's 3,069 OTC Labels every one carries
`warnings` and five carry an adverse reactions section; of ibuprofen's 901, one does.

A single renderer built against the prescription vocabulary therefore returns a blank
page for Tylenol, Advil and Benadryl — which are among the most-searched drugs there
are, and exactly the case where a blank page reads as "no known warnings".

We branch on `product_type` and maintain two renderers. This was not in the original V1
scope and is real additional work; shipping prescription-only with an explicit "this is
an over-the-counter product" message would be acceptable, and shipping one renderer
would not.

## Consequences

Regulatory Class is a property of the Label, so a Drug Concept can have Labels in both
and most of the interesting ones do: acetaminophen has 3,069 OTC Labels and 409
prescription ones, ibuprofen 901 and 272, diphenhydramine 1,080 and 35. This decision
is what stops the prescription Labels answering for the OTC ones. ADR-0010 settles which
class a page shows, and #6 makes it show every class a Drug Concept appears in.

An earlier draft of this ADR said "all 3,501 acetaminophen Labels are OTC, and not one
has an adverse reactions section". Neither half held against openFDA in September 2026,
and the counts above replace them. The decision is unaffected — it is strengthened,
because a Drug Concept in both classes is not a blank page under a prescription-only
renderer but a worse thing: a reader holding a drugstore box, shown the labelling of an
intravenous hospital product under the FDA's name.
