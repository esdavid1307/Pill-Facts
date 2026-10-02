package net.pillfacts.backend.drugconcept;

import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * What {@code GET /api/drug-concepts/{rxcui}} returns: everything a Drug Concept's page
 * renders.
 *
 * <p>The safety rules live in this shape rather than in the renderer, which is what
 * keeps them testable at one seam. Sections are the ones the Representative Label
 * actually carries, in the order they are to be read; a section the Label does not have
 * is simply not in the list, with no null, no empty string and no flag to say so. An
 * absent Boxed Warning is therefore indistinguishable here from any other absent
 * section, which is the point (ADR-0007).
 *
 * @param rxcui the ingredient-level RxCUI identifying the Drug Concept (ADR-0002)
 * @param name its Active Ingredient's name
 * @param labelling one block per Regulatory Class in which the FDA publishes a Label,
 * OTC first. Empty where it publishes none, which is what Unlabelled is: a fact about the
 * drug, answered as a page like any other, and distinct from a block whose Label carries
 * none of the Safety Sections Pill-Facts reads
 * @param alternatives other products of this Active Ingredient alone, absent where there
 * are none
 * @param combinationProducts products of this Active Ingredient and at least one other,
 * which are never Alternatives and are never in that list (ADR-0005)
 * @param fetchedDate the date Pill-Facts last retrieved this from the FDA — a fact about
 * us, and not to be confused with any Provenance's Effective Date, which is a fact about
 * the FDA. A page may be up to a week old, and says so rather than hiding it (ADR-0003).
 * Absent only in the cached copy of a page, where the row carrying it holds the date
 * instead, and {@link #fetchedOn} puts it back on the way out
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record DrugConceptPage(
		String rxcui,
		String name,
		List<RegulatoryClassBlock> labelling,
		List<Alternative> alternatives,
		List<CombinationProduct> combinationProducts,
		LocalDate fetchedDate) {

	/** The same page, dated by the retrieval it actually came from. */
	DrugConceptPage fetchedOn(LocalDate date) {
		return new DrugConceptPage(this.rxcui, this.name, this.labelling, this.alternatives,
				this.combinationProducts, date);
	}
}
