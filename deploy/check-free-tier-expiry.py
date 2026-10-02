#!/usr/bin/env python3
"""Fail when the AWS free tier ends within 30 days, or when nobody recorded when it ends.

ADR-0009 hosts the backend on a free tier with an expiry date. The date lives in the
GitHub repo variable PILLFACTS_FREE_TIER_EXPIRES, and a weekly workflow runs this. A
scheduled workflow that fails emails the repo owner, so the warning arrives without
anyone looking for it. A missing date fails too, because a check that passes on nothing
would never warn.

PILLFACTS_TODAY overrides today's date, for tests.
"""

import datetime
import os
import re
import sys


WARN_DAYS = 30
MIGRATION = (
    "Move the backend to Koyeb, whose free tier is always-on (ADR-0009), then repoint "
    "the Pages environment variable PILLFACTS_ORIGIN at it. That one value is the whole "
    "change on the frontend's side (ADR-0011)."
)


def fail(problem):
    # The ::error:: prefix puts the line on the run's summary page, where the email links.
    print(f"::error::{problem} {MIGRATION}")
    return 1


def main():
    recorded = os.environ.get("PILLFACTS_FREE_TIER_EXPIRES", "").strip()
    if not recorded:
        return fail(
            "No free-tier expiry is recorded. Set the repo variable "
            "PILLFACTS_FREE_TIER_EXPIRES to the date AWS shows under Billing → Free tier "
            "(deploy/setup-billing.sh does this)."
        )
    try:
        # fromisoformat also reads 20270401 and week dates; only YYYY-MM-DD is recorded.
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", recorded):
            raise ValueError(recorded)
        expires = datetime.date.fromisoformat(recorded)
    except ValueError:
        return fail(
            f"PILLFACTS_FREE_TIER_EXPIRES is {recorded!r}, which is not an ISO date "
            "such as 2027-04-01."
        )

    today = datetime.date.fromisoformat(
        os.environ.get("PILLFACTS_TODAY") or datetime.date.today().isoformat()
    )
    days_left = (expires - today).days
    if days_left < 0:
        return fail(f"The AWS free tier expired on {expires}.")
    when = f"The AWS free tier ends on {expires}, in {days_left} days."
    if days_left <= WARN_DAYS:
        return fail(when)
    print(when)
    return 0


if __name__ == "__main__":
    sys.exit(main())
