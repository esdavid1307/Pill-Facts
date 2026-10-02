#!/usr/bin/env python3
"""Check the site at SITE_URL is up end to end, through its public URL.

    smoke-check.py https://pill-facts.pages.dev

The deploy workflow runs this after the frontend is deployed. It searches through
/api/search, which only passes if the Pages Function forwarded it to the backend and the
backend answered (ADR-0011), then loads a deep link, which only passes if Pages serves the
app for a path it has no file for. A broken same-origin chain then fails the deploy rather
than a reader's browser.

A deploy takes a moment to reach the public URL, so it tries again until both pass.
PILLFACTS_POLL_SECONDS and PILLFACTS_POLL_LIMIT override that, for tests.
"""

import os
import sys
import time
import urllib.error
import urllib.request


SEARCH = "/api/search?q=ibuprofen"
DEEP_LINK = "/drug-concepts/5640"


def get(url):
    """The status and content type a GET answered, or None and why it couldn't be sent."""
    request = urllib.request.Request(url, headers={"User-Agent": "pill-facts-smoke-check"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, response.headers.get_content_type()
    except urllib.error.HTTPError as error:
        return error.code, error.headers.get_content_type()
    except OSError as error:  # URLError among them
        return None, str(getattr(error, "reason", error))


def search_problem(site):
    status, content_type = get(site + SEARCH)
    if status is None:
        return f"Couldn't reach {site}: {content_type}."
    if status == 200 and content_type == "application/json":
        return None
    if status == 429 and content_type == "application/problem+json":
        # The backend's own refusal, so the chain to it works. A runner's address can
        # share a bucket with whatever else ran from it.
        print(f"{SEARCH} was refused for too many requests, by the backend.")
        return None
    if status == 200 and content_type == "text/html":
        # Pages serves index.html for any path it has no file or route for.
        return (
            f"{SEARCH} was answered by the app's index.html, not the backend. The deploy "
            "has no Function at functions/api/, so nothing forwards /api (ADR-0011)."
        )
    if status == 502:
        return (
            f"{SEARCH} answered 502: the Pages Function couldn't reach the backend. Check "
            "the Pages project's PILLFACTS_ORIGIN, and that the backend is up."
        )
    return f"{SEARCH} answered {status} ({content_type}), not the backend's search results."


def deep_link_problem(site):
    status, content_type = get(site + DEEP_LINK)
    if status is None:
        return f"Couldn't reach {site}: {content_type}."
    if status == 200 and content_type == "text/html":
        return None
    return (
        f"{DEEP_LINK} answered {status} ({content_type}), not the app. Pages serves "
        "index.html for unknown paths only while the build has no 404.html."
    )


def main():
    site = sys.argv[1].rstrip("/")
    poll_seconds = float(os.environ.get("PILLFACTS_POLL_SECONDS", "10"))
    poll_limit = max(1, int(os.environ.get("PILLFACTS_POLL_LIMIT", "18")))

    for attempt in range(poll_limit):
        if attempt:
            time.sleep(poll_seconds)
        problem = search_problem(site) or deep_link_problem(site)
        if problem is None:
            print(f"{site} searches through the backend and serves deep links.")
            return 0
        print(f"Not yet: {problem}")

    # The ::error:: prefix puts the line on the run's summary page.
    print(f"::error::{problem}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
