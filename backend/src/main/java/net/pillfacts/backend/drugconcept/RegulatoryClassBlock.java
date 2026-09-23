package net.pillfacts.backend.drugconcept;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import net.pillfacts.backend.openfda.RegulatoryClass;

/**
 * The part of a Drug Concept page spoken by one Representative Label.
 *
 * <p>A Drug Concept may have one block for each Regulatory Class in which the FDA
 * publishes a Label. Keeping the class beside its rendered fields lets a caller show
 * every block without mistaking prescription labelling for the Drug Facts panel
 * (ADR-0010).
 *
 * @param regulatoryClass the class of the Representative Label
 * @param provenance the source Label for claims carried directly by the block
 * @param strengths the strengths that Label states, absent where it states none
 * @param sections that Label's Safety Sections, in render order
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RegulatoryClassBlock(
		RegulatoryClass regulatoryClass,
		Provenance provenance,
		String strengths,
		List<SafetySection> sections) {}
