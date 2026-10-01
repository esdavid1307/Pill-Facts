#!/usr/bin/env python3
"""Tests for the live-upstream canary, using local HTTP stand-ins."""

import json
import os
import pathlib
import subprocess
import sys
import threading
import unittest
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


SCRIPT = pathlib.Path(__file__).with_name("check-upstream-contracts.py")


def rxnorm_related_response(*concepts):
    return {
        "relatedGroup": {
            "conceptGroup": [{"conceptProperties": list(concepts)}],
        },
    }


class Upstreams(BaseHTTPRequestHandler):
    separator = " / "
    combination_ingredients = (
        {"rxcui": "17767", "name": "amlodipine", "tty": "IN"},
        {"rxcui": "83367", "name": "atorvastatin", "tty": "IN"},
    )
    prescription = {
        "set_id": "prescription-label",
        "effective_time": "20260930",
        "boxed_warning": ["warning"],
        "contraindications": ["contraindications"],
        "warnings_and_cautions": ["warnings"],
        "adverse_reactions": ["reactions"],
        "drug_interactions": ["interactions"],
        "dosage_forms_and_strengths": ["10 mg tablet"],
        "openfda": {
            "brand_name": ["Motrin"],
            "generic_name": ["ibuprofen"],
            "manufacturer_name": ["Example"],
            "application_number": ["NDA017463"],
            "substance_name": ["IBUPROFEN"],
        },
    }
    otc = {
        "set_id": "otc-label",
        "effective_time": "20260930",
        "warnings": ["warnings"],
        "do_not_use": ["do not use"],
        "ask_doctor": ["ask a doctor"],
        "when_using": ["when using"],
        "stop_use": ["stop use"],
        "openfda": {
            "brand_name": ["Benadryl"],
            "generic_name": ["diphenhydramine"],
            "manufacturer_name": ["Example"],
            "application_number": ["M012345"],
            "substance_name": ["DIPHENHYDRAMINE"],
        },
    }

    def do_GET(self):
        request = urllib.parse.urlsplit(self.path)
        query = urllib.parse.parse_qs(request.query)
        if request.path == "/REST/approximateTerm.json":
            body = {"approximateGroup": {"candidate": [{"rxcui": "11289"}]}}
        elif request.path == "/REST/rxcui/11289/properties.json":
            body = {"properties": {"rxcui": "11289", "name": "warfarin", "tty": "IN"}}
        elif request.path == "/REST/rxcui/83367/related.json":
            body = rxnorm_related_response(
                {
                    "rxcui": "617320",
                    "name": "atorvastatin 40 MG Oral Tablet [Lipitor]",
                    "tty": "SBD",
                },
                {
                    "rxcui": "750199",
                    "name": f"amlodipine 10 MG{self.separator}atorvastatin 10 MG "
                    "Oral Tablet [Caduet]",
                    "tty": "SBD",
                },
            )
        elif request.path == "/REST/rxcui/617320/related.json":
            body = rxnorm_related_response(
                {"rxcui": "83367", "name": "atorvastatin", "tty": "IN"}
            )
        elif request.path == "/REST/rxcui/750199/related.json":
            body = rxnorm_related_response(*self.combination_ingredients)
        elif request.path == "/drug/label.json":
            search = query.get("search", [""])[0]
            label = self.otc if "HUMAN OTC DRUG" in search else self.prescription
            body = {"results": [label]}
        else:
            self.send_error(404)
            return

        encoded = json.dumps(body).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, *_args):
        pass


class ContractCheckTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Upstreams)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def run_check(self):
        base_url = f"http://127.0.0.1:{self.server.server_port}"
        return subprocess.run(
            [sys.executable, SCRIPT],
            capture_output=True,
            check=False,
            env={
                **os.environ,
                "PILLFACTS_RXNORM_BASE_URL": base_url,
                "PILLFACTS_OPENFDA_BASE_URL": base_url,
            },
            text=True,
        )

    def test_valid_upstream_contracts_pass(self):
        result = self.run_check()

        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn("All upstream contracts are intact", result.stdout)

    def test_changed_openfda_field_names_the_upstream_and_json_path(self):
        metadata = Upstreams.prescription["openfda"]
        original = metadata["manufacturer_name"]
        metadata["manufacturer_name"] = "Example"
        try:
            result = self.run_check()
        finally:
            metadata["manufacturer_name"] = original

        self.assertEqual(1, result.returncode)
        self.assertIn(
            "::error title=Upstream contract changed::openFDA: "
            "results[0].openfda.manufacturer_name expected array",
            result.stderr,
        )

    def test_changed_rxnorm_separator_names_the_product_name_field(self):
        Upstreams.separator = "/"
        try:
            result = self.run_check()
        finally:
            Upstreams.separator = " / "

        self.assertEqual(1, result.returncode)
        self.assertIn("RxNorm", result.stderr)
        self.assertIn(
            "relatedGroup.conceptGroup[].conceptProperties[].name", result.stderr
        )
        self.assertIn("750199", result.stderr)

    def test_every_active_ingredient_requires_its_own_separator(self):
        Upstreams.combination_ingredients = (*Upstreams.combination_ingredients, {
            "rxcui": "1191",
            "name": "aspirin",
            "tty": "IN",
        })
        try:
            result = self.run_check()
        finally:
            Upstreams.combination_ingredients = Upstreams.combination_ingredients[:2]

        self.assertEqual(1, result.returncode)
        self.assertIn("3 Active Ingredients", result.stderr)
        self.assertIn("have 2 occurrences of ' / '", result.stderr)


if __name__ == "__main__":
    unittest.main()
