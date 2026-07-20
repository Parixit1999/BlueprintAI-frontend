import { useState } from 'react'
import './App.css'

export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

const TABS = [
  { id: 'upload', label: 'Upload', description: 'Upload a drawing (DXF / vector PDF) for extraction.' },
  { id: 'review', label: 'Review', description: 'Verify extracted fields against the source crop before ingestion.' },
  { id: 'query', label: 'Query', description: 'Ask questions; answers come with highlighted source evidence.' },
]

function App() {
  const [activeTab, setActiveTab] = useState('upload')
  const tab = TABS.find((t) => t.id === activeTab)

  return (
    <div className="app">
      <header>
        <h1>BlueprintAI</h1>
        <p className="tagline">Query engineering drawings with verifiable evidence</p>
      </header>
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === activeTab ? 'tab active' : 'tab'}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <main>
        <p>{tab.description}</p>
        <p className="placeholder">Coming soon.</p>
      </main>
    </div>
  )
}

export default App
