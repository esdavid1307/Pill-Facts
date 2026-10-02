package net.pillfacts.backend.cache;

/**
 * FDA data cannot currently be retrieved, and no cached payload exists to serve instead.
 * A fact about an outage, never about a drug.
 *
 * <p>A search is answered from RxNorm rather than the FDA, and its outage is this too:
 * to someone looking up their medication, either is the data behind the site being out
 * of reach, and neither is a fact about what they typed.
 *
 * <p>Only the {@link Cache} throws this, and only once it has looked for a stored payload
 * and found none, because a payload of any age is served in preference to it (ADR-0003).
 * That is what keeps Unreachable from ever standing in for an answer the site had.
 */
public class Unreachable extends RuntimeException {

	Unreachable(String key, Throwable cause) {
		super("Nothing cached for " + key + ", and the upstream could not be reached", cause);
	}
}
