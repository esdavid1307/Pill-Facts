import { afterEach, describe, expect, it, vi } from 'vitest'
import { isUnreachable } from '../src/api/unreachable'
import { forward } from './forward'

/**
 * The Pages Function's test seam: `forward` called with a Request the way Pages hands one
 * over, and the origin stubbed at fetch. Whatever the function sent is read back as a
 * Request, so these cases hold however it chose to build one.
 */
const ORIGIN = 'http://origin.test:8080'

function originAnswers(answer: () => Response | Promise<Response>) {
  const sent: Request[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      sent.push(new Request(input, init))
      return answer()
    }),
  )
  return sent
}

function fromClient(path: string, init: RequestInit = {}) {
  return new Request(`https://pillfacts.test${path}`, init)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('forward', () => {
  it('sends the path and query to the origin, keeping the method and body', async () => {
    const sent = originAnswers(() => new Response('ok'))

    await forward(
      fromClient('/api/search?q=lipitor&page=2', { method: 'POST', body: '{"a":1}' }),
      ORIGIN,
    )

    expect(sent).toHaveLength(1)
    expect(sent[0].url).toBe('http://origin.test:8080/api/search?q=lipitor&page=2')
    expect(sent[0].method).toBe('POST')
    expect(await sent[0].text()).toBe('{"a":1}')
  })

  it('tolerates a trailing slash on the configured origin', async () => {
    const sent = originAnswers(() => new Response('ok'))

    await forward(fromClient('/api/search?q=x'), `${ORIGIN}/`)

    expect(sent[0].url).toBe('http://origin.test:8080/api/search?q=x')
  })

  it("leaves Cloudflare's address for the client as the last X-Forwarded-For entry", async () => {
    const sent = originAnswers(() => new Response('ok'))

    await forward(
      fromClient('/api/search?q=x', {
        headers: { 'CF-Connecting-IP': '203.0.113.7', 'X-Forwarded-For': '198.51.100.1, 10.0.0.1' },
      }),
      ORIGIN,
    )

    const entries = sent[0].headers.get('X-Forwarded-For')!.split(',').map((e) => e.trim())
    expect(entries.at(-1)).toBe('203.0.113.7')
  })

  it("drops the client's X-Forwarded-For when Cloudflare names no address", async () => {
    const sent = originAnswers(() => new Response('ok'))

    await forward(
      fromClient('/api/search?q=x', { headers: { 'X-Forwarded-For': '198.51.100.1' } }),
      ORIGIN,
    )

    expect(sent[0].headers.has('X-Forwarded-For')).toBe(false)
  })

  it('keeps a path the configured origin has of its own', async () => {
    const sent = originAnswers(() => new Response('ok'))

    await forward(fromClient('/api/search?q=x'), `${ORIGIN}/pillfacts`)

    expect(sent[0].url).toBe('http://origin.test:8080/pillfacts/api/search?q=x')
  })

  it("drops the client's Host", async () => {
    const sent = originAnswers(() => new Response('ok'))

    await forward(fromClient('/api/search?q=x', { headers: { Host: 'pillfacts.test' } }), ORIGIN)

    expect(sent[0].headers.has('Host')).toBe(false)
  })

  it('says the client spoke https', async () => {
    const sent = originAnswers(() => new Response('ok'))

    await forward(fromClient('/api/search?q=x'), ORIGIN)

    expect(sent[0].headers.get('X-Forwarded-Proto')).toBe('https')
  })

  it('does not follow redirects', async () => {
    const sent = originAnswers(() => new Response('ok'))

    await forward(fromClient('/api/search?q=x'), ORIGIN)

    expect(sent[0].redirect).toBe('manual')
  })

  it("passes a 429 through with the origin's Retry-After", async () => {
    originAnswers(
      () =>
        new Response('{"status":429}', {
          status: 429,
          headers: { 'Retry-After': '17', 'Content-Type': 'application/problem+json' },
        }),
    )

    const response = await forward(fromClient('/api/search?q=x'), ORIGIN)

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('17')
    expect(response.headers.get('Content-Type')).toBe('application/problem+json')
    expect(await response.text()).toBe('{"status":429}')
  })

  it("passes the origin's 503 Unreachable through so the frontend still reads it as one", async () => {
    originAnswers(
      () =>
        new Response(JSON.stringify({ status: 503, title: 'Unreachable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
    )

    const response = await forward(fromClient('/api/drug-concepts/1'), ORIGIN)

    expect(await isUnreachable(response)).toBe(true)
  })

  it('answers a plain 502 when the origin cannot be reached, which is not Unreachable', async () => {
    originAnswers(() => Promise.reject(new TypeError('fetch failed')))

    const response = await forward(fromClient('/api/drug-concepts/1'), ORIGIN)

    expect(response.status).toBe(502)
    expect(await isUnreachable(response.clone())).toBe(false)
    expect(await response.text()).toBe('')
  })
})
