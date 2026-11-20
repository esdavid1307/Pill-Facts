import type { ReactNode } from 'react'
import { Link } from 'react-router'
import './App.css'

/**
 * The frame every page but the landing wears: the landing's top bar, grid and footer, so
 * that leaving the landing reads as going deeper into the same drawing rather than onto
 * another site.
 *
 * The landing carries its own brand, headline and footer as part of a fixed composition,
 * so it is deliberately outside this. The brand here is a link and not a heading: the
 * page inside names itself with its own <h1>. See ADR-0014.
 */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="page">
      <div className="page-grid" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <header className="page-top">
        <Link to="/" className="brand">
          Pill-Facts
        </Link>
        <p className="meta">
          <span>Source</span> FDA drug labels
        </p>
      </header>
      <main className="page-body">{children}</main>
      <footer className="page-foot">
        <span>Talk to a pharmacist or doctor before changing any medication.</span>
        <span>&copy; Pill-Facts</span>
      </footer>
    </div>
  )
}
