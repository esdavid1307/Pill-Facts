package net.pillfacts.backend.status;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class ServiceStatusRepository {

	private final JdbcClient jdbc;

	ServiceStatusRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	ServiceStatus current() {
		String status = jdbc.sql("select status from service_status where id = 1")
				.query(String.class)
				.single();
		return new ServiceStatus(status);
	}
}
