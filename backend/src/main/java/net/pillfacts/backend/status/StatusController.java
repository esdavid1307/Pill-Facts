package net.pillfacts.backend.status;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class StatusController {

	private final ServiceStatusRepository repository;

	StatusController(ServiceStatusRepository repository) {
		this.repository = repository;
	}

	@GetMapping("/api/status")
	ServiceStatus status() {
		return repository.current();
	}
}
