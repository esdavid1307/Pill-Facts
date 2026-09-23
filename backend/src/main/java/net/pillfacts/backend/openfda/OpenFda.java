package net.pillfacts.backend.openfda;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.StreamSupport;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.MissingNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * openFDA, where the Labels come from.
 *
 * <p>Everything about openFDA's shape stops here: the Lucene search expressions, the
 * every-field-is-an-array JSON, the {@code 20240415} dates, the 404 that means "nothing
 * matched" rather than "something broke". Callers get Labels.
 *
 * <p>Labels are found by generic name, never by RxCUI, for the reasons in ADR-0004.
 * That is a text search, so it also matches Labels for Combination Products containing
 * the Active Ingredient — Caduet answers a search for atorvastatin. Those are filtered
 * out here, because a Label describing two Active Ingredients speaks for neither Drug
 * Concept (ADR-0012), and letting one out of this class would put amlodipine's warnings
 * on atorvastatin's page.
 */
@Component
public class OpenFda {

	/**
	 * The Label sections Pill-Facts may read, both Regulatory Classes' worth. Dosing
	 * instructions are absent from this list and stay absent: it is the one place that
	 * guarantees they reach no response (ADR-0007).
	 *
	 * <p>Which of these a page shows, under what heading and in what order, is the
	 * renderers' business — {@code PrescriptionSection} names the prescription five
	 * again and {@code OtcSection} the OTC five, this being a Set precisely because
	 * order is theirs to decide. Those two agreeing with this is what
	 * {@code DrugConceptApiTest} and {@code OtcDrugConceptApiTest} assert when they pin
	 * the headings a Drug Concept comes back with; a field named here and nowhere else
	 * is read and then dropped, and one named there and not here renders as absent.
	 *
	 * <p>This being the union of the two, a Label can carry a field belonging to the
	 * other class's vocabulary — {@code warnings} is an OTC section and also the one an
	 * old pre-PLR Prescription Label still uses, and diphenhydramine's injection Labels
	 * carry both it and {@code contraindications}. Nothing renders it on a prescription
	 * page, because the renderer is chosen by Regulatory Class and names only its own
	 * five. Reading it and dropping it is the allowlist working, not leaking.
	 */
	private static final Set<String> SAFETY_SECTIONS = Set.of(
			"boxed_warning",
			"contraindications",
			"warnings_and_cautions",
			"adverse_reactions",
			"drug_interactions",
			"warnings",
			"do_not_use",
			"ask_doctor",
			"when_using",
			"stop_use");

	/** A property of the pill rather than an instruction to a patient, so kept (ADR-0007). */
	private static final String STRENGTHS = "dosage_forms_and_strengths";

	private static final String BY_CLASS =
			"openfda.generic_name:\"%s\" AND openfda.product_type:\"%s\"";

	private static final String BRAND_ONLY = " AND openfda.application_number:NDA*";

	/**
	 * How many Labels to read per search. A popular Active Ingredient has hundreds, all
	 * but the first useful one discarded; the page only needs to be deep enough to see
	 * past the Combination Products that sort above it.
	 */
	private static final int PAGE_SIZE = 10;

	private static final DateTimeFormatter EFFECTIVE_TIME = DateTimeFormatter.BASIC_ISO_DATE;

	private final RestClient http;

	OpenFda(RestClient.Builder builder, @Value("${pillfacts.openfda.base-url}") String baseUrl) {
		this.http = builder.baseUrl(baseUrl).build();
	}

	/**
	 * The Labels published for a Drug Concept in one Regulatory Class, most recently
	 * updated first.
	 *
	 * <p>A Label openFDA publishes no effective time for is not among them. It cannot be
	 * ranked against the rest, and Provenance is a promise about when as much as about
	 * who, so a Label that cannot say when is one this system cannot attribute.
	 */
	public List<Label> labels(RegulatoryClass regulatoryClass, String activeIngredient) {
		return search(byClass(regulatoryClass, activeIngredient));
	}

	/**
	 * The same, restricted to Labels approved under a new drug application — the brand
	 * Labels ADR-0010 prefers to speak for a Drug Concept.
	 */
	public List<Label> brandLabels(RegulatoryClass regulatoryClass, String activeIngredient) {
		return search(byClass(regulatoryClass, activeIngredient) + BRAND_ONLY);
	}

	private static String byClass(RegulatoryClass regulatoryClass, String activeIngredient) {
		return BY_CLASS.formatted(activeIngredient, regulatoryClass.productType());
	}

	private List<Label> search(String expression) {
		JsonNode results = get(expression).path("results");

		List<Label> labels = new ArrayList<>();
		for (JsonNode result : results) {
			Label label = labelFrom(result);
			if (label.isForOneDrugConcept() && label.effectiveDate() != null) {
				labels.add(label);
			}
		}

		// openFDA sorts by effective time, but says nothing about how it breaks a tie,
		// and repackagers publish several Labels on the same day. Ordering by set id
		// within a date is what makes the Representative Label the same one every time.
		labels.sort(Comparator.comparing(Label::effectiveDate).reversed().thenComparing(Label::setId));
		return List.copyOf(labels);
	}

	private static Label labelFrom(JsonNode result) {
		JsonNode openfda = result.path("openfda");
		Map<String, String> sections = new LinkedHashMap<>();
		for (String section : SAFETY_SECTIONS) {
			text(result, section).ifPresent(body -> sections.put(section, body));
		}
		return new Label(
				result.path("set_id").stringValue(null),
				first(openfda, "brand_name").orElseGet(() -> first(openfda, "generic_name").orElse(null)),
				first(openfda, "manufacturer_name").orElse(null),
				first(openfda, "application_number").orElse(null),
				effectiveDate(result),
				strings(openfda.path("substance_name")),
				Map.copyOf(sections),
				text(result, STRENGTHS).orElse(null));
	}

	/**
	 * One section's prose. openFDA splits a section into several strings where the SPL
	 * did, so they are rejoined as the paragraphs they were.
	 */
	private static Optional<String> text(JsonNode result, String section) {
		List<String> paragraphs = strings(result.path(section));
		return paragraphs.isEmpty()
				? Optional.empty()
				: Optional.of(String.join("\n\n", paragraphs));
	}

	private static LocalDate effectiveDate(JsonNode result) {
		String effectiveTime = result.path("effective_time").stringValue(null);
		if (effectiveTime == null) {
			return null;
		}
		try {
			return LocalDate.parse(effectiveTime, EFFECTIVE_TIME);
		}
		catch (DateTimeParseException ex) {
			// An undated Label cannot be ranked against the others, so it is not one we
			// can choose; search() drops it.
			return null;
		}
	}

	private static Optional<String> first(JsonNode node, String field) {
		return strings(node.path(field)).stream().findFirst();
	}

	private static List<String> strings(JsonNode array) {
		return StreamSupport.stream(array.spliterator(), false)
				.map(element -> element.stringValue(null))
				.filter(value -> value != null && !value.isBlank())
				.toList();
	}

	private JsonNode get(String expression) {
		JsonNode body = this.http.get()
				.uri(uri -> uri.path("/drug/label.json")
						.queryParam("search", expression)
						.queryParam("sort", "effective_time:desc")
						.queryParam("limit", PAGE_SIZE)
						.build())
				.retrieve()
				// openFDA answers a search that matched nothing with 404. That is an
				// answer — this Drug Concept is Unlabelled — and not a failure. Every
				// other status still throws, so an outage stays distinguishable.
				.onStatus(status -> status.value() == 404, (request, response) -> { })
				.body(JsonNode.class);
		return (body == null) ? MissingNode.getInstance() : body;
	}
}
