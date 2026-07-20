import { useEffect, useState } from 'react'
import { confirmAndIngest, getExtraction, listFiles } from '../api'
import DrawingViewer from './DrawingViewer'

function ConfidenceBadge({ level }) {
  return <span className={`badge badge-${level}`}>{level}</span>
}

export default function ReviewView() {
  const [files, setFiles] = useState([])
  const [selected, setSelected] = useState(null)
  const [chunks, setChunks] = useState([])
  const [edits, setEdits] = useState({})
  const [rejected, setRejected] = useState(new Set())
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [focusedChunk, setFocusedChunk] = useState(null)

  useEffect(() => {
    listFiles().then(setFiles).catch((e) => setError(e.message))
  }, [])

  async function open(fileId) {
    setSelected(fileId)
    setEdits({})
    setRejected(new Set())
    setStatus(null)
    setError(null)
    setFocusedChunk(null)
    try {
      const res = await getExtraction(fileId)
      setChunks(res.chunks)
      setStatus(res.status)
    } catch (e) {
      setError(e.message)
    }
  }

  function toggleReject(i) {
    const next = new Set(rejected)
    next.has(i) ? next.delete(i) : next.add(i)
    setRejected(next)
  }

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const corrections = Object.fromEntries(
        Object.entries(edits).filter(([i, v]) => v !== (chunks[i].chunk_text ?? '')),
      )
      const res = await confirmAndIngest(selected, corrections, [...rejected])
      setStatus('ingested')
      setFiles(await listFiles())
      alert(`Ingested ${res.ingested_chunks} chunks (${res.rejected} rejected).`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="review">
      <div className="file-list">
        <h3>Files</h3>
        {files.length === 0 && <p className="placeholder">Nothing uploaded yet.</p>}
        {files.map((f) => (
          <button
            key={f.file_id}
            className={f.file_id === selected ? 'file-item active' : 'file-item'}
            onClick={() => open(f.file_id)}
          >
            {f.filename} <span className="placeholder">({f.status})</span>
          </button>
        ))}
      </div>
      <div className="chunk-panel">
        {!selected && <p className="placeholder">Select a file to review its extraction.</p>}
        {selected && (
          <>
            <DrawingViewer
              fileId={selected}
              highlightBbox={focusedChunk != null ? chunks[focusedChunk]?.bbox : null}
              page={focusedChunk != null ? (chunks[focusedChunk]?.page ?? 1) : 1}
            />
            <p className="placeholder hint">Click a chunk to highlight its region on the drawing.</p>
            {chunks.map((c, i) => (
              <div
                key={i}
                className={[
                  'chunk',
                  rejected.has(i) && 'rejected',
                  focusedChunk === i && 'focused',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setFocusedChunk(i)}
              >
                <div className="chunk-meta">
                  <span className="region">{c.region_type}</span>
                  <ConfidenceBadge level={c.confidence} />
                  {c.bbox && (
                    <span className="bbox">
                      bbox [{c.bbox.map((n) => n.toFixed(0)).join(', ')}]
                    </span>
                  )}
                  <button className="link" onClick={() => toggleReject(i)}>
                    {rejected.has(i) ? 'restore' : 'reject'}
                  </button>
                </div>
                <input
                  value={edits[i] ?? c.chunk_text ?? ''}
                  placeholder="(unreadable - type the correct value or reject)"
                  disabled={status === 'ingested' || rejected.has(i)}
                  onChange={(e) => setEdits({ ...edits, [i]: e.target.value })}
                />
              </div>
            ))}
            {status !== 'ingested' && chunks.length > 0 && (
              <button className="primary" disabled={busy} onClick={confirm}>
                {busy ? 'Ingesting…' : 'Confirm & ingest'}
              </button>
            )}
            {status === 'ingested' && <p className="success">Already ingested.</p>}
          </>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
