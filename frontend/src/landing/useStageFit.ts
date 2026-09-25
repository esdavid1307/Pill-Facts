import { useEffect, useRef } from 'react'
import { HEIGHT, PHONE_MAX, PHONE_WIDTH, WIDTH } from './composition'

/**
 * Fits whichever composition the window has room for, and hands back the refs to attach.
 *
 * It owns the refs it needs because the fitting is entirely this hook's business: nothing
 * else sets either composition's geometry. The scale comes back in a ref rather than as
 * state because it is read inside an animation frame, sixty times a second, to turn element
 * boxes back into composition coordinates; re-rendering React for it would be a waste and
 * would lag the drawing.
 *
 * The two layouts scale by different means. The wide one centres a fixed 1440x860 stage with
 * `transform: scale`, which resamples its text — acceptable, because it only ever scales
 * down. The phone one is 390px wide and scales up, so it uses `zoom`, which reflows text at
 * the scaled size rather than resampling it. That is the whole reason a phone composition
 * exists rather than the wide one shrunk. See ADR-0014.
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

    // Neither layout inherits the other's geometry, so hand back everything first.
    composition.style.left = ''
    composition.style.top = ''
    composition.style.transform = ''
    composition.style.removeProperty('zoom')
    composition.style.minHeight = ''

    const fitWide = () => {
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

    /*
     * Capped at PHONE_MAX so the drawing stops growing before its line weights coarsen; past
     * that it sits centred with the grid bleeding into the window either side. The height is
     * a floor rather than a size: the hero takes the slack, and the page scrolls when there
     * is not enough of it.
     */
    const fitPhone = () => {
      const factor = Math.min(innerWidth, PHONE_MAX) / PHONE_WIDTH
      if (!factor) {
        return
      }
      scale.current = factor
      composition.style.setProperty('zoom', `${factor}`)
      composition.style.minHeight = `${innerHeight / factor}px`
    }

    const fit = drawn ? fitWide : fitPhone
    fit()

    // The wide stage is sized by its board; the phone composition by the window itself.
    if (drawn && typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(fit)
      observer.observe(board)
      return () => observer.disconnect()
    }
    addEventListener('resize', fit)
    return () => removeEventListener('resize', fit)
  }, [drawn])

  return { stage, hero, scale }
}
