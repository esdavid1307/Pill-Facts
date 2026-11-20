package net.pillfacts.backend.drugconcept;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LabelTextTest {

	@Test
	void strips_the_heading_the_label_restates() {
		assertThat(LabelText.render("Active ingredient (in each tablet) Ibuprofen 200 mg", "Active ingredient"))
				.isEqualTo("(in each tablet) Ibuprofen 200 mg");
	}

	/** A heading that is only the start of a longer word is not a restatement of it. */
	@Test
	void leaves_a_longer_word_that_merely_starts_with_the_heading_whole() {
		assertThat(LabelText.render("Active ingredients (in each caplet) Ibuprofen 200 mg", "Active ingredient"))
				.isEqualTo("Active ingredients (in each caplet) Ibuprofen 200 mg");
	}
}
