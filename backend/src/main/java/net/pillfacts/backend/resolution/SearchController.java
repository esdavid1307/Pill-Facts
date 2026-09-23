package net.pillfacts.backend.resolution;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
class SearchController {

	private final Resolution resolution;

	SearchController(Resolution resolution) {
		this.resolution = resolution;
	}

	@GetMapping("/api/search")
	SearchResults search(@RequestParam String q) {
		return new SearchResults(this.resolution.resolve(q));
	}
}
