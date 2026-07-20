import { useState } from 'react'
import { ask } from '../api'
import DrawingViewer from './DrawingViewer'

export default function QueryView() {
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [focused, setFocused] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!question.trim()) return
    setBusy(true)
    setError(null)
    setFocused(null)
    try {
      setResult(await ask(question))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="query-form">
        <input
          value={question}
          placeholder="e.g. What material is the mounting plate made of?"
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button className="primary" disabled={busy} type="submit">
          {busy ? 'Thinking…' : 'Ask'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {result && (
        <div className="answer">
          <h3>Answer</h3>
          <p>{result.answer}</p>
          <h3>Evidence</h3>
          <p className="placeholder hint">Click an evidence card to see it highlighted on the drawing.</p>
          {focused != null && result.evidence[focused] && (
            <DrawingViewer
              fileId={result.evidence[focused].source_file_id}
              highlightBbox={result.evidence[focused].bbox}
              page={result.evidence[focused].page ?? 1}
            />
          )}
          {result.evidence.map((h, i) => (
            <div
              key={i}
              className={focused === i ? 'chunk focused' : 'chunk'}
              onClick={() => setFocused(i)}
            >
              <div className="chunk-meta">
                <span className="region">{h.region_type}</span>
                <span className="bbox">
                  {h.bbox ? `bbox [${h.bbox.map((n) => n.toFixed(0)).join(', ')}]` : 'no bbox'}
                </span>
                <span className="score">score {h.score}</span>
              </div>
              <p>{h.chunk_text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
