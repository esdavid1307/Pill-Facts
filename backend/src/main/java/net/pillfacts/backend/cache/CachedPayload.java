package net.pillfacts.backend.cache;

import java.time.LocalDate;

/**
 * One row of the cache.
 *
 * @param payload the response as it was built, as JSON
 * @param fetchedDate the date Pill-Facts retrieved it, which is the Fetched Date a page
 * built from this row shows
 * @param fresh whether that is recent enough to serve without asking the upstream again
 */
record CachedPayload(String payload, LocalDate fetchedDate, boolean fresh) {}
