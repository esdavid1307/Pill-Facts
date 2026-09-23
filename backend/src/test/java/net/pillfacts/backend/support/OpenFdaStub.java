package net.pillfacts.backend.support;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.client.WireMock;
import com.github.tomakehurst.wiremock.core.WireMockConfiguration;
import org.springframework.core.io.Resource;

/**
 * openFDA, served from recorded fixtures instead of the live API.
 *
 * <p>A fixture's directory says which search recorded it and its filename says for which
 * Active Ingredient, so a test names a Drug Concept and nothing else. The recorder that
 * produced them is {@code backend/tools/record-openfda-fixtures.py}.
 *
 * <p>Anything not recorded answers 500, which fails the test that asked for it. It
 * cannot answer 404: openFDA uses 404 to mean a search matched nothing, so a missing
 * fixture answering 404 would read as a Drug Concept the FDA publishes no Label for, and
 * a test would quietly pass having reached somewhere it shouldn't.
 */
final class OpenFdaStub {

	/**
	 * Kept in step with {@code OpenFda}, which builds these, and with the recorder,
	 * which records what they return.
	 */
	private static final String PRESCRIPTION =
			"openfda.generic_name:\"%s\" AND openfda.product_type:\"HUMAN PRESCRIPTION DRUG\"";

	private static final String BRAND_ONLY = " AND openfda.application_number:NDA*";

	private final WireMockServer server = new WireMockServer(WireMockConfiguration.options().dynamicPort());

	String start() {
		server.start();
		server.stubFor(WireMock.any(WireMock.anyUrl())
				.atPriority(10)
				.willReturn(WireMock.aResponse().withStatus(500)
						.withBody("Not recorded. Add the ingredient to record-openfda-fixtures.py.")));
		stubSearches("prescription", PRESCRIPTION);
		stubSearches("prescription-brand", PRESCRIPTION + BRAND_ONLY);
		return server.baseUrl();
	}

	private void stubSearches(String directory, String expression) {
		for (Resource fixture : Fixtures.in("openfda/" + directory)) {
			String body = Fixtures.read(fixture);
			server.stubFor(WireMock.get(WireMock.urlPathEqualTo("/drug/label.json"))
					.atPriority(1)
					.withQueryParam("search", WireMock.equalTo(expression.formatted(Fixtures.stem(fixture))))
					.willReturn(WireMock.aResponse()
							// openFDA answers a search that matched nothing with 404, and
							// the recorded body is how we know which this fixture is.
							.withStatus(body.contains("\"error\"") ? 404 : 200)
							.withHeader("Content-Type", "application/json")
							.withBody(body)));
		}
	}
}
