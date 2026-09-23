package net.pillfacts.backend.drugconcept;

import java.util.List;
import java.util.Optional;

import net.pillfacts.backend.openfda.Label;
import net.pillfacts.backend.openfda.OpenFda;
import net.pillfacts.backend.rxnorm.RxNorm;
import net.pillfacts.backend.rxnorm.RxNormConcept;
import org.springframework.stereotype.Service;

/**
 * Building a Drug Concept's page: identity from RxNorm, words from the FDA.
 *
 * <p>RxNorm turns the ingredient RxCUI back into the Active Ingredient's name, which is
 * what the FDA's Labels are found by (ADR-0004). One of them is then chosen to speak for
 * the Drug Concept in its Regulatory Class (ADR-0010).
 */
@Service
class Labelling {

	private final RxNorm rxNorm;

	private final OpenFda openFda;

	private final PrescriptionRenderer prescription;

	Labelling(RxNorm rxNorm, OpenFda openFda, PrescriptionRenderer prescription) {
		this.rxNorm = rxNorm;
		this.openFda = openFda;
		this.prescription = prescription;
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

	private DrugConceptPage pageFor(RxNormConcept drugConcept) {
		Optional<Label> representative = representativePrescriptionLabel(drugConcept.name());
		return new DrugConceptPage(
				drugConcept.rxcui(),
				drugConcept.name(),
				representative.map(this.prescription::strengths).orElse(null),
				representative.map(this.prescription::render).orElseGet(List::of));
	}

	/**
	 * The Prescription Label that speaks for a Drug Concept: the brand one, falling back
	 * to the most recently updated generic (ADR-0010). Both lists arrive newest first,
	 * so the choice within each is the head of it.
	 */
	private Optional<Label> representativePrescriptionLabel(String activeIngredient) {
		List<Label> brand = this.openFda.brandPrescriptionLabels(activeIngredient);
		return brand.isEmpty()
				? this.openFda.prescriptionLabels(activeIngredient).stream().findFirst()
				: Optional.of(brand.getFirst());
	}
}
