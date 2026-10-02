# Pill-Facts


Pill-Facts presents FDA-published drug labelling
verbatim, attributed to its source, and authors no medical content of its own.

See [`docs/domain-language.md`](docs/domain-language.md) for the words it uses, and
[`docs/adr/`](docs/adr) for the decisions behind it.

## Layout

| Path        | What it is                                             |
| ----------- | ------------------------------------------------------ |
| `backend/`  | Spring Boot API, Postgres for caching, Flyway migrations |
| `frontend/` | React single-page app, built with Vite                 |

## Running it

Everything, in one command:

```sh
docker compose up --build
```

The app is then on <http://localhost:5173> and the API on <http://localhost:8080>. If
something else on your machine already holds those ports, override them:

```sh
PILLFACTS_WEB_PORT=15173 PILLFACTS_API_PORT=18080 PILLFACTS_DB_PORT=15432 \
  docker compose up --build
```

### Working on the backend

```sh
docker compose up -d db
cd backend && ./mvnw spring-boot:run
```

### Working on the frontend

Vite proxies `/api` to `http://localhost:8080`, nginx does the same in the built image,
and a Pages Function will do it in production, so the app is same-origin everywhere —
there is no API URL to configure and no CORS anywhere. See
[ADR-0011](docs/adr/0011-the-frontend-proxies-api-to-the-backend.md).

```sh
cd frontend && npm install && npm run dev
```

## Testing

The backend has one test seam: the running application exercised through its HTTP
surface, against a real Postgres from Testcontainers with the upstream APIs stubbed by
WireMock. Tests extend `ApiTest` and assert on the JSON a request returns. **Docker must
be running.**

No test touches a live upstream. WireMock answers from responses recorded under
`backend/src/test/resources/fixtures/`, so a test names a search term or a Drug Concept
and nothing else. Re-record them when an upstream's shape changes, and read the diff
before committing it:

```sh
python3 backend/tools/record-rxnorm-fixtures.py
python3 backend/tools/record-openfda-fixtures.py
```

An FDA Label runs to a quarter of a megabyte, so the openFDA recorder records only the
searches the backend actually issues for the Active Ingredients the tests look up. A
test that needs a new drug adds it to that script's list rather than hand-writing JSON.

```sh
cd backend && ./mvnw verify
```

The frontend has one component-test seam, in jsdom with the backend stubbed at `fetch`.

```sh
cd frontend && npm test
```

CI runs both on every pull request, each only when its own directory changed.

The live upstream contract check is deliberately separate from CI. GitHub Actions runs
it nightly (or manually through `workflow_dispatch`) against RxNorm and openFDA, and its
failure names the upstream and JSON field that changed. Pull requests run only its local
stand-in tests and never call either third party:

```sh
python3 -m unittest backend/tools/test_check_upstream_contracts.py
```

## Configuration

No credential or API key belongs in this repository. The backend reads everything it
needs from the environment:

| Variable                | Default                                      |
| ----------------------- | -------------------------------------------- |
| `PILLFACTS_DB_URL`      | `jdbc:postgresql://localhost:5432/pillfacts` |
| `PILLFACTS_DB_USERNAME` | `pillfacts`                                  |
| `PILLFACTS_DB_PASSWORD` | `pillfacts`                                  |
| `PILLFACTS_RXNORM_BASE_URL` | `https://rxnav.nlm.nih.gov`              |
| `PILLFACTS_OPENFDA_BASE_URL` | `https://api.fda.gov`                   |
| `PILLFACTS_OPENFDA_API_KEY` | none                                     |
| `PILLFACTS_RATE_LIMIT_BURST` | `60`                                    |
| `PILLFACTS_RATE_LIMIT_INTERVAL` | `10s`                                |

The defaults describe the local compose stack. Production values are supplied by the
deployment environment.

Without `PILLFACTS_OPENFDA_API_KEY` the backend starts anyway and says so in its log,
running on openFDA's unkeyed quota of 1,000 requests a day. That is fine for development
and not for a public site. [Request a key](https://open.fda.gov/apis/authentication/) and
put it in a `.env` beside `compose.yaml`, which is gitignored and which compose reads:

```sh
echo 'PILLFACTS_OPENFDA_API_KEY=your-key' > .env
```

Each address gets a burst of 60 requests to `/api/search` and `/api/drug-concepts`,
then one more every 10 seconds. Past that it gets a `429` that says when to try again.
That address is the last one in `X-Forwarded-For`, the one the proxy in front of the
backend appended (ADR-0011). Any proxy that forwards to the backend has to append to
that header itself, or every visitor is counted as one address — or, if it passes the
client's header through, a script picks its own. A backend reachable without the proxy
can be sent any header at all, which is why production's is reachable only through it.
