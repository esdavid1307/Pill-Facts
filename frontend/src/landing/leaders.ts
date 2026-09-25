import type { Point } from './composition'

/**
 * The parts of the drawing that connect a callout to a point on the pill: a leader line
 * out of the box's inner edge, and a square node where it lands.
 */
export type Leaders = {
  hero: HTMLElement
  paths: [SVGPathElement, SVGPathElement]
  nodes: [HTMLElement, HTMLElement]
  /** The left, mirrored callout first, then the right one. */
  callouts: [HTMLElement, HTMLElement]
}

/** A live element's box in composition coordinates, undoing the stage's scale. */
export function compositionBox(hero: HTMLElement, element: HTMLElement, scale: number) {
  const origin = hero.getBoundingClientRect()
  const rect = element.getBoundingClientRect()
  return {
    left: (rect.left - origin.left) / scale,
    right: (rect.right - origin.left) / scale,
    middle: (rect.top + rect.bottom - 2 * origin.top) / (2 * scale),
  }
}

/**
 * Redraws both leaders for two points on the pill, in composition coordinates.
 *
 * Called from the render loop, because the points are on a pill that is turning: the
 * callouts float, the pill rotates, and the line between them has to stay attached to
 * both. Each line leaves its box horizontally, turns once, and runs flat into the node,
 * which is what makes it read as a dimension leader rather than a connector.
 */
export function drawLeaders(leaders: Leaders, scale: number, points: [Point, Point]) {
  const { hero, paths, nodes, callouts } = leaders

  const left = compositionBox(hero, callouts[0], scale)
  const start = { x: left.right, y: left.middle }
  const bend = { x: Math.min(points[0].x - 60, start.x + 120), y: points[0].y }
  paths[0].setAttribute('d', `M${start.x},${start.y}L${bend.x},${bend.y}H${points[0].x}`)

  const right = compositionBox(hero, callouts[1], scale)
  const from = { x: right.left, y: right.middle }
  const turn = { x: Math.max(points[1].x + 60, from.x - 120), y: points[1].y }
  paths[1].setAttribute('d', `M${from.x},${from.y}L${turn.x},${turn.y}H${points[1].x}`)

  points.forEach((point, index) => {
    nodes[index].style.transform = `translate(${point.x}px,${point.y}px)`
  })
}
