package net.pillfacts.backend;

import java.util.List;

import net.pillfacts.backend.support.ApiTest;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Resolution: turning free text into Drug Concepts, through recorded RxNorm fixtures.
 *
 * <p>The RxCUIs asserted on are ingredient-level, per ADR-0002: 83367 is atorvastatin,
 * 5640 is ibuprofen.
 */
class ResolutionApiTest extends ApiTest {

	@Test
	void resolves_an_active_ingredient_to_the_same_drug_concept_as_its_brand() {
		api().get().uri("/api/search?q=ibuprofen")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.candidates.length()").isEqualTo(1)
				.jsonPath("$.candidates[0].rxcui").isEqualTo("5640")
				.jsonPath("$.candidates[0].name").isEqualTo("ibuprofen")
				.jsonPath("$.candidates[0].brand").doesNotExist();

		api().get().uri("/api/search?q=advil")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.candidates.length()").isEqualTo(1)
				.jsonPath("$.candidates[0].rxcui").isEqualTo("5640")
				.jsonPath("$.candidates[0].name").isEqualTo("ibuprofen")
				.jsonPath("$.candidates[0].brand").isEqualTo("Advil");
	}

	@Test
	void resolves_a_misspelled_query() {
		api().get().uri("/api/search?q=lipitr")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.candidates.length()").isEqualTo(1)
				.jsonPath("$.candidates[0].rxcui").isEqualTo("83367")
				.jsonPath("$.candidates[0].brand").isEqualTo("Lipitor");
	}

	@Test
	void offers_a_choice_when_several_drug_concepts_are_plausible() {
		api().get().uri("/api/search?q=hydroxy")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.candidates.length()").value(count -> assertThat((Integer) count).isGreaterThan(1))
				.jsonPath("$.candidates[*].rxcui").value(rxcuis ->
						assertThat((List<?>) rxcuis).doesNotHaveDuplicates());
	}

	/**
	 * A Drug Concept has exactly one Active Ingredient, so a Combination Product is not
	 * one and cannot be a candidate. Searching "tylenol pm" matches the Combination
	 * Product itself and several of its packagings, all of which carry acetaminophen and
	 * diphenhydramine together; only plain Tylenol resolves to a Drug Concept. Neither
	 * constituent may be offered on its own behalf, per ADR-0012.
	 */
	@Test
	void never_offers_a_combination_product_as_a_drug_concept() {
		api().get().uri("/api/search?q=tylenol pm")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.candidates.length()").isEqualTo(1)
				.jsonPath("$.candidates[0].rxcui").isEqualTo("161")
				.jsonPath("$.candidates[0].name").isEqualTo("acetaminophen")
				.jsonPath("$.candidates[0].brand").isEqualTo("Tylenol");
	}

	/** RxNorm rejects an empty term outright, so an empty search must not reach it. */
	@Test
	void returns_nothing_for_an_empty_query() {
		api().get().uri("/api/search?q={q}", "   ")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.candidates").isEmpty();
	}

	@Test
	void returns_nothing_for_a_query_that_is_not_a_drug() {
		api().get().uri("/api/search?q=zzzqqqnotadrug")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.candidates").isEmpty();
	}

	@Test
	void resolves_a_correctly_spelled_brand_to_its_drug_concept() {
		api().get().uri("/api/search?q=lipitor")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.candidates.length()").isEqualTo(1)
				.jsonPath("$.candidates[0].rxcui").isEqualTo("83367")
				.jsonPath("$.candidates[0].name").isEqualTo("atorvastatin")
				.jsonPath("$.candidates[0].brand").isEqualTo("Lipitor");
	}
}
