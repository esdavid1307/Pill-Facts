import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { DrugConcept, RegulatoryClassBlock, SafetySection } from './api/drugConcept'

/**
 * The frontend's one test seam: a component rendered in jsdom with the backend stubbed
 * at fetch. Later tickets add cases here rather than a second harness.
 *
 * Routes are keyed by the path they answer, because resolving a search and then opening
 * the Drug Concept it resolved to is two calls, and a stub that answered both with the
 * same body would let a page pass on the other page's payload.
 */
function backendReturns(routes: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const route = Object.keys(routes).find((path) => url.startsWith(path))
      return route
        ? new Response(JSON.stringify(routes[route]))
        : new Response('no such route', { status: 404 })
    }),
  )
}

const LIPITOR = {
  labelId: 'a60cc18b-0631-4cf0-b021-9f52224ece65',
  label: 'Lipitor',
  manufacturer: 'Viatris Specialty LLC',
  effectiveDate: '2024-04-15',
  url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a60cc18b',
}

function section(heading: string, text: string): SafetySection {
  return { heading, text, provenance: LIPITOR }
}

function drugConcept(overrides: Partial<DrugConcept> = {}): DrugConcept {
  return { rxcui: '83367', name: 'atorvastatin', labelling: [], ...overrides }
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
    '/api/search': { candidates: [{ rxcui: page.rxcui, name: page.name }] },
    [`/api/drug-concepts/${page.rxcui}`]: page,
  })
  await search(page.name)
}

async function search(query: string) {
  const user = userEvent.setup()
  render(<App />)
  await user.type(screen.getByRole('searchbox', { name: /medication/i }), query)
  await user.click(screen.getByRole('button', { name: /search/i }))
}

afterEach(() => vi.unstubAllGlobals())

describe('resolving a search to a Drug Concept', () => {
  it('lands on the Drug Concept when one candidate is clearly right', async () => {
    backendReturns({
      '/api/search': { candidates: [{ rxcui: '83367', name: 'atorvastatin', brand: 'Lipitor' }] },
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
      '/api/search': {
        candidates: [
          { rxcui: '236797', name: 'alpha hydroxy acids' },
          { rxcui: '1541733', name: '4-hydroxy acetophenone' },
        ],
      },
    })

    await search('hydroxy')

    const results = await screen.findByRole('region', { name: 'Search results' })
    const choices = within(results).getAllByRole('link')
    expect(choices).toHaveLength(2)
    expect(choices[0]).toHaveTextContent('alpha hydroxy acids')
    expect(screen.queryByRole('heading', { name: /alpha hydroxy acids \(/ })).toBeNull()
  })

  it('says nothing matched when the query is not a drug', async () => {
    backendReturns({ '/api/search': { candidates: [] } })

    await search('zzzqqqnotadrug')

    expect(await screen.findByText(/nothing matched/i)).toBeInTheDocument()
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
   * Having nothing to show is stated as a fact about Pill-Facts, never as the claim that
   * the FDA publishes nothing, and above all never as a claim about the drug. Which of
   * the three empty states this actually is stays #9's work.
   */
  it('says the gap is ours when there is nothing to show', async () => {
    await openPage(drugConcept())

    expect(await screen.findByText(/no labelling to show/i)).toBeInTheDocument()
    expect(screen.getByText(/not a statement that this medication has no known risks/i))
      .toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/publishes no/i)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps the same empty state when a Label has no supported Safety Sections', async () => {
    await openPage(
      drugConcept({
        labelling: [
          prescription([], 'Tablets: 10 mg, 20 mg, 40 mg and 80 mg of atorvastatin.'),
        ],
      }),
    )

    expect(await screen.findByText(/no labelling to show/i)).toBeInTheDocument()
    expect(screen.getByText(/not a statement that this medication has no known risks/i))
      .toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Prescription labelling' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Strengths' })).toBeNull()
  })

  /** Unreachable is a fact about an outage, and never worded as the other two are. */
  it('says the FDA could not be reached when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.startsWith('/api/search')
          ? new Response(JSON.stringify({ candidates: [{ rxcui: '83367', name: 'atorvastatin' }] }))
          : Promise.reject(new TypeError('network down')),
      ),
    )

    await search('atorvastatin')

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t reach the FDA/i)
    expect(document.body.textContent).not.toMatch(/no labelling to show/i)
  })

  /** No such Drug Concept is a fact about the address, and never worded as an outage. */
  it('says there is no medication at the address when the RxCUI is not one', async () => {
    backendReturns({
      '/api/search': { candidates: [{ rxcui: '153165', name: 'atorvastatin' }] },
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
  const FEVERALL = {
    labelId: '3561bbc3-53b0-4857-8b71-39e165ed95ce',
    label: 'Feverall Jr. Strength',
    manufacturer: 'Sun Pharmaceutical Industries, Inc.',
    effectiveDate: '2026-09-03',
    url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=3561bbc3',
  }

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
      '/api/search': { candidates: [{ rxcui: '5640', name: 'ibuprofen' }] },
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
