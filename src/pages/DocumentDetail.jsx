import { Button } from '@mantine/core'
import { IconArrowLeft, IconTrash } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { confirmAndIngest, deleteFile, getExtraction } from '../api'
import { ConfidenceBadge } from '../components/Badges'
import ConfirmDialog from '../components/ConfirmDialog'
import DrawingViewer from '../components/DrawingViewer'
import PageHeader from '../components/PageHeader'
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
        `Ingested ${res.ingested_chunks} region${res.ingested_chunks === 1 ? '' : 's'}` +
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
      <Button
        variant="subtle"
        color="gray"
        size="compact-sm"
        leftSection={<IconArrowLeft size={16} />}
        onClick={() => navigate('/documents')}
        mb="xs"
      >
        Documents
      </Button>
      <PageHeader
        title={reviewing ? 'Review extraction' : 'Document'}
        description={
          reviewing
            ? 'Verify each region against the drawing. Click a region to highlight it; correct or reject anything wrong, then confirm.'
            : undefined
        }
        actions={
          <>
            {reviewing && chunks.length > 0 && (
              <Button loading={busy} onClick={confirm}>
                Confirm & ingest
              </Button>
            )}
            <Button
              variant="light"
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </Button>
          </>
        }
      />

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
                  <Button
                    variant="subtle"
                    color={rejected.has(i) ? 'brand' : 'red'}
                    size="compact-xs"
                    ml="auto"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleReject(i)
                    }}
                  >
                    {rejected.has(i) ? 'Restore' : 'Reject'}
                  </Button>
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
