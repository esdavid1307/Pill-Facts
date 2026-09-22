import { useEffect, useState } from 'react'
import './App.css'
import { fetchStatus } from './api/status'

type Loading = { state: 'loading' }
type Loaded = { state: 'loaded'; status: string }
type Unreachable = { state: 'unreachable' }
type BackendStatus = Loading | Loaded | Unreachable

function App() {
  const [backend, setBackend] = useState<BackendStatus>({ state: 'loading' })

  useEffect(() => {
    let current = true
    fetchStatus()
      .then(({ status }) => current && setBackend({ state: 'loaded', status }))
      .catch(() => current && setBackend({ state: 'unreachable' }))
    return () => {
      current = false
    }
  }, [])

  return (
    <main>
      <h1>Pill-Facts</h1>
      <p className="tagline">FDA drug labelling, in the FDA&rsquo;s own words.</p>

      <section className="status">
        <h2>Backend status</h2>
        {backend.state === 'loading' && <p>Asking the backend&hellip;</p>}
        {backend.state === 'loaded' && (
          <p>
            <strong>{backend.status}</strong>
          </p>
        )}
        {backend.state === 'unreachable' && (
          <p role="alert">We couldn&rsquo;t reach the backend.</p>
        )}
      </section>
    </main>
  )
}

export default App
