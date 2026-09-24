#!/usr/bin/env python3
"""Record openFDA drug label responses into the fixtures the backend tests stub with.

No test may touch the live API, so every response the tests need is recorded here
first. Re-run this when openFDA's shape changes and the nightly contract check (#12)
says so; review the diff before committing it.

    python3 backend/tools/record-openfda-fixtures.py

Only the queries the backend actually issues are recorded. Representative Label
selection asks for brand/NDA Labels first and falls back to every Label in the class
(ADR-0010), so this records the fallback only where the brand search does not answer
it — which is what keeps a 250KB-per-Label fixture set to the Labels a test reads.

"Does not answer it" is the backend's own test rather than "returned nothing": a brand
search can come back full of Combination Products, every one of which is dropped before
selection (ADR-0012), and the fallback then runs. Recording on emptiness alone would
leave those drugs a missing fixture and a 500 from the stub.
"""

import json
import pathlib
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://api.fda.gov/drug/label.json"
FIXTURES = pathlib.Path(__file__).resolve().parent.parent / "src/test/resources/fixtures/openfda"

# Kept in step with RegulatoryClass.java, which builds the same expressions, and with
# OpenFdaStub.java, which matches on them.
BY_CLASS = 'openfda.generic_name:"%s" AND openfda.product_type:"%s"'
BRAND_ONLY = " AND openfda.application_number:NDA*"
PAGE_SIZE = 10

# Each Regulatory Class, as openFDA names it and as the fixture directories do.
CLASSES = [
    ("otc", "HUMAN OTC DRUG"),
    ("prescription", "HUMAN PRESCRIPTION DRUG"),
]

# The Active Ingredients the tests look up. Every one is recorded in both classes,
# because the backend asks both and returns one block per class that has a Representative
# Label (ADR-0010). A class with no Labels answers 404, which is itself a recorded answer.
INGREDIENTS = [
    "atorvastatin",     # prescription only; brand/NDA Label chosen over the Combination Products above it
    "warfarin",         # prescription only, no NDA Label at all, so the generic fallback runs; has a Boxed Warning
    "acetaminophen",    # both classes, with an OTC brand Label naming one Active Ingredient
    "ibuprofen",        # the same, and the drug ADR-0010 uses as its two-class example
    "diphenhydramine",  # OTC brand Labels that are every one a Combination Product, so the fallback runs
    "sulbactam",        # sold only in combination, so no Label speaks for it and no page lists an Alternative
]


def get(search):
    url = f"{BASE}?" + urllib.parse.urlencode(
        {"search": search, "sort": "effective_time:desc", "limit": PAGE_SIZE}
    )
    try:
        with urllib.request.urlopen(url, timeout=120) as response:
            return response.read().decode()
    except urllib.error.HTTPError as error:
        # openFDA answers 404 with a NOT_FOUND body when a search matches nothing. That
        # is an answer, not a failure, and the tests need it recorded.
        if error.code == 404:
            return error.read().decode()
        raise


def speaks_for_a_drug_concept(result):
    """Whether the backend would let this Label speak for a Drug Concept.

    Mirrors OpenFda.search: a Label naming more than one substance describes more than
    one Drug Concept and speaks for none of them (ADR-0012), and an undated one cannot
    be ranked against the rest.
    """
    openfda = result.get("openfda", {})
    return len(openfda.get("substance_name", [])) == 1 and bool(result.get("effective_time"))


def write(relative, body):
    target = FIXTURES / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(json.loads(body), indent=2) + "\n")
    print(f"  {target.relative_to(FIXTURES.parents[4])} ({len(body) // 1024}KB)")


def main():
    for ingredient in INGREDIENTS:
        for directory, product_type in CLASSES:
            search = BY_CLASS % (ingredient, product_type)
            brand = get(search + BRAND_ONLY)
            write(f"{directory}-brand/{ingredient}.json", brand)
            results = json.loads(brand).get("results", [])
            if not any(map(speaks_for_a_drug_concept, results)):
                fallback = get(search)
                write(f"{directory}/{ingredient}.json", fallback)
                results = json.loads(fallback).get("results", [])


if __name__ == "__main__":
    main()
