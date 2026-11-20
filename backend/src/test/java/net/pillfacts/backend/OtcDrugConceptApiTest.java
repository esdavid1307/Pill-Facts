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
 * about: acetaminophen (161) has OTC brand Labels that are all suppositories, so an oral
 * generic speaks for it (ADR-0017), and that one has no "When using this product"
 * section; ibuprofen (5640) carries all five and is sold in both Regulatory Classes;
 * and diphenhydramine (3498) has OTC brand Labels that are every one a Combination
 * Product, so the generic fallback runs.
 */
class OtcDrugConceptApiTest extends ApiTest {

	private static final String DISCOUNT_DRUG_MART_PAIN_RELIEF = "146c735b-5081-4de4-9025-d939d560bbba";

	@Test
	void returns_the_otc_safety_sections_each_carrying_its_own_provenance() {
		api().get().uri("/api/drug-concepts/161")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.rxcui").isEqualTo("161")
				.jsonPath("$.name").isEqualTo("acetaminophen")
				.jsonPath("$.labelling[0].sections[*].heading").isEqualTo(List.of(
						"Active ingredient",
						"Warnings"))
				.jsonPath("$.labelling[0].sections[0].provenance.labelId").isEqualTo(DISCOUNT_DRUG_MART_PAIN_RELIEF)
				.jsonPath("$.labelling[0].sections[0].provenance.label").isEqualTo("Pain Relief")
				.jsonPath("$.labelling[0].sections[0].provenance.manufacturer").isEqualTo("DISCOUNT DRUG MART")
				.jsonPath("$.labelling[0].sections[0].provenance.effectiveDate").isEqualTo("2026-11-10")
				.jsonPath("$.labelling[0].sections[1].provenance.labelId").isEqualTo(DISCOUNT_DRUG_MART_PAIN_RELIEF);
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
				.expectBody()
				.jsonPath("$.labelling[0].regulatoryClass").isEqualTo("OVER_THE_COUNTER")
				.jsonPath("$.labelling[0].sections[*].heading").value(headings ->
						assertThat((List<String>) headings)
								.doesNotContain(
										"Adverse Reactions",
										"Contraindications",
										"Warnings and Precautions"));
	}

	/**
	 * The whole of the Drug Facts panel's warnings, for a Label that carries all five.
	 * Advil Menstrual Pain nests all four subsections inside Warnings (ADR-0018), so the
	 * panel is read there, in the order it is printed, rather than under five headings.
	 */
	@Test
	void renders_the_whole_panel_inside_warnings_in_the_order_it_is_printed() {
		api().get().uri("/api/drug-concepts/5640")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.name").isEqualTo("ibuprofen")
				.jsonPath("$.labelling.length()").isEqualTo(2)
				.jsonPath("$.labelling[0].regulatoryClass").isEqualTo("OVER_THE_COUNTER")
				.jsonPath("$.labelling[0].sections[*].heading").isEqualTo(List.of(
						"Active ingredient",
						"Warnings"))
				.jsonPath("$.labelling[0].sections[1].text").value(text -> assertThat((String) text)
						.containsSubsequence(
								"Do not use",
								"Ask a doctor before use if",
								"When using this product",
								"Stop use and ask a doctor if"))
				.jsonPath("$.labelling[0].sections[0].provenance.label").isEqualTo("Advil Menstrual Pain")
				.jsonPath("$.labelling[1].regulatoryClass").isEqualTo("PRESCRIPTION")
				.jsonPath("$.labelling[1].sections.length()").value(length ->
						assertThat((Integer) length).isPositive());
	}

