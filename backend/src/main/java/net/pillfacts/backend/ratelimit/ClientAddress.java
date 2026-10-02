package net.pillfacts.backend.ratelimit;

import jakarta.servlet.http.HttpServletRequest;

/**
 * The address a request comes from, which is what the rate limit counts by.
 *
 * <p>Every request reaches the backend through exactly one proxy (ADR-0011): nginx in
 * compose, the Pages Function in production. That proxy appends the address it saw to
 * {@code X-Forwarded-For}, so the last entry is the client's. Everything before it arrived
 * from the client and can say anything, which is why it is never read — a script that
 * prepends a fresh address to each request is still one address.
 *
 * <p>That makes the header only as trustworthy as the proxy. A proxy that passes the
 * client's header through untouched, or a backend reachable without one, lets a script
 * pick its own address; the EC2 security group is what rules the second out (ADR-0011).
 *
 * <p>A request with no such header came straight to the backend, as one does in
 * development, and is counted by the address that made it.
 */
final class ClientAddress {

	private ClientAddress() {
	}

	static String of(HttpServletRequest request) {
		String forwardedFor = request.getHeader("X-Forwarded-For");
		if (forwardedFor != null) {
			String last = forwardedFor.substring(forwardedFor.lastIndexOf(',') + 1).strip();
			if (!last.isEmpty()) {
				return last;
			}
		}
		return request.getRemoteAddr();
	}
}
