package net.pillfacts.backend.drugconcept;

/**
 * One named division of a Label carrying risk information, ready to render.
 *
 * <p>Provenance is per section rather than per page because a Drug Concept appearing in
 * both Regulatory Classes has a Representative Label for each, and the sections of the
 * two are never merged (ADR-0010).
 *
 * @param heading the FDA's own name for the section
 * @param text the FDA's own words, less the section numbering and the cross-references
 * that lead nowhere (ADR-0006)
 */
public record SafetySection(String heading, String text, Provenance provenance) {}
