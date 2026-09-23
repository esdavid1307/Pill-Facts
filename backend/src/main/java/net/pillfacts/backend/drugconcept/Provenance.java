package net.pillfacts.backend.drugconcept;

import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Who said this, and when. Carried alongside every rendered claim so a reader can always
 * tell whose words they are reading.
 *
 * <p>A Label that names no manufacturer leaves the field out of the JSON rather than
 * null, so the frontend renders the Provenance it is given and has no absence to
 * interpret.
 *
 * @param labelId the FDA's identifier for the source Label, which is stable across the
 * Label's versions and is what a reader would use to find it anywhere else
 * @param label the Label the words come from, named as it is published
 * @param manufacturer who published it
 * @param effectiveDate the date that version of the Label took effect — a fact about the
 * FDA, and not to be confused with the date Pill-Facts fetched it
 * @param url where the Label can be read whole
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record Provenance(
		String labelId, String label, String manufacturer, LocalDate effectiveDate, String url) {}
