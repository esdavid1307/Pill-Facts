import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { DrugConcept, SafetySection } from './api/drugConcept'

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
  return { rxcui: '83367', name: 'atorvastatin', sections: [], ...overrides }
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
  async function open(page: DrugConcept) {
    backendReturns({
      '/api/search': { candidates: [{ rxcui: page.rxcui, name: page.name }] },
      [`/api/drug-concepts/${page.rxcui}`]: page,
    })
    await search(page.name)
  }

  it('renders the Safety Sections in the order the backend gave them', async () => {
    await open(
      drugConcept({
        sections: [
          section('Contraindications', 'Acute liver failure.'),
          section('Warnings and Precautions', 'Myopathy and rhabdomyolysis.'),
        ],
      }),
    )

    expect(await screen.findByRole('heading', { name: 'Contraindications' })).toBeInTheDocument()
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Contraindications', 'Warnings and Precautions'])
    expect(screen.getByText('Acute liver failure.')).toBeInTheDocument()
  })

  it('shows a Boxed Warning first and prominently', async () => {
    await open(
      drugConcept({
        rxcui: '11289',
        name: 'warfarin',
        sections: [
          section('Boxed Warning', 'WARNING: BLEEDING RISK'),
          section('Contraindications', 'Pregnancy.'),
        ],
      }),
    )

    const boxed = await screen.findByRole('heading', { name: 'Boxed Warning' })
    expect(screen.getAllByRole('heading', { level: 2 })[0]).toBe(boxed)
    expect(boxed.closest('section')).toHaveClass('boxed-warning')
  })

  /**
   * ADR-0007: an absent Boxed Warning means the FDA did not require one, never that the
   * drug is safe. Nothing may stand in for it — no heading, no "None", no reassurance.
   */
  it('says nothing at all about a Boxed Warning a Drug Concept does not have', async () => {
    await open(drugConcept({ sections: [section('Contraindications', 'Acute liver failure.')] }))

    expect(await screen.findByRole('heading', { name: 'Contraindications' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/boxed/i)
    expect(document.querySelector('.boxed-warning')).toBeNull()
  })

  it('attributes every Safety Section to the Label it came from', async () => {
    await open(
      drugConcept({
        sections: [
          section('Contraindications', 'Acute liver failure.'),
          section('Adverse Reactions', 'Nasopharyngitis.'),
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
    await open(
      drugConcept({
        strengths: 'Tablets: 10 mg, 20 mg, 40 mg and 80 mg of atorvastatin.',
        sections: [section('Contraindications', 'Acute liver failure.')],
      }),
    )

    expect(await screen.findByRole('heading', { name: 'Strengths' })).toBeInTheDocument()
    expect(screen.getByText(/10 mg, 20 mg, 40 mg and 80 mg/)).toBeInTheDocument()
  })

  /**
   * ADR-0008 allows shipping the prescription renderer alone only while the page says
   * that is what it is. Having nothing to show is stated as a fact about Pill-Facts, and
   * never as the claim that the FDA publishes nothing.
   */
  it('says the over-the-counter gap is ours when there is nothing to show', async () => {
    await open(drugConcept())

    expect(await screen.findByText(/no prescription labelling to show/i)).toBeInTheDocument()
    expect(screen.getByText(/over-the-counter labelling isn’t here yet/i)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/publishes no/i)
    expect(screen.queryByRole('alert')).toBeNull()
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
    expect(document.body.textContent).not.toMatch(/no prescription labelling to show/i)
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
