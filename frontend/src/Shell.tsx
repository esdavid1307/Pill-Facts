import type { ReactNode } from 'react'
import { Link } from 'react-router'
import './App.css'

/**
 * The masthead every page but the landing wears.
 *
 * The landing carries its own brand, headline and footer as part of a fixed composition,
 * so it is deliberately outside this: wrapping it would put a second <h1> and a second
 * brand mark on the page. See ADR-0014.
 */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="page">
      <h1 className="masthead">
        <Link to="/">Pill-Facts</Link>
      </h1>
      <p className="tagline">FDA drug labelling, in the FDA&rsquo;s own words.</p>
      {children}
    </main>
  )
}
