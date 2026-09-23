import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

/**
 * The frontend's one test seam: a component rendered in jsdom with the backend stubbed
 * at fetch. Later tickets add cases here rather than a second harness.
 */
function backendReturns(body: unknown, init: ResponseInit = { status: 200 }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), init)),
  )
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
      candidates: [{ rxcui: '83367', name: 'atorvastatin', brand: 'Lipitor' }],
    })

    await search('lipitor')

    // Arriving via a Brand leads with that Brand, per ADR-0002.
    expect(
      await screen.findByRole('heading', { name: 'Lipitor (atorvastatin)' }),
    ).toBeInTheDocument()
  })

  it('offers a choice when several Drug Concepts are plausible', async () => {
    backendReturns({
      candidates: [
        { rxcui: '236797', name: 'alpha hydroxy acids' },
        { rxcui: '1541733', name: '4-hydroxy acetophenone' },
      ],
    })

    await search('hydroxy')

    const results = await screen.findByRole('region', { name: 'Search results' })
    const choices = within(results).getAllByRole('link')
    expect(choices).toHaveLength(2)
    expect(choices[0]).toHaveTextContent('alpha hydroxy acids')
    expect(screen.queryByRole('heading', { name: /alpha hydroxy acids \(/ })).toBeNull()
  })

  it('says nothing matched when the query is not a drug', async () => {
    backendReturns({ candidates: [] })

    await search('zzzqqqnotadrug')

    expect(await screen.findByText(/nothing matched/i)).toBeInTheDocument()
  })
})
