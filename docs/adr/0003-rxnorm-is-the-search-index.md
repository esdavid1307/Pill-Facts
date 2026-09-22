# RxNorm is the search index; Postgres is only a cache

The obvious design for a drug search is to ingest the source datasets nightly and build
a full-text index over our own copy. We don't, because RxNorm already publishes a hosted
fuzzy index: `approximateTerm` resolves misspellings ("lipitr", "atorvastatn") and maps
both Brands and Active Ingredients onto the same RxCUI, free and without an API key.
Building a `pg_trgm` index over an ingested corpus would reproduce it worse.

So there is no bulk ingest. Postgres holds resolved concepts and Label payloads with a
seven-day TTL, and nothing else.

## Consequences

The database is smaller than the stack implies, and a reader expecting a medication
store will find a cache. That is deliberate. It also means Resolution depends on NLM
uptime: on failure we serve stale content with its Fetched Date visible rather than
erroring, because a Label that is a few days old is still true.
