import { useEffect, useState } from 'react'
import { COMPOSITION } from './composition'

/**
 * Which of the two compositions the window has room for.
 *
 * This picks the wide drawing's stage, grid and hand-placed annotations over the phone
 * drawing's; it does not gate the drawing itself, because both layouts are drawings. See
 * ADR-0014. In jsdom no media query matches unless a test says otherwise, so the suite's
 * default is the phone — which is the majority of readers.
 */
export function useComposition(): boolean {
  const [drawn, setDrawn] = useState(() => matchMedia?.(COMPOSITION).matches ?? false)

  useEffect(() => {
    const query = matchMedia?.(COMPOSITION)
    if (!query?.addEventListener) {
      return
    }
    const change = () => setDrawn(query.matches)
    change()
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])

  return drawn
}
