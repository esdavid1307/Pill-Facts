package net.pillfacts.backend.support;

import com.github.tomakehurst.wiremock.WireMockServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.containers.PostgreSQLContainer;

import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;

/**
 * The backend's one test seam: the running application exercised through its HTTP
 * surface, against a real Postgres and with the upstream APIs stubbed.
 *
 * <p>Tests here assert on the JSON a request returns. They do not reach past the HTTP
 * boundary into services or repositories, so any refactor that leaves the API contract
 * intact leaves them passing.
 *
 * <p>Both the container and the stub server are static, so one of each is shared by
 * every test class that extends this.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public abstract class ApiTest {

	private static final PostgreSQLContainer<?> POSTGRES =
			new PostgreSQLContainer<>("postgres:18-alpine");

	private static final WireMockServer UPSTREAM =
			new WireMockServer(wireMockConfig().dynamicPort());

	static {
		POSTGRES.start();
		UPSTREAM.start();
	}

	@DynamicPropertySource
	static void properties(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
		registry.add("spring.datasource.username", POSTGRES::getUsername);
		registry.add("spring.datasource.password", POSTGRES::getPassword);
		registry.add("pillfacts.upstream.rxnorm.base-url", UPSTREAM::baseUrl);
		registry.add("pillfacts.upstream.openfda.base-url", UPSTREAM::baseUrl);
	}

	@LocalServerPort
	private int port;

	/** Stub responses for RxNorm and openFDA. Every upstream call in a test goes here. */
	protected static final WireMockServer upstream = UPSTREAM;

	@BeforeEach
	void resetUpstream() {
		UPSTREAM.resetAll();
	}

	@AfterAll
	static void stopUpstream() {
		UPSTREAM.stop();
	}

	/** A client pointed at the running application. */
	protected RestTestClient api() {
		return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
	}
}
