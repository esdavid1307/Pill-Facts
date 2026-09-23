package net.pillfacts.backend.resolution;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import net.pillfacts.backend.rxnorm.RxNorm;
import net.pillfacts.backend.rxnorm.RxNormConcept;
import org.springframework.stereotype.Service;

/**
 * Turning what someone typed into Drug Concepts.
 *
 * <p>RxNorm supplies typo-tolerant matching but answers at every level of specificity at
 * once: searching "lipitor" matches the Brand, two dose-form groups, four branded drugs
 * and four branded components. All twelve are the same medication. Resolution walks each
 * match to its Active Ingredient and collapses them onto that ingredient's RxCUI, which
 * is the Drug Concept's identity per ADR-0002, and which is why searching a Brand and
 * searching its Active Ingredient land in the same place.
 *
 * <p>Matches keep RxNorm's ranking, so the best match is the first candidate and a lone
 * candidate is the one the searcher meant.
 */
@Service
class Resolution {

	private final RxNorm rxNorm;

	Resolution(RxNorm rxNorm) {
		this.rxNorm = rxNorm;
	}

	List<Candidate> resolve(String query) {
		// RxNorm rejects an empty term, and there is nothing to ask it about anyway.
		if (query.isBlank()) {
			return List.of();
		}

		List<Candidate> candidates = new ArrayList<>();
		for (String matched : this.rxNorm.approximateMatches(query)) {
			drugConceptOf(matched).ifPresent(ingredient -> merge(candidates, matched, ingredient));
		}
		return candidates;
	}

	/**
	 * The Active Ingredient a match belongs to, where it has exactly one. A match with
	 * several is a Combination Product, which is not a Drug Concept and so is no
	 * candidate for anything (ADR-0012); a match with none is an obsolete concept RxNorm
	 * still returns but no longer relates to an ingredient.
	 */
	private Optional<RxNormConcept> drugConceptOf(String matched) {
		List<RxNormConcept> ingredients = this.rxNorm.activeIngredientsOf(matched);
		return (ingredients.size() == 1) ? Optional.of(ingredients.getFirst()) : Optional.empty();
	}

	/**
	 * Folds one match into the candidates, either as a Drug Concept not seen yet or as
	 * another sighting of one already there. A popular Brand matches a dozen times, and
	 * every sighting after the first that can teach us nothing costs an upstream call we
	 * skip.
	 */
	private void merge(List<Candidate> candidates, String matched, RxNormConcept ingredient) {
		Optional<Candidate> seen = candidates.stream()
				.filter(candidate -> candidate.rxcui().equals(ingredient.rxcui()))
				.findFirst();
		if (seen.isEmpty()) {
			candidates.add(new Candidate(ingredient.rxcui(), ingredient.name(), brandOf(matched)));
		}
		else if (seen.get().brand() == null) {
			candidates.set(candidates.indexOf(seen.get()), seen.get().withBrand(brandOf(matched)));
		}
	}

	/** The name of a match that is itself a Brand, and null for one that isn't. */
	private String brandOf(String matched) {
		return this.rxNorm.concept(matched)
				.filter(RxNormConcept::isBrand)
				.map(RxNormConcept::name)
				.orElse(null);
	}
}
