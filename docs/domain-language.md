# Domain language

The words Pill-Facts uses, and the words it does not.

Each term is defined once here. The `_Avoid_` line under a term lists the synonyms that
must not stand in for it — not in code, not in comments, not in test names, and above all
not in anything a reader sees. Where a term is missing, that is a signal: either the
concept is being invented and should not be, or it is real and belongs here.

The decision records in [`docs/adr/`](adr) use these as defined terms rather than
restating them.

## Identity

**Drug Concept**:
The active-ingredient-level concept that Pill-Facts treats as one medication. Every
search resolves to exactly one, whether the user typed a brand or an ingredient name.
_Avoid_: medication, drug, medicine, product

**Brand**:
A proprietary name a Drug Concept is sold under, such as Lipitor or Advil. Many Brands
map to one Drug Concept.
_Avoid_: trade name, brand drug, brand-name drug

**Active Ingredient**:
The substance in a product responsible for its therapeutic effect. A Drug Concept has
exactly one.
_Avoid_: ingredient, substance, molecule, compound

**Combination Product**:
A product containing more than one Active Ingredient. Never an Alternative to any of
its constituents, and never a Drug Concept, so a search that matches one drops it rather
than resolving to either constituent. A dropped Combination Product is still named to the
reader, together with the Active Ingredients the search leaves them no Candidate for.
_Avoid_: combo drug, multi-ingredient drug

**Candidate**:
One Drug Concept a search might have meant, carrying the Brand that matched where the
query matched one. A search returns them best match first. A single one means Resolution
found the answer rather than a shortlist only where no Combination Product was dropped;
where one was, that lone Candidate is a separate Drug Concept the reader has to be told
about rather than sent to.
_Avoid_: result, hit, match, suggestion

**Resolution**:
Turning a user's free text into a single Drug Concept, tolerating misspellings and
accepting either a Brand or an Active Ingredient name.
_Avoid_: lookup, matching, search

## Source material

**Label**:
One FDA-approved labelling document published by one manufacturer for one product. A
single Drug Concept has hundreds of them.
_Avoid_: SPL, monograph, package insert, leaflet

**Regulatory Class**:
Whether a Label is prescription or over-the-counter. A property of the Label, not of the
Drug Concept — ibuprofen has Labels in both classes.
_Avoid_: drug type, schedule, product type

**Representative Label**:
The Label chosen to speak for a Drug Concept within one Regulatory Class. A Drug Concept
has one per class it appears in, so it may have two.
_Avoid_: canonical label, primary label, default label

**Safety Section**:
A named division of a Label carrying risk information. Which Safety Sections exist
depends on whether the Label is a Prescription Label or an OTC Label. "Side effect" is
permitted in landing copy, where the phrase a reader would themselves search for is what
earns their attention; it is never the name of this concept, and never appears on a page
that renders one.
_Avoid_: side effects, warnings

**Prescription Label**:
A Label for a drug requiring a prescription. Its Safety Sections include adverse
reactions, warnings and cautions, contraindications, and drug interactions.
_Avoid_: Rx label, professional label

**OTC Label**:
A Label for a drug sold over the counter. It carries an entirely different Safety
Section vocabulary — warnings, do not use, when using, stop use, ask a doctor — and
essentially never an adverse reactions section.
_Avoid_: consumer label, non-prescription label

**Drug Facts panel**:
The standardised panel the FDA requires on an over-the-counter product's packaging, and
the form an OTC Label's Safety Sections are published in. Its headings open the sentences
their contents finish — "Do not use" is followed by what not to use it with — so a
heading and its section are read as one thing and never separately.
_Avoid_: drug facts box, label panel, warnings box

**Boxed Warning**:
The FDA's most serious warning, carried by only some Labels. Its absence means the FDA
did not require one, never that a Drug Concept is safe.
_Avoid_: black box warning, black box

## Claims and provenance

**Alternative**:
Another product sharing a Drug Concept's Active Ingredient, strength, and dosage form.
A statement about composition only, never a claim that one may be substituted for
another.
_Avoid_: generic, generic alternative, substitute, equivalent, interchangeable

**Composition**:
What a product is made of, as RxNorm names it: every Active Ingredient with its strength,
then the dosage form. The whole of what an Alternative claims, and the reason two
strengths are never one line.
_Avoid_: formulation, presentation, product name

**Provenance**:
The source, publisher, and date carried alongside every rendered claim, so a reader can
always tell who said it and when.
_Avoid_: attribution, citation, metadata

**Effective Date**:
The date an FDA Label version took effect. A fact about the FDA.
_Avoid_: label date, published date, last updated

**Fetched Date**:
The date Pill-Facts last retrieved a Label. A fact about Pill-Facts.
_Avoid_: cached at, last updated, refreshed

**Unlabelled**:
A Drug Concept that resolves in RxNorm but for which the FDA publishes no Label. A fact
about the drug.
_Avoid_: not found, no results, missing

**Unreachable**:
A state in which FDA data cannot currently be retrieved. A fact about an outage, and
never worded the same way as Unlabelled.
_Avoid_: error, failed, unavailable
