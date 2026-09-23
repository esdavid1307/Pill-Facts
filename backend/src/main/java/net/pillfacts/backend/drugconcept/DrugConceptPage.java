package net.pillfacts.backend.drugconcept;

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
 * @param strengths the strengths the drug is made in, absent where the Label omits them
 * @param sections its Safety Sections, in render order
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record DrugConceptPage(String rxcui, String name, String strengths, List<SafetySection> sections) {}
