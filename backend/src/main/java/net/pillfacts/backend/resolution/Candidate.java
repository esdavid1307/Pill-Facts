package net.pillfacts.backend.resolution;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * One Drug Concept a search might have meant: its ingredient-level RxCUI, its Active
 * Ingredient name, and the Brand that matched where the query matched one.
 *
 * <p>An absent Brand is absent from the JSON rather than null, so the frontend renders
 * the Brand it is given and has no absence to interpret.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record Candidate(String rxcui, String name, String brand) {

	Candidate withBrand(String newBrand) {
		return new Candidate(this.rxcui, this.name, newBrand);
	}
}
