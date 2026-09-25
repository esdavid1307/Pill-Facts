import { vi } from 'vitest'
import { COMPOSITION } from '../landing/composition'

/**
 * The viewport a test runs at.
 *
 * jsdom has no layout and no `matchMedia`, so without this the landing's layout picker falls
 * into the narrow branch by accident and the suite's coverage of it is an accident too. This
 * makes it a decision: a test that cares which composition it is exercising says so.
 *
 * Only the breakpoint is answered. Every other query — reduced motion among them — reports
 * false, which is the default a browser gives a reader who has asked for nothing.
 */
export function viewportIs(viewport: 'phone' | 'desktop') {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: viewport === 'desktop' && query === COMPOSITION,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}
