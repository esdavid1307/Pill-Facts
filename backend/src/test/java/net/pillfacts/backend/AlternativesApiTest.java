package net.pillfacts.backend;

import java.util.List;
import java.util.Map;

import net.pillfacts.backend.support.ApiTest;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The Alternatives a Drug Concept's page lists, and the Combination Products it keeps
 * out of them.
 *
 * <p>Atorvastatin (83367) is the drug ADR-0005 is written about: RxNorm relates it to
 * Lipitor in four strengths, to a suspension sold as Atorvaliq, and to two families of
 * Combination Product — Caduet, which is amlodipine as well, and the ezetimibe tablets.
 * Offering any of the latter as an Alternative to a statin is the most dangerous false
 * positive this system can produce, so most of what is asserted here is an absence.
 *
 * <p>Warfarin (11289) is related to no Combination Product at all, and sulbactam (10167)
 * to nothing but Combination Products; between them they pin what an empty list does,
 * which is not exist.
 */
class AlternativesApiTest extends ApiTest {

	/**
	 * An Alternative is a statement of composition: one strength, one dosage form, and
	 * the Brands sold in exactly it. Every entry names its own strength, so no two of
	 * them are ever run together.
	 */
	@Test
	void lists_one_alternative_per_strength_and_dosage_form() {
		api().get().uri("/api/drug-concepts/83367")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.alternatives[*].composition").isEqualTo(List.of(
						"atorvastatin 10 MG Oral Tablet",
						"atorvastatin 20 MG Oral Tablet",
						"atorvastatin 4 MG/ML Oral Suspension",
						"atorvastatin 40 MG Oral Tablet",
						"atorvastatin 80 MG Oral Tablet"))
				.jsonPath("$.alternatives[0].brands").isEqualTo(List.of("Lipitor"))
				.jsonPath("$.alternatives[2].brands").isEqualTo(List.of("Atorvaliq"));
	}

	/**
	 * ADR-0005: Combination Products are filtered out of Alternatives entirely. Caduet
	 * is a blood-pressure drug as much as a statin, and RxNorm lists it under
	 * atorvastatin just the same.
	 */
	@Test
	void never_lists_a_combination_product_among_the_alternatives() {
		api().get().uri("/api/drug-concepts/83367")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.alternatives[*].composition").value(compositions ->
						assertThat((List<String>) compositions)
								.noneMatch(composition -> composition.contains("amlodipine"))
								.noneMatch(composition -> composition.contains("ezetimibe")))
				.jsonPath("$.alternatives[*].brands[*]").value(brands ->
						assertThat((List<String>) brands).doesNotContain("Caduet"));
	}

	/** And are shown instead in their own field, named for what they are. */
	@Test
	void lists_combination_products_containing_the_active_ingredient_separately() {
		api().get().uri("/api/drug-concepts/83367")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.combinationProducts[*].composition").value(compositions ->
						assertThat((List<String>) compositions)
								.contains("amlodipine 10 MG / atorvastatin 10 MG Oral Tablet")
								.contains("atorvastatin 20 MG / ezetimibe 10 MG Oral Tablet")
								.allMatch(composition -> composition.contains("atorvastatin")))
				.jsonPath("$.combinationProducts[?(@.composition == "
						+ "'amlodipine 10 MG / atorvastatin 10 MG Oral Tablet')].brands[*]")
				.isEqualTo(List.of("Caduet"));
	}

	/**
	 * A Brand sold in several strengths appears once per strength and never once for all
	 * of them, so nothing in the payload can be read as "Lipitor, in whatever strength".
	 */
	@Test
	void never_runs_two_strengths_of_one_brand_together() {
		api().get().uri("/api/drug-concepts/83367")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.alternatives[?(@.brands[0] == 'Lipitor')].composition").isEqualTo(List.of(
						"atorvastatin 10 MG Oral Tablet",
						"atorvastatin 20 MG Oral Tablet",
						"atorvastatin 40 MG Oral Tablet",
						"atorvastatin 80 MG Oral Tablet"));
	}

	/**
	 * ADR-0005 puts the wording in the payload's shape rather than in a disclaimer: an
	 * Alternative carries a composition and the Brands it is sold under, and no prose at
	 * all. There is nothing here for a renderer to turn into a sentence about switching.
	 */
	@Test
	void says_nothing_about_an_alternative_beyond_what_it_is_made_of() {
		api().get().uri("/api/drug-concepts/83367")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.alternatives").value(alternatives ->
						assertThat((List<Map<String, Object>>) alternatives)
								.allSatisfy(alternative ->
										assertThat(alternative).containsOnlyKeys("composition", "brands")));
	}

	/** Ordering is the payload's, and repeating the request does not change it. */
	@Test
	void lists_alternatives_in_the_same_order_on_every_request() {
		for (int attempt = 0; attempt < 3; attempt++) {
			api().get().uri("/api/drug-concepts/83367")
					.exchange()
					.expectStatus().isOk()
					.expectBody()
					.jsonPath("$.alternatives[0].composition").isEqualTo("atorvastatin 10 MG Oral Tablet")
					.jsonPath("$.alternatives[4].composition").isEqualTo("atorvastatin 80 MG Oral Tablet");
		}
	}

	/**
	 * An empty list is a section with nothing in it, and a page renders nothing rather
	 * than an empty section. Warfarin is in no Combination Product RxNorm knows of.
	 */
	@Test
	void has_no_combination_products_field_where_there_are_none() {
		api().get().uri("/api/drug-concepts/11289")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.alternatives[*].composition").value(compositions ->
						assertThat((List<String>) compositions).isNotEmpty())
				.jsonPath("$.combinationProducts").doesNotExist();
	}

	/**
	 * And the other way round. Sulbactam is sold only alongside ampicillin, so it has
	 * Combination Products and not one Alternative.
	 */
	@Test
	void has_no_alternatives_field_where_a_drug_concept_is_sold_only_in_combination() {
		api().get().uri("/api/drug-concepts/10167")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.name").isEqualTo("sulbactam")
				.jsonPath("$.alternatives").doesNotExist()
				.jsonPath("$.combinationProducts[*].composition").value(compositions ->
						assertThat((List<String>) compositions).isNotEmpty());
	}
}
