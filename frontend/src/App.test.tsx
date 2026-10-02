import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { DrugConcept, RegulatoryClassBlock, SafetySection } from './api/drugConcept'
import type { Candidate, DroppedCombinationProduct, SearchResults } from './api/search'
import { viewportIs } from './test/viewport'

/**
 * The frontend's one test seam: a component rendered in jsdom with the backend stubbed
 * at fetch. Later tickets add cases here rather than a second harness.
 *
 * Routes are keyed by the path they answer, because resolving a search and then opening
 * the Drug Concept it resolved to is two calls, and a stub that answered both with the
 * same body would let a page pass on the other page's payload.
 *
 * The other knob is `viewportIs`, which every test gets set to the phone by the shared
 * setup. The cases below reach every page through the landing's search form, so they are
 * also the regression test for that form staying reachable on a phone.
 */
function backendReturns(routes: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const route = Object.keys(routes).find((path) => url.startsWith(path))
      if (!route) {
        return new Response('no such route', { status: 404 })
      }
      return routes[route] === UNREACHABLE
        ? new Response(JSON.stringify({ status: 503, title: 'Unreachable' }), {
            status: 503,
            headers: { 'Content-Type': 'application/problem+json' },
          })
        : new Response(JSON.stringify(routes[route]))
    }),
  )
}

/**
 * A route's answer while the data behind it cannot be retrieved and nothing is cached:
 * the backend's 503, titled as the domain names it.
 */
const UNREACHABLE = Symbol('unreachable')

/**
 * Wording that could be read as a claim about whether a drug is safe. The framing above
 * every page talks about risk on purpose; an empty state never does, because whatever it
 * says is read as the answer to the question the reader came with.
 */
const SAFETY_WORDING = /safe|risk|side effect|harm|no known/i

const LIPITOR = {
  labelId: 'a60cc18b-0631-4cf0-b021-9f52224ece65',
  label: 'Lipitor',
  manufacturer: 'Viatris Specialty LLC',
  effectiveDate: '2024-04-15',
  url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a60cc18b',
}

/** A second Label, so a page can carry two sources at once the way ADR-0010 lets it. */
const FEVERALL = {
  labelId: '3561bbc3-53b0-4857-8b71-39e165ed95ce',
  label: 'Feverall Jr. Strength',
  manufacturer: 'Sun Pharmaceutical Industries, Inc.',
  effectiveDate: '2026-09-03',
  url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=3561bbc3',
}

function section(heading: string, text: string): SafetySection {
  return { heading, text, provenance: LIPITOR }
}

/**
 * A search response. The backend always sends both lists, so the stub does too: a test
 * that left the dropped Combination Products out would be stubbing a contract the backend
 * does not have, and the straight-through path would pass on a shape it never sees.
 */
function searchResults(
  candidates: Candidate[],
  droppedCombinationProducts: DroppedCombinationProduct[] = [],
): SearchResults {
  return { candidates, droppedCombinationProducts }
}

function drugConcept(overrides: Partial<DrugConcept> = {}): DrugConcept {
  return {
    rxcui: '83367',
    name: 'atorvastatin',
    labelling: [],
    fetchedDate: '2026-10-01',
    ...overrides,
  }
}

function prescription(
  sections: SafetySection[],
  strengths?: string,
): RegulatoryClassBlock {
  return {
    regulatoryClass: 'PRESCRIPTION',
    provenance: sections[0]?.provenance ?? LIPITOR,
    sections,
    strengths,
  }
}

function overTheCounter(sections: SafetySection[]): RegulatoryClassBlock {
  return { regulatoryClass: 'OVER_THE_COUNTER', provenance: sections[0]?.provenance ?? LIPITOR, sections }
}

/**
 * Arriving at a Drug Concept's page the way a reader does, through a search that
 * resolves to it. The payload is the one the backend would return for that RxCUI.
 */
async function openPage(page: DrugConcept) {
  backendReturns({
    '/api/search': searchResults([{ rxcui: page.rxcui, name: page.name }]),
    [`/api/drug-concepts/${page.rxcui}`]: page,
  })
  await search(page.name)
}

/**
 * Arriving at a Drug Concept's page cold: the URL pasted, shared or followed from a
 * search engine, with no search before it and so nothing in router state. Everything the
 * page must say about itself has to survive this.
 */
function deepLinkTo(page: DrugConcept) {
  backendReturns({ [`/api/drug-concepts/${page.rxcui}`]: page })
  window.history.pushState({}, '', `/drug-concepts/${page.rxcui}`)
  render(<App />)
}

async function search(query: string) {
  const user = userEvent.setup()
  render(<App />)
  await user.type(screen.getByRole('searchbox', { name: /medication/i }), query)
  await user.click(screen.getByRole('button', { name: /search/i }))
}

afterEach(() => vi.unstubAllGlobals())

