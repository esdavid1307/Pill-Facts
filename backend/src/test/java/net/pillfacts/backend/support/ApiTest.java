package net.pillfacts.backend.support;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import com.github.tomakehurst.wiremock.verification.LoggedRequest;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
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
 * <p>Two assertions also look past a response, each because what it is about has no
 * response to show it in. The FDA API key travels on the requests the application makes
 * rather than the ones it answers, so {@link #openFdaRequests()} is how a test sees it
 * sent; and an application started without one says so in its startup log, which is
 * where whoever runs it looks.
 *
 * <p>Postgres and the upstream stubs are all static, so one of each is shared by every
 * test class that extends this. None may be stopped in a per-class {@code @AfterAll}, or
 * the first class to finish leaves them dead for all the rest; they live until the JVM
 * does.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = "pillfacts.openfda.api-key=" + ApiTest.OPENFDA_API_KEY)
public abstract class ApiTest {

	/**
	 * The key the application is configured with, as production's is. A property rather
	 * than part of the dynamic sources below, so a test class can configure itself without
	 * one.
	 */
	protected static final String OPENFDA_API_KEY = "test-openfda-key";

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

	/** Hands each test instance an address no other test has used. */
	private static final AtomicInteger ADDRESSES = new AtomicInteger();

	@LocalServerPort
	private int port;

	/**
	 * The address this test's requests arrive from, as the proxy in front of the backend
	 * would report it.
	 *
	 * <p>The rate limit is per address, and its state outlives any one test because the
	 * application does. Were every test to arrive from the same address, they would spend
	 * one shared allowance and the suite would start being refused part way through. Each
	 * test arrives from an address of its own instead, browsing under the limits
	 * production runs with, and so every test in the suite is also a check that ordinary
	 * browsing is never refused.
	 */
	private final String address = aNewAddress();

	protected String address() {
		return this.address;
	}

	/** An address from the range reserved for benchmarking (RFC 2544), never a real visitor's. */
	protected static String aNewAddress() {
		int n = ADDRESSES.incrementAndGet();
		return "198.18.%d.%d".formatted(n / 250, n % 250 + 1);
	}

	@Autowired
	private JdbcClient jdbc;

	/** A client pointed at the running application, from this test's address. */
	protected RestTestClient api() {
		return apiForwardedFor(this.address);
	}

	/**
	 * A client pointed at the running application, arriving through the proxy with this
	 * {@code X-Forwarded-For}. The proxy appends the address it saw to whatever the client
	 * sent, so the last entry is the client's address and anything before it is the
	 * client's own claim.
	 */
	protected RestTestClient apiForwardedFor(String forwardedFor) {
		return RestTestClient.bindToServer()
				.baseUrl("http://localhost:" + port)
				.defaultHeader("X-Forwarded-For", forwardedFor)
				.build();
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

	/** The requests that have reached openFDA since {@link #forgetUpstreamRequests()}. */
	protected List<LoggedRequest> openFdaRequests() {
		return OPENFDA.requestsReceived();
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
