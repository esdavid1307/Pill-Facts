package net.pillfacts.backend.drugconcept;

/**
 * The sections of an OTC Label a page renders — its active ingredient line, then its
 * Safety Sections — in the order they are to be read.
 *
 * <p>Declaration order is render order, and it is the order the FDA prints these in on
 * the Drug Facts panel — the one a reader holding the box is looking at. There is no
 * Boxed Warning to lead with here: an OTC Label has none, and none of the prescription
 * vocabulary either, which is why this is a separate list rather than an extension of
 * {@code PrescriptionSection} (ADR-0008).
 *
 * <p>The active ingredient line leads, as it leads the panel. It names the strength of
 * this one product, per unit of its dosage form, which is why it stands under the
 * panel's heading rather than as the strengths a Prescription Label lists (#18).
 *
 * <p>{@code warnings} is the one every Drug Facts panel carries — of acetaminophen's
 * 3,069 OTC Labels, all 3,069 have it — which is what keeps an OTC page from coming back
 * empty. The others are each present or absent as that product's panel prints them.
 *
 * <p>The headings are the FDA's own, down to reading as the openings of sentences that
 * the panel's bullets finish: "Do not use" is followed by what not to use it with, and
 * "Ask a doctor before use if" by the condition. That is why openFDA's text for each of
 * these fields begins by restating the heading, and why {@code LabelText} takes the
 * heading and strips that restatement — the same rule that removes "4 CONTRAINDICATIONS"
 * from a Prescription Label, arrived at from the other direction.
 */
enum OtcSection {

	ACTIVE_INGREDIENT("active_ingredient", "Active ingredient"),
	WARNINGS("warnings", "Warnings"),
	DO_NOT_USE("do_not_use", "Do not use"),
	ASK_DOCTOR("ask_doctor", "Ask a doctor before use if"),
	WHEN_USING("when_using", "When using this product"),
	STOP_USE("stop_use", "Stop use and ask a doctor if");

	private final String field;

	private final String heading;

	OtcSection(String field, String heading) {
		this.field = field;
		this.heading = heading;
	}

	/** The name openFDA publishes this section under. */
	String field() {
		return this.field;
	}

	/**
	 * The FDA's own printed heading for the section, which is what a reader comparing
	 * the page against the real box will be looking for.
	 */
	String heading() {
		return this.heading;
	}
}
