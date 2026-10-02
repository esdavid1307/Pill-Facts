package net.pillfacts.backend.cache;

import java.time.LocalDate;
import java.util.Optional;
import java.util.function.Supplier;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;

/**
 * The week-long memory that lets this site survive both its traffic and its outages
 * (ADR-0003).
 *
 * <p>Those are one purchase rather than two. A Label changes on the order of months, so a
 * week-old copy is still true, and the FDA's unkeyed quota is small enough that a single
 * burst of visitors would exhaust it without a cache. And a copy that is true enough to
 * serve while the upstream is up is true enough to serve while it is down, which is why
 * an expired payload is a fallback here and not an error.
 *
 * <p>What comes back carries the Fetched Date beside the payload, because serving
 * something a week old is only honest if the page can say when it was fetched. That date
 * is the row's, never the payload's, so it cannot drift from the retrieval it describes.
 */
@Service
public class Cache {

	/**
	 * A payload and the date Pill-Facts retrieved it — one fact about a source and one
	 * fact about us, which is why they travel together and stay separate.
	 */
	public record Fetched<T>(T payload, LocalDate date) {}

	private static final Logger logger = LoggerFactory.getLogger(Cache.class);

	private final CachedPayloads payloads;

	private final ObjectMapper json;

	Cache(CachedPayloads payloads, ObjectMapper json) {
		this.payloads = payloads;
		this.json = json;
	}

	/**
	 * What this system has to say for a key, in the order the answers are preferred: an
	 * unexpired payload, which costs no upstream call at all; what the upstream answers,
	 * stored as it goes by; and, where the upstream failed, the expired payload that is
	 * still better than nothing.
	 *
	 * <p>An upstream with no payload to give at all — there is no such thing at this
	 * address — is not stored, because an absent payload has nothing to go stale and the
	 * caller is going to answer 404 either way. An answer that is merely empty is a
	 * payload like any other and is kept; a search that matched nothing matched nothing
	 * last week too. A failure with nothing stored is {@link Unreachable}, because there is
	 * then nothing honest to serve.
	 *
	 * @param key what this payload is for, prefixed by the kind of thing it is so that
	 * the two kinds the cache holds cannot collide
	 * @param type the payload's shape, which is how a stored row is read back
	 * @param fromUpstream what to ask when the cache cannot answer
	 */
	public <T> Optional<Fetched<T>> servedFrom(String key, Class<T> type, Supplier<Optional<T>> fromUpstream) {
		Optional<CachedPayload> stored = this.payloads.find(key);
		Optional<Fetched<T>> cached = stored.flatMap(row -> read(key, row, type));
		if (cached.isPresent() && stored.get().fresh()) {
			return cached;
		}

		Optional<T> fetched;
		try {
			fetched = fromUpstream.get();
		}
		catch (RuntimeException ex) {
			if (cached.isEmpty()) {
				throw unreachableOr(key, ex);
			}
			logger.warn("Upstream failed for {}, so serving the payload fetched on {}: {}",
					key, cached.get().date(), ex.toString());
			return cached;
		}
		return fetched.map(payload ->
				new Fetched<>(payload, this.payloads.save(key, this.json.writeValueAsString(payload))));
	}

	/**
	 * An upstream that could not be reached is Unreachable. Anything else that went wrong
	 * on the way is ours, and is left to fail as itself rather than be worded as an
	 * outage.
	 */
	private static RuntimeException unreachableOr(String key, RuntimeException ex) {
		return (ex instanceof RestClientException) ? new Unreachable(key, ex) : ex;
	}

	/**
	 * A stored row read back into its shape, or empty where it no longer fits one. A
	 * deploy that changes a payload's shape leaves rows behind that were written against
	 * the old one; those are a cache miss, not an error, and the next fetch replaces
	 * them.
	 */
	private <T> Optional<Fetched<T>> read(String key, CachedPayload row, Class<T> type) {
		try {
			return Optional.of(new Fetched<>(this.json.readValue(row.payload(), type), row.fetchedDate()));
		}
		catch (JacksonException ex) {
			logger.warn("Discarding the cached payload for {}, which no longer reads as {}: {}",
					key, type.getSimpleName(), ex.toString());
			return Optional.empty();
		}
	}
}
