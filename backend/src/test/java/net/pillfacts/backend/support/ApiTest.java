package net.pillfacts.backend.support;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.simple.JdbcClient;
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

	/** Comfortably past the TTL, and the Fetched Date a stale page is then expected to show. */
	protected static final int DAYS_SINCE_FETCHING = 8;

	private static final PostgreSQLContainer<?> POSTGRES =
			new PostgreSQLContainer<>("postgres:18-alpine");

	private static final RxNormStub RXNORM = new RxNormStub();

	private static final OpenFdaStub OPENFDA = new OpenFdaStub();

	private static final String RXNORM_BASE_URL = RXNORM.start();

	private static final String OPENFDA_BASE_URL = OPENFDA.start();

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

	@Autowired
	private JdbcClient jdbc;

	/** A client pointed at the running application. */
	protected RestTestClient api() {
		return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
	}

	/**
	 * How many requests have reached the upstreams since {@link #forgetUpstreamRequests()}.
	 *
	 * <p>Both are counted together, because what the cache promises is that a repeated
	 * request costs no upstream call at all, and a test that counted only one of them
	 * would pass while the other was still being asked.
	 */
	protected int upstreamRequests() {
		return RXNORM.requests() + OPENFDA.requests();
	}

	protected void forgetUpstreamRequests() {
		RXNORM.forgetRequests();
		OPENFDA.forgetRequests();
	}

	/**
	 * Runs the body with both upstreams answering every path as though they were down,
	 * and brings them back whatever the body does.
	 */
	protected void whileTheUpstreamsAreDown(Runnable body) {
		RXNORM.goesDown();
		OPENFDA.goesDown();
		try {
			body.run();
		}
		finally {
			RXNORM.comesBack();
			OPENFDA.comesBack();
		}
	}

	/**
	 * Empties the cache, so the next request is the first one ever made for what it asks
	 * for. Postgres is shared by every test class, and class order is not guaranteed, so
	 * a test about a cold cache has to make itself one.
	 */
	protected void theCacheIsEmpty() {
		this.jdbc.sql("delete from cached_payload").update();
	}

	/**
	 * Ages every cache entry past its seven-day TTL.
	 *
	 * <p>The one arrangement here that reaches past HTTP, because only the database can
	 * represent a week going by: the TTL is measured against {@code now()} in Postgres,
	 * so moving the rows back is the only way to let a week pass without waiting one. It
	 * asserts nothing, and what it arranges is then observed through the API like
	 * everything else.
	 */
	protected void aWeekPasses() {
		this.jdbc.sql("update cached_payload set fetched_at = fetched_at - make_interval(days => :days)")
				.param("days", DAYS_SINCE_FETCHING)
				.update();
	}
}
