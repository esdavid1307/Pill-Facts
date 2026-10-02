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
 * one address left running all day makes 8,640 requests, and even uncached, at up to
 * four FDA calls each, that is under a third of the day's quota. A handful of addresses
 * together could still spend it. This stops one visitor with a script, which is what it
 * is for, and not a distributed one.
 *
 * <p>Everyone behind one address — a campus, an office, a carrier's NAT — shares one
 * allowance. The burst is sized with that in mind, and is configurable for the day it
 * turns out too small.
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
