package net.pillfacts.backend.support;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.client.ResponseDefinitionBuilder;
import com.github.tomakehurst.wiremock.client.WireMock;
import com.github.tomakehurst.wiremock.core.WireMockConfiguration;
import org.springframework.core.io.Resource;

/**
 * RxNorm, served from recorded fixtures instead of the live API.
 *
 * <p>Every fixture under {@code src/test/resources/fixtures/rxnorm} is stubbed, so a
 * test names a search term and nothing else. The recorder that produced them is
 * {@code backend/tools/record-rxnorm-fixtures.py}.
 *
 * <p>Anything not recorded answers 404, which fails the test that asked for it. That is
 * the point: a test must never quietly pass because it reached somewhere it shouldn't,
 * and the fix is to record the fixture rather than to tolerate the gap.
 */
final class RxNormStub {

	private final WireMockServer server = new WireMockServer(WireMockConfiguration.options().dynamicPort());

	String start() {
		server.start();
		stubApproximateTerm();
		stubConcepts("properties", "/REST/rxcui/%s/properties.json", null);
		stubConcepts("related-ingredient", "/REST/rxcui/%s/related.json", "IN");
		stubProducts();
		return server.baseUrl();
	}

	private void stubApproximateTerm() {
		for (Resource fixture : Fixtures.in("rxnorm/approximate-term")) {
			server.stubFor(WireMock.get(WireMock.urlPathEqualTo("/REST/approximateTerm.json"))
					.withQueryParam("term", WireMock.equalTo(Fixtures.stem(fixture)))
					.willReturn(json(Fixtures.read(fixture))));
		}
	}

	private void stubConcepts(String directory, String pathTemplate, String tty) {
		for (Resource fixture : Fixtures.in("rxnorm/" + directory)) {
			var mapping = WireMock.get(WireMock.urlPathEqualTo(pathTemplate.formatted(Fixtures.stem(fixture))));
			if (tty != null) {
				mapping = mapping.withQueryParam("tty", WireMock.equalTo(tty));
			}
			server.stubFor(mapping.willReturn(json(Fixtures.read(fixture))));
		}
	}

	/**
	 * The products related to an Active Ingredient, which {@code RxNorm} asks for by
	 * repeating the term type rather than joining the two with a plus sign. Matching on
	 * both values is what keeps this stub apart from the ingredient one above, which
	 * answers the same path.
	 */
	private void stubProducts() {
		for (Resource fixture : Fixtures.in("rxnorm/related-product")) {
			server.stubFor(WireMock.get(WireMock
					.urlPathEqualTo("/REST/rxcui/%s/related.json".formatted(Fixtures.stem(fixture))))
					.withQueryParam("tty", WireMock.havingExactly("SCD", "SBD"))
					.willReturn(json(Fixtures.read(fixture))));
		}
	}

	private static ResponseDefinitionBuilder json(String body) {
		return WireMock.aResponse()
				.withStatus(200)
				.withHeader("Content-Type", "application/json")
				.withBody(body);
	}
}
