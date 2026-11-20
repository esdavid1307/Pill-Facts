# <img src="frontend/public/favicon.svg" alt="" width="32" height="32"> Pill-Facts

**Live at <https://pillfacts.net>**

Pill-Facts looks up any US medication by brand or ingredient name, misspellings included,
and shows what its FDA label says: boxed warnings, side effects, interactions, and which
other products share its active ingredients. It shows the FDA's text verbatim, credits
the source, and writes no medical content of its own.

It's a full-stack portfolio project. Every significant decision is written up as an
Architecture Decision Record in [`docs/adr/`](docs/adr), and the shared vocabulary is
in [`docs/domain-language.md`](docs/domain-language.md).

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

## Why this stack

**Spring Boot on Java 21.** It's a mature, typed framework with first-class support for
the three things this backend does: an HTTP API, calls to upstream REST APIs, and a SQL
database. It's also what most enterprise backends run on.

**RxNorm as the search index, Postgres as a cache.** The obvious design is to ingest
drug datasets every night and build a full-text index. The National Library of Medicine
already hosts a fuzzy index that resolves misspellings ("lipitr") and maps brands and
ingredients onto one concept, for free. Rebuilding it would be worse, so Postgres only
caches resolved concepts and labels for seven days. When an upstream is down, the site
serves the cached copy and shows when it was fetched instead of returning an error.
([ADR-0003](docs/adr/0003-rxnorm-is-the-search-index.md))

**No LLM summaries.** FDA label text is long and clinical, so summarizing it is the
obvious "improvement". The site doesn't, because a paraphrase would cite the FDA for
words the FDA never wrote. ([ADR-0006](docs/adr/0006-label-text-is-rendered-verbatim.md))

**React with Vite, plus Three.js on the landing page.** It's a small single-page app
with no server rendering to manage. The 3D pill loads as a separate chunk and falls
back to a flat drawing when WebGL isn't available.

**Zero-cost hosting that still uses AWS.** The backend runs on an EC2 t3.micro. Postgres
runs on Neon rather than on the same instance, because 1 GB of RAM won't fit a JVM and a
database. Neon was picked over Supabase because Supabase pauses idle free projects, and
Render because its free tier takes 30–50 seconds to wake a Spring app. A $1 billing
alarm and a weekly free-tier expiry check guard against surprise charges.
([ADR-0009](docs/adr/0009-zero-cost-hosting-with-a-known-expiry.md))

**One origin, no CORS.** The frontend always calls `/api` on its own domain. In
production, a Cloudflare Pages Function proxies that path to EC2, so TLS ends at
Cloudflare and the EC2 instance needs no certificate. Locally, Vite and nginx do the same.
The frontend never needs an API URL configured.
([ADR-0011](docs/adr/0011-the-frontend-proxies-api-to-the-backend.md))

**Security by default.** No secret is in the repository or a build log. Credentials
live in AWS SSM Parameter Store and GitHub secrets. CI deploys through a short-lived OIDC
role that only `main` can assume. EC2 has no SSH port and accepts traffic only from
Cloudflare's IP ranges. Search is rate-limited per client address.

## Testing

- **Backend:** Every test drives the running application through its HTTP API, against
  a real Postgres in Testcontainers. WireMock replays recorded RxNorm and openFDA
  responses, so no test calls the live services.
- **Frontend:** Vitest and Testing Library test the components in jsdom and the edge
  proxy in Node, with the backend stubbed at `fetch`.
- **Upstream contracts:** A nightly GitHub Actions job checks the real RxNorm and
  openFDA APIs. If a response changes shape, it fails and names the field that changed.
- **Deploys:** Every push to `main` that passes CI builds an image, rolls it out to EC2,
  deploys the frontend, and runs a smoke test through the public URL.

## Running it locally

Requires Docker.

```sh
docker compose up --build
```

The app is on <http://localhost:5173> and the API on <http://localhost:8080>. Tests:

```sh
cd backend && ./mvnw verify    # Docker must be running
cd frontend && npm test
```

Without an openFDA API key, the backend uses openFDA's unkeyed quota of 1,000 requests
a day, which is enough for local development. To use a
[free key](https://open.fda.gov/apis/authentication/), put it in a gitignored `.env`:

```sh
echo 'PILLFACTS_OPENFDA_API_KEY=your-key' > .env
```

## Repository layout

| Path        | What it is |
| ----------- | ---------- |
| `backend/`  | Spring Boot API, Flyway migrations, fixture recorders |
| `frontend/` | React app and the Cloudflare Pages Function |
| `deploy/`   | CloudFormation template, EC2 rollout, and CI deploy scripts |
| `docs/`     | Architecture Decision Records and the domain glossary |
