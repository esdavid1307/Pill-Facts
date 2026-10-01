package net.pillfacts.backend.resolution;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import net.pillfacts.backend.cache.Cache;
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
 * <p>Matches keep RxNorm's ranking, so the best match is the first candidate. A lone
 * candidate is the one the searcher meant only where no Combination Product was dropped;
 * the result keeps dropped products alongside the candidates so the frontend can make
 * that distinction visible.
 *
 * <p>Walking a dozen matches to their ingredients costs a dozen RxNorm calls, and the
 * queries people type repeat, so a resolution is remembered for a week (ADR-0003). It is
 * remembered under the query less its case and the spaces around it, since neither
 * changes what RxNorm answers; the upstream still sees what was typed. A query that
 * matched nothing is remembered too — that is RxNorm's answer about a word, and it will
 * be the same answer next week.
 *
 * <p>What comes back carries a Fetched Date, and nothing is done with it: a Candidate is
 * a name and an RxCUI, and carries no claim for a date to qualify. Fetched Date belongs
 * to a Label, and it is a Drug Concept's page that shows one.
 */
@Service
class Resolution {

	/**
	 * What a cached resolution's key says it is, keeping it clear of the pages.
	 *
	 * <p>The version counts the payload's shape. A row written before Resolution reported
	 * dropped Combination Products has no such field, and Jackson fills a record
	 * component the JSON does not mention with null rather than refusing it, so the row
	 * would read back as a search that dropped nothing — and the searches that did drop
	 * something are precisely the ones this work exists to stop mishandling. Rather than
	 * serve that for a week after a deploy, the old rows are never read; they expire
	 * where they lie.
	 */
	private static final String RESOLUTION = "resolution:v2:";

	private final Cache cache;

	private final RxNorm rxNorm;

	Resolution(Cache cache, RxNorm rxNorm) {
		this.cache = cache;
		this.rxNorm = rxNorm;
	}

	SearchResults resolve(String query) {
		// RxNorm rejects an empty term, and there is nothing to ask it about anyway.
		if (query.isBlank()) {
			return nothing();
		}

		String key = RESOLUTION + query.strip().toLowerCase(Locale.ROOT);
		return this.cache
				.servedFrom(key, SearchResults.class, () -> Optional.of(walk(query)))
				.map(Cache.Fetched::payload)
				.orElseGet(Resolution::nothing);
	}

	/**
	 * Every match RxNorm offers, collapsed onto the Drug Concepts they belong to, beside
	 * the Combination Products that could not become one.
	 */
	private SearchResults walk(String query) {
		List<Candidate> candidates = new ArrayList<>();
		DroppedCombinationProducts dropped = new DroppedCombinationProducts();
		for (String matched : this.rxNorm.approximateMatches(query)) {
			List<RxNormConcept> ingredients = this.rxNorm.activeIngredientsOf(matched);
			if (ingredients.size() == 1) {
				merge(candidates, matched, ingredients.getFirst());
			}
			/*
			 * Several ingredients make a Combination Product, which is not a Drug Concept
			 * and so is no candidate for anything (ADR-0012) — but it is what the reader
			 * asked about, so it is kept and named rather than discarded. Asking the
			 * collector before naming is what skips the upstream call for the seven
			 * further sightings of one Brand, the same economy merge makes below.
			 */
			else if (ingredients.size() > 1 && !dropped.alreadyHas(ingredients)) {
				dropped.add(nameOf(matched, ingredients), ingredients);
			}
			// A match with no ingredients at all is an obsolete concept RxNorm still
			// returns but no longer relates to one, and there is nothing to say about it.
		}
		return new SearchResults(candidates, dropped.describedAgainst(candidates));
	}

	/** A search that found nothing, which is still an answer and still worth caching. */
	private static SearchResults nothing() {
		return new SearchResults(List.of(), List.of());
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

	/**
	 * What to call a dropped Combination Product. RxNorm's own name for the match is the
	 * one a reader is likeliest to recognise as what they typed, but obsolete and
	 * suppressed concepts publish no properties at all; naming one of those by its Active
	 * Ingredients still beats dropping it in silence, which is the whole failure being
	 * fixed here. The separator is RxNorm's own, which is where the reader has seen one
	 * before.
	 */
	private String nameOf(String matched, List<RxNormConcept> ingredients) {
		return this.rxNorm.concept(matched)
				.map(RxNormConcept::name)
				.orElseGet(() -> ingredients.stream()
						.map(RxNormConcept::name)
						.collect(Collectors.joining(" / ")));
	}

	/** The name of a match that is itself a Brand, and null for one that isn't. */
	private String brandOf(String matched) {
		return this.rxNorm.concept(matched)
				.filter(RxNormConcept::isBrand)
				.map(RxNormConcept::name)
				.orElse(null);
	}

	/**
	 * The Combination Products one search had to drop, gathered one per combination of
	 * Active Ingredients.
	 *
	 * <p>The combination, not the product, is the identity. One Brand occupies the
	 * approximate results many times over: "tylenol pm" matches the Brand itself, three
	 * branded dose-form groups and four packaged products. What Pill-Facts has no page for
	 * is the combination, and that reads identically for every sighting of it, so one
	 * record says everything there is to say. The first sighting supplies the name,
	 * RxNorm having ranked it best.
	 *
	 * <p>Two genuinely different products sharing a combination therefore produce one
	 * record, under the better-ranked name. The reader is told the combination and every
	 * ingredient in it either way; what is lost is the second product's name. The identity
	 * is a set rather than a list so that two sightings ordering the same ingredients
	 * differently cannot report the combination twice.
	 */
	private static final class DroppedCombinationProducts {

		private final List<Sighting> sightings = new ArrayList<>();

		private final Set<Set<String>> combinations = new HashSet<>();

		/** One dropped Combination Product, before the candidates are known. */
		private record Sighting(String name, List<RxNormConcept> activeIngredients) {
		}

		boolean alreadyHas(List<RxNormConcept> ingredients) {
			return this.combinations.contains(combinationOf(ingredients));
		}

		void add(String name, List<RxNormConcept> ingredients) {
			this.sightings.add(new Sighting(name, List.copyOf(ingredients)));
			this.combinations.add(combinationOf(ingredients));
		}

		/**
		 * The records to publish, each knowing which of its Active Ingredients the
		 * candidates leave the reader nothing for. That is the part they are missing:
		 * searching "tylenol pm" leaves acetaminophen as a candidate and diphenhydramine
		 * as nothing at all, and diphenhydramine's warnings are the reason the product
		 * differs from plain Tylenol.
		 */
		List<DroppedCombinationProduct> describedAgainst(List<Candidate> candidates) {
			Set<String> offered = candidates.stream().map(Candidate::rxcui).collect(Collectors.toSet());
			return this.sightings.stream().map(sighting -> {
				List<String> all = new ArrayList<>();
				List<String> withNoCandidate = new ArrayList<>();
				for (RxNormConcept ingredient : sighting.activeIngredients()) {
					all.add(ingredient.name());
					if (!offered.contains(ingredient.rxcui())) {
						withNoCandidate.add(ingredient.name());
					}
				}
				return new DroppedCombinationProduct(sighting.name(), all, withNoCandidate);
			}).toList();
		}

		private static Set<String> combinationOf(List<RxNormConcept> ingredients) {
			return ingredients.stream().map(RxNormConcept::rxcui).collect(Collectors.toSet());
		}
	}
}
