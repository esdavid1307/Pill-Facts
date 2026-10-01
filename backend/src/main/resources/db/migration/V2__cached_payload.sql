-- The whole of what Postgres holds for the domain: resolved Drug Concepts and Label
-- payloads, kept for a week (ADR-0003). There is no bulk ingest and no medication store;
-- a reader expecting one finds a cache, deliberately.
--
-- One table rather than one per kind, because the two are kept on identical terms: the
-- key says what a row is for, the payload is the response as it was built, and fetched_at
-- is both the TTL's clock and the Fetched Date the page shows.
create table cached_payload (
    cache_key   text primary key,
    payload     jsonb not null,
    fetched_at  timestamptz not null
);
