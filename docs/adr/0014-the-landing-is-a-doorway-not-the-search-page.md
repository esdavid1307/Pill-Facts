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

Below 900px the composition is abandoned entirely for document flow — the same content,
laid out normally. It is not the drawing squeezed: scaling a 1440px stage into a 390px
phone renders 11px body copy at 3px, and this is a site people read on a phone because
they are worried about a medication. The two layouts are maintained as two layouts.

The masthead moved out of the root component into a shell that wraps `/search` and a Drug
Concept's page. The landing carries its own brand, headline and footer as part of the
drawing, and wrapping it would put a second `<h1>` on the page.