	/**
	 * ADR-0007's absent-section rule, on this side of ADR-0008 too. Acetaminophen's
	 * Representative Label carries no "When using this product" section, and the page
	 * says nothing whatsoever about it: no heading, no "None", nothing a reader could take for a statement that there is
	 * nothing to watch for while taking it.
	 */
	@Test
	void says_nothing_at_all_about_a_section_an_otc_label_does_not_carry() {
		api().get().uri("/api/drug-concepts/161")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				// Active ingredient and Warnings, with no empty "When using this product" beside them.
				.jsonPath("$.labelling[0].sections.length()").isEqualTo(2)
				.jsonPath("$.labelling[0].sections[*].heading").value(headings ->
						assertThat((List<String>) headings).doesNotContain("When using this product"))
				.jsonPath("$.labelling[0].sections[*].text").value(texts ->
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
				.jsonPath("$.labelling[0].sections[0].provenance.label").isEqualTo("Nighttime Sleep Aid Berry Flavor")
				.jsonPath("$.labelling[0].sections[0].provenance.effectiveDate").isEqualTo("2026-09-09")
				.jsonPath("$.labelling[0].sections[*].provenance.label").value(labels ->
						assertThat((List<String>) labels).containsOnly("Nighttime Sleep Aid Berry Flavor"));
	}

	/** ADR-0010: every Regulatory Class gets its own block, with OTC first. */
	@Test
	void returns_both_regulatory_classes_otc_first() {
		api().get().uri("/api/drug-concepts/3498")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.labelling.length()").isEqualTo(2)
				.jsonPath("$.labelling[0].regulatoryClass").isEqualTo("OVER_THE_COUNTER")
				.jsonPath("$.labelling[0].sections[0].provenance.label")
						.isEqualTo("Nighttime Sleep Aid Berry Flavor")
				.jsonPath("$.labelling[0].sections[*].heading").isEqualTo(List.of(
						"Active ingredient",
						"Warnings"))
				.jsonPath("$.labelling[1].regulatoryClass").isEqualTo("PRESCRIPTION")
				.jsonPath("$.labelling[1].sections[0].provenance.label").isEqualTo("Diphenhydramine HCL")
				.jsonPath("$.labelling[1].sections[*].heading").isEqualTo(List.of(
						"Contraindications",
						"Adverse Reactions",
						"Drug Interactions"));
	}

	@Test
	void chooses_the_same_representative_label_for_each_class_on_every_request() {
		for (int attempt = 0; attempt < 3; attempt++) {
			api().get().uri("/api/drug-concepts/3498")
					.exchange()
					.expectStatus().isOk()
					.expectBody()
					.jsonPath("$.labelling[*].sections[0].provenance.label").isEqualTo(List.of(
							"Nighttime Sleep Aid Berry Flavor",
							"Diphenhydramine HCL"));
		}
	}

	/**
	 * ADR-0006: the FDA's own words, less the heading the Drug Facts panel prints above
	 * them and openFDA repeats inside them. What is left reads as the panel reads, under
	 * the heading it is read under — "Warnings" then "Liver warning".
	 */
	@Test
	void renders_the_panels_words_under_the_panels_headings() {
		api().get().uri("/api/drug-concepts/161")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.labelling[0].sections[1].heading").isEqualTo("Warnings")
				.jsonPath("$.labelling[0].sections[1].text").value(text -> assertThat((String) text)
						.startsWith("Liver warning")
						.contains("Do not use with any other drug containing acetaminophen"));
	}

	/**
	 * ADR-0018: Nighttime Sleep Aid publishes the whole Drug Facts panel in its warnings
	 * section and splits every subsection out as well. Each subsection is already read
	 * inside Warnings, so it is not read a second time under its own heading.
	 */
	@Test
	void never_renders_a_subsection_the_warnings_section_already_contains() {
		api().get().uri("/api/drug-concepts/3498")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.labelling[0].sections[*].heading").isEqualTo(List.of(
						"Active ingredient",
						"Warnings"))
				.jsonPath("$.labelling[0].sections[1].text").value(text -> assertThat((String) text)
						.contains("Do not use ▪ for children under 12 years of age")
						.contains("When using this product ▪ avoid alcoholic beverages"));
	}

	/**
	 * #18: an OTC Label states its strength in the Drug Facts active ingredient line,
	 * not in a strengths section. It is one product's strength, per unit of its dosage
	 * form, so it renders verbatim under the panel's own heading and never as "Strengths".
	 */
	@Test
	void renders_the_panels_active_ingredient_line_verbatim_under_its_own_heading() {
		api().get().uri("/api/drug-concepts/161")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.labelling[0].strengths").doesNotExist()
				.jsonPath("$.labelling[0].sections[0].heading").isEqualTo("Active ingredient")
				.jsonPath("$.labelling[0].sections[0].text")
						.isEqualTo("(in each caplet) Acetaminophen 500 mg")
				.jsonPath("$.labelling[0].sections[0].provenance.labelId").isEqualTo(DISCOUNT_DRUG_MART_PAIN_RELIEF);
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
						.doesNotContainIgnoringCase("take 2 caplets every 6 hours"));

		api().get().uri("/api/drug-concepts/5640")
				.exchange()
				.expectStatus().isOk()
				.expectBody(String.class)
				.value(body -> assertThat(body)
						.doesNotContainIgnoringCase("the smallest effective dose should be used"));
	}
}
