package net.pillfacts.backend;

import java.util.List;

import net.pillfacts.backend.support.ApiTest;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * An over-the-counter Drug Concept's page, through recorded RxNorm and openFDA fixtures.
 *
 * <p>An OTC Label shares no Safety Section with a Prescription Label, so what this
 * asserts is a different vocabulary rather than the same one over different drugs
 * (ADR-0008). The three drugs are the ones #5 names, chosen for what they disagree
 * about: acetaminophen (161) has an OTC brand Label and no "When using this product"
 * section, ibuprofen (5640) carries all five and is sold in both Regulatory Classes,
 * and diphenhydramine (3498) has OTC brand Labels that are every one a Combination
 * Product, so the generic fallback runs.
 */
class OtcDrugConceptApiTest extends ApiTest {

	private static final String FEVERALL = "3561bbc3-53b0-4857-8b71-39e165ed95ce";

	@Test
	void returns_the_otc_safety_sections_in_render_order_each_carrying_its_own_provenance() {
		api().get().uri("/api/drug-concepts/161")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.rxcui").isEqualTo("161")
				.jsonPath("$.name").isEqualTo("acetaminophen")
				.jsonPath("$.sections[*].heading").isEqualTo(List.of(
						"Warnings",
						"Do not use",
						"Ask a doctor before use if",
						"Stop use and ask a doctor if"))
				.jsonPath("$.sections[0].provenance.labelId").isEqualTo(FEVERALL)
				.jsonPath("$.sections[0].provenance.label").isEqualTo("Feverall Jr. Strength")
				.jsonPath("$.sections[0].provenance.manufacturer")
						.isEqualTo("Sun Pharmaceutical Industries, Inc.")
				.jsonPath("$.sections[0].provenance.effectiveDate").isEqualTo("2026-09-03")
				.jsonPath("$.sections[3].provenance.labelId").isEqualTo(FEVERALL);
	}

	/**
	 * ADR-0008: none of the prescription vocabulary may appear on an OTC page. An OTC
	 * Label has no adverse reactions section at all, and a renderer reaching for one
	 * would render a page that is empty where it matters most.
	 */
	@Test
	void never_renders_the_prescription_vocabulary_on_an_otc_page() {
		api().get().uri("/api/drug-concepts/161")
				.exchange()
				.expectStatus().isOk()
				.expectBody(String.class)
				.value(body -> assertThat(body)
						.doesNotContainIgnoringCase("Adverse Reactions")
						.doesNotContainIgnoringCase("Contraindications")
						.doesNotContainIgnoringCase("Warnings and Precautions"));
	}

	/**
	 * The whole of the Drug Facts panel's warnings, for a Label that carries all five.
	 * Acetaminophen's Representative Label has no "When using this product" section, so
	 * a drug that does is what says the vocabulary is complete rather than truncated.
	 */
	@Test
	void renders_every_section_an_otc_label_carries() {
		api().get().uri("/api/drug-concepts/5640")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.name").isEqualTo("ibuprofen")
				.jsonPath("$.sections[*].heading").isEqualTo(List.of(
						"Warnings",
						"Do not use",
						"Ask a doctor before use if",
						"When using this product",
						"Stop use and ask a doctor if"))
				.jsonPath("$.sections[0].provenance.label").isEqualTo("Advil Menstrual Pain");
	}

	/**
	 * ADR-0007's absent-section rule, on this side of ADR-0008 too. Feverall carries no
	 * "When using this product" section, and the page says nothing whatsoever about it:
	 * no heading, no "None", nothing a reader could take for a statement that there is
	 * nothing to watch for while taking it.
	 */
	@Test
	void says_nothing_at_all_about_a_section_an_otc_label_does_not_carry() {
		api().get().uri("/api/drug-concepts/161")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				// Four sections, not five with one of them standing empty.
				.jsonPath("$.sections.length()").isEqualTo(4)
				.jsonPath("$.sections[*].heading").value(headings ->
						assertThat((List<String>) headings).doesNotContain("When using this product"))
				.jsonPath("$.sections[*].text").value(texts ->
						assertThat((List<String>) texts).noneMatch(String::isBlank));
	}

