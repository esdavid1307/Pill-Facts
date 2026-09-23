package net.pillfacts.backend.drugconcept;

import java.util.ArrayList;
import java.util.List;

import net.pillfacts.backend.openfda.Label;
import org.springframework.stereotype.Component;

/**
 * A Prescription Label, turned into the Safety Sections a page renders.
 *
 * <p>ADR-0008 keeps this apart from the OTC renderer because the two share almost no
 * section vocabulary, and ADR-0010 lets a single page run both, so this renders a Label
 * and never assumes it owns the page.
 */
@Component
class PrescriptionRenderer {

	/** The sections this Label carries, in render order, each attributed to it. */
	List<SafetySection> render(Label label) {
		Provenance provenance = Provenance.from(label);

		List<SafetySection> sections = new ArrayList<>();
		for (PrescriptionSection section : PrescriptionSection.values()) {
			label.section(section.field()).ifPresent(text ->
					sections.add(new SafetySection(
							section.heading(), LabelText.render(text, section.heading()), provenance)));
		}
		return List.copyOf(sections);
	}

	/** The strengths the drug is made in, or null where this Label does not say. */
	String strengths(Label label) {
		return (label.strengths() == null) ? null : LabelText.render(label.strengths(), "Dosage Forms and Strengths");
	}
}
