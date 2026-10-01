#!/usr/bin/env python3
"""Fail when the live RxNorm or openFDA contracts Pill-Facts reads have changed.

This is a canary, not a normal test: the nightly GitHub Actions workflow is the only
automated caller that points it at the live services. Tests override the base URLs with
local stand-ins, so pull-request checks never depend on third-party availability.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request


RXNORM = os.environ.get("PILLFACTS_RXNORM_BASE_URL", "https://rxnav.nlm.nih.gov").rstrip("/")
OPENFDA = os.environ.get("PILLFACTS_OPENFDA_BASE_URL", "https://api.fda.gov").rstrip("/")
SAMPLE_SIZE = 24
BETWEEN_INGREDIENTS = " / "

PRESCRIPTION_FIELDS = (
    "boxed_warning",
    "contraindications",
    "warnings_and_cautions",
    "adverse_reactions",
    "drug_interactions",
    "dosage_forms_and_strengths",
)
OTC_FIELDS = ("warnings", "do_not_use", "ask_doctor", "when_using", "stop_use")
OPENFDA_FIELDS = (
    "brand_name",
    "generic_name",
    "manufacturer_name",
    "application_number",
    "substance_name",
)


class ContractError(AssertionError):
    """One named part of an upstream response no longer has its expected shape."""


def fail(upstream, field, expectation):
    raise ContractError(f"{upstream}: {field} {expectation}")


def get_json(upstream, base_url, path, **params):
    url = f"{base_url}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    try:
        with urllib.request.urlopen(url, timeout=120) as response:
            return json.load(response)
    except (urllib.error.URLError, TimeoutError) as error:
        fail(upstream, "HTTP request", f"failed for {url}: {error}")
    except json.JSONDecodeError as error:
        fail(upstream, "response body", f"expected JSON for {url}: {error}")


def require_object(upstream, value, field):
    if not isinstance(value, dict):
        fail(upstream, field, f"expected object, got {type(value).__name__}")
    return value


def require_array(upstream, value, field, nonempty=True):
    if not isinstance(value, list):
        fail(upstream, field, f"expected array, got {type(value).__name__}")
    if nonempty and not value:
        fail(upstream, field, "expected a non-empty array")
    return value


def require_string(upstream, value, field):
    if not isinstance(value, str) or not value.strip():
        fail(upstream, field, f"expected a non-empty string, got {value!r}")
    return value


def require_string_array(upstream, value, field):
    values = require_array(upstream, value, field)
    for index, item in enumerate(values):
        require_string(upstream, item, f"{field}[{index}]")
    return values


def related_concepts(body, endpoint):
    upstream = "RxNorm"
    body = require_object(upstream, body, endpoint)
    related_group = require_object(
        upstream, body.get("relatedGroup"), f"{endpoint}.relatedGroup"
    )
    groups = require_array(
        upstream,
        related_group.get("conceptGroup"),
        f"{endpoint}.relatedGroup.conceptGroup",
    )
    concepts = []
    for group_index, group in enumerate(groups):
        group_path = f"{endpoint}.relatedGroup.conceptGroup[{group_index}]"
        group = require_object(upstream, group, group_path)
        properties = group.get("conceptProperties")
        if properties is None:
            continue
        concepts.extend(require_array(
            upstream, properties, f"{group_path}.conceptProperties", nonempty=False
        ))
    if not concepts:
        fail(
            upstream,
            f"{endpoint}.relatedGroup.conceptGroup[].conceptProperties",
            "expected products",
        )
    return concepts


def require_rxnorm_concept(concept, field):
    concept = require_object("RxNorm", concept, field)
    return {
        key: require_string("RxNorm", concept.get(key), f"{field}.{key}")
        for key in ("rxcui", "name", "tty")
    }


def evenly_spaced(values, count):
    if len(values) <= count:
        return values
    return [
        values[round(index * (len(values) - 1) / (count - 1))]
        for index in range(count)
    ]


def check_rxnorm():
    approximate = get_json(
        "RxNorm", RXNORM, "/REST/approximateTerm.json", term="warfarin", maxEntries=20
    )
    approximate = require_object("RxNorm", approximate, "response")
    group = require_object(
        "RxNorm", approximate.get("approximateGroup"), "approximateGroup"
    )
    candidates = require_array("RxNorm", group.get("candidate"), "approximateGroup.candidate")
    first_candidate = require_object(
        "RxNorm", candidates[0], "approximateGroup.candidate[0]"
    )
    require_string(
        "RxNorm",
        first_candidate.get("rxcui"),
        "approximateGroup.candidate[0].rxcui",
    )

    properties = get_json("RxNorm", RXNORM, "/REST/rxcui/11289/properties.json")
    properties = require_object("RxNorm", properties, "response")
    concept = require_rxnorm_concept(properties.get("properties"), "properties")
    if concept != {"rxcui": "11289", "name": "warfarin", "tty": "IN"}:
        fail(
            "RxNorm",
            "properties",
            f"expected the known warfarin Active Ingredient, got {concept}",
        )

    products_body = get_json(
        "RxNorm",
        RXNORM,
        "/REST/rxcui/83367/related.json",
        tty=("SCD", "SBD"),
    )
    products = [
        require_rxnorm_concept(product, "relatedGroup.conceptGroup[].conceptProperties[]")
        for product in related_concepts(products_body, "response")
    ]

    saw_single = False
    saw_combination = False
    for product in evenly_spaced(products, SAMPLE_SIZE):
        ingredients_body = get_json(
            "RxNorm",
            RXNORM,
            f"/REST/rxcui/{product['rxcui']}/related.json",
            tty="IN",
        )
        ingredients = {
            require_rxnorm_concept(
                ingredient, "relatedGroup.conceptGroup[].conceptProperties[]"
            )["rxcui"]
            for ingredient in related_concepts(ingredients_body, "response")
        }
        combination = len(ingredients) > 1
        expected_separators = len(ingredients) - 1
        actual_separators = product["name"].count(BETWEEN_INGREDIENTS)
        if actual_separators != expected_separators:
            fail(
                "RxNorm",
                "relatedGroup.conceptGroup[].conceptProperties[].name",
                f"expected {product['rxcui']} ({len(ingredients)} Active Ingredients) to "
                f"have {expected_separators} occurrences of {BETWEEN_INGREDIENTS!r}; "
                f"got {actual_separators} in {product['name']!r}",
            )
        saw_combination |= combination
        saw_single |= not combination

    if not saw_single or not saw_combination:
        fail(
            "RxNorm",
            "relatedGroup.conceptGroup[].conceptProperties[].name",
            "expected the 24-product sample to contain both a single-ingredient product "
            "and a Combination Product",
        )


def check_openfda_search(active_ingredient, product_type, required_sections):
    expression = (
        f'openfda.generic_name:"{active_ingredient}" '
        f'AND openfda.product_type:"{product_type}" '
        "AND openfda.application_number:NDA*"
    )
    body = get_json(
        "openFDA",
        OPENFDA,
        "/drug/label.json",
        search=expression,
        sort="effective_time:desc",
        limit=10,
    )
    body = require_object("openFDA", body, "response")
    results = require_array("openFDA", body.get("results"), "results")

    present = set()
    for index, result in enumerate(results):
        path = f"results[{index}]"
        result = require_object("openFDA", result, path)
        require_string("openFDA", result.get("set_id"), f"{path}.set_id")
        effective_time = require_string(
            "openFDA", result.get("effective_time"), f"{path}.effective_time"
        )
        if not re.fullmatch(r"\d{8}", effective_time):
            fail(
                "openFDA",
                f"{path}.effective_time",
                "expected an eight-digit YYYYMMDD string",
            )
        metadata = require_object("openFDA", result.get("openfda"), f"{path}.openfda")

        for field in OPENFDA_FIELDS:
            if field in metadata:
                require_string_array("openFDA", metadata[field], f"{path}.openfda.{field}")
                present.add(f"openfda.{field}")
        for field in required_sections:
            if field in result:
                require_string_array("openFDA", result[field], f"{path}.{field}")
                present.add(field)

    expected = {f"openfda.{field}" for field in OPENFDA_FIELDS} | set(required_sections)
    for field in sorted(expected - present):
        fail(
            "openFDA",
            f"results[].{field}",
            "expected the field in at least one sampled Label",
        )


def check_openfda():
    check_openfda_search("ibuprofen", "HUMAN PRESCRIPTION DRUG", PRESCRIPTION_FIELDS)
    check_openfda_search("diphenhydramine", "HUMAN OTC DRUG", OTC_FIELDS)


def main():
    try:
        check_rxnorm()
        print("RxNorm contract is intact, including the Combination Product separator.")
        check_openfda()
        print("openFDA contract is intact for prescription and OTC Labels.")
    except ContractError as error:
        print(f"::error title=Upstream contract changed::{error}", file=sys.stderr)
        return 1

    print("All upstream contracts are intact.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
