/**
 * What the Pages Function does with a request for `/api/*`: send it on to the backend at
 * `origin` and hand back whatever the backend answered (ADR-0011).
 *
 * It lives outside `functions/` because Pages turns every file there into a route, and a
 * test beside it would become one.
 *
 * The backend counts its rate limit by the last `X-Forwarded-For` entry (`ClientAddress`),
 * so the proxy in front of it, which in production is this one, must put the reader's
 * address there. Cloudflare names it in `CF-Connecting-IP`. Without that header there is
 * no address to trust, and the client's own `X-Forwarded-For` is dropped rather than
 * passed on, so a script cannot pick the address it is counted as. Every such request is
 * then counted together, which fails closed.
 *
 * The backend's answer passes through untouched, so a 429 keeps its `Retry-After` and a
 * 503 Unreachable keeps the problem body the frontend reads it by. A backend that cannot
 * be reached at all is a plain 502 with no body: the frontend never words that as
 * Unreachable, because only the backend knows whether it has anything saved.
 */
export async function forward(request: Request, origin: string): Promise<Response> {
  const incoming = new URL(request.url)
  // Appended rather than resolved, so an origin with a path of its own keeps it.
  const target = origin.replace(/\/$/, '') + incoming.pathname + incoming.search

  const headers = new Headers(request.headers)
  headers.delete('Host')
  const address = request.headers.get('CF-Connecting-IP')
  if (address) {
    const forwardedFor = request.headers.get('X-Forwarded-For')
    headers.set('X-Forwarded-For', forwardedFor ? `${forwardedFor}, ${address}` : address)
  } else {
    headers.delete('X-Forwarded-For')
  }
  headers.set('X-Forwarded-Proto', 'https')

  // The incoming request as init carries its method and body over without restreaming it.
  const outgoing = new Request(new Request(target, request), { headers, redirect: 'manual' })
  try {
    return await fetch(outgoing)
  } catch {
    return new Response(null, { status: 502 })
  }
}
