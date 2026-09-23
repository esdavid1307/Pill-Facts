package net.pillfacts.backend.resolution;

import java.util.ArrayList;
import java.util.List;

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
		List<Candidate> candidates = new ArrayList<>();
		for (String matched : this.rxNorm.approximateMatches(query)) {
			drugConceptOf(matched).ifPresent(ingredient -> record(candidates, matched, ingredient));
		}
		return candidates;
	}

	/**
	 * The Active Ingredient a match belongs to, where it has exactly one. A match with
	 * several is a Combination Product, which is not a Drug Concept and so is no
	 * candidate for anything; a match with none is an obsolete concept RxNorm still
	 * returns but no longer relates to an ingredient.
	 */
	private java.util.Optional<RxNormConcept> drugConceptOf(String matched) {
		List<RxNormConcept> ingredients = this.rxNorm.activeIngredientsOf(matched);
		return (ingredients.size() == 1) ? java.util.Optional.of(ingredients.getFirst()) : java.util.Optional.empty();
	}

	private void record(List<Candidate> candidates, String matched, RxNormConcept ingredient) {
		int seen = indexOf(candidates, ingredient.rxcui());
		if (seen < 0) {
			candidates.add(new Candidate(ingredient.rxcui(), ingredient.name(), brandOf(matched)));
		}
		else if (candidates.get(seen).brand() == null) {
			candidates.set(seen, candidates.get(seen).withBrand(brandOf(matched)));
		}
		// Otherwise this Drug Concept and the Brand that found it are both already known,
		// and asking RxNorm about this match would teach us nothing. A popular Brand
		// matches a dozen times, so this is most of the work a search would otherwise do.
	}

	private static int indexOf(List<Candidate> candidates, String rxcui) {
		for (int i = 0; i < candidates.size(); i++) {
			if (candidates.get(i).rxcui().equals(rxcui)) {
				return i;
			}
		}
		return -1;
	}

	/** The name of a match that is itself a Brand, and null for one that isn't. */
	private String brandOf(String matched) {
		return this.rxNorm.concept(matched)
				.filter(RxNormConcept::isBrand)
				.map(RxNormConcept::name)
				.orElse(null);
	}
}
