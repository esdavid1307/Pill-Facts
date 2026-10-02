/**
 * Thrown where the backend refused a request because this reader has made too many
 * recently. That is a fact about how often they asked, not about the drug and not an
 * outage, so it is never worded as either.
 */
export class TooManyRequests extends Error {
  /** How long the backend asked the reader to wait, where it said. */
  readonly retryAfterSeconds?: number

  constructor(retryAfterSeconds?: number) {
    super('The backend refused too many requests')
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/** Throws TooManyRequests where the backend answered 429, and does nothing otherwise. */
export function refuseIfTooMany(response: Response) {
  if (response.status !== 429) {
    return
  }
  const seconds = Number.parseInt(response.headers.get('Retry-After') ?? '', 10)
  throw new TooManyRequests(Number.isFinite(seconds) && seconds > 0 ? seconds : undefined)
}

/** What a page tells a reader the backend has refused. */
export function tooManyRequestsMessage(error: TooManyRequests): string {
  const when =
    error.retryAfterSeconds === undefined
      ? 'in a minute'
      : `in ${error.retryAfterSeconds} second${error.retryAfterSeconds === 1 ? '' : 's'}`
  return `There have been a lot of requests from your connection in a short time, so Pill-Facts is pausing them. Please try again ${when}.`
}
