package net.pillfacts.backend;

import java.util.List;

import net.pillfacts.backend.support.ApiTest;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A prescription Drug Concept's page, through recorded RxNorm and openFDA fixtures.
 *
 * <p>The two drugs here are chosen for what they disagree about. Atorvastatin (83367)
 * has a brand Label and no Boxed Warning, and the Combination Products it shares an
 * Active Ingredient with are published more recently than Lipitor is. Warfarin (11289)
 * has no brand Label at all and a Boxed Warning on every generic one.
 */
class DrugConceptApiTest extends ApiTest {

	private static final String LIPITOR = "a60cc18b-0631-4cf0-b021-9f52224ece65";

	private static final String LIPITOR_URL =
			"https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=" + LIPITOR;

	@Test
	void returns_safety_sections_in_render_order_each_carrying_its_own_provenance() {
		api().get().uri("/api/drug-concepts/83367")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.rxcui").isEqualTo("83367")
				.jsonPath("$.name").isEqualTo("atorvastatin")
				.jsonPath("$.sections[*].heading").isEqualTo(List.of(
						"Contraindications",
						"Warnings and Precautions",
						"Adverse Reactions",
						"Drug Interactions"))
				.jsonPath("$.sections[0].provenance.labelId").isEqualTo(LIPITOR)
				.jsonPath("$.sections[0].provenance.label").isEqualTo("Lipitor")
				.jsonPath("$.sections[0].provenance.manufacturer").isEqualTo("Viatris Specialty LLC")
				.jsonPath("$.sections[0].provenance.effectiveDate").isEqualTo("2024-04-15")
				.jsonPath("$.sections[0].provenance.url").isEqualTo(LIPITOR_URL)
				.jsonPath("$.sections[3].provenance.labelId").isEqualTo(LIPITOR);
	}

	/**
	 * Every Label in the Representative Label's class must be a Label for this Drug
	 * Concept alone. The three atorvastatin Labels published more recently than Lipitor
	 * are all amlodipine-and-atorvastatin, whose warnings are not atorvastatin's, and
	 * which is not a Drug Concept at all (ADR-0012).
	 */
	@Test
	void never_speaks_for_a_drug_concept_with_a_combination_products_label() {
		api().get().uri("/api/drug-concepts/83367")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.sections[*].provenance.label").value(labels ->
						assertThat((List<String>) labels).containsOnly("Lipitor"));
	}

	/**
	 * ADR-0010: the brand Label is preferred, and repeating the request does not change
	 * which one that is. Selection reads one page of Labels and orders it itself, so what
	 * this pins is that nothing in that walk depends on iteration order; Labels sharing
	 * an Effective Date, which is what the ordering's tie-break is for, are rarer than
	 * any one drug's recorded page and are not among these.
	 */
	@Test
	void chooses_the_same_representative_label_on_every_request() {
		for (int attempt = 0; attempt < 3; attempt++) {
			api().get().uri("/api/drug-concepts/83367")
					.exchange()
					.expectStatus().isOk()
					.expectBody()
					.jsonPath("$.sections[0].provenance.labelId").isEqualTo(LIPITOR);
		}
	}

	/** No brand Label exists for warfarin, so the most recently updated generic speaks. */
	@Test
	void falls_back_to_the_most_recently_updated_generic_label() {
		api().get().uri("/api/drug-concepts/11289")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.name").isEqualTo("warfarin")
				.jsonPath("$.sections[0].provenance.label").isEqualTo("Warfarin Sodium")
				.jsonPath("$.sections[0].provenance.manufacturer").isEqualTo("Coupler LLC")
				.jsonPath("$.sections[0].provenance.effectiveDate").isEqualTo("2026-08-31");
	}

	@Test
	void puts_a_boxed_warning_first() {
		api().get().uri("/api/drug-concepts/11289")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.sections[0].heading").isEqualTo("Boxed Warning")
				.jsonPath("$.sections[0].text").value(text ->
						assertThat((String) text).startsWith("WARNING: BLEEDING RISK"));
	}

	/**
	 * ADR-0007: an absent Boxed Warning means the FDA did not require one, never that
	 * the drug is safe, so nothing whatsoever is said about it.
	 */
	@Test
	void says_nothing_at_all_about_a_boxed_warning_a_drug_concept_does_not_have() {
		api().get().uri("/api/drug-concepts/83367")
				.exchange()
				.expectStatus().isOk()
				.expectBody(String.class)
				.value(body -> assertThat(body).doesNotContainIgnoringCase("boxed"));
	}

	/** ADR-0007: the strengths a drug is made in are a property of the pill, and are rendered. */
	@Test
	void shows_the_strengths_a_drug_is_made_in() {
		api().get().uri("/api/drug-concepts/83367")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.strengths").value(strengths ->
						assertThat((String) strengths).startsWith("Tablets:").contains("10 mg of atorvastatin"));
	}

	/**
	 * ADR-0007: dosing is an instruction to a patient and never leaves the backend, in
	 * any form, behind any expander. The phrases asserted on are lines from each
	 * Representative Label's own dosage and administration section.
	 */
	@Test
	void never_returns_dosing_instructions() {
		api().get().uri("/api/drug-concepts/83367")
				.exchange()
				.expectStatus().isOk()
				.expectBody(String.class)
				.value(body -> assertThat(body)
						.doesNotContainIgnoringCase("Assess LDL-C when clinically appropriate"));

		api().get().uri("/api/drug-concepts/11289")
				.exchange()
				.expectStatus().isOk()
				.expectBody(String.class)
				.value(body -> assertThat(body)
						.doesNotContainIgnoringCase("Individualize dosing regimen for each patient"));
	}

	/** ADR-0006: verbatim, less the section numbering and the references that lead nowhere. */
	@Test
	void strips_leading_section_numbers_and_unresolvable_cross_references() {
		api().get().uri("/api/drug-concepts/83367")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.sections[0].text").value(text -> assertThat((String) text)
						// "4 CONTRAINDICATIONS • Acute liver failure…", less its own numbering
						.startsWith("• Acute liver failure or decompensated cirrhosis")
						.doesNotContain("[see ")
						.doesNotContain("(5.3)")
						// and is otherwise the FDA's own words
						.contains("Hypersensitivity to atorvastatin or any excipients in LIPITOR"));
	}

	/**
	 * A reference the SPL did not spell out is left as a bare "( 7 )", which says even
	 * less to a reader than the spelled-out kind and goes the same way.
	 */
	@Test
	void strips_references_to_a_section_by_number_alone() {
		api().get().uri("/api/drug-concepts/11289")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.sections[4].text").value(text -> assertThat((String) text)
						.contains("inducers of CYP2C9, 1A2, or 3A4.")
						.doesNotContain("( 7 )"));
	}

	/** An RxCUI RxNorm does not publish is no Drug Concept, and has no page. */
	@Test
	void has_no_page_for_an_rxcui_that_is_not_a_drug_concept() {
		api().get().uri("/api/drug-concepts/999999999")
				.exchange()
				.expectStatus().isNotFound();
	}

	/**
	 * A Drug Concept is identified by its ingredient-level RxCUI (ADR-0002). 153165 is
	 * the Brand Lipitor, and asking openFDA for Labels whose generic name is "Lipitor"
	 * would answer nothing while looking like a Drug Concept with no Labels.
	 */
	@Test
	void has_no_page_for_a_brands_rxcui() {
		api().get().uri("/api/drug-concepts/153165")
				.exchange()
				.expectStatus().isNotFound();
	}
}