/**
 * The landing is a drawing either side of 900px, and the point of testing it is that being
 * two drawings costs a reader nothing: the same content, the same controls under the same
 * names, the same search. What the geometry computed is not asserted — jsdom measures every
 * box as zero, so an assertion about the zoom factor, the dodging annotations, the leader
 * paths or the fitted headline would be an assertion about the stub. Those are verified in a
 * browser. What running both layouts here does catch is that none of that code throws or
 * produces a NaN when every measurement is zero, because the page has to render at all for
 * anything below to pass.
 */
describe('the landing a reader arrives on', () => {
  for (const viewport of ['phone', 'desktop'] as const) {
    describe(`at ${viewport} width`, () => {
      function arrive() {
        viewportIs(viewport)
        return render(<App />)
      }

      it('says whose words these are, and that they are not advice', () => {
        arrive()

        expect(screen.getByRole('link', { name: 'PILL-FACTS' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Your pills. Your facts.' })).toBeInTheDocument()
        expect(screen.getByText('FDA drug labels')).toBeInTheDocument()
        expect(screen.getByText(/not medical advice/i)).toBeInTheDocument()
        expect(screen.getByText(/talk to a pharmacist or doctor/i)).toBeInTheDocument()
      })

      it('annotates the drawing with what a Drug Concept page renders', () => {
        arrive()

        const effects = within(screen.getByRole('complementary', { name: 'Side effects' }))
        expect(effects.getByText(/in the FDA/i)).toBeInTheDocument()

        // A statement of composition and nothing more. See ADR-0005.
        const products = within(screen.getByRole('complementary', { name: 'Other products' }))
        expect(products.getByText('Atorvastatin 10 MG Oral Tablet')).toBeInTheDocument()
        expect(document.body.textContent).not.toMatch(
          /\b(substitut|equivalent|interchangeable|generic version)/i,
        )
      })

      it('offers a search field and a button, both named', () => {
        arrive()

        expect(screen.getByRole('searchbox', { name: /medication/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument()
      })

      it('leaves for Resolution when a medication is searched for', async () => {
        backendReturns({
          '/api/search': searchResults([{ rxcui: '83367', name: 'atorvastatin', brand: 'Lipitor' }]),
          '/api/drug-concepts/83367': drugConcept(),
        })
        const user = userEvent.setup()
        arrive()

        await user.type(screen.getByRole('searchbox', { name: /medication/i }), 'lipitor')
        await user.click(screen.getByRole('button', { name: /^search$/i }))

        expect(
          await screen.findByRole('heading', { name: 'Lipitor (atorvastatin)' }),
        ).toBeInTheDocument()
      })

      it('searches for an example when one is tapped', async () => {
        backendReturns({
          '/api/search': searchResults([{ rxcui: '6809', name: 'metformin' }]),
          '/api/drug-concepts/6809': drugConcept({ rxcui: '6809', name: 'metformin' }),
        })
        const user = userEvent.setup()
        arrive()

        for (const example of ['Lipitor', 'Ibuprofen', 'Metformin']) {
          expect(screen.getByRole('button', { name: example })).toBeInTheDocument()
        }
        await user.click(screen.getByRole('button', { name: 'Metformin' }))

        expect(await screen.findByRole('heading', { name: 'metformin' })).toBeInTheDocument()
        // The stub answers any query, so what proves the chip searched for its own example
        // is the query Resolution was asked for.
        expect(vi.mocked(fetch).mock.calls[0][0]).toContain('q=Metformin')
      })
    })
  }
})

describe('resolving a search to a Drug Concept', () => {
  it('lands on the Drug Concept when one candidate is clearly right', async () => {
    backendReturns({
      '/api/search': searchResults([{ rxcui: '83367', name: 'atorvastatin', brand: 'Lipitor' }]),
      '/api/drug-concepts/83367': drugConcept(),
    })

    await search('lipitor')

    // Arriving via a Brand leads with that Brand, per ADR-0002.
    expect(
      await screen.findByRole('heading', { name: 'Lipitor (atorvastatin)' }),
    ).toBeInTheDocument()
  })

  it('offers a choice when several Drug Concepts are plausible', async () => {
    backendReturns({
      '/api/search': searchResults([
        { rxcui: '236797', name: 'alpha hydroxy acids' },
        { rxcui: '1541733', name: '4-hydroxy acetophenone' },
      ]),
    })

    await search('hydroxy')

    const results = await screen.findByRole('region', { name: 'Search results' })
    const choices = within(results).getAllByRole('link')
    expect(choices).toHaveLength(2)
    expect(choices[0]).toHaveTextContent('alpha hydroxy acids')
    expect(screen.queryByRole('heading', { name: /alpha hydroxy acids \(/ })).toBeNull()

    // Nothing was dropped, so the shortlist is still a question rather than a caveat.
    expect(within(results).getByRole('heading', { name: 'Did you mean…' })).toBeInTheDocument()
    expect(results).not.toHaveTextContent('also matched')
  })

  const TYLENOL_PM: DroppedCombinationProduct = {
    name: 'Tylenol PM',
    activeIngredients: ['acetaminophen', 'diphenhydramine'],
    activeIngredientsWithNoCandidate: ['diphenhydramine'],
  }

  it('names a dropped Combination Product instead of navigating to one ingredient', async () => {
    backendReturns({
      '/api/search': searchResults(
        [{ rxcui: '161', name: 'acetaminophen', brand: 'Tylenol' }],
        [TYLENOL_PM],
      ),
    })

    await search('tylenol pm')

    const combination = await screen.findByRole('region', {
      name: 'Combination Product: Tylenol PM',
    })
    expect(within(combination).getByRole('heading', { name: 'Tylenol PM is a Combination Product' }))
      .toBeInTheDocument()
    expect(combination).toHaveTextContent('acetaminophen and diphenhydramine')
    expect(combination).toHaveTextContent('Pill-Facts has no page')

    // The dropped ingredient, named. It is the whole reason the product differs.
    expect(combination).toHaveTextContent('This search offers nothing for diphenhydramine')

    const results = screen.getByRole('region', { name: 'Search results' })
    expect(within(results).getByRole('heading', { name: 'Another Drug Concept' })).toBeInTheDocument()
    expect(results).toHaveTextContent('Its page does not cover Tylenol PM')
    expect(within(results).getByRole('link', { name: /Tylenol.*acetaminophen/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Tylenol (acetaminophen)' })).toBeNull()
  })

  it('still names the Combination Product when nothing else matched at all', async () => {
    // Nothing resolved, so both ingredients are ones the reader gets nothing for.
    backendReturns({
      '/api/search': searchResults([], [
        { ...TYLENOL_PM, activeIngredientsWithNoCandidate: TYLENOL_PM.activeIngredients },
      ]),
    })

    await search('tylenol pm')

    const combination = await screen.findByRole('region', {
      name: 'Combination Product: Tylenol PM',
    })
    expect(combination).toHaveTextContent('Pill-Facts has no page')
    expect(combination).toHaveTextContent(
      'This search offers nothing for acetaminophen and diphenhydramine',
    )

    // "Nothing matched" would be a lie: something matched, and it has just been named.
    expect(screen.queryByText(/Nothing matched/)).toBeNull()
    expect(screen.queryByRole('region', { name: 'Search results' })).toBeNull()
  })

  /**
   * Obsolete and suppressed concepts publish no properties, so the backend names those
   * Combination Products by their Active Ingredients instead. Saying what such a product
   * contains would then just repeat its name back.
   */
  it('does not list the ingredients twice where they are the product name', async () => {
    backendReturns({
      '/api/search': searchResults([{ rxcui: '161', name: 'acetaminophen', brand: 'Tylenol' }], [
        {
          name: 'acetaminophen / diphenhydramine',
          activeIngredients: ['acetaminophen', 'diphenhydramine'],
          activeIngredientsWithNoCandidate: ['diphenhydramine'],
        },
      ]),
    })

    await search('tylenol pm')

    const combination = await screen.findByRole('region', {
      name: 'Combination Product: acetaminophen / diphenhydramine',
    })
    expect(combination).toHaveTextContent('Pill-Facts has no page')
    expect(combination).toHaveTextContent('This search offers nothing for diphenhydramine')
    expect(combination).not.toHaveTextContent('contains the Active Ingredients')
  })

  it('speaks of several Candidates in the plural where one was dropped', async () => {
    backendReturns({
      '/api/search': searchResults(
        [
          { rxcui: '161', name: 'acetaminophen', brand: 'Tylenol' },
          { rxcui: '3498', name: 'diphenhydramine' },
        ],
        [{ ...TYLENOL_PM, activeIngredientsWithNoCandidate: [] }],
      ),
    })

    await search('tylenol pm')

    const results = await screen.findByRole('region', { name: 'Search results' })
    expect(within(results).getByRole('heading', { name: 'Other Drug Concepts' })).toBeInTheDocument()
    expect(results).toHaveTextContent('Their pages do not cover Tylenol PM')
  })

  /** No match is a fact about what was typed, and is worded as one. */
  it('says nothing matched when the query is not a drug', async () => {
    backendReturns({ '/api/search': searchResults([]) })

    await search('zzzqqqnotadrug')

    const noMatch = await screen.findByText(/nothing matched/i)
    expect(noMatch).toHaveTextContent('Nothing matched “zzzqqqnotadrug”')
    expect(noMatch.textContent).not.toMatch(SAFETY_WORDING)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  /**
   * Unreachable is a fact about an outage. It must not read as "nothing matched", which
   * would send the reader off to respell a name that was right all along.
   */
  it('asks the reader to come back later when the search is Unreachable', async () => {
    backendReturns({ '/api/search': UNREACHABLE })

    await search('lipitor')

    const unreachable = await screen.findByRole('alert')
    expect(unreachable).toHaveTextContent(/couldn’t reach/i)
    expect(unreachable).toHaveTextContent(/come back later/i)
    expect(unreachable.textContent).not.toMatch(SAFETY_WORDING)
    expect(screen.queryByText(/nothing matched/i)).toBeNull()
  })

  /** Unreachable is read from the backend's answer, never assumed from any failure. */
  it('does not claim the search is Unreachable when the backend never answers', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('network down'))))

    await search('lipitor')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/couldn’t load this search/i)
    expect(alert.textContent).not.toMatch(/couldn’t reach|saved/i)
  })
})

/**
 * What stops this page being read as medical advice.
 *
 * Two things a reader must be told before they read a word of labelling: that none of it
 * is advice, and that what is here is not everything there is. Both are asserted in every
 * state the page has, because a notice that only shows up once the labelling loads is a
 * notice the slowest connections and the deepest links do without.
 *
 * Most of these arrive by deep link rather than through the search form. That is the case
 * the ticket is about, and it is also the cheaper one: a search starts on the landing,
 * whose composition is the most expensive thing this suite renders. One case below still
 * comes through the form, to hold that the notices are not something the search route
 * supplies.
 *
 * Document order is the whole of what jsdom can say about "without scrolling" — it
 * measures every box as zero. That the notices come first in the article is the part a
 * test can hold; that they fit on a phone screen is held by the stylesheet having no
 * fixed heights or widths to overflow one.
 */
describe('the framing a Drug Concept page carries', () => {
  const LABELLED = drugConcept({
    labelling: [prescription([section('Contraindications', 'Acute liver failure.')])],
  })

  function framing() {
    return screen.getByRole('complementary', { name: /what this page is/i })
  }

  /** Deep-linked, then settled, so no fetch is still in flight when the test ends. */
  async function arriveCold() {
    deepLinkTo(LABELLED)
    await screen.findByRole('heading', { name: 'Contraindications' })
  }

  it('says this is not medical advice, and where advice comes from instead', async () => {
    await arriveCold()

    expect(within(framing()).getByText(/not medical advice/i)).toBeInTheDocument()
    expect(within(framing()).getByText(/pharmacist or doctor/i)).toBeInTheDocument()
  })

  it('says the page is not a complete account of the risks', async () => {
    await arriveCold()

    expect(within(framing()).getByText(/not a complete account/i)).toBeInTheDocument()
    expect(within(framing()).getByText(/no label lists everything/i)).toBeInTheDocument()
    expect(within(framing()).getByText(/absence from this page is not evidence of safety/i))
      .toBeInTheDocument()
  })

  it('puts both notices above the labelling they frame', async () => {
    await arriveCold()

    const heading = screen.getByRole('heading', { name: 'Contraindications' })
    expect(framing().compareDocumentPosition(heading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  /**
   * docs/domain-language.md: "side effect" is the phrase a reader searches for and so
   * it earns its place in landing copy, but it is never the name of a Safety Section and
   * never appears on a page that renders one. A notice is the easiest place to forget
   * that.
   *
   * Scoped to the notice rather than to the page, because the page is not all ours. A
   * Drug Facts panel really does say "if side effects occur", and ADR-0006 renders the
   * FDA's words verbatim — a page-wide assertion would be this rule overruling that one
   * the first time it met a real OTC Label.
   */
  it('names the risks without calling them side effects', async () => {
    await arriveCold()

    expect(framing().textContent).not.toMatch(/side.effect/i)
  })

  it('carries both notices before any labelling has arrived', async () => {
    deepLinkTo(LABELLED)

    expect(screen.getByText(/Looking up/i)).toBeInTheDocument()
    expect(within(framing()).getByText(/not medical advice/i)).toBeInTheDocument()
    expect(within(framing()).getByText(/not a complete account/i)).toBeInTheDocument()

    await screen.findByRole('heading', { name: 'Contraindications' })
  })

  it('carries both notices where the drug is Unlabelled', async () => {
    deepLinkTo(drugConcept())

    expect(await screen.findByText(/FDA publishes no Label/i)).toBeInTheDocument()
    expect(within(framing()).getByText(/not medical advice/i)).toBeInTheDocument()
    expect(within(framing()).getByText(/not a complete account/i)).toBeInTheDocument()
  })

  it('carries both notices when the FDA could not be reached', async () => {
    backendReturns({ '/api/drug-concepts/83367': UNREACHABLE })
    window.history.pushState({}, '', '/drug-concepts/83367')
    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t reach the FDA/i)
    expect(within(framing()).getByText(/not medical advice/i)).toBeInTheDocument()
    expect(within(framing()).getByText(/not a complete account/i)).toBeInTheDocument()
  })

  it('carries both notices on a page reached through the search form', async () => {
    await openPage(LABELLED)

    expect(await screen.findByRole('heading', { name: 'Contraindications' })).toBeInTheDocument()
    expect(within(framing()).getByText(/not medical advice/i)).toBeInTheDocument()
    expect(within(framing()).getByText(/not a complete account/i)).toBeInTheDocument()
  })

  /** The masthead's own tagline is not this notice, and does not stand in for it. */
  it('is not what the search page wears', async () => {
    backendReturns({ '/api/search': searchResults([]) })

    await search('not a drug')

    expect(screen.queryByRole('complementary', { name: /what this page is/i })).toBeNull()
  })
})

/**
 * Provenance presented rather than merely stored: every claim on the page checkable at
 * its origin.
 *
 * A Drug Concept in both Regulatory Classes has a Representative Label for each
 * (ADR-0010), so the page carries two sources at once and a section attributed to the
 * other one is a reader sent to the wrong document. Each section is therefore read on its
 * own and asked who said it, rather than the page being asked how many attributions it
 * has in total.
 */
describe('the source every Safety Section names', () => {
  /** The section a heading belongs to, which is the unit Provenance attaches to. */
  function sectionNamed(heading: string) {
    return within(screen.getByRole('heading', { name: heading }).closest('section')!)
  }

  async function openBothClasses() {
    deepLinkTo(
      drugConcept({
        rxcui: '5640',
        name: 'ibuprofen',
        labelling: [
          {
            regulatoryClass: 'OVER_THE_COUNTER',
            provenance: FEVERALL,
            sections: [{ heading: 'Warnings', text: 'Stomach bleeding warning.', provenance: FEVERALL }],
          },
          prescription([section('Warnings and Precautions', 'Cardiovascular thrombotic events.')]),
        ],
      }),
    )
    await screen.findByRole('heading', { name: 'Warnings' })
  }

  it('names the Label, its manufacturer and its Effective Date in each section', async () => {
    await openBothClasses()

    expect(sectionNamed('Warnings').getByText(/From the FDA label for/)).toHaveTextContent(
      'From the FDA label for Feverall Jr. Strength, published by Sun Pharmaceutical Industries, Inc., effective 2026-09-03.',
    )
    expect(
      sectionNamed('Warnings and Precautions').getByText(/From the FDA label for/),
    ).toHaveTextContent(
      'From the FDA label for Lipitor, published by Viatris Specialty LLC, effective 2024-04-15.',
    )
  })

  it('links each section to the Label it came from and not to the page’s other one', async () => {
    await openBothClasses()

    expect(sectionNamed('Warnings').getByRole('link', { name: /read the full label/i }))
      .toHaveAttribute('href', FEVERALL.url)
    expect(
      sectionNamed('Warnings and Precautions').getByRole('link', { name: /read the full label/i }),
    ).toHaveAttribute('href', LIPITOR.url)
  })

  /** An Effective Date is a date, and marked up as one so it is not read as a version. */
  it('marks the Effective Date up as a date', async () => {
    await openBothClasses()

    const effective = sectionNamed('Warnings').getByText(FEVERALL.effectiveDate)
    expect(effective.tagName).toBe('TIME')
    expect(effective).toHaveAttribute('datetime', FEVERALL.effectiveDate)
  })

  /** A Label naming no manufacturer leaves it out, rather than attributing it to nobody. */
  it('names only what the Label says where it names no manufacturer', async () => {
    const anonymous = { ...FEVERALL, manufacturer: undefined }
    deepLinkTo(
      drugConcept({
        labelling: [
          {
            regulatoryClass: 'PRESCRIPTION',
            provenance: anonymous,
            sections: [
              { heading: 'Contraindications', text: 'Acute liver failure.', provenance: anonymous },
            ],
          },
        ],
      }),
    )
    await screen.findByRole('heading', { name: 'Contraindications' })

    const attribution = sectionNamed('Contraindications').getByText(/From the FDA label for/)
    expect(attribution).toHaveTextContent(
      'From the FDA label for Feverall Jr. Strength, effective 2026-09-03.',
    )
    expect(attribution.textContent).not.toMatch(/published by/)
  })
})

describe("a prescription Drug Concept's page", () => {
  it('renders the Safety Sections in the order the backend gave them', async () => {
    await openPage(
      drugConcept({
        labelling: [
          prescription([
            section('Contraindications', 'Acute liver failure.'),
            section('Warnings and Precautions', 'Myopathy and rhabdomyolysis.'),
          ]),
        ],
      }),
    )

    expect(await screen.findByRole('heading', { name: 'Contraindications' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Prescription labelling' })).toBeInTheDocument()
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(headings).toEqual(['Contraindications', 'Warnings and Precautions'])
    expect(screen.getByText('Acute liver failure.')).toBeInTheDocument()
  })

  it('shows a Boxed Warning first and prominently', async () => {
    await openPage(
      drugConcept({
        rxcui: '11289',
        name: 'warfarin',
        labelling: [
          prescription([
            section('Boxed Warning', 'WARNING: BLEEDING RISK'),
            section('Contraindications', 'Pregnancy.'),
          ]),
        ],
      }),
    )

    const boxed = await screen.findByRole('heading', { name: 'Boxed Warning' })
    expect(screen.getAllByRole('heading', { level: 3 })[0]).toBe(boxed)
    expect(boxed.closest('section')).toHaveClass('boxed-warning')
  })

  /**
   * ADR-0007: an absent Boxed Warning means the FDA did not require one, never that the
   * drug is safe. Nothing may stand in for it — no heading, no "None", no reassurance.
   */
  it('says nothing at all about a Boxed Warning a Drug Concept does not have', async () => {
    await openPage(
      drugConcept({
        labelling: [prescription([section('Contraindications', 'Acute liver failure.')])],
      }),
    )

    expect(await screen.findByRole('heading', { name: 'Contraindications' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/boxed/i)
    expect(document.querySelector('.boxed-warning')).toBeNull()
  })

  it('attributes every Safety Section to the Label it came from', async () => {
    await openPage(
      drugConcept({
        labelling: [
          prescription([
            section('Contraindications', 'Acute liver failure.'),
            section('Adverse Reactions', 'Nasopharyngitis.'),
          ]),
        ],
      }),
    )

    const attributions = await screen.findAllByText(/From the FDA label for/)
    expect(attributions).toHaveLength(2)
    expect(attributions[0]).toHaveTextContent(
      'From the FDA label for Lipitor, published by Viatris Specialty LLC, effective 2024-04-15.',
    )
    expect(screen.getAllByRole('link', { name: /read the full label/i })[0]).toHaveAttribute(
      'href',
      LIPITOR.url,
    )
  })

  /**
   * Two dates, two facts: when the FDA's labelling took effect, and when we last went and
   * got it. A page may be a week old, or older while the FDA is unreachable, and says so
   * rather than reading as though it were fetched just now. See ADR-0003.
   */
  it('says when Pill-Facts retrieved the page, apart from when the labelling took effect', async () => {
    await openPage(
      drugConcept({
        labelling: [prescription([section('Contraindications', 'Acute liver failure.')])],
        fetchedDate: '2026-09-24',
      }),
    )

    expect(await screen.findByText(/retrieved this from the FDA/i)).toHaveTextContent(
      'Pill-Facts retrieved this from the FDA on 2026-09-24.',
    )
    expect(screen.getByText(/From the FDA label for/)).toHaveTextContent('effective 2024-04-15')
  })

  it('says when it retrieved a page it found no labelling on', async () => {
    await openPage(drugConcept({ fetchedDate: '2026-09-24' }))

    expect(await screen.findByText(/FDA publishes no Label/i)).toBeInTheDocument()
    expect(screen.getByText(/retrieved this from the FDA/i)).toHaveTextContent('2026-09-24')
  })

  it('shows the strengths a drug is made in', async () => {
    await openPage(
      drugConcept({
        labelling: [
          prescription(
            [section('Contraindications', 'Acute liver failure.')],
            'Tablets: 10 mg, 20 mg, 40 mg and 80 mg of atorvastatin.',
          ),
        ],
      }),
    )

    expect(await screen.findByRole('heading', { name: 'Strengths' })).toBeInTheDocument()
    expect(screen.getByText(/10 mg, 20 mg, 40 mg and 80 mg/)).toBeInTheDocument()
    expect(screen.getAllByText(/From the FDA label for/)).toHaveLength(2)
  })

  /**
   * Unlabelled is a fact about the drug: resolution succeeded and the FDA publishes no
   * Label for it. The absence is the FDA's, and the page says so rather than letting it
   * read as a gap in the site — or, worse, as a claim about the drug.
   */
  it('says the FDA publishes no Label, and that the absence is the FDA’s', async () => {
    await openPage(drugConcept({ rxcui: '10167', name: 'sulbactam' }))

    const unlabelled = await screen.findByText(/FDA publishes no Label/i)
    expect(unlabelled).toHaveTextContent('The FDA publishes no Label for sulbactam')
    expect(unlabelled).toHaveTextContent(/absence is the FDA’s, not Pill-Facts’/)
    expect(unlabelled.textContent).not.toMatch(SAFETY_WORDING)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  /**
   * A Label carrying none of the sections Pill-Facts reads is not Unlabelled: the FDA
   * does publish one, and the reader can go and read it whole.
   */
  it('tells a Label with no Safety Sections Pill-Facts reads apart from Unlabelled', async () => {
    await openPage(
      drugConcept({
        labelling: [
          prescription([], 'Tablets: 10 mg, 20 mg, 40 mg and 80 mg of atorvastatin.'),
        ],
      }),
    )

    const note = await screen.findByText(/carries none of the sections/i)
    expect(note).toHaveTextContent(
      'The FDA’s Label for atorvastatin carries none of the sections Pill-Facts shows.',
    )
    expect(note.textContent).not.toMatch(SAFETY_WORDING)
    expect(screen.getByRole('link', { name: 'Read the full label' })).toHaveAttribute(
      'href',
      LIPITOR.url,
    )
    expect(document.body.textContent).not.toMatch(/publishes no Label/i)
    expect(screen.queryByRole('heading', { name: 'Prescription labelling' })).toBeNull()
  })

  /**
   * Unreachable is a fact about an outage, and never worded as the other two are. The
   * backend answers it only when it has no copy of the page at all; any copy it has is
   * served and dated instead.
   */
  it('asks the reader to come back later when the page is Unreachable', async () => {
    backendReturns({
      '/api/search': searchResults([{ rxcui: '83367', name: 'atorvastatin' }]),
      '/api/drug-concepts/83367': UNREACHABLE,
    })

    await search('atorvastatin')

    const unreachable = await screen.findByRole('alert')
    expect(unreachable).toHaveTextContent(/couldn’t reach the FDA/i)
    expect(unreachable).toHaveTextContent(/come back later/i)
    expect(unreachable.textContent).not.toMatch(SAFETY_WORDING)
    expect(document.body.textContent).not.toMatch(/publishes no Label/i)
    // Nothing arrived, so there is no retrieval to date and none is claimed.
    expect(document.body.textContent).not.toMatch(/retrieved this from the FDA/i)
  })

  /**
   * A request that never reached the backend says nothing about what it has cached, so
   * it is not worded as Unreachable: "no copy saved" would be a claim nobody checked.
   */
  it('does not claim Unreachable when the request never reaches the backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.startsWith('/api/search')
          ? new Response(JSON.stringify(searchResults([{ rxcui: '83367', name: 'atorvastatin' }])))
          : Promise.reject(new TypeError('network down')),
      ),
    )

    await search('atorvastatin')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/couldn’t load this page/i)
    expect(alert.textContent).not.toMatch(/couldn’t reach|saved/i)
  })

  /** A fault of the backend's own is not an outage either, and is not worded as one. */
  it('does not claim Unreachable when the backend answers with a fault of its own', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.startsWith('/api/search')
          ? new Response(JSON.stringify(searchResults([{ rxcui: '83367', name: 'atorvastatin' }])))
          : new Response('{}', { status: 500 }),
      ),
    )

    await search('atorvastatin')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/couldn’t load this page/i)
    expect(alert.textContent).not.toMatch(/couldn’t reach|saved/i)
  })

  /** No such Drug Concept is a fact about the address, and never worded as an outage. */
  it('says there is no medication at the address when the RxCUI is not one', async () => {
    backendReturns({
      '/api/search': searchResults([{ rxcui: '153165', name: 'atorvastatin' }]),
      // and no /api/drug-concepts route, so the stub answers 404
    })

    await search('lipitor')

    expect(await screen.findByRole('alert')).toHaveTextContent(/medication at this address/i)
    expect(document.body.textContent).not.toMatch(/couldn’t reach the FDA/i)
  })
})

/**
 * The page renders whatever vocabulary the backend sends, which is what lets one
 * component serve both renderers (ADR-0008) without knowing there are two. What these
 * assert is that nothing in it is keyed to the prescription vocabulary.
 */
describe("an over-the-counter Drug Concept's page", () => {
  /** The sections the FDA's own Drug Facts panel prints, as the backend sends them. */
  function acetaminophen(): DrugConcept {
    const panel: [string, string][] = [
      ['Warnings', 'Liver warning This product contains acetaminophen.'],
      ['Do not use', 'in children under 6 years'],
      ['Ask a doctor before use if', 'you have liver disease.'],
      ['Stop use and ask a doctor if', 'fever lasts more than 3 days (72 hours), or recurs.'],
    ]
    return {
      rxcui: '161',
      name: 'acetaminophen',
      fetchedDate: '2026-10-01',
      labelling: [
        overTheCounter(
          panel.map(([heading, text]) => ({ heading, text, provenance: FEVERALL })),
        ),
      ],
    }
  }

  it('renders the Drug Facts headings in the order the backend gave them', async () => {
    await openPage(acetaminophen())

    expect(await screen.findByRole('heading', { name: 'Warnings' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Over-the-counter labelling' }))
      .toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Warnings',
      'Do not use',
      'Ask a doctor before use if',
      'Stop use and ask a doctor if',
    ])
    expect(screen.getByText('in children under 6 years')).toBeInTheDocument()
  })

  /**
   * An OTC Label has no Boxed Warning, so nothing here may be styled as one. The lead
   * styling means "the FDA's most serious warning", and over a section that is merely
   * first it would say something the FDA did not.
   */
  it('styles no section as a Boxed Warning', async () => {
    await openPage(acetaminophen())

    expect(await screen.findByRole('heading', { name: 'Warnings' })).toBeInTheDocument()
    expect(document.querySelector('.boxed-warning')).toBeNull()
    expect(document.body.textContent).not.toMatch(/boxed/i)
  })

  it('attributes every section to the OTC Label it came from', async () => {
    await openPage(acetaminophen())

    const attributions = await screen.findAllByText(/From the FDA label for/)
    expect(attributions).toHaveLength(4)
    expect(attributions[0]).toHaveTextContent(
      'From the FDA label for Feverall Jr. Strength, published by Sun Pharmaceutical Industries, Inc., effective 2026-09-03.',
    )
  })

  /**
   * ADR-0007 renders the strengths a drug is made in, where the Label gives them. An OTC
   * Label has no strengths section at all, so the heading is absent rather than standing
   * empty over nothing — the same rule as any other absent section. #18 asks whether the
   * panel's active ingredient line is the same fact.
   */
  it('shows no strengths heading where the Label carries none', async () => {
    await openPage(acetaminophen())

    expect(await screen.findByRole('heading', { name: 'Warnings' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Strengths' })).toBeNull()
  })
})

describe('a Drug Concept sold in both Regulatory Classes', () => {
  it('shows both classes under clear headings, with over-the-counter labelling first', async () => {
    backendReturns({
      '/api/search': searchResults([{ rxcui: '5640', name: 'ibuprofen' }]),
      '/api/drug-concepts/5640': {
        rxcui: '5640',
        name: 'ibuprofen',
        labelling: [
          {
            regulatoryClass: 'OVER_THE_COUNTER',
            provenance: LIPITOR,
            sections: [section('Warnings', 'Stomach bleeding warning.')],
          },
          {
            regulatoryClass: 'PRESCRIPTION',
            provenance: LIPITOR,
            strengths: 'Tablets: 400 mg, 600 mg, and 800 mg.',
            sections: [section('Warnings and Precautions', 'Cardiovascular thrombotic events.')],
          },
        ],
      },
    })

    await search('ibuprofen')

    expect(await screen.findByRole('heading', { name: 'Over-the-counter labelling' }))
      .toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent))
      .toEqual(['Over-the-counter labelling', 'Prescription labelling'])
    expect(screen.getByText('Stomach bleeding warning.')).toBeInTheDocument()
    expect(screen.getByText('Cardiovascular thrombotic events.')).toBeInTheDocument()
  })
})

/**
 * ADR-0005: an Alternative is a statement about what a product is made of, and the page
 * is where that constraint is enforced. Most of what these assert is therefore an
 * absence — of Caduet from the Alternatives, and of any sentence a reader could take as
 * permission to switch.
 */
describe('the other products an Active Ingredient is sold in', () => {
  const LIPITOR_10 = { composition: 'atorvastatin 10 MG Oral Tablet', brands: ['Lipitor'] }
  const LIPITOR_20 = { composition: 'atorvastatin 20 MG Oral Tablet', brands: ['Lipitor'] }
  const CADUET = {
    composition: 'amlodipine 10 MG / atorvastatin 10 MG Oral Tablet',
    brands: ['Caduet'],
  }

  async function openAtorvastatin(overrides: Partial<DrugConcept>) {
    await openPage(
      drugConcept({
        labelling: [prescription([section('Adverse Reactions', 'Myalgia, diarrhea.')])],
        ...overrides,
      }),
    )
  }

  it('lists each strength and dosage form on its own line, with the Brands sold in it', async () => {
    await openAtorvastatin({ alternatives: [LIPITOR_10, LIPITOR_20] })

    const list = within(
      await screen.findByRole('region', { name: /other products made with atorvastatin/i }),
    )
    expect(list.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'atorvastatin 10 MG Oral Tablet — sold as Lipitor',
      'atorvastatin 20 MG Oral Tablet — sold as Lipitor',
    ])
  })

  it('names a product sold without a Brand by its composition alone', async () => {
    await openAtorvastatin({
      alternatives: [{ composition: 'atorvastatin 30 MG Oral Tablet', brands: [] }],
    })

    expect(await screen.findByText('atorvastatin 30 MG Oral Tablet')).toBeInTheDocument()
  })

  /**
   * The list a reader scans for "another atorvastatin" must not contain a drug that is
   * also amlodipine. Caduet arrives in its own field and is shown under its own heading,
   * which says what it is.
   */
  it('keeps a Combination Product out of the Alternatives and under its own heading', async () => {
    await openAtorvastatin({ alternatives: [LIPITOR_10], combinationProducts: [CADUET] })

    const alternatives = within(
      await screen.findByRole('region', { name: /other products made with atorvastatin/i }),
    )
    expect(alternatives.queryByText(/Caduet/)).toBeNull()

    const combinations = within(
      screen.getByRole('region', { name: /combine atorvastatin with another medication/i }),
    )
    expect(combinations.getByText(/Caduet/)).toBeInTheDocument()
  })

  /** No rendered sentence may be readable as "you can take this instead". */
  it('says nothing that reads as permission to take one product in place of another', async () => {
    await openAtorvastatin({ alternatives: [LIPITOR_10, LIPITOR_20], combinationProducts: [CADUET] })

    await screen.findByRole('region', { name: /other products made with atorvastatin/i })
    expect(document.body.textContent).not.toMatch(
      /\b(substitut|equivalent|interchangeable|generic version|the same as)/i,
    )
  })

  it('shows no heading for a list the Drug Concept has none of', async () => {
    await openAtorvastatin({ alternatives: [LIPITOR_10] })

    expect(await screen.findByRole('heading', { name: /other products made with atorvastatin/i }))
      .toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /combine atorvastatin/i })).toBeNull()
  })

  it('shows neither heading for a Drug Concept RxNorm relates to no other product', async () => {
    await openAtorvastatin({})

    expect(await screen.findByRole('heading', { name: 'Adverse Reactions' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /other products made with/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: /combine atorvastatin/i })).toBeNull()
  })

  /**
   * Composition is a fact about the drug and the FDA's labelling is a fact about one
   * Label, so a Drug Concept with nothing to show from a Label still has its products
   * listed — which is the whole page for a drug sold only in combination.
   */
  it('lists Combination Products for a Drug Concept with no labelling at all', async () => {
    await openPage(
      drugConcept({ rxcui: '10167', name: 'sulbactam', labelling: [], combinationProducts: [CADUET] }),
    )

    expect(await screen.findByRole('heading', { name: /combine sulbactam/i })).toBeInTheDocument()
  })
})
