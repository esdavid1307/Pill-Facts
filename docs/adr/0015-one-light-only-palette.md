# One palette, light only

The landing page's colours are now the whole app's colours: near-black ink on white, a
single red at `#c8321f`, and a grey for panels and rules. The `prefers-color-scheme: dark`
block that used to sit in the stylesheet is gone, and the app is light-only.

Two palettes had been declared on `:root` — the app's and the landing's — with colliding
names. Whichever stylesheet loaded last silently won, so `--bg` meant "white paper" to one
page and "theme background" to the other, and in dark mode the Drug Concept page would
have rendered light tokens on a dark ground depending on import order. That is a bug
waiting on a build-order change, not a styling preference.

Choosing the landing's palette to resolve it means choosing light. The composition is a
white-paper technical drawing; there is no token swap that inverts it, only a redesign.
The red carries the Boxed Warning as well as the landing's accents, so it was checked
rather than assumed: `#c8321f` on white is about 5.3:1, which clears WCAG AA for body text.

## Consequences

Someone reading FDA warning text at night gets a white screen. That is a real cost and the
reason this is written down rather than left as a deleted media query — a dark treatment
is open work, and it is a design exercise for the composition, not a second set of tokens.

The names the other pages were written against (`--fg`, `--border`, `--alert`) survive as
aliases onto the palette rather than as a second palette. There is one place a colour is
chosen.
