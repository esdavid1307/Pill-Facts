import { useLayoutEffect, useRef } from 'react'
import { PHONE_WIDTH, WIDTH } from './composition'

/** The size the headline is measured at before being scaled to the width it must fill. */
const PROBE = 100
/** 14px of margin either side, in both compositions. */
const MARGIN = 28

/**
 * Stretches the headline to fill its composition's width, and hands back the ref to attach
 * to it.
 *
 * Measure at a known size, then scale by the ratio of the width wanted to the width got.
 * What is measured is the widest line rather than the whole heading, because the phone sets
 * the headline on two: where that line breaks is a composition decision and so it is in the
 * markup, and each line has to reach the same width. The wide composition sets it on one,
 * where the widest line is the heading.
 *
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

    const fit = () => {
      element.style.fontSize = `${PROBE}px`
      const lines = element.querySelectorAll<HTMLElement>('.line')
      const measured = Math.max(
        element.scrollWidth,
        ...Array.from(lines, (line) => line.offsetWidth),
      )
      // Nothing laid out yet, or no layout engine at all: leave the stylesheet's size.
      if (!measured || !Number.isFinite(measured)) {
        element.style.fontSize = ''
        return
      }
      const target = (drawn ? WIDTH : PHONE_WIDTH) - MARGIN
      element.style.fontSize = `${(PROBE * target) / measured}px`
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
