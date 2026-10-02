package net.pillfacts.backend.ratelimit;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/**
 * How many requests each address may make: a burst, then one more per interval.
 *
 * <p>Each address is a single number, the moment its allowance would be whole again.
 * A request moves it one interval later, and a request that would move it further than
 * the burst allows is refused. That is the generic cell rate algorithm, a token bucket
 * that keeps one timestamp where a bucket keeps a count and a refill time.
 *
 * <p>An address whose moment has passed has a whole allowance, which is the same as never
 * having been seen, so it is forgotten. That bounds memory by the addresses active in
 * the last few minutes rather than by everyone who ever visited.
 */
final class RateLimit {

	private final long interval;

	/** How far ahead of now an address's moment may run and still be served. */
	private final long tolerance;

	private final LongSupplier nanoTime;

	private final Map<String, Long> wholeAgainAt = new ConcurrentHashMap<>();

	private volatile long lastSweep;

	RateLimit(int burst, Duration interval, LongSupplier nanoTime) {
		if (burst < 1) {
			throw new IllegalArgumentException("A burst of " + burst + " serves nobody");
		}
		this.interval = interval.toNanos();
		this.tolerance = (burst - 1) * this.interval;
		this.nanoTime = nanoTime;
		this.lastSweep = nanoTime.getAsLong();
	}

	/**
	 * Spends one request of this address's allowance, or says how long until there is
	 * one to spend.
	 */
	Optional<Duration> refusal(String address) {
		long now = this.nanoTime.getAsLong();
		sweep(now);

		// compute() is what makes the read and the write one step per address; the array
		// is only how the lambda hands back the wait it found.
		long[] refusedFor = {0};
		this.wholeAgainAt.compute(address, (key, previous) -> {
			long from = (previous == null || previous - now < 0) ? now : previous;
			long ahead = from - now;
			if (ahead > this.tolerance) {
				refusedFor[0] = ahead - this.tolerance;
				return previous;
			}
			return from + this.interval;
		});
		return (refusedFor[0] > 0) ? Optional.of(Duration.ofNanos(refusedFor[0])) : Optional.empty();
	}

	private void sweep(long now) {
		long longestRun = this.tolerance + this.interval;
		if (now - this.lastSweep < longestRun) {
			return;
		}
		this.lastSweep = now;
		this.wholeAgainAt.values().removeIf(moment -> moment - now <= 0);
	}
}
