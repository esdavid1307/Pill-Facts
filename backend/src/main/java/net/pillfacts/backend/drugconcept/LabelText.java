package net.pillfacts.backend.drugconcept;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Label prose, made readable without being rewritten.
 *
 * <p>ADR-0006 renders Label text verbatim, and limits cleanup to exactly two things: the
 * section numbering the SPL carries in the prose itself, and the cross-references that
 * point at parts of the Label we do not render and so lead nowhere. Nothing here
 * paraphrases, summarises, reorders or abridges; whatever is left is the FDA's own
 * words.
 */
final class LabelText {

	/** {@code "5 WARNINGS AND PRECAUTIONS …"} — the SPL's own number for the section. */
	private static final Pattern LEADING_NUMBER = Pattern.compile("^\\d+(?:\\.\\d+)*\\s+");

	/** {@code "[see Warnings and Precautions (5.1) ]"}, whole. */
	private static final Pattern CROSS_REFERENCE = Pattern.compile("\\[\\s*see\\b[^\\]]*\\]", Pattern.CASE_INSENSITIVE);

	/** A section's number: 1 to 17, the sections an SPL has, each with optional subsections. */
	private static final String NUMBER = "(?:1[0-7]|[1-9])(?:\\.\\d+)*";

	/**
	 * {@code "( 5.2 )"}, {@code "(8.5 , 8.6)"} and {@code "( 7 )"} — a bare pointer at a
	 * numbered section, left behind where the SPL did not spell the reference out.
	 * Restricting the number to a section that can exist is what keeps a quantity in
	 * parentheses from being mistaken for one.
	 */
	private static final Pattern SECTION_REFERENCE =
			Pattern.compile("\\(\\s*" + NUMBER + "(?:\\s*,\\s*" + NUMBER + ")*\\s*\\)");

	private static final Pattern SPACE_BEFORE_PUNCTUATION = Pattern.compile("\\s+(?=[.,;:])");

	private static final Pattern RUN_OF_SPACES = Pattern.compile("[ \\t]{2,}");

	private LabelText() {
	}

	/**
	 * One section's text as it should be read, under the heading it is to be read under.
	 *
	 * <p>The heading is needed because the SPL restates it in the prose: the text of the
	 * contraindications section opens "4 CONTRAINDICATIONS", which under a heading
	 * reading "Contraindications" is the section number written out.
	 */
	static String render(String text, String heading) {
		String rendered = LEADING_NUMBER.matcher(text.strip()).replaceFirst("");
		rendered = withoutLeading(rendered, heading);
		rendered = CROSS_REFERENCE.matcher(rendered).replaceAll("");
		rendered = SECTION_REFERENCE.matcher(rendered).replaceAll("");
		rendered = SPACE_BEFORE_PUNCTUATION.matcher(rendered).replaceAll("");
		return RUN_OF_SPACES.matcher(rendered).replaceAll(" ").strip();
	}

	private static String withoutLeading(String text, String heading) {
		return text.toLowerCase(Locale.ROOT).startsWith(heading.toLowerCase(Locale.ROOT))
				? text.substring(heading.length()).strip()
				: text;
	}
}
