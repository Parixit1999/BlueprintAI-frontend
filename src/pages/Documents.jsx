import { Button } from '@mantine/core'
import { IconDatabaseImport, IconUpload } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { confirmAndIngest, deleteFile, listFiles, retryExtraction } from '../api'
import AssignModal from '../components/AssignModal'
import { StatusBadge } from '../components/Badges'
import CompareModal from '../components/CompareModal'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorState from '../components/ErrorState'
import Loading from '../components/Loading'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'extracted', label: 'Needs review' },
  { value: 'ingested', label: 'Ingested' },
  { value: 'failed', label: 'Failed' },
]

export default function Documents() {
  const [files, setFiles] = useState(null)
  const [loadError, setLoadError] = useState(null)
  // Filters live in the URL so they survive navigating to a document and back
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const typeFilter = searchParams.get('type') ?? 'all'
  const statusFilter = searchParams.get('status') ?? 'all'
  const assignedFilter = searchParams.get('assigned') ?? 'all'
  const dupOnly = searchParams.get('dup') === '1'
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [comparing, setComparing] = useState(null)
  const [assigning, setAssigning] = useState(null)
  const [retryingId, setRetryingId] = useState(null)
  const [confirmIngestAll, setConfirmIngestAll] = useState(false)
  const [bulkIngesting, setBulkIngesting] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  async function handleRetry(file) {
    setRetryingId(file.file_id)
    try {
      const res = await retryExtraction(file.file_id)
      toast.success(`Extracted ${res.chunks.length} regions from ${file.filename}.`)
      refresh()
    } catch (e) {
      toast.error(e.message)
      refresh() // error message on the row may have changed
    } finally {
      setRetryingId(null)
    }
  }

  function setFilter(key, value) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === '' || value === 'all' || value === false) next.delete(key)
        else next.set(key, value === true ? '1' : value)
        return next
      },
      { replace: true },
    )
  }

  function refresh() {
    return listFiles()
      .then((f) => {
        setFiles(f)
        setLoadError(null)
      })
      .catch((e) => (files ? toast.error(e.message) : setLoadError(e.message)))
  }

  useEffect(() => {
    refresh()
  }, [])

  const types = useMemo(
    () => [...new Set((files ?? []).map((f) => f.file_type))].sort(),
    [files],
  )
  const duplicateCount = useMemo(
    () => (files ?? []).filter((f) => f.is_duplicate).length,
    [files],
  )
  const pendingReviewCount = useMemo(
    () => (files ?? []).filter((f) => f.status === 'extracted').length,
    [files],
  )

  const filtered = useMemo(() => {
    return (files ?? []).filter((f) => {
      if (query && !f.filename.toLowerCase().includes(query.toLowerCase())) return false
      if (typeFilter !== 'all' && f.file_type !== typeFilter) return false
      if (statusFilter !== 'all' && f.status !== statusFilter) return false
      if (assignedFilter === 'yes' && !f.drawing_id) return false
      if (assignedFilter === 'no' && f.drawing_id) return false
      if (dupOnly && !f.is_duplicate) return false
      return true
    })
  }, [files, query, typeFilter, statusFilter, assignedFilter, dupOnly])

  // Bulk-confirm every document awaiting review, as extracted (no
  // corrections). Three at a time, same as uploads; each document is
  // protected by the backend's atomic ingest claim.
  async function ingestAll() {
    setConfirmIngestAll(false)
    setBulkIngesting(true)
    const queue = (files ?? []).filter((f) => f.status === 'extracted')
    let ok = 0
    let failed = 0
    const worker = async () => {
      for (;;) {
        const f = queue.shift()
        if (!f) return
        try {
          await confirmAndIngest(f.file_id, {}, [])
          ok++
        } catch (e) {
          if (!/already/i.test(e.message)) failed++
        }
        refresh()
      }
    }
    // show the Processing badges as soon as the claims land
    setTimeout(refresh, 1200)
    await Promise.all(Array.from({ length: 3 }, worker))
    setBulkIngesting(false)
    refresh()
    if (failed) toast.error(`${ok} added to the knowledge base; ${failed} failed — see the list for details.`)
    else toast.success(`${ok} document${ok === 1 ? '' : 's'} added to the knowledge base.`)
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await deleteFile(pendingDelete.file_id)
      toast.success(`Deleted ${pendingDelete.filename}.`)
      setPendingDelete(null)
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Engineering drawings in the knowledge base"
        onRefresh={refresh}
        actions={
          <>
            {pendingReviewCount > 0 && (
              <Button
                variant="default"
                leftSection={<IconDatabaseImport size={16} />}
                loading={bulkIngesting}
                onClick={() => setConfirmIngestAll(true)}
              >
                Ingest all ({pendingReviewCount})
              </Button>
            )}
            <Button leftSection={<IconUpload size={16} />} onClick={() => navigate('/upload')}>
              Upload drawings
            </Button>
          </>
        }
      />

      {duplicateCount > 0 && (
        <div className="notice">
          <span className="notice-icon">!</span>
          <span>
            {duplicateCount} document{duplicateCount > 1 ? 's look' : ' looks'} like a possible
            duplicate — the same drawing content appears more than once, even across file formats.
            Review the matches and delete the extra copies.
          </span>
          <Button
            variant="subtle"
            color="orange"
            size="compact-sm"
            style={{ flexShrink: 0 }}
            onClick={() => setFilter('dup', !dupOnly)}
          >
            {dupOnly ? 'Show all' : 'Show duplicates'}
          </Button>
        </div>
      )}

      {files === null && loadError ? (
        <ErrorState message={loadError} onRetry={refresh} />
      ) : files === null ? (
        <Loading label="Loading documents…" />
      ) : files.length === 0 ? (
        <div className="empty-state">
          <p>No documents yet.</p>
          <p className="page-sub">Upload a DXF, PDF, or drawing photo to get started.</p>
        </div>
      ) : (
        <>
          <div className="filters">
            <input
              className="search"
              placeholder="Search by name…"
              value={query}
              onChange={(e) => setFilter('q', e.target.value)}
            />
            <select value={typeFilter} onChange={(e) => setFilter('type', e.target.value)}>
              <option value="all">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t.toUpperCase()}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setFilter('status', e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select value={assignedFilter} onChange={(e) => setFilter('assigned', e.target.value)}>
              <option value="all">All assignments</option>
              <option value="yes">Assigned</option>
              <option value="no">Unassigned</option>
            </select>
            <label className="dup-toggle">
              <input type="checkbox" checked={dupOnly} onChange={(e) => setFilter('dup', e.target.checked)} />
              Duplicates only
            </label>
            <span className="filter-count">
              {filtered.length} of {files.length}
            </span>
          </div>

          <div className="panel table-panel">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Assignment</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th className="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => {
                  const match = f.similar_documents?.[0]
                  return (
                  <tr key={f.file_id} onClick={() => navigate(`/documents/${f.file_id}`)}>
                    <td className="cell-name">
                      <div className="name-cell">
                        <span>{f.filename}</span>
                        {f.is_drawing === false && (
                          <span
                            className="dup-tag not-drawing-tag"
                            title="The AI judged this image is not an engineering drawing — check it before ingesting."
                          >
                            Not a drawing
                          </span>
                        )}
                        {f.is_duplicate && (
                          <span
                            className="dup-tag"
                            title={
                              match
                                ? `${Math.round(match.similarity * 100)}% similar to ${match.filename}`
                                : 'Possible duplicate'
                            }
                          >
                            Possible duplicate
                          </span>
                        )}
                      </div>
                      {match && (
                        <div className="dup-match">
                          {Math.round(match.similarity * 100)}% similar to {match.filename}
                        </div>
                      )}
                      {f.status === 'failed' && f.error && (
                        <div className="error-match">{f.error}</div>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {f.drawing_id ? (
                        <>
                          <Button
                            variant="light"
                            size="compact-xs"
                            onClick={() => navigate(`/drawings/${f.drawing_id}`)}
                          >
                            {f.dwg_number ?? 'Drawing'}
                          </Button>
                          {f.auto_assigned && (
                            <span
                              className="dup-tag"
                              style={{ marginLeft: 6 }}
                              title="Assigned automatically from an exact drawing-number match"
                            >
                              auto
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="cell-type">{f.file_type.toUpperCase()}</td>
                    <td>
                      <StatusBadge status={f.status} />
                    </td>
                    <td className="cell-date" title={new Date(f.created_at).toLocaleString()}>
                      {new Date(f.created_at).toLocaleDateString()}
                    </td>
                    <td className="cell-action" onClick={(e) => e.stopPropagation()}>
                      {/* Fixed slots so actions line up in columns across rows */}
                      <div className="action-grid">
                        <span>
                          {!f.drawing_id && f.status !== 'failed' && (
                            <Button
                              variant="subtle"
                              color="grape"
                              size="compact-xs"
                              onClick={() => setAssigning(f)}
                            >
                              Assign
                            </Button>
                          )}
                        </span>
                        <span>
                          {f.is_duplicate && (
                            <Button
                              variant="subtle"
                              color="orange"
                              size="compact-xs"
                              onClick={() => setComparing(f)}
                            >
                              Compare
                            </Button>
                          )}
                        </span>
                        <span>
                          {f.status === 'failed' ? (
                            <Button
                              variant="subtle"
                              size="compact-xs"
                              loading={retryingId === f.file_id}
                              onClick={() => handleRetry(f)}
                            >
                              Retry
                            </Button>
                          ) : (
                            <Button
                              variant="subtle"
                              size="compact-xs"
                              onClick={() => navigate(`/documents/${f.file_id}`)}
                            >
                              {f.status === 'extracted' ? 'Review' : 'View'}
                            </Button>
                          )}
                        </span>
                        <span>
                          <Button
                            variant="subtle"
                            color="red"
                            size="compact-xs"
                            onClick={() => setPendingDelete(f)}
                          >
                            Delete
                          </Button>
                        </span>
                      </div>
                    </td>
                  </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr className="no-hover">
                    <td colSpan={6} className="empty-note center">
                      No documents match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {assigning && (
        <AssignModal
          file={assigning}
          onClose={() => setAssigning(null)}
          onAssigned={() => {
            setAssigning(null)
            refresh()
          }}
        />
      )}

      {comparing && (
        <CompareModal
          file={comparing}
          allFiles={files ?? []}
          onClose={() => setComparing(null)}
          onDeleted={() => {
            setComparing(null)
            refresh()
          }}
        />
      )}

      {confirmIngestAll && (
        <ConfirmDialog
          title={`Ingest all ${pendingReviewCount} documents?`}
          message={
            <>
              This adds all {pendingReviewCount} documents awaiting review to the knowledge base{' '}
              <strong>as extracted, without individual review</strong> — including any
              low-confidence regions. You can still open, re-extract, or delete any document
              afterwards. Large drawings take a few minutes each; they’ll show as
              “Processing” while they’re added.
            </>
          }
          confirmLabel="Ingest all"
          busy={bulkIngesting}
          onConfirm={ingestAll}
          onCancel={() => setConfirmIngestAll(false)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete document?"
          message={
            <>
              <strong>{pendingDelete.filename}</strong> and all of its extracted regions will be
              permanently removed. This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
