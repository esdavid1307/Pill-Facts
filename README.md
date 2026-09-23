# Pill-Facts

[pillfacts.net](https://pillfacts.net)

Pill-Facts answers one question for people in the United States: what are the known side
effects and safety warnings of a medication? It presents FDA-published drug labelling
verbatim, attributed to its source, and authors no medical content of its own.

See [`docs/adr/`](docs/adr) for the decisions behind it.

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
`backend/src/test/resources/fixtures/`, so a test names a search term and nothing else.
Re-record them when an upstream's shape changes, and read the diff before committing it:

```sh
python3 backend/tools/record-rxnorm-fixtures.py
```

```sh
cd backend && ./mvnw verify
```

The frontend has one component-test seam, in jsdom with the backend stubbed at `fetch`.

```sh
cd frontend && npm test
```

CI runs both on every pull request, each only when its own directory changed.

## Configuration

No credential or API key belongs in this repository. The backend reads everything it
needs from the environment:

| Variable                | Default                                      |
| ----------------------- | -------------------------------------------- |
| `PILLFACTS_DB_URL`      | `jdbc:postgresql://localhost:5432/pillfacts` |
| `PILLFACTS_DB_USERNAME` | `pillfacts`                                  |
| `PILLFACTS_DB_PASSWORD` | `pillfacts`                                  |
| `PILLFACTS_RXNORM_BASE_URL` | `https://rxnav.nlm.nih.gov`              |

The defaults describe the local compose stack. Production values are supplied by the
deployment environment.
