import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

/**
 * The frontend's one test seam: a component rendered in jsdom with the backend
 * stubbed at fetch. Later tickets add cases here rather than a second harness.
 */
function backendReturns(body: unknown, init: ResponseInit = { status: 200 }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), init)),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('App', () => {
  it('renders the status the backend reports', async () => {
    backendReturns({ status: 'ready' })

    render(<App />)

    expect(await screen.findByText('ready')).toBeInTheDocument()
  })

  it('says the backend could not be reached when the request fails', async () => {
    backendReturns({}, { status: 500 })

    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /couldn’t reach the backend/i,
    )
  })
})
