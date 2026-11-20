package net.pillfacts.backend.drugconcept;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import net.pillfacts.backend.openfda.Label;
import org.springframework.stereotype.Component;

/**
 * An OTC Label, turned into the Safety Sections a page renders.
 *
 * <p>ADR-0008 keeps this apart from the prescription renderer because the two share
 * almost no section vocabulary, and ADR-0010 lets a single page run both, so this
 * renders a Label and never assumes it owns the page.
 *
 * <p>The loop below began as the prescription renderer's loop, and the two are kept apart
 * deliberately. They are not one mechanism used twice, and what they render has already
 * diverged: only a Prescription Label states strengths, and only this one has a warnings
 * section that can restate the sections nested inside it. Most OTC Labels publish the
 * whole Drug Facts panel in {@code warnings} and split its subsections out as well, so a
 * section whose text the warnings section already contains verbatim is not rendered a
 * second time under its own heading (ADR-0018).
 *
 * <p>There is no counterpart here to the strengths a Prescription Label carries: an OTC
 * Label has no {@code dosage_forms_and_strengths} section at all, stating its strength
 * inside the active ingredient line of the Drug Facts panel instead. That line is not the
 * same fact — it is one product's strength per unit of its dosage form, not the range a
 * Drug Concept is made in — so it renders verbatim under the panel's own heading, as
 * {@code OtcSection.ACTIVE_INGREDIENT}, and never as strengths (#18).
 */
@Component
class OtcRenderer {

	private static final Set<OtcSection> NESTED_IN_WARNINGS =
			EnumSet.range(OtcSection.DO_NOT_USE, OtcSection.STOP_USE);

	/**
	 * The sections this Label carries, in render order, each attributed to it, less any
	 * that its warnings section already contains.
	 */
	List<SafetySection> render(Label label) {
		Provenance provenance = Provenance.from(label);

		String warnings = label.section(OtcSection.WARNINGS.field()).orElse("");

		List<SafetySection> sections = new ArrayList<>();
		for (OtcSection section : OtcSection.values()) {
			label.section(section.field())
					.filter(text -> !NESTED_IN_WARNINGS.contains(section) || !warnings.contains(text.strip()))
					.ifPresent(text -> sections.add(new SafetySection(
							section.heading(), LabelText.render(text, section.heading()), provenance)));
		}
		return List.copyOf(sections);
	}
}
