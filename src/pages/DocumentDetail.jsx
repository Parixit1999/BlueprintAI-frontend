import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { confirmAndIngest, deleteFile, getExtraction } from '../api'
import { ConfidenceBadge } from '../components/Badges'
import ConfirmDialog from '../components/ConfirmDialog'
import DrawingViewer from '../components/DrawingViewer'
import { useToast } from '../components/Toast'

export default function DocumentDetail() {
  const { fileId } = useParams()
  const [status, setStatus] = useState(null)
  const [chunks, setChunks] = useState([])
  const [edits, setEdits] = useState({})
  const [rejected, setRejected] = useState(new Set())
  const [focused, setFocused] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    getExtraction(fileId)
      .then((res) => {
        setChunks(res.chunks)
        setStatus(res.status)
      })
      .catch((e) => toast.error(e.message))
  }, [fileId])

  const reviewing = status === 'extracted'

  function toggleReject(i) {
    const next = new Set(rejected)
    next.has(i) ? next.delete(i) : next.add(i)
    setRejected(next)
  }

  async function confirm() {
    setBusy(true)
    try {
      const corrections = Object.fromEntries(
        Object.entries(edits).filter(([i, v]) => v !== (chunks[i].chunk_text ?? '')),
      )
      const res = await confirmAndIngest(fileId, corrections, [...rejected])
      setStatus('ingested')
      toast.success(
        `Ingested ${res.ingested_chunks} chunks` +
          (Object.keys(corrections).length ? ` with ${Object.keys(corrections).length} correction(s)` : '') +
          (res.rejected ? `, ${res.rejected} rejected` : '') +
          '.',
      )
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteFile(fileId)
      toast.success('Document deleted.')
      navigate('/documents')
    } catch (e) {
      toast.error(e.message)
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="page-header row">
        <div>
          <Link to="/documents" className="back-link">
            ← Documents
          </Link>
          <h1>{reviewing ? 'Review extraction' : 'Document'}</h1>
          {reviewing && (
            <p className="page-sub">
              Verify each region against the drawing. Click a region to highlight it; correct or
              reject anything wrong, then confirm.
            </p>
          )}
        </div>
        <div className="header-actions">
          {reviewing && chunks.length > 0 && (
            <button className="primary" disabled={busy} onClick={confirm}>
              {busy ? 'Ingesting…' : 'Confirm & ingest'}
            </button>
          )}
          <button className="ghost danger-text" onClick={() => setConfirmingDelete(true)}>
            Delete
          </button>
        </div>
      </div>

      <div className="detail-grid">
        <div className="panel viewer-panel">
          <DrawingViewer
            fileId={fileId}
            highlightBbox={focused != null ? chunks[focused]?.bbox : null}
            page={focused != null ? (chunks[focused]?.page ?? 1) : 1}
          />
        </div>
        <div className="chunk-list">
          {chunks.map((c, i) => (
            <div
              key={i}
              className={[
                'chunk-card',
                rejected.has(i) && 'rejected',
                focused === i && 'focused',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setFocused(i)}
            >
              <div className="chunk-meta">
                <span className="region">{c.region_type.replace('_', ' ')}</span>
                <ConfidenceBadge level={c.confidence} />
                {!c.bbox && <span className="muted">no location</span>}
                {reviewing && (
                  <button
                    className="link-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleReject(i)
                    }}
                  >
                    {rejected.has(i) ? 'Restore' : 'Reject'}
                  </button>
                )}
              </div>
              {reviewing ? (
                <input
                  value={edits[i] ?? c.chunk_text ?? ''}
                  placeholder="(unreadable — type the correct value or reject)"
                  disabled={rejected.has(i)}
                  onChange={(e) => setEdits({ ...edits, [i]: e.target.value })}
                />
              ) : (
                <p className="chunk-text">{c.chunk_text ?? <em>(unreadable)</em>}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete document?"
          message="This document, its extracted regions, and its stored files will be permanently removed. This cannot be undone."
          confirmLabel="Delete"
          danger
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  )
}
