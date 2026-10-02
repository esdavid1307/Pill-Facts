package net.pillfacts.backend.ratelimit;

import java.time.Duration;

import tools.jackson.databind.ObjectMapper;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The rate limit, in front of the two endpoints that can cost an upstream call.
 *
 * <p>The FDA allows a keyed caller 240 requests a minute and 120,000 a day, and the site
 * spends that on everyone's behalf. The burst is generous so that someone reading never
 * meets it; the rate after it is what bounds a script. At one request every ten seconds,
 * a single address left running all day cannot spend more than a fraction of the day's
 * quota, even when nothing it asks for is cached.
 */
@Configuration(proxyBeanMethods = false)
class RateLimitConfiguration {

	@Bean
	FilterRegistrationBean<RateLimitFilter> rateLimitFilter(
			@Value("${pillfacts.rate-limit.burst}") int burst,
			@Value("${pillfacts.rate-limit.interval}") Duration interval,
			ObjectMapper json) {
		var registration = new FilterRegistrationBean<>(
				new RateLimitFilter(new RateLimit(burst, interval, System::nanoTime), json));
		registration.addUrlPatterns("/api/search", "/api/drug-concepts/*");
		return registration;
	}
}
