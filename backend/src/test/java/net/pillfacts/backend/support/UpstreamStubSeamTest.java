package net.pillfacts.backend.support;

import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.ok;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the seam itself: one stub server is shared by every {@link ApiTest} subclass,
 * so nothing may stop it when a single test class finishes. A per-class {@code @AfterAll}
 * here leaves this passing in isolation and failing as soon as a second class exists.
 */
class UpstreamStubSeamTest extends ApiTest {

	@Test
	void stub_server_answers_over_http_from_every_test_class() throws Exception {
		upstream.stubFor(get("/probe").willReturn(ok("alive")));

		HttpResponse<String> response = HttpClient.newHttpClient().send(
				HttpRequest.newBuilder(URI.create(upstream.baseUrl() + "/probe")).build(),
				HttpResponse.BodyHandlers.ofString());

		assertThat(response.body()).isEqualTo("alive");
	}
}
