#!/usr/bin/env python3
"""Record openFDA drug label responses into the fixtures the backend tests stub with.

No test may touch the live API, so every response the tests need is recorded here
first. Re-run this when openFDA's shape changes and the nightly contract check (#12)
says so; review the diff before committing it.

    python3 backend/tools/record-openfda-fixtures.py

Only the queries the backend actually issues are recorded. Representative Label
selection asks for brand/NDA Labels first and falls back to every Label in the class
(ADR-0010), so this records the fallback only for the drugs that need it — which is
what keeps a 250KB-per-Label fixture set to the Labels a test reads.
"""

import json
import pathlib
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://api.fda.gov/drug/label.json"
FIXTURES = pathlib.Path(__file__).resolve().parent.parent / "src/test/resources/fixtures/openfda"

# Kept in step with OpenFda.java, which builds the same expressions, and with
# OpenFdaStub.java, which matches on them.
PRESCRIPTION = 'openfda.generic_name:"%s" AND openfda.product_type:"HUMAN PRESCRIPTION DRUG"'
BRAND_ONLY = " AND openfda.application_number:NDA*"
PAGE_SIZE = 10

# The Active Ingredients the tests look up.
INGREDIENTS = [
    "atorvastatin",  # brand/NDA Label chosen over the Combination Products above it
    "warfarin",      # no NDA Label at all, so the generic fallback runs; has a Boxed Warning
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


def write(relative, body):
    target = FIXTURES / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(json.loads(body), indent=2) + "\n")
    print(f"  {target.relative_to(FIXTURES.parents[4])} ({len(body) // 1024}KB)")


def main():
    for ingredient in INGREDIENTS:
        brand = get(PRESCRIPTION % ingredient + BRAND_ONLY)
        write(f"prescription-brand/{ingredient}.json", brand)
        if "results" not in json.loads(brand):
            write(f"prescription/{ingredient}.json", get(PRESCRIPTION % ingredient))


if __name__ == "__main__":
    main()
