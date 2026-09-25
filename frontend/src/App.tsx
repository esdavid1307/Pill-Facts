import { BrowserRouter, Route, Routes } from 'react-router'
import { DrugConceptPage } from './drugconcept/DrugConceptPage'
import { LandingPage } from './landing/LandingPage'
import { SearchPage } from './search/SearchPage'
import { Shell } from './Shell'

/**
 * Three surfaces: the landing a reader arrives on, the results page they see only when a
 * query was genuinely ambiguous, and a Drug Concept's labelling. See ADR-0014 for why
 * results are a route of their own rather than something the landing unfolds into.
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/search"
          element={
            <Shell>
              <SearchPage />
            </Shell>
          }
        />
        <Route
          path="/drug-concepts/:rxcui"
          element={
            <Shell>
              <DrugConceptPage />
            </Shell>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
