package net.pillfacts.backend.cache;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Unreachable as every endpoint answers it: 503, titled with the domain's own word, so
 * the frontend can tell an outage from No match and from Unlabelled by the response
 * alone. Both of those are successful answers; this is the only one of the three that is
 * not, because it is the only one that is not a fact about what was asked.
 */
@RestControllerAdvice
class UnreachableResponse {

	@ExceptionHandler(Unreachable.class)
	ProblemDetail unreachable() {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
				"What this request needs cannot be retrieved just now, and nothing is cached for it.");
		problem.setTitle("Unreachable");
		return problem;
	}
}
