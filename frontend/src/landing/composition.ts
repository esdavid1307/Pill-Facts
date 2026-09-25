/**
 * The size the landing was drawn at. Above the breakpoint the whole composition is laid
 * out at exactly this size and scaled to fit the window, so every coordinate in the
 * leader lines and in the 3D pill's projection is in this space rather than in CSS pixels.
 */
export const WIDTH = 1440
export const HEIGHT = 860

/** Below this the composition is abandoned for document flow. See ADR-0014. */
export const COMPOSITION = '(min-width: 900px)'

export type Point = { x: number; y: number }
