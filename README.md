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
| `deploy/`   | AWS CloudFormation and the setup wizards for production |

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
and a Pages Function (`frontend/functions/api/[[path]].ts`) does it in production, so the app is same-origin everywhere —
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

The frontend has two test seams, both with the backend stubbed at `fetch`: the app's
components in jsdom, and the Pages Function's `forward` in node.

```sh
cd frontend && npm test
```

CI runs both on every pull request, each only when its own directory changed. The same
goes for `deploy/`, whose free-tier expiry check, CI rollout and smoke check have tests
of their own:

```sh
python3 -m unittest deploy/test_check_free_tier_expiry.py deploy/test_run_rollout.py \
  deploy/test_smoke_check.py
```

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

The Pages Function reads one variable of its own, `PILLFACTS_ORIGIN`: the backend it
forwards `/api` to, such as `http://ec2-203-0-113-10.compute-1.amazonaws.com`. It has no default and is set in
the Pages project, as a secret, not here.

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

## Deploying

Four wizards set production up, run once each, in this order. Each walks you through the
console steps only a person can take, and is safe to run again:

1. [`deploy/setup-billing.sh`](deploy/setup-billing.sh): billing alerts and the
   free-tier end date
2. [`deploy/setup-backend.sh`](deploy/setup-backend.sh): the database, and the backend
   on EC2
3. [`deploy/setup-ci.sh`](deploy/setup-ci.sh): the backend deployed from CI
4. [`deploy/setup-frontend.sh`](deploy/setup-frontend.sh): the frontend on Cloudflare
   Pages, which makes the site public

No secret is in this repository or in a build log. Each value lives in one place:

| Value | Where it lives | Set by |
| ----- | -------------- | ------ |
| Neon credentials, openFDA key | SSM Parameter Store, under `/pillfacts/` | `setup-backend.sh` |
| `PILLFACTS_FREE_TIER_EXPIRES` | GitHub variable | `setup-billing.sh` |
| `PILLFACTS_AWS_DEPLOY_ROLE`, `PILLFACTS_BACKEND_INSTANCE`, `PILLFACTS_AWS_REGION` | GitHub variables | `setup-ci.sh` |
| `CLOUDFLARE_API_TOKEN` | GitHub secret | `setup-frontend.sh` |
| `CLOUDFLARE_ACCOUNT_ID`, `PILLFACTS_PAGES_PROJECT`, `PILLFACTS_SITE_URL` | GitHub variables | `setup-frontend.sh` |
| `PILLFACTS_ORIGIN` | Secret on the Pages project | `setup-frontend.sh` |

Production follows ADR-0009: the backend on an AWS free tier that ends, so two things
are set up before anything can cost money. Run
[`deploy/setup-billing.sh`](deploy/setup-billing.sh):

```sh
deploy/setup-billing.sh
```

It turns on billing alerts, deploys `deploy/aws.yaml` to us-east-1 with an alarm that
emails you once charges pass $1, fires that alarm once so you see it arrive, and
records the free-tier end date in the repo variable `PILLFACTS_FREE_TIER_EXPIRES` with
a calendar reminder. A weekly workflow then fails, and so emails the repo owner, from
30 days before that date or whenever no date is recorded. Its message names the way
out: move the backend to Koyeb and repoint `PILLFACTS_ORIGIN` at it (ADR-0011).

Then the backend, [`deploy/setup-backend.sh`](deploy/setup-backend.sh):

```sh
deploy/setup-backend.sh
```

It creates the Neon database in us-east-1 and stores its credentials and the openFDA
key in SSM Parameter Store under `/pillfacts/`, the only place they live. Then it adds
the backend to the stack and rolls it out once. The backend is an EC2 t3.micro with an
Elastic IP, no key pair and no port 22, and port 80 open to
[Cloudflare's ranges](https://www.cloudflare.com/ips-v4) and nothing else. You reach it
through SSM: `aws ssm start-session --target <instance>` for a shell. A rollout is
[`deploy/ec2/rollout.sh`](deploy/ec2/rollout.sh) run there through Run Command. It writes
the parameters to a root-only env file, then replaces the container with the JVM, Tomcat
and connection pool sized for 1GB. A stack update can replace the instance when Amazon
Linux publishes a new AMI. The replacement comes up with Docker and nothing else, so the
backend has to be rolled out again.

From then on CI deploys it. Once `.github/workflows/deploy.yml` is on main, run
[`deploy/setup-ci.sh`](deploy/setup-ci.sh):

```sh
deploy/setup-ci.sh
```

It adds a deploy role to the stack that only a workflow on main can assume, through
GitHub's OIDC tokens, so no AWS key exists. It copies the role, instance and region into
the repo variables `PILLFACTS_AWS_DEPLOY_ROLE`, `PILLFACTS_BACKEND_INSTANCE` and
`PILLFACTS_AWS_REGION`, then runs the first deploy and makes the image public. After
that, every commit on main that passes CI is pushed to
`ghcr.io/esdavid1307/pill-facts-backend` as `:<sha>` and `:latest` and rolled out by
[`deploy/run-rollout.py`](deploy/run-rollout.py). It sends `rollout.sh` over Run
Command, waits for it, and prints its output. The workflow fails if the rollout does. To
deploy main again without a new commit, run the Deploy workflow from the Actions tab.
A stack update that replaces the instance changes its ID, so run `deploy/setup-ci.sh`
again afterwards: it updates `PILLFACTS_BACKEND_INSTANCE` and deploys to the new one.

Then the frontend, [`deploy/setup-frontend.sh`](deploy/setup-frontend.sh), once the
Deploy workflow's frontend job is on main:

```sh
deploy/setup-frontend.sh
```

It has you create a Cloudflare API token that can edit Pages and nothing else, then
creates the Pages project, has you put it on <https://pillfacts.net>, and sets its
`PILLFACTS_ORIGIN` to the instance's public DNS name. A Worker can't fetch a bare IP address. It stores the token as a GitHub secret
and the account, project and public URL as variables, runs the first deploy, and checks
that one reader's rate limit doesn't refuse another. From then on the Deploy workflow
deploys the frontend after every backend rollout, with `wrangler pages deploy` from
`frontend/`, so the Pages Function is bundled with the built app. Then
[`deploy/smoke-check.py`](deploy/smoke-check.py) searches through the public URL, and
loads a deep link, which Pages serves `index.html` for. A deploy whose `/api` doesn't
reach the backend fails the workflow, rather than failing in a reader's browser
(ADR-0011). It's already live by then, so deploy a fix, or roll back to the last good
deployment from the Pages project's Deployments tab. wrangler is locked on its own in
`deploy/wrangler/`, so the frontend's `npm ci` doesn't download it. The job is skipped
until the wizard has set `PILLFACTS_PAGES_PROJECT` and `PILLFACTS_SITE_URL`. Moving the
backend off the free tier means changing `PILLFACTS_ORIGIN` and nothing else.

GitHub pauses scheduled workflows in a public repository after 60 days without activity,
and a paused one warns nobody. If the Actions tab says the schedule is disabled, enable
it again; the calendar reminder covers the gap.
