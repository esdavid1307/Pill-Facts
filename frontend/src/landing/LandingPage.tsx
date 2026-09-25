/*
 * Self-hosted rather than fetched from Google's CDN: two render-blocking cross-origin hops
 * on the first page anyone sees, for a font, is a bad trade, and it puts every visitor's IP
 * in front of a third party. Latin subsets only, in the four weights the composition uses.
 */
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/inter-tight/latin-400.css'
import '@fontsource/inter-tight/latin-600.css'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { searchPath } from '../search/searchPath'
import type { Silhouette } from './composition'
import './Landing.css'
import {
  compositionBox,
  drawLeaders,
  drawPhoneLeaders,
  releaseCallouts,
  type Leaders,
} from './leaders'
import type { Pill } from './pill'
import { useComposition } from './useComposition'
import { useFittedHeadline } from './useFittedHeadline'
import { useStageFit } from './useStageFit'

/** Three drugs that between them cover a Brand, an OTC-and-prescription drug, and a Boxed Warning. */
const EXAMPLES = ['Lipitor', 'Ibuprofen', 'Metformin']

/*
 * The grid, which is the one piece of the drawing the two layouts do not share. A taller,
 * narrower box wants more horizontal division, and eight crosshair marks at phone size
 * would be noise rather than register.
 */
const COLUMNS = [25, 50, 75]
const WIDE_RULES = [28, 56]
const PHONE_RULES = [20, 40, 60, 80]
const CROSSHAIRS = [25, 75]

/**
 * Where the leaders land on the flat pill, relative to its centre. The 3D capsule is asked
 * for its silhouette every frame; the flat one has no projection to ask, so the two points
 * are simply drawn on it.
 */
const FLAT_ANCHORS = {
  wide: [
    { x: -40, y: -70 },
    { x: 80, y: 40 },
  ],
  phone: [
    { x: -34, y: -44 },
    { x: 40, y: 36 },
  ],
} as const

/**
 * Where a reader arrives.
 *
 * Two drawn compositions, one component. Above 900px it is a fixed 1440x860 stage scaled to
 * the window; below, a composition authored at 390x844 and scaled with `zoom`, fluid in
 * height. Both have the grid, the turning capsule, the leader lines and the two annotations,
 * and both render the same elements in the same order with the same strings — only the grid
 * rules and the placing of the annotations differ. See ADR-0014.
 *
 * Searching leaves this page rather than unfolding inside it: both compositions position
 * everything against a drawn grid and have nowhere to put a shortlist, and choosing between
 * two medications deserves plain scrollable text.
 */
