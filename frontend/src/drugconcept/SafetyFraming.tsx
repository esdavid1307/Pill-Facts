/**
 * What a Drug Concept page says about itself, before it says anything about a drug.
 *
 * Two facts, and they are the ones that decide whether a reader can tell what this site
 * is. The first is that nothing here is advice: Pill-Facts renders FDA labelling verbatim
 * and authors no medical content of its own (ADR-0006), which is a constraint on us and
 * useless to a reader unless we say so. The second is that the page is not exhaustive — a
 * Representative Label speaks for one product of hundreds (ADR-0010), and Pill-Facts
 * renders an allowlist of its Safety Sections. A reader who took this page for the
 * complete set would read a gap as a reassurance, which is the one misreading that could
 * hurt them.
 *
 * It sits at the top of the article rather than in the footer, unconditionally, in every
 * state the page has. Pages are deep-linked and read part-way down, so a notice below the
 * labelling is a notice most readers never reach; and a notice rendered only once the
 * labelling arrives is absent for exactly as long as the reader is waiting. Neither fact
 * depends on what came back from the FDA, so neither waits for it.
 *
 * "Side effect" is the phrase a reader would search for, and it stays on the landing where
 * it earns their attention. It is not the name of anything Pill-Facts renders, so it is
 * not used here: the word on this page is risk, which is what a Safety Section carries.
 */
export function SafetyFraming() {
  return (
    <aside className="framing" aria-label="What this page is">
      <p>
        <strong>This is not medical advice.</strong> Pill-Facts reproduces FDA labelling and
        writes nothing of its own. Talk to a pharmacist or doctor about your own medication.
      </p>
      <p className="not-exhaustive">
        This page is not a complete account of this medication&rsquo;s risks. Pill-Facts shows
        part of one FDA label, and no label lists everything that is known about a drug.
        Absence from this page is not evidence of safety.
      </p>
    </aside>
  )
}
