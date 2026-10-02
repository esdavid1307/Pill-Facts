/**
 * The backend's answer when the data behind a request cannot currently be retrieved and it
 * has nothing cached to serve instead: a 503 titled with the domain's own word.
 *
 * Read from the response rather than assumed from any failure, because the copy this
 * produces tells the reader the site has nothing saved, and only the backend knows that.
 * A request that never reached it, or that it answered with a fault of its own, is not
 * this and is never worded as it.
 */
export class Unreachable extends Error {}

/** Whether a response is the backend saying Unreachable. */
export async function isUnreachable(response: Response): Promise<boolean> {
  if (response.status !== 503) {
    return false
  }
  try {
    const problem = (await response.json()) as { title?: unknown }
    return problem.title === 'Unreachable'
  } catch {
    // A 503 with no problem body came from something in front of the backend.
    return false
  }
}
