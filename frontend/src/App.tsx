import { BrowserRouter, Link, Route, Routes } from 'react-router'
import './App.css'
import { DrugConceptPage } from './drugconcept/DrugConceptPage'
import { SearchPage } from './search/SearchPage'

function App() {
  return (
    <BrowserRouter>
      <main>
        <h1 className="masthead">
          <Link to="/">Pill-Facts</Link>
        </h1>
        <p className="tagline">FDA drug labelling, in the FDA&rsquo;s own words.</p>

        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/drug-concepts/:rxcui" element={<DrugConceptPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App
