/*
 * The two sizes the landing was drawn at.
 *
 * Above the breakpoint the composition is laid out at exactly 1440x860 and scaled to fit
 * the window with `transform: scale`. Below it a second composition, authored at phone size
 * rather than derived from the first, is laid out 390px wide and scaled with `zoom`. Either
 * way every coordinate in the leader lines and in the capsule's projection is in
 * composition pixels rather than CSS ones, and the scale is what converts between them.
 */

/** The wide composition, fixed on both axes. */
export const WIDTH = 1440
export const HEIGHT = 860

/**
 * The phone composition fixes only its width: phone width barely varies and phone height
 * varies a lot, so the axis that is fixed is the axis that does not move. A consequence is
 * that the phone landing scrolls on a short device and the wide one never scrolls.
 */
export const PHONE_WIDTH = 390

/**
 * Past this the phone drawing stops growing and sits centred, with the grid bleeding into
 * the window either side. Scaling it further coarsens the 1px grid rules and the line
 * weights, which are the drawing.
 */
export const PHONE_MAX = 600

/** Above this the wide composition takes over. See ADR-0014. */
export const COMPOSITION = '(min-width: 900px)'

export type Point = { x: number; y: number }

/**
 * What the capsule reports each frame, in its canvas' coordinates: the two points on its
 * silhouette the leader lines land on, and the vertical extent of the whole silhouette.
 *
 * The phone layout uses the extent to keep both annotations clear of the capsule as it
 * turns. The wide layout ignores it: its annotations are placed by hand against a drawn
 * grid, and moving them would break the register the composition is built on. The asymmetry
 * is deliberate.
 */
export type Silhouette = {
  anchors: [Point, Point]
  extent: { top: number; bottom: number }
}
