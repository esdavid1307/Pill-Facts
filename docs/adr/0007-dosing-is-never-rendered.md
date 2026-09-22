# Dosing instructions are never rendered, and an absent Boxed Warning renders nothing

Two rendering rules that look like omissions and are not.

**Strengths yes, dosing no.** The original V1 asked to show "strength and dosage
information", but these are different kinds of fact. `dosage_forms_and_strengths` —
"10mg, 20mg, 40mg, 80mg tablets" — is a property of the pill, and we render it.
`dosage_and_administration` — "recommended starting dosage is 10 or 20 mg once daily" —
is an instruction to a patient, and we never render it in any form, behind any expander.

**Absence is not safety.** `boxed_warning` is a sparse field: warfarin has one,
atorvastatin does not. When it is missing the section is omitted entirely. We never
render "None", a green check, or any affirmative statement about its absence, because
the field means "the FDA did not require a Boxed Warning", not "this drug is safe".

The same discipline governs empty states: Unlabelled and Unreachable are distinct facts
and never share wording. "The FDA publishes no label for this drug" and "we couldn't
reach the FDA" mean entirely different things to someone looking up their medication.
