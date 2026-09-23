package net.pillfacts.backend.drugconcept;

/**
 * The Safety Sections of a Prescription Label, in the order they are to be read.
 *
 * <p>Declaration order is render order, and the Boxed Warning comes first because it is
 * the FDA's most serious warning and a reader must not have to scroll to it. The rest
 * keep the FDA's own ordering.
 *
 * <p>An OTC Label carries an entirely different vocabulary and none of these; it gets
 * its own renderer, per ADR-0008.
 */
enum PrescriptionSection {

	BOXED_WARNING("boxed_warning", "Boxed Warning"),
	CONTRAINDICATIONS("contraindications", "Contraindications"),
	WARNINGS_AND_PRECAUTIONS("warnings_and_cautions", "Warnings and Precautions"),
	ADVERSE_REACTIONS("adverse_reactions", "Adverse Reactions"),
	DRUG_INTERACTIONS("drug_interactions", "Drug Interactions");

	private final String field;

	private final String heading;

	PrescriptionSection(String field, String heading) {
		this.field = field;
		this.heading = heading;
	}

	/** The name openFDA publishes this section under. */
	String field() {
		return this.field;
	}

	/**
	 * The FDA's own printed heading for the section, which is what a reader comparing
	 * the page against the real Label will be looking for.
	 */
	String heading() {
		return this.heading;
	}
}
