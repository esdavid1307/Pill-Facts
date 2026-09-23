package net.pillfacts.backend.openfda;

/**
 * Whether a Label is prescription or over-the-counter.
 *
 * <p>A property of the Label and not of the Drug Concept: ibuprofen has hundreds of
 * Labels in each, and which class a reader wants depends on which box they are holding
 * (ADR-0010). Declaration order is the order the classes are shown in, over-the-counter
 * first, because a visitor is more often holding the drugstore box than a prescription.
 *
 * <p>The two carry almost no Safety Section vocabulary in common, which is why each has
 * its own renderer rather than one renderer with two branches inside it (ADR-0008).
 */
public enum RegulatoryClass {

	OVER_THE_COUNTER("HUMAN OTC DRUG"),
	PRESCRIPTION("HUMAN PRESCRIPTION DRUG");

	private final String productType;

	RegulatoryClass(String productType) {
		this.productType = productType;
	}

	/** The name openFDA publishes this class under, in {@code openfda.product_type}. */
	String productType() {
		return this.productType;
	}
}
