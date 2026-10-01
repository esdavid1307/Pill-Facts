package net.pillfacts.backend.cache;

import java.time.LocalDate;
import java.util.Optional;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * The cache's one table, and the only place the seven days are counted.
 *
 * <p>Postgres owns the clock. Freshness is decided in the query and the Fetched Date is
 * read back out of the row that was written, so there is no second notion of "now" in
 * Java that could disagree with the column every page's Fetched Date comes from.
 */
@Repository
class CachedPayloads {

	/**
	 * How long a payload is worth serving without asking again. Labels change on the
	 * order of months, so a week-old one is still true, and the FDA's unkeyed quota is
	 * small enough that a burst of visitors would exhaust it without this (ADR-0003).
	 */
	private static final int TTL_DAYS = 7;

	private final JdbcClient jdbc;

	CachedPayloads(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** Whatever is stored for a key, expired or not, since an expired payload is still servable. */
	Optional<CachedPayload> find(String key) {
		return this.jdbc.sql("""
				select payload,
				       fetched_at::date as fetched_date,
				       fetched_at > now() - make_interval(days => :ttl) as fresh
				from cached_payload
				where cache_key = :key
				""")
				.param("key", key)
				.param("ttl", TTL_DAYS)
				.query(CachedPayload.class)
				.optional();
	}

	/** Stores a payload as fetched now, and answers the Fetched Date that gives it. */
	LocalDate save(String key, String payload) {
		return this.jdbc.sql("""
				insert into cached_payload (cache_key, payload, fetched_at)
				values (:key, cast(:payload as jsonb), now())
				on conflict (cache_key) do update
				    set payload = excluded.payload, fetched_at = excluded.fetched_at
				returning fetched_at::date
				""")
				.param("key", key)
				.param("payload", payload)
				.query(LocalDate.class)
				.single();
	}
}
