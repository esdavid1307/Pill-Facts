package net.pillfacts.backend;

import net.pillfacts.backend.support.ApiTest;
import org.junit.jupiter.api.Test;

class StatusApiTest extends ApiTest {

	@Test
	void reports_the_status_stored_in_postgres() {
		api().get().uri("/api/status")
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.status").isEqualTo("ready");
	}
}
