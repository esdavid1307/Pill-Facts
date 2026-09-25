import type { Point, Silhouette } from './composition'

/**
 * The parts of the drawing that connect an annotation to a point on the pill: a leader line
 * out of the box's edge, and a square node where it lands.
 *
 * Everything here lives inside one box — the one the capsule is drawn in — and every
 * coordinate is measured from its top left, which is also what the capsule projects into.
 * In the wide composition that box is the whole stage; on the phone it is the hero.
 */
export type Leaders = {
  region: HTMLElement
  paths: [SVGPathElement, SVGPathElement]
  nodes: [HTMLElement, HTMLElement]
  /** The left, mirrored callout first, then the right one. */
  callouts: [HTMLElement, HTMLElement]
}

/** A live element's box in composition coordinates, undoing the layout's scale. */
export function compositionBox(region: HTMLElement, element: HTMLElement, scale: number) {
  const origin = region.getBoundingClientRect()
  const rect = element.getBoundingClientRect()
  return {
    left: (rect.left - origin.left) / scale,
    right: (rect.right - origin.left) / scale,
    top: (rect.top - origin.top) / scale,
    bottom: (rect.bottom - origin.top) / scale,
    middle: (rect.top + rect.bottom - 2 * origin.top) / (2 * scale),
  }
}

function place(nodes: Leaders['nodes'], points: [Point, Point]) {
  points.forEach((point, index) => {
    nodes[index].style.transform = `translate(${point.x}px,${point.y}px)`
    // The nodes start hidden, because their CSS position is the box's corner rather than
    // anywhere on the pill; the first frame is what puts them somewhere worth seeing.
    nodes[index].style.opacity = '1'
  })
}

/**
 * Hands back the vertical positions the phone's frame loop writes onto the annotations.
 *
 * Only the phone places them; the wide composition places them from the stylesheet, so a
 * window dragged across the breakpoint has to be given those declarations back.
 */
export function releaseCallouts(leaders: Leaders) {
  for (const callout of leaders.callouts) {
    callout.style.top = ''
    callout.style.bottom = ''
  }
}

/**
 * Redraws both leaders of the wide composition, for two points on the pill in composition
 * coordinates.
 *
 * Called from the render loop, because the points are on a pill that is turning: the
 * callouts float, the pill rotates, and the line between them has to stay attached to
 * both. Each line leaves its box horizontally, turns once, and runs flat into the node,
 * which is what makes it read as a dimension leader rather than a connector.
 */
export function drawLeaders(leaders: Leaders, scale: number, points: [Point, Point]) {
  const { region, paths, nodes, callouts } = leaders

  const left = compositionBox(region, callouts[0], scale)
  const start = { x: left.right, y: left.middle }
  const bend = { x: Math.min(points[0].x - 60, start.x + 120), y: points[0].y }
  paths[0].setAttribute('d', `M${start.x},${start.y}L${bend.x},${bend.y}H${points[0].x}`)

  const right = compositionBox(region, callouts[1], scale)
  const from = { x: right.left, y: right.middle }
  const turn = { x: Math.max(points[1].x + 60, from.x - 120), y: points[1].y }
  paths[1].setAttribute('d', `M${from.x},${from.y}L${turn.x},${turn.y}H${points[1].x}`)

  place(nodes, points)
}

/** How far the chamfer on a phone leader cuts the corner. */
const CHAMFER = 18
/** The clearance a dodged annotation keeps from the capsule, and from the box's own edge. */
const CLEARANCE = 14
const EDGE = 4
/** Where a phone leader leaves its box, measured in from the box's outer corner. */
const EXIT = 28

/**
 * Redraws the phone composition's leaders, first moving both annotations clear of the
 * capsule.
 *
 * The phone has no room to place the annotations by hand and leave them: at 390px the
 * capsule sweeps most of the width as it turns, so the boxes are pushed above and below its
 * silhouette every frame instead, which is why the capsule reports that silhouette at all.
 * The lines leave vertically rather than horizontally — down out of the upper box, up out of
 * the lower one — because that is the only direction with room in it at this width.
 */
export function drawPhoneLeaders(leaders: Leaders, scale: number, silhouette: Silhouette) {
  const { region, paths, nodes, callouts } = leaders
  const { top, bottom } = silhouette.extent
  const [above, below] = callouts

  if (Number.isFinite(top) && Number.isFinite(bottom)) {
    const floor = region.clientHeight - below.offsetHeight - EDGE
    above.style.top = `${Math.max(EDGE, top - above.offsetHeight - CLEARANCE)}px`
    // The seed position pins the lower box to the bottom edge; from here its top is set.
    below.style.bottom = 'auto'
    below.style.top = `${Math.min(floor, bottom + CLEARANCE)}px`
  }

  const points = silhouette.anchors

  const upper = compositionBox(region, above, scale)
  const exit = upper.left + EXIT
  const away = Math.sign(points[0].x - exit) || 1
  const cut = Math.min(CHAMFER, Math.max(0, points[0].y - upper.bottom))
  paths[0].setAttribute(
    'd',
    `M${exit},${upper.bottom}V${points[0].y - cut}L${exit + away * cut},${points[0].y}H${points[0].x}`,
  )

  const lower = compositionBox(region, below, scale)
  const leave = lower.right - EXIT
  const back = Math.sign(points[1].x - leave) || -1
  const bevel = Math.min(CHAMFER, Math.max(0, lower.top - points[1].y))
  paths[1].setAttribute(
    'd',
    `M${leave},${lower.top}V${points[1].y + bevel}L${leave + back * bevel},${points[1].y}H${points[1].x}`,
  )

  place(nodes, points)
}
