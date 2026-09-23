package net.pillfacts.backend.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * The backend's one test seam: the running application exercised through its HTTP
 * surface, against a real Postgres and recorded upstream fixtures.
 *
 * <p>Tests here assert on the JSON a request returns. They do not reach past the HTTP
 * boundary into services or repositories, so any refactor that leaves the API contract
 * intact leaves them passing.
 *
 * <p>Postgres and the upstream stubs are all static, so one of each is shared by every
 * test class that extends this. None may be stopped in a per-class {@code @AfterAll}, or
 * the first class to finish leaves them dead for all the rest; they live until the JVM
 * does.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public abstract class ApiTest {

	private static final PostgreSQLContainer<?> POSTGRES =
			new PostgreSQLContainer<>("postgres:18-alpine");

	private static final String RXNORM_BASE_URL = new RxNormStub().start();

	private static final String OPENFDA_BASE_URL = new OpenFdaStub().start();

	static {
		POSTGRES.start();
	}

	@DynamicPropertySource
	static void properties(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
		registry.add("spring.datasource.username", POSTGRES::getUsername);
		registry.add("spring.datasource.password", POSTGRES::getPassword);
		registry.add("pillfacts.rxnorm.base-url", () -> RXNORM_BASE_URL);
		registry.add("pillfacts.openfda.base-url", () -> OPENFDA_BASE_URL);
	}

	@LocalServerPort
	private int port;

	/** A client pointed at the running application. */
	protected RestTestClient api() {
		return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
	}
}
