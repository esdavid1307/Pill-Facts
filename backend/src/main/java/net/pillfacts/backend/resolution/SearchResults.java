package net.pillfacts.backend.resolution;

import java.util.List;

/**
 * What {@code GET /api/search} returns: the Drug Concepts a query might have meant, best
 * match first.
 *
 * <p>One candidate means one Drug Concept is clearly right and the frontend may navigate
 * straight to it. The list length is the signal; there is no separate confidence flag to
 * disagree with it.
 */
public record SearchResults(List<Candidate> candidates) {}
