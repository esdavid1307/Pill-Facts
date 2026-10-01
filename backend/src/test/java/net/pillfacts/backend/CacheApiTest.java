package net.pillfacts.backend;

import java.time.LocalDate;

import net.pillfacts.backend.support.ApiTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The week-long cache, and what the site does once the FDA and NLM stop answering.
 * ADR-0003.
 *
 * <p>A cache is invisible in a response, so these assert on the two things that do show:
 * the upstream calls a request costs, and the Fetched Date a page carries. The one drug
 * used throughout is atorvastatin, whose fixtures the prescription tests already pin; what
 * matters here is not which page comes back but whether it was paid for.
 *
 * <p>Every test starts by emptying the cache, because the Postgres behind these is shared
 * with every other test class and nothing orders them.
 */
class CacheApiTest extends ApiTest {

	private static final String ATORVASTATIN = "/api/drug-concepts/83367";

	private static final String LIPITOR = "a60cc18b-0631-4cf0-b021-9f52224ece65";

	@BeforeEach
	void coldCache() {
		theCacheIsEmpty();
	}

	@Test
	void serves_a_second_request_for_the_same_drug_concept_without_an_upstream_call() {
		api().get().uri(ATORVASTATIN).exchange().expectStatus().isOk();

		forgetUpstreamRequests();
		api().get().uri(ATORVASTATIN)
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.name").isEqualTo("atorvastatin")
				.jsonPath("$.labelling[0].sections[0].provenance.labelId").isEqualTo(LIPITOR);

		assertThat(upstreamRequests()).isZero();
	}

	@Test
	void serves_a_second_search_for_the_same_query_without_an_upstream_call() {
		api().get().uri("/api/search?q=lipitor").exchange().expectStatus().isOk();

		forgetUpstreamRequests();
		api().get().uri("/api/search?q=lipitor")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.candidates[0].rxcui").isEqualTo("83367")
				.jsonPath("$.candidates[0].brand").isEqualTo("Lipitor");

		assertThat(upstreamRequests()).isZero();
	}

	/**
	 * A Label changes on the order of months, so a week-old one is still true — and a
	 * week-old one is as old as this system will serve without asking again.
	 */
	@Test
	void refetches_a_drug_concept_once_its_entry_is_older_than_seven_days() {
		api().get().uri(ATORVASTATIN).exchange().expectStatus().isOk();
		aWeekPasses();

		forgetUpstreamRequests();
		api().get().uri(ATORVASTATIN)
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.fetchedDate").isEqualTo(LocalDate.now().toString());

		assertThat(upstreamRequests()).isPositive();
	}

	/**
	 * Degradation: the Labels we have are served rather than an error, and the page says
	 * when they were fetched. Staleness is shown, never hidden.
	 */
	@Test
	void serves_the_expired_payload_with_its_fetched_date_when_the_upstreams_are_down() {
		api().get().uri(ATORVASTATIN).exchange().expectStatus().isOk();
		aWeekPasses();

		whileTheUpstreamsAreDown(() -> api().get().uri(ATORVASTATIN)
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.name").isEqualTo("atorvastatin")
				.jsonPath("$.labelling[0].sections[0].provenance.labelId").isEqualTo(LIPITOR)
				.jsonPath("$.fetchedDate")
				.isEqualTo(LocalDate.now().minusDays(DAYS_SINCE_FETCHING).toString()));
	}

	@Test
	void serves_an_expired_resolution_when_the_upstreams_are_down() {
		api().get().uri("/api/search?q=lipitor").exchange().expectStatus().isOk();
		aWeekPasses();

		whileTheUpstreamsAreDown(() -> api().get().uri("/api/search?q=lipitor")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.candidates[0].rxcui").isEqualTo("83367"));
	}

	/**
	 * With nothing cached there is nothing honest to serve, so the failure is a failure.
	 * Wording that as Unreachable rather than as a fact about the drug is #9's work.
	 */
	@Test
	void fails_when_the_upstreams_are_down_and_nothing_was_ever_fetched() {
		whileTheUpstreamsAreDown(() -> api().get().uri(ATORVASTATIN)
				.exchange()
				.expectStatus().is5xxServerError());
	}

	/**
	 * Effective Date and Fetched Date are different facts: one is when the FDA's
	 * labelling took effect, the other is when we last retrieved it. They are never the
	 * same field and never the same date.
	 */
	@Test
	void reports_when_it_fetched_the_labelling_separately_from_when_it_took_effect() {
		api().get().uri(ATORVASTATIN)
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.fetchedDate").isEqualTo(LocalDate.now().toString())
				.jsonPath("$.labelling[0].sections[0].provenance.effectiveDate").isEqualTo("2024-04-15");
	}
}
