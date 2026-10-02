package net.pillfacts.backend;

import net.pillfacts.backend.support.ApiTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The per-reader limit in front of both endpoints, which keeps one visitor with a script
 * from spending the FDA quota every other visitor depends on.
 *
 * <p>These run under the limits production runs with: a burst of sixty requests, then one
 * more every ten seconds. Both sides of the burst are pinned, as the cache's seven days
 * are, because a test that asserted only the refusal would pass just as well with a limit
 * tight enough to turn away someone reading.
 */
class RateLimitApiTest extends ApiTest {

	private static final int BURST = 60;

	private static final String LIPITOR = "/api/search?q=lipitor";

	@Test
	void serves_a_burst_of_sixty_requests_and_refuses_the_sixty_first_with_a_reason() {
		spendTheBurst();

		api().get().uri(LIPITOR)
				.exchange()
				.expectStatus().isEqualTo(HttpStatus.TOO_MANY_REQUESTS)
				.expectHeader().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)
				.expectHeader().value("Retry-After", retryAfter ->
						assertThat(Integer.parseInt(retryAfter)).isBetween(1, 10))
				.expectBody()
				.jsonPath("$.status").isEqualTo(429)
				.jsonPath("$.title").isEqualTo("Too many requests")
				.jsonPath("$.detail").value(String.class, detail ->
						assertThat(detail).contains("try again"));
	}

	/** What protects ordinary browsing from a script is that the script spends only its own. */
	@Test
	void never_refuses_one_reader_for_what_another_has_spent() {
		spendTheBurst();

		apiForwardedFor(aNewReader()).get().uri(LIPITOR).exchange().expectStatus().isOk();
	}

	/**
	 * The proxy appends the address it saw, so anything before it is the client's to
	 * invent. A script that invents a new one each time is still one reader.
	 */
	@Test
	void counts_a_reader_by_the_address_the_proxy_saw_not_one_the_client_claims() {
		spendTheBurst();

		apiForwardedFor(aNewReader() + ", " + reader())
				.get().uri(LIPITOR)
				.exchange()
				.expectStatus().isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
	}

	/** One allowance covers both endpoints, since either can cost an FDA call. */
	@Test
	void refuses_a_drug_concept_page_once_searches_have_spent_the_burst() {
		spendTheBurst();

		api().get().uri("/api/drug-concepts/83367")
				.exchange()
				.expectStatus().isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
	}

	private void spendTheBurst() {
		for (int i = 0; i < BURST; i++) {
			api().get().uri(LIPITOR).exchange().expectStatus().isOk();
		}
	}
}
