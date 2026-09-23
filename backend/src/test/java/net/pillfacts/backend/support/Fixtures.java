package net.pillfacts.backend.support;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;

import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

/** The recorded upstream responses the stubs answer from. */
final class Fixtures {

	private static final String ROOT = "classpath*:fixtures/";

	private Fixtures() {
	}

	/**
	 * Every fixture in one directory. An empty directory is a failure rather than an
	 * empty run: it means the recorder has not been run, and every test that needed
	 * those fixtures would otherwise fail one by one and obscurely.
	 */
	static Resource[] in(String directory) {
		try {
			Resource[] found = new PathMatchingResourcePatternResolver()
					.getResources(ROOT + directory + "/*.json");
			if (found.length == 0) {
				throw new IllegalStateException("No fixtures found in " + directory
						+ ". Run the recorders in backend/tools.");
			}
			return found;
		}
		catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
	}

	/** A fixture's filename without its extension, which is what it was recorded for. */
	static String stem(Resource fixture) {
		String name = fixture.getFilename();
		return name.substring(0, name.length() - ".json".length());
	}

	static String read(Resource fixture) {
		try (var in = fixture.getInputStream()) {
			return new String(in.readAllBytes(), StandardCharsets.UTF_8);
		}
		catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
	}
}
