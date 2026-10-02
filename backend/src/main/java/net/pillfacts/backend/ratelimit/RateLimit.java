package net.pillfacts.backend.ratelimit;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/**
 * How many requests each reader may make: a burst, then one more per interval.
 *
 * <p>Each reader is a single number, the moment their allowance would be whole again.
 * A request moves it one interval later, and a request that would move it further than
 * the burst allows is refused. That is the generic cell rate algorithm, a token bucket
 * that keeps one timestamp where a bucket keeps a count and a refill time.
 *
 * <p>A reader whose moment has passed has a whole allowance, which is the same as never
 * having been seen, so they are forgotten. That bounds memory by the readers active in
 * the last few minutes rather than by everyone who ever visited.
 */
final class RateLimit {

	private final long interval;

	/** How far ahead of now a reader's moment may run and still be served. */
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
	 * Spends one request of this reader's allowance, or says how long until there is one
	 * to spend.
	 */
	Optional<Duration> refusal(String reader) {
		long now = this.nanoTime.getAsLong();
		sweep(now);

		long[] wait = {0};
		this.wholeAgainAt.compute(reader, (key, previous) -> {
			long from = (previous == null || previous - now < 0) ? now : previous;
			long ahead = from - now;
			if (ahead > this.tolerance) {
				wait[0] = ahead - this.tolerance;
				return previous;
			}
			return from + this.interval;
		});
		return (wait[0] > 0) ? Optional.of(Duration.ofNanos(wait[0])) : Optional.empty();
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
