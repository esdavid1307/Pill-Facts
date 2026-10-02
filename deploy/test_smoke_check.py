#!/usr/bin/env python3
"""Tests for the deploy's smoke check, run against a local server standing in for the site.

The stand-in answers each path with the next of the responses a test lists for it,
repeating the last, and records every request it was sent.
"""

import http.server
import json
import os
import pathlib
import subprocess
import sys
import threading
import unittest


SCRIPT = pathlib.Path(__file__).with_name("smoke-check.py")
SEARCH = "/api/search"
DEEP_LINK = "/drug-concepts/5640"


def backend_json():
    return (200, "application/json", json.dumps({"candidates": [], "droppedCombinationProducts": []}))


def index_html():
    return (200, "text/html; charset=utf-8", "<!doctype html><div id=root></div>")


def status(code):
    return (code, "text/plain", "")


class Site:
    def __init__(self, answers):
        self.answers = answers
        self.requests = []
        site = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                site.requests.append(self.path)
                path = self.path.split("?")[0]
                listed = site.answers.get(path, [status(404)])
                served = sum(1 for p in site.requests if p.split("?")[0] == path) - 1
                code, content_type, body = listed[min(served, len(listed) - 1)]
                encoded = body.encode()
                self.send_response(code)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(encoded)))
                self.end_headers()
                self.wfile.write(encoded)

            def log_message(self, *_):
                pass

        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}"

    def close(self):
        self.server.shutdown()
        self.server.server_close()


class SmokeCheck(unittest.TestCase):
    def check(self, answers, url_suffix=""):
        site = Site(answers)
        self.addCleanup(site.close)
        env = {**os.environ, "PILLFACTS_POLL_SECONDS": "0", "PILLFACTS_POLL_LIMIT": "3"}
        result = subprocess.run(
            [sys.executable, str(SCRIPT), site.url + url_suffix],
            capture_output=True, text=True, env=env, timeout=30, check=False,
        )
        return result, site.requests

    def test_passes_when_the_backend_answers_search_and_the_app_answers_a_deep_link(self):
        result, requests = self.check({SEARCH: [backend_json()], DEEP_LINK: [index_html()]})

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(any(p.startswith(SEARCH + "?q=") for p in requests), requests)
        self.assertIn(DEEP_LINK, requests)

    def test_a_site_url_with_a_trailing_slash_is_the_same_site(self):
        result, requests = self.check({SEARCH: [backend_json()], DEEP_LINK: [index_html()]}, "/")

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(DEEP_LINK, requests)

    def test_fails_when_search_is_answered_by_the_app_instead_of_the_backend(self):
        # A deploy without functions/ serves index.html for /api/search, with a 200.
        result, _ = self.check({SEARCH: [index_html()], DEEP_LINK: [index_html()]})

        self.assertEqual(result.returncode, 1)
        self.assertIn("::error::", result.stdout)
        self.assertIn("index.html", result.stdout)

    def test_fails_when_the_function_cannot_reach_the_backend(self):
        result, _ = self.check({SEARCH: [status(502)], DEEP_LINK: [index_html()]})

        self.assertEqual(result.returncode, 1)
        self.assertIn("::error::", result.stdout)
        self.assertIn("PILLFACTS_ORIGIN", result.stdout)

    def test_fails_naming_the_status_when_the_backend_answers_with_an_error(self):
        result, _ = self.check({SEARCH: [status(500)], DEEP_LINK: [index_html()]})

        self.assertEqual(result.returncode, 1)
        self.assertIn("500", result.stdout)

    def test_waits_for_a_deploy_still_reaching_the_public_url(self):
        result, requests = self.check(
            {SEARCH: [index_html(), status(502), backend_json()], DEEP_LINK: [index_html()]}
        )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(sum(p.startswith(SEARCH) for p in requests), 3)

    def test_gives_up_after_the_poll_limit(self):
        result, requests = self.check({SEARCH: [status(502)], DEEP_LINK: [index_html()]})

        self.assertEqual(result.returncode, 1)
        self.assertEqual(sum(p.startswith(SEARCH) for p in requests), 3)

    def test_fails_when_a_deep_link_is_not_the_app(self):
        result, _ = self.check({SEARCH: [backend_json()], DEEP_LINK: [status(404)]})

        self.assertEqual(result.returncode, 1)
        self.assertIn("::error::", result.stdout)
        self.assertIn(DEEP_LINK, result.stdout)

    def test_fails_when_the_site_cannot_be_reached_at_all(self):
        site = Site({})
        url = site.url
        site.close()
        env = {**os.environ, "PILLFACTS_POLL_SECONDS": "0", "PILLFACTS_POLL_LIMIT": "2"}
        result = subprocess.run(
            [sys.executable, str(SCRIPT), url],
            capture_output=True, text=True, env=env, timeout=30, check=False,
        )

        self.assertEqual(result.returncode, 1)
        self.assertIn("::error::", result.stdout)


if __name__ == "__main__":
    unittest.main()
