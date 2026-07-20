import { useState } from 'react'
import './App.css'
import QueryView from './views/QueryView'
import ReviewView from './views/ReviewView'
import UploadView from './views/UploadView'

const TABS = [
  { id: 'upload', label: 'Upload' },
  { id: 'review', label: 'Review' },
  { id: 'query', label: 'Query' },
]

function App() {
  const [activeTab, setActiveTab] = useState('upload')

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
        {activeTab === 'upload' && <UploadView onUploaded={() => setActiveTab('review')} />}
        {activeTab === 'review' && <ReviewView />}
        {activeTab === 'query' && <QueryView />}
      </main>
    </div>
  )
}

export default App
