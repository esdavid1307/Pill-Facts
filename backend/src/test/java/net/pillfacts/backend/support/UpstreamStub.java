package net.pillfacts.backend.support;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.client.WireMock;
import com.github.tomakehurst.wiremock.core.WireMockConfiguration;
import com.github.tomakehurst.wiremock.stubbing.StubMapping;

/**
 * One upstream, served from recorded fixtures instead of the live API.
 *
 * <p>Which paths a stub answers and from which fixtures is each subclass's business.
 * What they have in common is here: each starts on a port of its own, each counts what
 * reaches it, and each can be made Unreachable. The last two are how a cache is tested
 * at all — a cache is invisible except in the calls it stops making, and in what it still
 * serves once the data behind it cannot be retrieved.
 */
abstract class UpstreamStub {

	/**
	 * Higher priority than any fixture, so one outage covers every path at once, and
	 * removable, so it lasts exactly as long as the test that asked for it. WireMock
	 * counts down: 1 beats the 2 the fixtures are registered at.
	 */
	private static final int WHILE_UNREACHABLE = 1;

	protected static final int WHEN_REACHABLE = 2;

	protected final WireMockServer server =
			new WireMockServer(WireMockConfiguration.options().dynamicPort());

	private StubMapping outage;

	final String start() {
		this.server.start();
		stubFixtures();
		return this.server.baseUrl();
	}

	abstract void stubFixtures();

	/** How many requests have reached this upstream since they were last forgotten. */
	final int requests() {
		return this.server.getAllServeEvents().size();
	}

	final void forgetRequests() {
		this.server.resetRequests();
	}

	/** Every path answering as though this upstream's data could not be retrieved. */
	final void becomesUnreachable() {
		if (this.outage == null) {
			this.outage = this.server.stubFor(WireMock.any(WireMock.anyUrl())
					.atPriority(WHILE_UNREACHABLE)
					.willReturn(WireMock.aResponse().withStatus(503)));
		}
	}

	final void becomesReachable() {
		if (this.outage != null) {
			this.server.removeStub(this.outage);
			this.outage = null;
		}
	}
}
