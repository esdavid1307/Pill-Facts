package net.pillfacts.backend.drugconcept;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
class DrugConceptController {

	private final Labelling labelling;

	DrugConceptController(Labelling labelling) {
		this.labelling = labelling;
	}

	@GetMapping("/api/drug-concepts/{rxcui}")
	DrugConceptPage page(@PathVariable String rxcui) {
		return this.labelling.page(rxcui)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
	}
}
