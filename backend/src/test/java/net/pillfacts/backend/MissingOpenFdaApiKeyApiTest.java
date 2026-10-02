package net.pillfacts.backend;

import net.pillfacts.backend.support.ApiTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * An application started without an FDA API key, as a fresh clone of this public
 * repository is: it serves, and it says what it is missing and where to get one.
 *
 * <p>The explanation is in the startup log, because that is where someone running the
 * application looks and the HTTP surface has no reader to tell. It is the one thing this
 * suite asserts outside a response. The configuration below is unique to this class, so
 * the application starts afresh for it and the capture sees it start.
 */
@ExtendWith(OutputCaptureExtension.class)
@TestPropertySource(properties = "pillfacts.openfda.api-key=")
class MissingOpenFdaApiKeyApiTest extends ApiTest {

	@Test
	void starts_without_a_key_and_says_how_to_supply_one(CapturedOutput output) {
		api().get().uri("/api/drug-concepts/83367")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.name").isEqualTo("atorvastatin");

		assertThat(output.getAll())
				.contains("No openFDA API key is configured")
				.contains("PILLFACTS_OPENFDA_API_KEY");
	}
}
