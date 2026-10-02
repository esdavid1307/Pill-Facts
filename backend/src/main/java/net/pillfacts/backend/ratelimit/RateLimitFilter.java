package net.pillfacts.backend.ratelimit;

import java.io.IOException;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import tools.jackson.databind.ObjectMapper;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Refuses an address that has spent its allowance, with a 429 that says so and says when
 * to come back, before the request reaches anything that could call an upstream.
 *
 * <p>The refusal is an RFC 9457 problem, so it reads as what it is — this address asked
 * too often — rather than as the site having failed.
 */
final class RateLimitFilter extends OncePerRequestFilter {

	private final RateLimit limit;

	private final ObjectMapper json;

	RateLimitFilter(RateLimit limit, ObjectMapper json) {
		this.limit = limit;
		this.json = json;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		var refusal = this.limit.refusal(ClientAddress.of(request));
		if (refusal.isPresent()) {
			refuse(response, refusal.get());
			return;
		}
		chain.doFilter(request, response);
	}

	private void refuse(HttpServletResponse response, Duration wait) throws IOException {
		long seconds = Math.max(1, (wait.toMillis() + 999) / 1000);

		Map<String, Object> problem = new LinkedHashMap<>();
		problem.put("type", "about:blank");
		problem.put("title", "Too many requests");
		problem.put("status", HttpStatus.TOO_MANY_REQUESTS.value());
		problem.put("detail", "There have been more requests from this connection than Pill-Facts "
				+ "serves to one in a short time. Please try again in " + seconds + " seconds.");

		response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
		response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(seconds));
		response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
		response.setCharacterEncoding("UTF-8");
		this.json.writeValue(response.getOutputStream(), problem);
	}
}
