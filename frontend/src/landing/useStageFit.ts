import { useEffect, useRef } from 'react'
import { HEIGHT, WIDTH } from './composition'

/**
 * Centres the 1440x860 composition in the window and scales it to fit.
 *
 * It owns the two refs it needs and hands them back for the caller to attach, because the
 * fitting is entirely this hook's business: nothing else sets the composition's geometry.
 * The scale comes back in a ref rather than as state because it is read inside an animation
 * frame, sixty times a second, to turn element boxes back into composition coordinates.
 * Re-rendering React for it would be a waste and would lag the drawing.
 */
export function useStageFit(drawn: boolean) {
  const stage = useRef<HTMLDivElement>(null)
  const hero = useRef<HTMLElement>(null)
  const scale = useRef(1)

  useEffect(() => {
    const board = stage.current
    const composition = hero.current
    if (!board || !composition) {
      return
    }

    // Flow layout owns its own geometry, so hand back anything this hook set.
    if (!drawn) {
      composition.style.left = ''
      composition.style.top = ''
      composition.style.transform = ''
      scale.current = 1
      return
    }

    const fit = () => {
      const width = board.clientWidth
      const height = board.clientHeight
      if (!width || !height) {
        return
      }
      const factor = Math.min(width / WIDTH, height / HEIGHT)
      scale.current = factor
      composition.style.left = `${(width - WIDTH * factor) / 2}px`
      composition.style.top = `${(height - HEIGHT * factor) / 2}px`
      composition.style.transform = `scale(${factor})`
    }

    fit()
    if (typeof ResizeObserver !== 'function') {
      addEventListener('resize', fit)
      return () => removeEventListener('resize', fit)
    }
    const observer = new ResizeObserver(fit)
    observer.observe(board)
    return () => observer.disconnect()
  }, [drawn])

  return { stage, hero, scale }
}
