package net.pillfacts.backend;

import net.pillfacts.backend.support.ApiTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/**
 * The three ways this site can have nothing to show, told apart in the response itself
 * rather than left for the frontend to guess at.
 *
 * <p>They are different facts. No match is a fact about the query, Unlabelled a fact about
 * the drug, and Unreachable a fact about an outage, and someone looking up their own
 * medication reads each of them differently. A response that let two of them arrive in the
 * same shape would leave the page no honest way to word either.
 *
 * <p>Sulbactam (10167) is Unlabelled in the fixtures: it is sold only alongside ampicillin,
 * so every Label naming it describes a Combination Product and none speaks for it.
 */
class EmptyStatesApiTest extends ApiTest {

	private static final String SULBACTAM = "/api/drug-concepts/10167";

	private static final String ATORVASTATIN = "/api/drug-concepts/83367";

	/** Unreachable depends on there being nothing cached, so every test starts from that. */
	@BeforeEach
	void coldCache() {
		theCacheIsEmpty();
	}

	/** No match is a successful answer about a query: both lists present, both empty. */
	@Test
	void answers_no_match_as_a_search_with_nothing_in_it() {
		api().get().uri("/api/search?q=zzzqqqnotadrug")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.candidates").isEmpty()
				.jsonPath("$.droppedCombinationProducts").isEmpty();
	}

	/**
	 * Unlabelled is a page, not a failure: the Drug Concept resolved, and the FDA
	 * publishes no Label for it. It keeps its name and its Fetched Date, and is told apart
	 * from a Label carrying none of the Safety Sections Pill-Facts reads by having no
	 * Regulatory Class block at all.
	 */
	@Test
	void answers_unlabelled_as_a_page_with_no_labelling() {
		api().get().uri(SULBACTAM)
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.name").isEqualTo("sulbactam")
				.jsonPath("$.labelling").isEmpty()
				.jsonPath("$.fetchedDate").exists();
	}

	@Test
	void answers_unreachable_for_a_drug_concept_nothing_was_ever_fetched_for() {
		whileTheUpstreamsAreUnreachable(() -> api().get().uri(ATORVASTATIN)
				.exchange()
				.expectStatus().isEqualTo(HttpStatus.SERVICE_UNAVAILABLE)
				.expectBody()
				.jsonPath("$.title").isEqualTo("Unreachable"));
	}

	@Test
	void answers_unreachable_for_a_search_nothing_was_ever_fetched_for() {
		whileTheUpstreamsAreUnreachable(() -> api().get().uri("/api/search?q=lipitor")
				.exchange()
				.expectStatus().isEqualTo(HttpStatus.SERVICE_UNAVAILABLE)
				.expectBody()
				.jsonPath("$.title").isEqualTo("Unreachable"));
	}

	/**
	 * Unreachable is only for when there is nothing honest to serve. A cached payload,
	 * however old, is served instead and dated (ADR-0003); {@code CacheApiTest} holds that
	 * for a labelled page, and this holds it for the Unlabelled one, whose empty labelling
	 * is a payload like any other.
	 */
	@Test
	void serves_a_cached_unlabelled_page_rather_than_answer_unreachable() {
		api().get().uri(SULBACTAM).exchange().expectStatus().isOk();
		daysPass(8);

		whileTheUpstreamsAreUnreachable(() -> api().get().uri(SULBACTAM)
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.name").isEqualTo("sulbactam")
				.jsonPath("$.labelling").isEmpty());
	}
}
