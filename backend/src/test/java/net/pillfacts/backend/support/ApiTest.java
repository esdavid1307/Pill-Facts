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
 * <p>Two arrangements below do touch the database, and neither asserts anything there.
 * The cache is the one piece of behaviour whose inputs are a shared table and the clock,
 * and a test can reach neither through HTTP: it cannot empty a table every other class
 * also writes to, and it cannot wait a week. Both are therefore set up in SQL and then
 * observed through the API like everything else.
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
	 * Runs the body with both upstreams Unreachable on every path, and reachable again
	 * whatever the body does.
	 */
	protected void whileTheUpstreamsAreUnreachable(Runnable body) {
		RXNORM.becomesUnreachable();
		OPENFDA.becomesUnreachable();
		try {
			body.run();
		}
		finally {
			RXNORM.becomesReachable();
			OPENFDA.becomesReachable();
		}
	}

	/**
	 * Empties the cache, so the next request is the first one ever made for what it asks
	 * for. Postgres is shared by every test class and nothing orders them, so a test
	 * about a cold cache has to make itself one.
	 */
	protected void theCacheIsEmpty() {
		this.jdbc.sql("delete from cached_payload").update();
	}

	/**
	 * Ages every cache entry by some days, which is how a test reaches either side of the
	 * TTL. It is measured against {@code now()} in Postgres, so moving the rows back is
	 * the only way to let days pass without waiting them.
	 */
	protected void daysPass(int days) {
		this.jdbc.sql("update cached_payload set fetched_at = fetched_at - make_interval(days => :days)")
				.param("days", days)
				.update();
	}

	/**
	 * Replaces every cached payload with one that fits no shape the application knows, as
	 * a deploy that changes a payload does to every row written before it.
	 */
	protected void theCachedPayloadsStopFittingTheirShape() {
		this.jdbc.sql("update cached_payload set payload = '[\"not a payload\"]'::jsonb").update();
	}

	/**
	 * Puts a payload in the cache under a key of the test's choosing, which is how a test
	 * reaches a row some past deploy would have written. A payload that still parses but
	 * has since grown a field cannot be had by asking this application for one.
	 */
	protected void theCacheHolds(String key, String payload) {
		this.jdbc.sql("""
				insert into cached_payload (cache_key, payload, fetched_at)
				values (:key, cast(:payload as jsonb), now())
				on conflict (cache_key) do update set payload = excluded.payload
				""")
				.param("key", key)
				.param("payload", payload)
				.update();
	}
}
