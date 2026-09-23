import type { Provenance, SafetySection } from '../api/drugConcept'

/** The heading the backend gives the FDA's most serious warning. */
const BOXED_WARNING = 'Boxed Warning'

/**
 * The Safety Sections of a Label, rendered in the order they arrive.
 *
 * The backend decides which sections exist and what order they are read in, so there is
 * nothing to sort, filter or look up here. A Boxed Warning is styled to be unmissable
 * because it leads the list; a Drug Concept without one has no Boxed Warning in the list
 * and so this renders nothing whatsoever about it, per ADR-0007.
 */
export function SafetySections({ sections }: { sections: SafetySection[] }) {
  return (
    <>
      {sections.map((section) => (
        <section
          key={section.heading}
          className={section.heading === BOXED_WARNING ? 'safety boxed-warning' : 'safety'}
        >
          <h2>{section.heading}</h2>
          {/* Verbatim, per ADR-0006: the FDA's paragraphs, not ours. */}
          {section.text.split('\n\n').map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          <Attribution provenance={section.provenance} />
        </section>
      ))}
    </>
  )
}

/**
 * Who said this and when, next to the words themselves. Every rendered claim carries it,
 * so a reader never has to wonder whether a sentence is the FDA's or ours.
 */
function Attribution({ provenance }: { provenance: Provenance }) {
  return (
    <p className="provenance">
      From the FDA label for <strong>{provenance.label}</strong>
      {provenance.manufacturer && <>, published by {provenance.manufacturer}</>}, effective{' '}
      <time dateTime={provenance.effectiveDate}>{provenance.effectiveDate}</time>.{' '}
      <a href={provenance.url} rel="noreferrer noopener" target="_blank">
        Read the full label
      </a>
      .
    </p>
  )
}
