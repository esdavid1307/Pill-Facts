package net.pillfacts.backend;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import net.pillfacts.backend.support.ApiTest;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The FDA API key, which is what raises the site's quota from a thousand requests a day
 * to a hundred and twenty thousand.
 *
 * <p>It is sent as a basic-auth username, which openFDA accepts in place of the
 * {@code api_key} parameter, so it is never part of a URL: a URL turns up in exception
 * messages and logs, and a key in one is a key published.
 */
class OpenFdaApiKeyApiTest extends ApiTest {

	@Test
	void sends_the_configured_key_with_every_request_to_open_fda_and_never_in_the_url() {
		theCacheIsEmpty();
		forgetUpstreamRequests();

		api().get().uri("/api/drug-concepts/83367").exchange().expectStatus().isOk();

		String basic = "Basic " + Base64.getEncoder()
				.encodeToString((OPENFDA_API_KEY + ":").getBytes(StandardCharsets.UTF_8));
		assertThat(openFdaRequests())
				.isNotEmpty()
				.allSatisfy(request -> {
					assertThat(request.getHeader("Authorization")).isEqualTo(basic);
					assertThat(request.getUrl()).doesNotContain(OPENFDA_API_KEY);
				});
	}
}
