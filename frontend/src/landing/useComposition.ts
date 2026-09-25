import { useEffect, useState } from 'react'
import { COMPOSITION } from './composition'

/**
 * Whether the window is wide enough for the drawn composition.
 *
 * This gates the stage, the leader lines and the 3D pill alike, so a narrow window never
 * pays for a scene it does not render. In jsdom no media query matches, which is why the
 * tests exercise the flow layout — the same one a phone gets, not a test-only branch.
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
