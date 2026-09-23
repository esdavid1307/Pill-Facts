package net.pillfacts.backend.rxnorm;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.MissingNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriBuilder;

/**
 * RxNorm, the hosted index this system searches instead of ingesting one of its own.
 * See ADR-0003.
 *
 * <p>Everything about RxNorm's JSON — the nested groups, the keys that are absent rather
 * than empty, the duplicate rows one concept produces per source vocabulary — stops
 * here. Callers get RxCUIs and concepts.
 */
@Component
public class RxNorm {

	/**
	 * How many matches to ask for. RxNorm returns a row per source vocabulary, so a
	 * single Brand can occupy a dozen of them; this is far fewer concepts than it looks.
	 */
	private static final int MAX_ENTRIES = 20;

	private final RestClient http;

	RxNorm(RestClient.Builder builder, @Value("${pillfacts.rxnorm.base-url}") String baseUrl) {
		this.http = builder.baseUrl(baseUrl).build();
	}

	/**
	 * The RxCUIs of the concepts approximately matching free text, best match first and
	 * each appearing once. This is where typo-tolerance comes from.
	 */
	public List<String> approximateMatches(String term) {
		JsonNode candidates = get(uri -> uri.path("/REST/approximateTerm.json")
				.queryParam("term", term)
				.queryParam("maxEntries", MAX_ENTRIES)
				.build())
				.path("approximateGroup")
				.path("candidate");

		// RxNorm returns a row per source vocabulary, so the same RxCUI repeats.
		Set<String> rxcuis = new LinkedHashSet<>();
		for (JsonNode candidate : candidates) {
			String rxcui = candidate.path("rxcui").stringValue(null);
			if (rxcui != null) {
				rxcuis.add(rxcui);
			}
		}
		return List.copyOf(rxcuis);
	}

	/**
	 * A concept's own properties, or empty where RxNorm publishes none — which is what
	 * obsolete and suppressed concepts return.
	 */
	public Optional<RxNormConcept> concept(String rxcui) {
		JsonNode properties = get(uri -> uri.path("/REST/rxcui/{rxcui}/properties.json").build(rxcui))
				.path("properties");
		return properties.isMissingNode() || properties.isNull()
				? Optional.empty()
				: Optional.of(conceptFrom(properties));
	}

	/**
	 * The Active Ingredients of a concept, each appearing once. An ingredient-level
	 * concept is its own ingredient; a Combination Product has more than one.
	 */
	public List<RxNormConcept> activeIngredientsOf(String rxcui) {
		JsonNode groups = get(uri -> uri.path("/REST/rxcui/{rxcui}/related.json")
				.queryParam("tty", "IN")
				.build(rxcui))
				.path("relatedGroup")
				.path("conceptGroup");

		// One ingredient can appear in several groups, so key them by RxCUI.
		Map<String, RxNormConcept> ingredients = new LinkedHashMap<>();
		for (JsonNode group : groups) {
			for (JsonNode concept : group.path("conceptProperties")) {
				RxNormConcept ingredient = conceptFrom(concept);
				ingredients.putIfAbsent(ingredient.rxcui(), ingredient);
			}
		}
		return List.copyOf(ingredients.values());
	}

	private static RxNormConcept conceptFrom(JsonNode node) {
		return new RxNormConcept(
				node.path("rxcui").stringValue(null),
				node.path("name").stringValue(null),
				node.path("tty").stringValue(null));
	}

	private JsonNode get(Function<UriBuilder, URI> uri) {
		JsonNode body = this.http.get().uri(uri).retrieve().body(JsonNode.class);
		return (body == null) ? MissingNode.getInstance() : body;
	}
}
