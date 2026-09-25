# The landing is a doorway, and Resolution has a route of its own

The landing page is a fixed 1440x860 composition — a technical drawing with a turning
capsule, leader lines and two annotations — scaled to fit the window and clipped. Search
used to happen in place: the form and the "did you mean" shortlist were one component at
`/`. They are now two routes, and searching leaves the landing for `/search?q=`.

The composition has nowhere to put a shortlist. Every element in it is absolutely
positioned against a drawn grid and the whole thing is `overflow: hidden`, so a list that
grows would either be clipped or would have to float over the drawing. Overlaying it was
the alternative we rejected: choosing between two medications is the single moment a
reader can least afford 11px uppercase type over a scene scaled to 0.84, and a shortlist
is only ever shown when Resolution genuinely could not tell two drugs apart.

Putting the query in the URL rather than in router state follows from the same reasoning.
Resolution is the step a reader retries, and a reload, a shared link and a Back out of the
wrong medication should all put the same shortlist back.

## Consequences

Resolving to a single Candidate replaces the `/search` entry in history rather than
pushing onto it, so Back from a Drug Concept lands on the landing instead of on a page
that would immediately resolve and bounce the reader forward again.

Below 900px a second composition takes over: a drawing authored at 390px, not the wide one
squeezed. Scaling a 1440px stage down to a phone renders 11px body copy at 3px, and this is
a site people read on a phone because they are worried about a medication. What we rejected
was the squeeze, not the drawing — the narrow layout was document flow for one commit, and
a doorway that is a technical drawing on a desktop and a stack of paragraphs on a phone is
two different promises about what this site is.

The two scale by different means, which is the reason they are two compositions rather than
one with a breakpoint. The wide stage is fixed at 1440x860 and only ever scales down, so
`transform: scale` is fine. The phone drawing is 390px and scales up, where resampling text
would be visible, so it uses `zoom` and text reflows at its final size. The phone
composition fixes only its width: phone width barely varies, phone height varies a lot, so
the fixed axis is the one that does not move, and the phone landing scrolls where the wide
one never does. The two layouts are still maintained as two layouts.

The masthead moved out of the root component into a shell that wraps `/search` and a Drug
Concept's page. The landing carries its own brand, headline and footer as part of the
drawing, and wrapping it would put a second `<h1>` on the page.
