package net.pillfacts.backend.resolution;

import java.util.List;

/**
 * What {@code GET /api/search} returns: the Drug Concepts a query might have meant, best
 * match first, and any Combination Products Resolution had to drop.
 *
 * <p>One candidate means one Drug Concept is clearly right only where no Combination
 * Product was dropped. In that case the frontend may navigate straight to it. A dropped
 * Combination Product instead keeps the reader on the Resolution page, where it can be
 * named without pretending that a constituent's page covers it (ADR-0012).
 */
public record SearchResults(
		List<Candidate> candidates,
		List<DroppedCombinationProduct> droppedCombinationProducts) {}
