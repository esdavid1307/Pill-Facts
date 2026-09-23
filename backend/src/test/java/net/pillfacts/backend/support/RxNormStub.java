package net.pillfacts.backend.support;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.client.ResponseDefinitionBuilder;
import com.github.tomakehurst.wiremock.client.WireMock;
import com.github.tomakehurst.wiremock.core.WireMockConfiguration;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

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

	private static final String FIXTURES = "classpath*:fixtures/rxnorm/";

	private final WireMockServer server = new WireMockServer(WireMockConfiguration.options().dynamicPort());

	String start() {
		server.start();
		stubApproximateTerm();
		stubConcepts("properties", "/REST/rxcui/%s/properties.json", null);
		stubConcepts("related-ingredient", "/REST/rxcui/%s/related.json", "IN");
		return server.baseUrl();
	}

	private void stubApproximateTerm() {
		for (Resource fixture : fixtures("approximate-term")) {
			server.stubFor(WireMock.get(WireMock.urlPathEqualTo("/REST/approximateTerm.json"))
					.withQueryParam("term", WireMock.equalTo(stem(fixture)))
					.willReturn(json(read(fixture))));
		}
	}

	private void stubConcepts(String directory, String pathTemplate, String tty) {
		for (Resource fixture : fixtures(directory)) {
			var mapping = WireMock.get(WireMock.urlPathEqualTo(pathTemplate.formatted(stem(fixture))));
			if (tty != null) {
				mapping = mapping.withQueryParam("tty", WireMock.equalTo(tty));
			}
			server.stubFor(mapping.willReturn(json(read(fixture))));
		}
	}

	private static ResponseDefinitionBuilder json(String body) {
		return WireMock.aResponse()
				.withStatus(200)
				.withHeader("Content-Type", "application/json")
				.withBody(body);
	}

	private static Resource[] fixtures(String directory) {
		try {
			Resource[] found = new PathMatchingResourcePatternResolver()
					.getResources(FIXTURES + directory + "/*.json");
			if (found.length == 0) {
				throw new IllegalStateException("No RxNorm fixtures found in " + directory
						+ ". Run backend/tools/record-rxnorm-fixtures.py.");
			}
			return found;
		}
		catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
	}

	private static String stem(Resource fixture) {
		String name = fixture.getFilename();
		return name.substring(0, name.length() - ".json".length());
	}

	private static String read(Resource fixture) {
		try (var in = fixture.getInputStream()) {
			return new String(in.readAllBytes(), StandardCharsets.UTF_8);
		}
		catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
	}
}
