import { useLayoutEffect, useRef } from 'react'
import { WIDTH } from './composition'

/** The size the headline is measured at before being scaled to the width it must fill. */
const PROBE = 100
const MARGIN = 28

/**
 * Stretches the headline to the composition's full width on one line, and hands back the
 * ref to attach to it.
 *
 * Measure at a known size, then scale by the ratio of the width wanted to the width got.
 * The observer watches the headline's parent rather than the headline, because the headline
 * is what this changes and observing it would chase its own tail; what it actually catches
 * is the first real layout and the reflow when the webfont swaps in.
 */
export function useFittedHeadline(drawn: boolean) {
  const headline = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const element = headline.current
    if (!element) {
      return
    }
    if (!drawn) {
      element.style.fontSize = ''
      return
    }

    const fit = () => {
      element.style.fontSize = `${PROBE}px`
      const measured = element.scrollWidth
      // Nothing laid out yet, or no layout engine at all: leave the stylesheet's size.
      if (!measured) {
        element.style.fontSize = ''
        return
      }
      element.style.fontSize = `${(PROBE * (WIDTH - MARGIN)) / measured}px`
    }

    fit()

    const parent = element.parentElement
    if (!parent || typeof ResizeObserver !== 'function') {
      return
    }
    const observer = new ResizeObserver(fit)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [drawn])

  return headline
}
