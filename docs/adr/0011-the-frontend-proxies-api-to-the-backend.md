# The frontend host proxies /api to the backend; there is never a second origin

The frontend calls `/api` on its own origin. Nothing in the browser knows where the
backend lives, there is no API base URL to configure per environment, and no CORS
header exists anywhere in the system. Compose already works this way — nginx sits in
front of the built assets and proxies `/api` to the backend container.

ADR-0009 puts the frontend on Cloudflare Pages and the backend on an EC2 t3.micro, and
a static host does not proxy anything. So that decision has to be paid for here.

The obvious fix is to give the frontend a configured API URL — `api.pillfacts.net` on
the EC2 box — and turn on CORS. We don't, for two reasons. It puts an environment
switch into the frontend build, which is the thing every same-origin decision above was
buying its way out of. And it forces a TLS certificate onto the EC2 box, because a page
served over HTTPS cannot call an HTTP origin: the browser blocks it as mixed content.
That means certbot, renewal, and an outage the day renewal silently fails, on a box
whose whole purpose is to be free and unattended.

Instead the frontend host proxies, on every host we deploy to:

- **Compose**: nginx, already written.
- **Cloudflare Pages**: a Pages Function at `functions/api/[[path]].ts`, forwarding to
  the EC2 origin. Pages `_redirects` cannot do this — it supports only 301/302/303/307/308
  and explicitly refuses to proxy external domains — so a Function is the only native
  option. It also terminates TLS at Cloudflare and reaches the origin server-side, which
  is what removes the certificate from the EC2 box entirely.

Pages Functions bill as Workers: 100,000 requests a day and 10ms of CPU per invocation
on the free plan. A proxy spends nearly all its wall time awaiting `fetch` rather than
on CPU, so it fits, and ADR-0009's zero-cost constraint survives.

## Consequences

The origin is reachable directly by IP, and the Function is a bypassable front door
rather than a security boundary. The EC2 security group is what actually restricts
access, and it has to, because the rate limiting in #11 lives behind the proxy.

This is now a third place the same-origin rule has to hold, after the Vite dev proxy and
nginx. A deployment that breaks it does not fail loudly — it fails as a 404 on `/api`
in a browser, which no test in this repo can see. The nightly check in #12 is the
natural place to notice.

Migrating off the free tier, which ADR-0009 says is coming, means changing the origin
the Function forwards to and nothing else. That is the point.
