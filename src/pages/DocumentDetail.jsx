import { Button, SegmentedControl, Textarea, Tooltip } from '@mantine/core'
import { IconArrowLeft, IconMessageCircle, IconSparkles, IconTrash } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { confirmAndIngest, deleteFile, getExtraction, reextractFile } from '../api'
import { ConfidenceBadge } from '../components/Badges'
import ConfirmDialog from '../components/ConfirmDialog'
import DrawingViewer from '../components/DrawingViewer'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'

export default function DocumentDetail() {
  const { fileId } = useParams()
  const [status, setStatus] = useState(null)
  const [filename, setFilename] = useState(null)
  const [isDrawing, setIsDrawing] = useState(null)
  const [chunks, setChunks] = useState([])
  const [edits, setEdits] = useState({})
  const [rejected, setRejected] = useState(new Set())
  const [focused, setFocused] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [reextracting, setReextracting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    getExtraction(fileId)
      .then((res) => {
        setChunks(res.chunks)
        setStatus(res.status)
        setFilename(res.filename ?? null)
        setIsDrawing(res.is_drawing ?? null)
      })
      .catch((e) => toast.error(e.message))
  }, [fileId])

  const [regionFilter, setRegionFilter] = useState('all')

  const reviewing = status === 'extracted'

  // Pipeline disclosures (e.g. "converted from DWG") surface as a banner, not
  // review cards - they are not drawing content and are never ingested.
  const advisories = chunks.filter((c) => c.advisory)

  // Title blocks carry the identifying facts, so they lead; the original
  // extraction index (i) stays attached because edits/rejections key on it.
  const TYPE_ORDER = { summary: 0, title_block: 1, bom: 2, dimension: 3, note: 4 }
  const visibleChunks = chunks
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !c.advisory)
    .filter(({ c }) => regionFilter === 'all' || c.region_type === regionFilter)
    .sort(
      (a, b) =>
        (TYPE_ORDER[a.c.region_type] ?? 9) - (TYPE_ORDER[b.c.region_type] ?? 9) ||
        a.i - b.i,
    )
  const typeCounts = chunks.reduce((acc, c) => {
    if (c.advisory) return acc
    acc[c.region_type] = (acc[c.region_type] ?? 0) + 1
    return acc
  }, {})
  const reviewableCount = chunks.filter((c) => !c.advisory).length
  const ingesting = status === 'ingesting'

  // Ingestion embeds every region (minutes for dense sheets). While it runs,
  // poll so the page flips to the finished state on its own - including when
  // the user navigated away mid-ingest and came back.
  useEffect(() => {
    if (!ingesting) return
    const timer = setInterval(() => {
      getExtraction(fileId)
        .then((res) => setStatus(res.status))
        .catch(() => {})
    }, 4000)
    return () => clearInterval(timer)
  }, [ingesting, fileId])

  function toggleReject(i) {
    const next = new Set(rejected)
    next.has(i) ? next.delete(i) : next.add(i)
    setRejected(next)
  }

  async function confirm() {
    setBusy(true)
    setStatus('ingesting') // reflect the claim immediately; polling takes over
    try {
      const corrections = Object.fromEntries(
        Object.entries(edits).filter(([i, v]) => v !== (chunks[i].chunk_text ?? '')),
      )
      const res = await confirmAndIngest(fileId, corrections, [...rejected])
      setStatus('ingested')
      toast.success(
        `Added ${res.ingested_chunks} region${res.ingested_chunks === 1 ? '' : 's'} to the knowledge base` +
          (Object.keys(corrections).length ? ` with ${Object.keys(corrections).length} correction(s)` : '') +
          (res.rejected ? `, ${res.rejected} rejected` : '') +
          '.',
      )
    } catch (e) {
      // a concurrent confirm already claimed it - the poll will finish the job
      if (!/already being added|already in the knowledge base/i.test(e.message)) {
        setStatus('extracted')
        toast.error(e.message)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleReextract() {
    setReextracting(true)
    try {
      const res = await reextractFile(fileId)
      setChunks(res.chunks)
      setStatus('extracted')
      setEdits({})
      setRejected(new Set())
      setFocused(null)
      toast.success(
        `Re-read the drawing: ${res.chunks.length} regions found. Review and confirm to update the knowledge base.`,
      )
    } catch (e) {
      toast.error(e.message)
    } finally {
      setReextracting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteFile(fileId)
      toast.success('Document deleted.')
      if (window.history.state?.idx > 0) navigate(-1)
      else navigate('/documents')
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
        onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/documents'))}
        mb="xs"
      >
        Documents
      </Button>
      <PageHeader
        title={reviewing ? 'Review extraction' : 'Document'}
        description={
          reviewing
            ? 'Verify each region against the drawing. Click a region to highlight it; correct or reject anything wrong, then confirm.'
            : ingesting
              ? 'Adding this document to the knowledge base — this can take a few minutes for large drawings. You can leave this page; we’ll keep working in the background.'
              : undefined
        }
        actions={
          <>
            {reviewing && chunks.length > 0 && (
              <Button loading={busy} onClick={confirm}>
                Confirm & ingest
              </Button>
            )}
            {ingesting && (
              <Button loading disabled>
                Processing…
              </Button>
            )}
            {status === 'ingested' && (
              <Button
                leftSection={<IconMessageCircle size={16} />}
                onClick={() =>
                  navigate(
                    `/chat?file=${fileId}${filename ? `&name=${encodeURIComponent(filename)}` : ''}`,
                  )
                }
              >
                Ask about this drawing
              </Button>
            )}
            {status === 'ingested' && (
              <Button
                variant="default"
                loading={reextracting}
                onClick={handleReextract}
                title="Re-read this drawing with the current AI models — useful after model upgrades. You review the regions again before they replace the knowledge base entries."
              >
                Re-extract with latest AI
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

      {advisories.map((a, idx) => (
        <div className="notice notice-info" key={idx}>
          <span className="notice-icon">i</span>
          <span>{a.chunk_text}</span>
        </div>
      ))}

      {isDrawing === false && (
        <div className="notice">
          <span className="notice-icon">!</span>
          <span>
            The AI judged that this image is <strong>not an engineering drawing</strong> — see
            its summary for what it appears to be. If it was uploaded by mistake, delete it;
            ingesting it would add non-drawing content to the knowledge base.
          </span>
        </div>
      )}

      <div className="detail-grid">
        <div className="panel viewer-panel">
          <DrawingViewer
            fileId={fileId}
            highlightBbox={focused != null ? chunks[focused]?.bbox : null}
            page={focused != null ? (chunks[focused]?.page ?? 1) : 1}
          />
        </div>
        <div className="chunk-list">
          <SegmentedControl
            size="xs"
            fullWidth
            mb="xs"
            value={regionFilter}
            onChange={setRegionFilter}
            data={[
              { value: 'all', label: `All (${reviewableCount})` },
              ...['summary', 'title_block', 'bom', 'dimension', 'note']
                .filter((t) => typeCounts[t])
                .map((t) => ({
                  value: t,
                  label: `${t === 'title_block' ? 'Title block' : t === 'bom' ? 'BOM' : t === 'summary' ? 'Summary' : t[0].toUpperCase() + t.slice(1) + 's'} (${typeCounts[t]})`,
                })),
            ]}
          />
          {visibleChunks.map(({ c, i }) => (
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
                {c.region_type === 'summary' && (
                  <Tooltip
                    label="Written by AI from the drawing image — not text printed on the drawing. Review and edit it like any other region."
                    maw={300}
                    multiline
                    withArrow
                  >
                    <IconSparkles size={14} color="var(--mantine-color-brand-6)" />
                  </Tooltip>
                )}
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
                // autosize so long text (summaries especially) is fully
                // visible and editable, not clipped to one line
                <Textarea
                  autosize
                  minRows={1}
                  maxRows={10}
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
