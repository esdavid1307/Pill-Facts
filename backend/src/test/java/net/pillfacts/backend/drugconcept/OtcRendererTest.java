package net.pillfacts.backend.drugconcept;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import net.pillfacts.backend.openfda.Label;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ADR-0018 on a Label that nests some subsections inside Warnings and splits the rest
 * out. No Representative Label in the recorded fixtures does this, so the API tests
 * cannot reach it; the text is ZzzQuil's, from {@code otc/diphenhydramine.json}.
 */
class OtcRendererTest {

	@Test
	void drops_only_the_subsections_the_warnings_section_already_contains() {
		Label zzzquil = new Label("set-id", "VICKS ZzzQuil", "Procter & Gamble", "M010",
				LocalDate.of(2026, 9, 8), List.of("DIPHENHYDRAMINE HYDROCHLORIDE"), List.of("ORAL"), Map.of(
						"warnings", "Warnings Do not use for children under 12 years of age with any other product"
								+ " containing diphenhydramine, even one used on skin",
						"do_not_use", "Do not use for children under 12 years of age with any other product"
								+ " containing diphenhydramine, even one used on skin",
						"ask_doctor", "Ask a doctor before use if you have a breathing problem such as emphysema"
								+ " or chronic bronchitis",
						"when_using", "When using this product avoid alcoholic beverages"),
				null);

		List<SafetySection> sections = new OtcRenderer().render(zzzquil);

		assertThat(sections).extracting(SafetySection::heading).containsExactly(
				"Warnings",
				"Ask a doctor before use if",
				"When using this product");
		assertThat(sections.get(2).text()).isEqualTo("avoid alcoholic beverages");
	}
}
