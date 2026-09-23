import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  // The app routes on the real URL, and jsdom keeps it between tests. Without this, a
  // test that navigates leaves the next one starting on the page it landed on.
  window.history.pushState({}, '', '/')
})
