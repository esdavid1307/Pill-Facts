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

	public boolean isBrand() {
		return BRAND_NAME.equals(this.tty);
	}
}
