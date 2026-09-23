package net.pillfacts.backend.openfda;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * One FDA Label, carrying only what Pill-Facts may render of it.
 *
 * <p>The sections are an allowlist applied where the Label is read, which is why
 * {@code dosage_and_administration} has no representation here at all: nothing
 * downstream can render what was never read (ADR-0007).
 *
 * @param setId the FDA's identifier for the Label across its versions
 * @param name the Brand this Label is published under, falling back to its generic name
 * @param manufacturer who published it
 * @param applicationNumber the FDA application it was approved under, {@code NDA…} for a
 * brand Label and {@code ANDA…} for a generic one
 * @param effectiveDate the date this version of the Label took effect
 * @param activeIngredients every substance in the product the Label describes
 * @param sections the Safety Sections present, keyed by their openFDA field name
 * @param strengths the strengths the drug is made in, absent where the Label omits them
 */
public record Label(
		String setId,
		String name,
		String manufacturer,
		String applicationNumber,
		LocalDate effectiveDate,
		List<String> activeIngredients,
		Map<String, String> sections,
		String strengths) {

	private static final String BRAND_APPLICATION = "NDA";

	/**
	 * Where a reader can go to see this Label whole. DailyMed publishes every version of
	 * a set id, so the link outlives the version this Label is.
	 */
	public String url() {
		return "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=" + this.setId;
	}

	/**
	 * Whether this Label was approved under a new drug application, which is what makes
	 * it the brand Label ADR-0010 prefers.
	 */
	public boolean isBrandLabel() {
		return this.applicationNumber != null && this.applicationNumber.startsWith(BRAND_APPLICATION);
	}

	/**
	 * Whether this Label describes a single Drug Concept. A Label for a Combination
	 * Product describes several at once and speaks for none of them (ADR-0012).
	 */
	public boolean isForOneDrugConcept() {
		return this.activeIngredients.size() == 1;
	}

	public Optional<String> section(String name) {
		return Optional.ofNullable(this.sections.get(name));
	}
}
