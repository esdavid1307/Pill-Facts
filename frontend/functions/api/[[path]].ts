import { forward } from '../../proxy/forward'

/**
 * Every `/api/*` request on Cloudflare Pages, sent on to the backend named by the Pages
 * environment variable `PILLFACTS_ORIGIN`. See `proxy/forward.ts` and ADR-0011.
 */
export function onRequest(context: { request: Request; env: { PILLFACTS_ORIGIN: string } }) {
  return forward(context.request, context.env.PILLFACTS_ORIGIN)
}
