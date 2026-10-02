#!/usr/bin/env python3
"""Tests for the free-tier expiry warning, run against a fixed today."""

import os
import pathlib
import subprocess
import sys
import unittest


SCRIPT = pathlib.Path(__file__).with_name("check-free-tier-expiry.py")
TODAY = "2026-10-01"


def check(expires):
    env = {k: v for k, v in os.environ.items() if k != "PILLFACTS_FREE_TIER_EXPIRES"}
    env["PILLFACTS_TODAY"] = TODAY
    if expires is not None:
        env["PILLFACTS_FREE_TIER_EXPIRES"] = expires
    return subprocess.run(
        [sys.executable, SCRIPT], env=env, capture_output=True, text=True, check=False
    )


class CheckFreeTierExpiry(unittest.TestCase):
    def assertFailsNamingTheMigration(self, result):
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("Koyeb", result.stdout)
        self.assertIn("PILLFACTS_ORIGIN", result.stdout)

    def test_passes_more_than_30_days_out(self):
        result = check("2026-11-01")

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("31 days", result.stdout)

    def test_fails_30_days_out(self):
        result = check("2026-10-31")

        self.assertFailsNamingTheMigration(result)
        self.assertIn("30 days", result.stdout)

    def test_fails_once_expired(self):
        result = check("2026-09-30")

        self.assertFailsNamingTheMigration(result)
        self.assertIn("expired", result.stdout)

    def test_fails_when_no_date_is_recorded(self):
        result = check(None)

        self.assertFailsNamingTheMigration(result)
        self.assertIn("PILLFACTS_FREE_TIER_EXPIRES", result.stdout)

    def test_fails_when_the_recorded_date_is_blank(self):
        result = check("")

        self.assertFailsNamingTheMigration(result)
        self.assertIn("PILLFACTS_FREE_TIER_EXPIRES", result.stdout)

    def test_fails_when_the_recorded_date_is_not_an_iso_date(self):
        result = check("31/10/2026")

        self.assertFailsNamingTheMigration(result)
        self.assertIn("31/10/2026", result.stdout)

    def test_fails_on_a_compact_iso_date(self):
        # Python reads this as a date, but the variable is documented as YYYY-MM-DD and a
        # date read one way here and another way by a person isn't recorded at all.
        result = check("20261231")

        self.assertFailsNamingTheMigration(result)


if __name__ == "__main__":
    unittest.main()
