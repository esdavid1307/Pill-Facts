# <img src="frontend/public/favicon.svg" alt="" width="32" height="32"> Pill-Facts

Live at <https://pillfacts.net>.

Pill-Facts looks up a US medication by brand or ingredient name, misspellings included,
and shows what its FDA label says about boxed warnings, side effects and interactions.
It also lists other products that share the same active ingredients. Label text appears
word for word with its source credited, and the site writes no medical content of its own.

I built it as a full-stack portfolio project. The decisions behind it are written up as
Architecture Decision Records in [`docs/adr/`](docs/adr), and the terms the code uses are
defined in [`docs/domain-language.md`](docs/domain-language.md).

## Tech stack

| Layer | Technology |
| ----- | ---------- |
| Frontend | React 19, TypeScript, Vite, React Router, Three.js |
| Backend | Java 21, Spring Boot 4 (Web MVC, JDBC, RestClient) |
| Database | PostgreSQL, with Flyway migrations |
| Data sources | NLM RxNorm API (search), openFDA drug label API (content) |
| Testing | JUnit, Testcontainers, WireMock, Vitest, Testing Library |
| Hosting | AWS EC2 (backend), Neon (Postgres), Cloudflare Pages (frontend and edge proxy) |
| CI/CD | GitHub Actions, GHCR images, AWS SSM Run Command, OIDC (no stored AWS keys) |
| Infrastructure | AWS CloudFormation, Docker Compose for local development |

## Why I chose it

### Spring Boot on Java 21

The backend serves an HTTP API, calls two upstream REST APIs and talks to a SQL database.
Spring Boot handles all three with typed, well-supported libraries, and it's what a lot
of enterprise backends run on.

### RxNorm for search, Postgres as a cache

A drug search could ingest the source datasets every night and build its own full-text
index. The National Library of Medicine already hosts a free fuzzy index that handles
misspellings like "lipitr" and maps brands and ingredients to the same concept, so I use
that instead. Postgres keeps resolved concepts and labels for seven days. If an upstream
API is down, the backend serves the expired copy and the page shows when it was fetched.
See [ADR-0003](docs/adr/0003-rxnorm-is-the-search-index.md).

### No LLM summaries

FDA labels are long and written for clinicians, so summarizing them with an LLM is
tempting. A paraphrase would cite the FDA for words the FDA never wrote, so the site
shows the label text as published. See
[ADR-0006](docs/adr/0006-label-text-is-rendered-verbatim.md).

### React and Vite, with Three.js on the landing page

The frontend is a small single-page app with no server rendering. The 3D pill on the
landing page loads as its own chunk, and browsers without WebGL get a flat drawing.

### Free hosting that still uses AWS

The backend runs on an EC2 t3.micro. Postgres is on Neon instead of the same instance,
because 1 GB of RAM can't comfortably hold a JVM and a database. Supabase pauses idle free
projects, and Render's free tier takes 30 to 50 seconds to wake a Spring app, so I ruled
both out. A billing alarm emails me once charges pass $1, and a weekly job warns me before
the AWS free tier ends. See [ADR-0009](docs/adr/0009-zero-cost-hosting-with-a-known-expiry.md).

### One origin for the app and the API

The frontend always calls `/api` on its own domain. In production a Cloudflare Pages
Function forwards those requests to EC2, so TLS ends at Cloudflare and the EC2 instance
needs no certificate. Vite and nginx do the same job locally. The frontend has no API URL
to configure and the backend sends no CORS headers. See
[ADR-0011](docs/adr/0011-the-frontend-proxies-api-to-the-backend.md).

### Security

The repository and build logs contain no secrets. Credentials live in AWS SSM Parameter
Store and GitHub secrets. CI deploys through a short-lived OIDC role that only `main` can
assume. The EC2 instance has no SSH port and only accepts traffic from Cloudflare's IP
ranges. Search requests are rate-limited per client address.

## Testing

Backend tests call the running application over HTTP, against a real Postgres started
by Testcontainers. WireMock replays recorded RxNorm and openFDA responses, so no test
depends on the live services.

Frontend tests use Vitest and Testing Library. They cover the React components in jsdom
and the Pages Function in Node, with the backend stubbed at `fetch`.

A nightly GitHub Actions job checks the real RxNorm and openFDA APIs, and if a response
changes shape it fails with the name of the field that changed.

Each push to `main` that passes CI builds a Docker image, rolls it out to EC2, deploys
the frontend, and runs a smoke test against the public URL.

## Running it locally

You need Docker.

```sh
docker compose up --build
```

The app runs on <http://localhost:5173> and the API on <http://localhost:8080>. To run
the tests:

```sh
cd backend && ./mvnw verify    # Docker must be running
cd frontend && npm test
```

Without an openFDA API key the backend uses openFDA's unkeyed limit of 1,000 requests a
day, which is enough for local development. To use a
[free key](https://open.fda.gov/apis/authentication/), put it in `.env`, which git ignores:

```sh
echo 'PILLFACTS_OPENFDA_API_KEY=your-key' > .env
```

## Repository layout

| Path        | Contents |
| ----------- | -------- |
| `backend/`  | Spring Boot API, Flyway migrations, fixture recorders |
| `frontend/` | React app and the Cloudflare Pages Function |
| `deploy/`   | CloudFormation template, EC2 rollout and CI deploy scripts |
| `docs/`     | Architecture Decision Records and the domain glossary |
