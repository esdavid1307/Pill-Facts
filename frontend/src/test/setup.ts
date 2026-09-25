import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { viewportIs } from './viewport'

// The phone, which is both what jsdom already selected by accident and the majority case.
beforeEach(() => viewportIs('phone'))

/*
 * jsdom has no canvas, so the landing's capsule chunk loads, fails to get a WebGL context and
 * falls back to the flat pill — which is the path under test. Saying so outright keeps jsdom
 * from logging a "not implemented" notice for every render; the answer is the one it gives.
 */
HTMLCanvasElement.prototype.getContext = () => null

afterEach(() => {
  cleanup()
  // The app routes on the real URL, and jsdom keeps it between tests. Without this, a
  // test that navigates leaves the next one starting on the page it landed on.
  window.history.pushState({}, '', '/')
})
