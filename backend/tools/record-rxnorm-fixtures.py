#!/usr/bin/env python3
"""Record RxNorm responses into the fixtures the backend tests stub with.

No test may touch the live API, so every response the tests need is recorded here
first. Re-run this when RxNorm's shape changes and the nightly contract check (#12)
says so; review the diff before committing it.

    python3 backend/tools/record-rxnorm-fixtures.py
"""

import json
import pathlib
import urllib.parse
import urllib.request

BASE = "https://rxnav.nlm.nih.gov"
FIXTURES = pathlib.Path(__file__).resolve().parent.parent / "src/test/resources/fixtures/rxnorm"

# The queries the tests search for. Every concept RxNorm returns for one of these is
# recorded too, so the stub can answer the whole walk from match to Active Ingredient.
TERMS = [
    "lipitor",        # a correctly spelled Brand
    "lipitr",         # the same Brand, misspelled
    "atorvastatin",   # that Brand's Active Ingredient
    "advil",          # the Brand ADR-0002 uses as its example
    "ibuprofen",      # and its Active Ingredient
    "hydroxy",        # ambiguous: several Drug Concepts, plus obsolete concepts
    "tylenol pm",     # a Brand that is a Combination Product, alongside one that isn't
    "warfarin",       # the Active Ingredient ADR-0007 uses as its Boxed Warning example
    "zzzqqqnotadrug", # matches nothing
]


def get(path, **params):
    url = f"{BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read().decode()


def write(relative, body):
    target = FIXTURES / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(json.loads(body), indent=2) + "\n")
    print(f"  {target.relative_to(FIXTURES.parent.parent.parent.parent)}")


# RxCUIs the tests ask about directly, which no search term above would reach.
EXTRA_RXCUIS = [
    "999999999",  # no such concept: RxNorm answers 200 with an empty body
    "161",        # acetaminophen, the Active Ingredient ADR-0008 uses as its OTC example
    "3498",       # diphenhydramine, whose OTC brand Labels are all Combination Products
    "10167",      # sulbactam, which RxNorm relates to no single-ingredient product at all
]

# The Active Ingredients the tests open a Drug Concept page for. A page lists the
# products RxNorm relates to its ingredient, so each of these needs that list recorded.
DRUG_CONCEPT_RXCUIS = [
    "83367",  # atorvastatin, whose products include Caduet and the ezetimibe combinations
    "11289",  # warfarin, which RxNorm relates to no Combination Product at all
    "161",    # acetaminophen, related to hundreds, nearly all of them combinations
    "5640",   # ibuprofen
    "3498",   # diphenhydramine
    "10167",  # sulbactam, sold only in combination
]


def main():
    rxcuis = list(EXTRA_RXCUIS)
    for term in TERMS:
        body = get("/REST/approximateTerm.json", term=term, maxEntries=20)
        write(f"approximate-term/{term}.json", body)
        for candidate in json.loads(body)["approximateGroup"].get("candidate") or []:
            if candidate["rxcui"] not in rxcuis:
                rxcuis.append(candidate["rxcui"])

    for rxcui in rxcuis:
        write(f"properties/{rxcui}.json", get(f"/REST/rxcui/{rxcui}/properties.json"))
        if rxcui not in EXTRA_RXCUIS:
            write(f"related-ingredient/{rxcui}.json", get(f"/REST/rxcui/{rxcui}/related.json", tty="IN"))

    # tty is repeated rather than "SCD+SBD": RxNorm rejects the plus sign once a URL
    # encoder has had it, and answers both term types to two parameters just the same.
    for rxcui in DRUG_CONCEPT_RXCUIS:
        write(f"related-product/{rxcui}.json",
              get(f"/REST/rxcui/{rxcui}/related.json", tty=["SCD", "SBD"]))


if __name__ == "__main__":
    main()
