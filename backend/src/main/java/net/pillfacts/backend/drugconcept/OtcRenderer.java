package net.pillfacts.backend.drugconcept;

import java.util.ArrayList;
import java.util.List;

import net.pillfacts.backend.openfda.Label;
import org.springframework.stereotype.Component;

/**
 * An OTC Label, turned into the Safety Sections a page renders.
 *
 * <p>ADR-0008 keeps this apart from the prescription renderer because the two share
 * almost no section vocabulary, and ADR-0010 lets a single page run both, so this
 * renders a Label and never assumes it owns the page.
 *
 * <p>The loop below is the prescription renderer's loop again, and deliberately so. The
 * two are not one mechanism used twice but two renderers that presently agree, and what
 * they render is already diverging: only a Prescription Label states strengths, and the
 * questions open against this one — whether the Drug Facts active ingredient line is a
 * strength (#18), and what to do where a Label's warnings section restates the sections
 * nested inside it (#19) — have no counterpart on the other side. Folding them together
 * would have to be unfolded to answer either.
 *
 * <p>There is no counterpart here to the strengths a Prescription Label carries: an OTC
 * Label has no {@code dosage_forms_and_strengths} section at all, stating its strength
 * inside the active ingredient line of the Drug Facts panel instead. Whether that line
 * is the same fact is a domain question rather than a rendering one, and #18 asks it.
 */
@Component
class OtcRenderer {

	/** The sections this Label carries, in render order, each attributed to it. */
	List<SafetySection> render(Label label) {
		Provenance provenance = new Provenance(
				label.setId(), label.name(), label.manufacturer(), label.effectiveDate(), label.url());

		List<SafetySection> sections = new ArrayList<>();
		for (OtcSection section : OtcSection.values()) {
			label.section(section.field()).ifPresent(text ->
					sections.add(new SafetySection(
							section.heading(), LabelText.render(text, section.heading()), provenance)));
		}
		return List.copyOf(sections);
	}
}
