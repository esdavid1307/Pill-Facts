package net.pillfacts.backend.drugconcept;

import java.util.List;
import java.util.Map;
import java.util.SortedSet;
import java.util.TreeMap;
import java.util.TreeSet;

import net.pillfacts.backend.rxnorm.RxNorm;
import net.pillfacts.backend.rxnorm.RxNormProduct;
import org.springframework.stereotype.Service;

/**
 * What else a Drug Concept's Active Ingredient is sold in, and which of it may be called
 * an Alternative.
 *
 * <p>RxNorm answers one question — every product it relates to this Active Ingredient —
 * and the answer mixes the two things ADR-0005 exists to keep apart. Caduet is
 * amlodipine as well as atorvastatin, and RxNorm lists it under atorvastatin exactly as
 * it lists Lipitor. Sorting the answer is all this does, and it sorts towards safety: a
 * product is an Alternative only where its composition names one Active Ingredient, and
 * everything else is a Combination Product.
 *
 * <p>Products are then grouped by composition, so an Alternative is one strength in one
 * dosage form and the Brands sold in exactly it. A Drug Concept has no strength of its
 * own, which is why the page lists a composition at a time rather than matching one
 * (ADR-0013), and grouping is what keeps two strengths from ever being run together.
 */
@Service
class RelatedProducts {

	/**
	 * The two lists a page shows, which are two lists precisely so that nothing can move
	 * between them.
	 *
	 * @param alternatives products of this Active Ingredient alone, one per strength and
	 * dosage form, or null where RxNorm relates the Drug Concept to none
	 * @param combinationProducts products of this Active Ingredient and at least one
	 * other, or null where there are none
	 */
	record Products(List<Alternative> alternatives, List<CombinationProduct> combinationProducts) {}

	private final RxNorm rxNorm;

	RelatedProducts(RxNorm rxNorm) {
		this.rxNorm = rxNorm;
	}

	Products of(String rxcui) {
		// Sorted by composition, and the Brands within one sorted too, so the page a
		// reader reloads is the page they were reading.
		Map<String, SortedSet<String>> alternatives = new TreeMap<>();
		Map<String, SortedSet<String>> combinationProducts = new TreeMap<>();

		for (RxNormProduct product : this.rxNorm.productsOf(rxcui)) {
			SortedSet<String> brands = (product.combinationProduct() ? combinationProducts : alternatives)
					.computeIfAbsent(product.composition(), composition -> new TreeSet<>());
			if (product.brand() != null) {
				brands.add(product.brand());
			}
		}

		return new Products(alternatives(alternatives), combinationProducts(combinationProducts));
	}

	/**
	 * An empty list is a section with nothing in it, and a page shows nothing rather than
	 * an empty section, so both of these answer null and the field leaves the response.
	 */
	private static List<Alternative> alternatives(Map<String, SortedSet<String>> grouped) {
		return grouped.isEmpty() ? null : grouped.entrySet().stream()
				.map(group -> new Alternative(group.getKey(), List.copyOf(group.getValue())))
				.toList();
	}

	private static List<CombinationProduct> combinationProducts(Map<String, SortedSet<String>> grouped) {
		return grouped.isEmpty() ? null : grouped.entrySet().stream()
				.map(group -> new CombinationProduct(group.getKey(), List.copyOf(group.getValue())))
				.toList();
	}
}
