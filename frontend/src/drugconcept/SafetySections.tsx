import { useLayoutEffect, useRef, useState } from 'react'
import type { Provenance, SafetySection } from '../api/drugConcept'
import { safetySectionId } from './drugConceptPath'

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
export function SafetySections({ sections, idPrefix }: { sections: SafetySection[]; idPrefix: string }) {
  return (
    <>
      {sections.map((section, index) => (
        <section
          key={section.heading}
          id={safetySectionId(idPrefix, index)}
          className={section.heading === BOXED_WARNING ? 'safety boxed-warning' : 'safety'}
        >
          <h3>{section.heading}</h3>
          <SafetyText
            id={`${safetySectionId(idPrefix, index)}-text`}
            text={section.text}
            collapsible={section.heading !== BOXED_WARNING}
          />
          <LabelProvenance provenance={section.provenance} />
        </section>
      ))}
    </>
  )
}

/**
 * A section's text, opening with its first few lines so the page reads as a list of
 * sections rather than one long scroll. Nothing is cut: the rest is there to open, and
 * to find-in-page and screen readers it is there already.
 *
 * Not a Boxed Warning, which stays open: a warning that has to be opened is not one that
 * cannot be missed. See ADR-0007.
 */
function SafetyText({ id, text, collapsible }: { id: string; text: string; collapsible: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)
  const [open, setOpen] = useState(false)

  // shortcut: measured once on mount, so a resize that changes whether it overflows is missed; use a ResizeObserver if that matters.
  useLayoutEffect(() => {
    const element = ref.current
    setOverflows(collapsible && !!element && element.scrollHeight > element.clientHeight + 1)
  }, [collapsible, text])

  return (
    <>
      <div
        ref={ref}
        id={id}
        className={
          collapsible && !open ? `safety-text collapsed${overflows ? ' cut' : ''}` : 'safety-text'
        }
      >
        {/* Verbatim, per ADR-0006: the FDA's paragraphs, not ours. */}
        {text.split('\n\n').map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      {overflows && (
        <button
          type="button"
          className="view-more"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          {open ? 'View less' : 'View more'}
        </button>
      )}
    </>
  )
}

/**
 * Who said this and when, next to the words themselves. Every rendered claim carries it,
 * so a reader never has to wonder whether a sentence is the FDA's or ours.
 */
export function LabelProvenance({ provenance }: { provenance: Provenance }) {
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
