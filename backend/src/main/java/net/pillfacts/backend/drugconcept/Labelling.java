package net.pillfacts.backend.drugconcept;

import java.util.List;
import java.util.Optional;

import net.pillfacts.backend.cache.Cache;
import net.pillfacts.backend.openfda.Label;
import net.pillfacts.backend.openfda.OpenFda;
import net.pillfacts.backend.openfda.RegulatoryClass;
import net.pillfacts.backend.rxnorm.RxNorm;
import net.pillfacts.backend.rxnorm.RxNormConcept;
import org.springframework.stereotype.Service;

/**
 * Building a Drug Concept's page: identity from RxNorm, words from the FDA.
 *
 * <p>RxNorm turns the ingredient RxCUI back into the Active Ingredient's name, which is
 * what the FDA's Labels are found by (ADR-0004). One of them is then chosen to speak for
 * the Drug Concept in its Regulatory Class (ADR-0010), and rendered by the renderer that
 * knows that class's vocabulary (ADR-0008).
 *
 * <p>RxNorm also says what else that Active Ingredient is sold in, which is where the
 * page's Alternatives and Combination Products come from. That is a claim about
 * composition and not about the labelling, so it is asked of {@link RelatedProducts}
 * whether the FDA publishes a Label or not.
 *
 * <p>A page is built from four upstream searches and two RxNorm walks, so it is built
 * once a week rather than once a request: the whole of it goes through the {@link Cache},
 * which is also what keeps the page up when the FDA is down (ADR-0003).
 */
@Service
class Labelling {

	/** What a cached page's key says it is, keeping it clear of the resolutions. */
	private static final String DRUG_CONCEPT = "drug-concept:";

	private final Cache cache;

	private final RxNorm rxNorm;

	private final OpenFda openFda;

	private final PrescriptionRenderer prescription;

	private final OtcRenderer otc;

	private final RelatedProducts relatedProducts;

	Labelling(Cache cache, RxNorm rxNorm, OpenFda openFda, PrescriptionRenderer prescription,
			OtcRenderer otc, RelatedProducts relatedProducts) {
		this.cache = cache;
		this.rxNorm = rxNorm;
		this.openFda = openFda;
		this.prescription = prescription;
		this.otc = otc;
		this.relatedProducts = relatedProducts;
	}

	/**
	 * The page for a Drug Concept, or empty where the RxCUI identifies no Drug Concept —
	 * which is a different thing from a Drug Concept the FDA publishes no Label for.
	 *
	 * <p>The Fetched Date is stamped on here rather than built in, because it belongs to
	 * the retrieval and not to the page: a page served from a week-old row carries that
	 * row's date and says so.
	 */
	Optional<DrugConceptPage> page(String rxcui) {
		return this.cache.servedFrom(DRUG_CONCEPT + rxcui, DrugConceptPage.class, () -> build(rxcui))
				.map(fetched -> fetched.payload().fetchedOn(fetched.date()));
	}

	private Optional<DrugConceptPage> build(String rxcui) {
		return this.rxNorm.concept(rxcui)
				.filter(RxNormConcept::isActiveIngredient)
				.map(this::pageFor);
	}

	/**
	 * Regulatory Class is a property of the Label and not of the Drug Concept, so every
	 * class with a Representative Label gets its own block. Declaration order puts OTC
	 * first, as ADR-0010 requires.
	 */
	private DrugConceptPage pageFor(RxNormConcept drugConcept) {
		List<RegulatoryClassBlock> blocks = List.of(RegulatoryClass.values()).stream()
				.flatMap(regulatoryClass -> representativeLabel(regulatoryClass, drugConcept.name())
						.map(label -> rendered(regulatoryClass, label))
						.stream())
				.toList();
		RelatedProducts.Products related = this.relatedProducts.of(drugConcept.rxcui());
		// Undated: page() stamps the Fetched Date on from the row this is stored in.
		return new DrugConceptPage(drugConcept.rxcui(), drugConcept.name(), blocks,
				related.alternatives(), related.combinationProducts(), null);
	}

	/**
	 * The page one Representative Label makes, through the renderer that knows its
	 * class's vocabulary. Only a Prescription Label states the strengths a drug is made
	 * in; the Drug Facts panel has no section for them, so an OTC page has none (#18).
	 */
	private RegulatoryClassBlock rendered(RegulatoryClass regulatoryClass, Label label) {
		return switch (regulatoryClass) {
			case OVER_THE_COUNTER -> new RegulatoryClassBlock(
					regulatoryClass, Provenance.from(label), null, this.otc.render(label));
			case PRESCRIPTION -> new RegulatoryClassBlock(
					regulatoryClass, Provenance.from(label),
					this.prescription.strengths(label), this.prescription.render(label));
		};
	}

	/**
	 * The Label that speaks for a Drug Concept in one Regulatory Class: the brand one,
	 * falling back to the most recently updated generic (ADR-0010). Both lists arrive
	 * newest first, so the choice within each is the head of it.
	 */
	private Optional<Label> representativeLabel(RegulatoryClass regulatoryClass, String activeIngredient) {
		List<Label> brand = this.openFda.brandLabels(regulatoryClass, activeIngredient);
		return brand.isEmpty()
				? this.openFda.labels(regulatoryClass, activeIngredient).stream().findFirst()
				: Optional.of(brand.getFirst());
	}
}
