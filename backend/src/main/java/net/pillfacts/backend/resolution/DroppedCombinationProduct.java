package net.pillfacts.backend.resolution;

import java.util.List;

/**
 * A Combination Product that matched a query but cannot become a Candidate.
 *
 * <p>A Combination Product is not a Drug Concept (ADR-0012), so Resolution drops the
 * match rather than turning either constituent into a page. Keeping this description in
 * the result lets the frontend say what was dropped instead of silently presenting a
 * different, single-ingredient match.
 *
 * <p>There is one of these per combination of Active Ingredients rather than one per
 * matched product, because the combination is what Pill-Facts has no page for; see
 * {@code Resolution} for why, and for what that costs.
 *
 * @param name RxNorm's name for the best-ranked product with this combination
 * @param activeIngredients every Active Ingredient RxNorm relates to it
 * @param activeIngredientsWithNoCandidate those of them the search offers no Drug Concept
 * for, which is what the reader would otherwise never hear about
 */
public record DroppedCombinationProduct(
		String name,
		List<String> activeIngredients,
		List<String> activeIngredientsWithNoCandidate) {}
