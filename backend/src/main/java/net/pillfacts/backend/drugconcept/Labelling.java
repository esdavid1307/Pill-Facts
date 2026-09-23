package net.pillfacts.backend.drugconcept;

import java.util.List;
import java.util.Optional;

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
 */
@Service
class Labelling {

	private final RxNorm rxNorm;

	private final OpenFda openFda;

	private final PrescriptionRenderer prescription;

	private final OtcRenderer otc;

	Labelling(RxNorm rxNorm, OpenFda openFda, PrescriptionRenderer prescription, OtcRenderer otc) {
		this.rxNorm = rxNorm;
		this.openFda = openFda;
		this.prescription = prescription;
		this.otc = otc;
	}

	/**
	 * The page for a Drug Concept, or empty where the RxCUI identifies no Drug Concept —
	 * which is a different thing from a Drug Concept the FDA publishes no Label for.
	 */
	Optional<DrugConceptPage> page(String rxcui) {
		return this.rxNorm.concept(rxcui)
				.filter(RxNormConcept::isActiveIngredient)
				.map(this::pageFor);
	}

	/**
	 * Regulatory Class is a property of the Label and not of the Drug Concept, so the
	 * classes are asked in the order ADR-0010 shows them and the first that has a Label
	 * speaks. Ibuprofen is sold in both and gets its Advil box, which is what a visitor
	 * holding one is looking for; a drug sold in one class has only the one answer to
	 * give. Showing both at once, so neither has to be chosen over the other, is #6.
	 */
	private DrugConceptPage pageFor(RxNormConcept drugConcept) {
		for (RegulatoryClass regulatoryClass : RegulatoryClass.values()) {
			Optional<Label> representative = representativeLabel(regulatoryClass, drugConcept.name());
			if (representative.isPresent()) {
				return rendered(drugConcept, regulatoryClass, representative.get());
			}
		}
		return new DrugConceptPage(drugConcept.rxcui(), drugConcept.name(), null, List.of());
	}

	/**
	 * The page one Representative Label makes, through the renderer that knows its
	 * class's vocabulary. Only a Prescription Label states the strengths a drug is made
	 * in; the Drug Facts panel has no section for them, so an OTC page has none (#18).
	 */
	private DrugConceptPage rendered(
			RxNormConcept drugConcept, RegulatoryClass regulatoryClass, Label label) {
		return switch (regulatoryClass) {
			case OVER_THE_COUNTER -> new DrugConceptPage(
					drugConcept.rxcui(), drugConcept.name(), null, this.otc.render(label));
			case PRESCRIPTION -> new DrugConceptPage(
					drugConcept.rxcui(), drugConcept.name(),
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
