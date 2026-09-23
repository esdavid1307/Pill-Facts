package net.pillfacts.backend.rxnorm;

/**
 * One RxNorm concept: its RxCUI, its name, and its term type.
 *
 * <p>The term type is what tells an Active Ingredient ({@code IN}) from a Brand
 * ({@code BN}) from a packaged product, and is the only reason Resolution asks for a
 * matched concept's properties at all.
 */
public record RxNormConcept(String rxcui, String name, String tty) {

	private static final String BRAND_NAME = "BN";

	private static final String INGREDIENT = "IN";

	public boolean isBrand() {
		return BRAND_NAME.equals(this.tty);
	}

	/**
	 * Whether this concept is ingredient-level, which is to say whether it is a Drug
	 * Concept's identity rather than something that resolves to one (ADR-0002).
	 */
	public boolean isActiveIngredient() {
		return INGREDIENT.equals(this.tty);
	}
}