	/**
	 * ADR-0012 governs the OTC side as much as the prescription one, and bites harder:
	 * every one of diphenhydramine's OTC brand Labels is a sleep aid or a cold remedy
	 * combined with something else, so the brand preference finds nothing it may use and
	 * the most recently updated generic speaks instead. Advil PM's warnings are as much
	 * ibuprofen's as diphenhydramine's and are neither one's to publish here.
	 */
	@Test
	void falls_back_to_a_generic_label_where_every_brand_label_is_a_combination_product() {
		api().get().uri("/api/drug-concepts/3498")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.name").isEqualTo("diphenhydramine")
				.jsonPath("$.sections[0].provenance.label").isEqualTo("Nighttime Sleep Aid Berry Flavor")
				.jsonPath("$.sections[0].provenance.effectiveDate").isEqualTo("2026-09-09")
				.jsonPath("$.sections[*].provenance.label").value(labels ->
						assertThat((List<String>) labels).containsOnly("Nighttime Sleep Aid Berry Flavor"));
	}

	/**
	 * ADR-0010 shows the classes OTC first, and until #6 renders both at once the first
	 * is the only one shown. Diphenhydramine is sold in both and its prescription Labels
	 * are recorded here for exactly this test: they are an injection's, they carry
	 * contraindications and adverse reactions, and they would make a perfectly good page.
	 * The OTC Label is chosen over them because a visitor is more often holding the
	 * drugstore box.
	 *
	 * <p>Recording them is what makes this an assertion rather than an accident. With
	 * only the OTC fixtures present, reversing the preference would fail the suite as an
	 * unrecorded search answering 500, which says nothing about which class should win.
	 */
	@Test
	void prefers_the_otc_label_for_a_drug_concept_sold_in_both_classes() {
		api().get().uri("/api/drug-concepts/3498")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.sections[0].provenance.label").isEqualTo("Nighttime Sleep Aid Berry Flavor")
				.jsonPath("$.sections[*].heading").isEqualTo(List.of(
						"Warnings",
						"Do not use",
						"Ask a doctor before use if",
						"When using this product",
						"Stop use and ask a doctor if"))
				// The prescription Label's own Representative, had that class been asked first.
				.jsonPath("$.sections[*].provenance.label").value(labels ->
						assertThat((List<String>) labels).doesNotContain("DIPHENHYDRAMINE HYDROCHLORIDE"));
	}

	/**
	 * ADR-0006: the FDA's own words, less the heading the Drug Facts panel prints above
	 * them and openFDA repeats inside them. What is left reads as the panel reads, under
	 * the heading it is read under — "Do not use" then "in children under 6 years".
	 */
	@Test
	void renders_the_panels_words_under_the_panels_headings() {
		api().get().uri("/api/drug-concepts/161")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.sections[1].heading").isEqualTo("Do not use")
				.jsonPath("$.sections[1].text").value(text -> assertThat((String) text)
						.startsWith("in children under 6 years")
						.contains("with any other drug containing acetaminophen"))
				.jsonPath("$.sections[2].text").value(text -> assertThat((String) text)
						.startsWith("you have liver disease"));
	}

	/**
	 * ADR-0007: dosing is an instruction to a patient and never leaves the backend, in
	 * any form, behind any expander. An OTC Label calls it "Directions" and prints it on
	 * the same panel as the warnings; the phrases asserted on are lines from each
	 * Representative Label's own directions.
	 */
	@Test
	void never_returns_dosing_instructions() {
		api().get().uri("/api/drug-concepts/161")
				.exchange()
				.expectStatus().isOk()
				.expectBody(String.class)
				.value(body -> assertThat(body)
						.doesNotContainIgnoringCase("insert suppository well up into the rectum"));

		api().get().uri("/api/drug-concepts/5640")
				.exchange()
				.expectStatus().isOk()
				.expectBody(String.class)
				.value(body -> assertThat(body)
						.doesNotContainIgnoringCase("the smallest effective dose should be used"));
	}
}
