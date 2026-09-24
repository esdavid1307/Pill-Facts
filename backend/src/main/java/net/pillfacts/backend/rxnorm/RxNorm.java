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

	/**
	 * What separates one Active Ingredient from the next in a normalised product name,
	 * and the only thing in it that says a product is a Combination Product. A strength
	 * writes its own slash without spaces — {@code 4 MG/ML} — so the two never collide.
	 */
	private static final String BETWEEN_INGREDIENTS = " / ";

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

	/**
	 * Every product RxNorm relates to an Active Ingredient: each strength and dosage form
	 * it is made in, branded and unbranded alike, and the Combination Products it is one
	 * ingredient of. Telling those apart is the caller's business and
	 * {@link RxNormProduct#combinationProduct()} is what it reads.
	 *
	 * <p>The term type is asked for twice rather than as {@code SCD+SBD}: RxNorm rejects
	 * the plus sign once a URL encoder has been near it, and answers a repeated parameter
	 * with both.
	 */
	public List<RxNormProduct> productsOf(String rxcui) {
		JsonNode groups = get(uri -> uri.path("/REST/rxcui/{rxcui}/related.json")
				.queryParam("tty", "SCD", "SBD")
				.build(rxcui))
				.path("relatedGroup")
				.path("conceptGroup");

		// A product appears under its own term type only, but keying by RxCUI costs
		// nothing and keeps the promise that each is here once.
		Map<String, RxNormProduct> products = new LinkedHashMap<>();
		for (JsonNode group : groups) {
			for (JsonNode concept : group.path("conceptProperties")) {
				String productRxcui = concept.path("rxcui").stringValue(null);
				String name = concept.path("name").stringValue(null);
				if (productRxcui != null && name != null) {
					products.putIfAbsent(productRxcui, productFrom(productRxcui, name));
				}
			}
		}
		return List.copyOf(products.values());
	}

	/**
	 * One product, read out of the name RxNorm generated for it. A Brand is the last
	 * bracketed word of the name and belongs to the product rather than to its
	 * composition, so it is lifted out; a name with no brackets is a product sold
	 * without a Brand.
	 */
	private static RxNormProduct productFrom(String rxcui, String name) {
		int bracket = name.lastIndexOf(" [");
		boolean branded = bracket > 0 && name.endsWith("]");
		String composition = branded ? name.substring(0, bracket) : name;
		String brand = branded ? name.substring(bracket + 2, name.length() - 1) : null;
		return new RxNormProduct(rxcui, composition, brand, composition.contains(BETWEEN_INGREDIENTS));
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
