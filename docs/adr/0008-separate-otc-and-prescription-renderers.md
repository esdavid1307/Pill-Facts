# OTC and prescription Labels need separate renderers

Prescription and OTC Labels share almost no Safety Section vocabulary. A Prescription
Label has `adverse_reactions`, `warnings_and_cautions` and `contraindications`. An OTC
Label has none of those — it has `warnings`, `do_not_use`, `when_using`, `stop_use` and
`ask_doctor`. All 3,501 acetaminophen Labels are OTC, and not one has an adverse
reactions section.

A single renderer built against the prescription vocabulary therefore returns a blank
page for Tylenol, Advil and Benadryl — which are among the most-searched drugs there
are, and exactly the case where a blank page reads as "no known warnings".

We branch on `product_type` and maintain two renderers. This was not in the original V1
scope and is real additional work; shipping prescription-only with an explicit "this is
an over-the-counter product" message would be acceptable, and shipping one renderer
would not.
