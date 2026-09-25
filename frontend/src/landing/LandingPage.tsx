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
import './Landing.css'
import { compositionBox, drawLeaders, type Leaders } from './leaders'
import type { Pill } from './pill'
import { useComposition } from './useComposition'
import { useFittedHeadline } from './useFittedHeadline'
import { useStageFit } from './useStageFit'

/** Three drugs that between them cover a Brand, an OTC-and-prescription drug, and a Boxed Warning. */
const EXAMPLES = ['Lipitor', 'Ibuprofen', 'Metformin']

/**
 * Where a reader arrives.
 *
 * Above 900px this is the drawn composition: a fixed 1440x860 stage scaled to the window,
 * with a turning 3D capsule and leader lines tying two annotations to points on its
 * silhouette. Below it, the same content in document flow at a size someone can read on a
 * phone. See ADR-0014.
 *
 * Searching leaves this page rather than unfolding inside it: the composition is clipped
 * and has nowhere to put a shortlist, and choosing between two medications deserves plain
 * scrollable text.
 */
export function LandingPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const drawn = useComposition()

  const { stage, hero, scale } = useStageFit(drawn)
  const headline = useFittedHeadline(drawn)

  const canvas = useRef<HTMLCanvasElement>(null)
  const flatPill = useRef<HTMLDivElement>(null)
  const firstPath = useRef<SVGPathElement>(null)
  const secondPath = useRef<SVGPathElement>(null)
  const firstNode = useRef<HTMLSpanElement>(null)
  const secondNode = useRef<HTMLSpanElement>(null)
  const firstCallout = useRef<HTMLElement>(null)
  const secondCallout = useRef<HTMLElement>(null)

  /*
   * Whether the pill is the 3D one. It turns false for good once we know this browser
   * cannot have it — no WebGL, or the chunk never arrived — and it is false on every
   * narrow window, where the flat pill is simply the right pill.
   */
  const [flat, setFlat] = useState(false)
  const spins = drawn && !flat

  const leaders = useCallback((): Leaders | null => {
    const parts = [
      hero.current,
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
      hero: hero.current!,
      paths: [firstPath.current!, secondPath.current!],
      nodes: [firstNode.current!, secondNode.current!],
      callouts: [firstCallout.current!, secondCallout.current!],
    }
  }, [hero])

  // The 3D pill, in a chunk nothing blocks on.
  useEffect(() => {
    if (!spins) {
      return
    }
    const surface = canvas.current
    const drawing = leaders()
    if (!surface || !drawing) {
      return
    }

    let live = true
    let pill: Pill | undefined
    import('./pill')
      .then(({ mountPill }) => {
        if (!live) {
          return
        }
        pill = mountPill(surface, (points) => drawLeaders(drawing, scale.current, points))
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
  }, [spins, leaders, scale])

  // The flat pill does not move, so its leaders are drawn once rather than every frame.
  useEffect(() => {
    if (!drawn || spins) {
      return
    }
    const pill = flatPill.current
    const drawing = leaders()
    if (!pill || !drawing) {
      return
    }

    const draw = () => {
      const box = compositionBox(drawing.hero, pill, scale.current)
      const x = (box.left + box.right) / 2
      const y = box.middle
      drawLeaders(drawing, scale.current, [
        { x: x - 40, y: y - 70 },
        { x: x + 80, y: y + 40 },
      ])
    }

    draw()
    addEventListener('resize', draw)
    return () => removeEventListener('resize', draw)
  }, [drawn, spins, leaders, scale])

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
          <i className="v" style={{ left: '25%' }} />
          <i className="v" style={{ left: '50%' }} />
          <i className="v" style={{ left: '75%' }} />
          <i className="h" style={{ top: '28%' }} />
          <i className="h" style={{ top: '56%' }} />
          <b style={{ left: '25%', top: '28%' }} />
          <b style={{ left: '75%', top: '28%' }} />
          <b style={{ left: '25%', top: '56%' }} />
          <b style={{ left: '75%', top: '56%' }} />
        </div>

        <div className="top">
          <Link className="brand" to="/">
            PILL-FACTS
          </Link>
          <div className="meta">
            <span>Source</span>FDA drug labels
          </div>
        </div>

        <h1 ref={headline}>Your pills. Your facts.</h1>

        <div className="pill">
          {spins ? (
            <canvas ref={canvas} aria-hidden="true" />
          ) : (
            <div className="pill-flat" ref={flatPill} aria-hidden="true" />
          )}
        </div>

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