export function LandingPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const drawn = useComposition()

  const { stage, hero, scale } = useStageFit(drawn)
  const headline = useFittedHeadline(drawn)

  const region = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const flatPill = useRef<HTMLDivElement>(null)
  const firstPath = useRef<SVGPathElement>(null)
  const secondPath = useRef<SVGPathElement>(null)
  const firstNode = useRef<HTMLSpanElement>(null)
  const secondNode = useRef<HTMLSpanElement>(null)
  const firstCallout = useRef<HTMLElement>(null)
  const secondCallout = useRef<HTMLElement>(null)

  /*
   * Whether the pill is the 3D one. It turns false for good once we know this browser cannot
   * have it — no WebGL, or the chunk never arrived. A slow chunk is not an absent chunk, so
   * nothing gives up on a timer.
   */
  const [flat, setFlat] = useState(false)
  const spins = !flat

  const leaders = useCallback((): Leaders | null => {
    const parts = [
      region.current,
      firstPath.current,
      secondPath.current,
      firstNode.current,
      secondNode.current,
      firstCallout.current,
      secondCallout.current,
    ]
    if (parts.some((part) => part === null)) {
      return null
    }
    return {
      region: region.current!,
      paths: [firstPath.current!, secondPath.current!],
      nodes: [firstNode.current!, secondNode.current!],
      callouts: [firstCallout.current!, secondCallout.current!],
    }
  }, [])

  /*
   * The wide composition's annotations are placed by hand against its grid and stay there;
   * the phone's are pushed clear of the capsule's silhouette every frame, because at 390px
   * the capsule sweeps most of the width as it turns.
   */
  const draw = useCallback(
    (silhouette: Silhouette) => {
      const drawing = leaders()
      if (!drawing) {
        return
      }
      if (drawn) {
        drawLeaders(drawing, scale.current, silhouette.anchors)
      } else {
        drawPhoneLeaders(drawing, scale.current, silhouette)
      }
    },
    [drawn, leaders, scale],
  )

  // Neither layout inherits the other's geometry, and only one of them writes any.
  useEffect(() => {
    const drawing = leaders()
    if (drawing) {
      releaseCallouts(drawing)
    }
  }, [drawn, leaders])

  // The 3D pill, in a chunk nothing blocks on.
  useEffect(() => {
    if (!spins) {
      return
    }
    const surface = canvas.current
    if (!surface) {
      return
    }

    let live = true
    let pill: Pill | undefined
    import('./pill')
      .then(({ mountPill }) => {
        if (!live) {
          return
        }
        pill = mountPill(surface, draw, () => scale.current)
      })
      .catch(() => {
        // No WebGL, or the chunk never arrived. Either way the flat pill is what is left.
        if (live) {
          setFlat(true)
        }
      })

    return () => {
      live = false
      pill?.dispose()
    }
  }, [spins, draw, scale])

  // The flat pill does not move, so its leaders are drawn once rather than every frame.
  useEffect(() => {
    if (spins) {
      return
    }
    const pill = flatPill.current
    const drawing = leaders()
    if (!pill || !drawing) {
      return
    }

    const redraw = () => {
      const box = compositionBox(drawing.region, pill, scale.current)
      const x = (box.left + box.right) / 2
      const y = (box.top + box.bottom) / 2
      const reach = FLAT_ANCHORS[drawn ? 'wide' : 'phone']
      draw({
        anchors: [
          { x: x + reach[0].x, y: y + reach[0].y },
          { x: x + reach[1].x, y: y + reach[1].y },
        ],
        extent: { top: box.top, bottom: box.bottom },
      })
    }

    redraw()
    addEventListener('resize', redraw)
    return () => removeEventListener('resize', redraw)
  }, [spins, drawn, leaders, scale, draw])

  function look(next: string) {
    const trimmed = next.trim()
    if (trimmed) {
      navigate(searchPath(trimmed))
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    look(query)
  }

  return (
    <div className="landing" ref={stage}>
      <main className="hero" ref={hero}>
        <div className="grid" aria-hidden="true">
          {COLUMNS.map((left) => (
            <i key={left} className="v" style={{ left: `${left}%` }} />
          ))}
          {(drawn ? WIDE_RULES : PHONE_RULES).map((top) => (
            <i key={top} className="h" style={{ top: `${top}%` }} />
          ))}
          {drawn &&
            WIDE_RULES.flatMap((top) =>
              CROSSHAIRS.map((left) => (
                <b key={`${left}-${top}`} style={{ left: `${left}%`, top: `${top}%` }} />
              )),
            )}
        </div>

        <div className="top">
          <Link className="brand" to="/">
            PILL-FACTS
          </Link>
          <div className="meta">
            <span>Source</span>FDA drug labels
          </div>
        </div>

        {/* Where the headline breaks is a composition decision, so it is set here. */}
        <h1 ref={headline}>
          <span className="line">Your pills.</span>{' '}
          <br />
          <span className="line">Your facts.</span>
        </h1>

        {/*
          * The capsule, its leaders and the two annotations share one box, because every
          * coordinate the frame loop works in is measured from its corner and that is what
          * the capsule projects into. The wide composition fills the stage with it; the
          * phone gives it the slack between the headline and the search box.
          */}
        <div className="pill" ref={region}>
          {spins ? (
            <canvas ref={canvas} aria-hidden="true" />
          ) : (
            <div className="pill-flat" ref={flatPill} aria-hidden="true" />
          )}

          <svg className="leaders" aria-hidden="true">
            <path ref={firstPath} />
            <path ref={secondPath} />
          </svg>
          <span className="node" ref={firstNode} />
          <span className="node" ref={secondNode} />

          {/*
            * Two annotations, each saying only what a Drug Concept's page actually renders.
            * The right-hand one is a statement of composition and nothing else: no price, no
            * "generic", no equals sign between two products. See ADR-0005.
            */}
          <aside
            className="callout flipped"
            ref={firstCallout}
            style={{ animationDelay: '-2.5s' }}
            aria-label="Side effects"
          >
            <header>
              <small>/01</small>
              <strong>SIDE EFFECTS</strong>
            </header>
            <p>What the label reports</p>
            <p>= warnings, cautions, contraindications</p>
            <hr />
            <p>&rarr; In the FDA&rsquo;s own words</p>
          </aside>

          <aside className="callout" ref={secondCallout} aria-label="Other products">
            <header>
              <strong>OTHER PRODUCTS</strong>
              <small>/02</small>
            </header>
            <p>Atorvastatin 10 MG Oral Tablet</p>
            <p>Sold as Lipitor</p>
            <hr />
            <p>&rarr; What else is made with the same ingredient</p>
          </aside>

        </div>

        <section className="about" aria-labelledby="disclaimer">
          <div className="bar">
            <span id="disclaimer">Not medical advice &mdash; just the label</span>
          </div>
          <div className="body">
            <p>
              Pill-Facts shows FDA drug labelling in the FDA&rsquo;s own words. Search a
              medication by brand or ingredient name.
            </p>
            <form onSubmit={submit} role="search">
              <label htmlFor="q">Search a medication by brand or ingredient name</label>
              <input
                id="q"
                name="q"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Lipitor, ibuprofen&hellip;"
                autoComplete="off"
              />
              <button type="submit">Search</button>
            </form>
          </div>
          <div className="chips">
            {EXAMPLES.map((example) => (
              <button key={example} type="button" onClick={() => look(example)}>
                {example}
              </button>
            ))}
          </div>
        </section>

        <div className="foot">
          <span>Talk to a pharmacist or doctor before changing any medication.</span>
          <span>&copy; Pill-Facts</span>
        </div>
      </main>
    </div>
  )
}
