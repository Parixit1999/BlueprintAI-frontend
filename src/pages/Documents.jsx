import {
  ActionIcon,
  Button,
  Checkbox,
  Select,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconDatabaseImport,
  IconSearch,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { confirmAndIngest, deleteFile, listFilesPaged, retryExtraction } from '../api'
import AssignModal from '../components/AssignModal'
import { StatusBadge } from '../components/Badges'
import CompareModal from '../components/CompareModal'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorState from '../components/ErrorState'
import Loading from '../components/Loading'
import PageHeader from '../components/PageHeader'
import TablePagination from '../components/TablePagination'
import { useToast } from '../components/Toast'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  // one option for both server-side busy states: extraction ('uploaded')
  // and knowledge-base ingestion ('ingesting')
  { value: 'processing', label: 'Processing' },
  { value: 'extracted', label: 'Needs review' },
  { value: 'ingested', label: 'Ingested' },
  { value: 'failed', label: 'Failed' },
]
const PAGE_SIZE = 10

export default function Documents() {
  const [files, setFiles] = useState(null)
  const [loadError, setLoadError] = useState(null)
  // documents waiting for a bulk-ingest worker slot (client-side status)
  const [queuedIds, setQueuedIds] = useState(new Set())
  // Filters live in the URL so they survive navigating to a document and back
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const typeFilter = searchParams.get('type') ?? 'all'
  const statusFilter = searchParams.get('status') ?? 'all'
  const assignedFilter = searchParams.get('assigned') ?? 'all'
  const dupOnly = searchParams.get('dup') === '1'
  const sortKey = searchParams.get('sort') ?? 'uploaded'
  const sortDir = searchParams.get('dir') ?? 'desc'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [comparing, setComparing] = useState(null)
  const [assigning, setAssigning] = useState(null)
  const [retryingId, setRetryingId] = useState(null)
  const [confirmIngestAll, setConfirmIngestAll] = useState(false)
  const [bulkIngesting, setBulkIngesting] = useState(false)
  const [bulkRetrying, setBulkRetrying] = useState(false)
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
        // changing what's shown restarts at page 1 (unless paging itself)
        if (key !== 'page') next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  // clicking a header sorts by it; clicking again flips direction
  function toggleSort(key) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        const dir = prev.get('sort') === key && (prev.get('dir') ?? 'desc') === 'asc' ? 'desc' : 'asc'
        next.set('sort', key)
        next.set('dir', dir)
        next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  // Server-side listing: filters, sort, and paging all run in SQL - the
  // page costs the same whether the archive has 14 documents or 14,000.
  const listParams = {
    q: query, file_type: typeFilter, status: statusFilter,
    assigned: assignedFilter, dup_only: dupOnly, sort: sortKey, dir: sortDir,
    page, page_size: PAGE_SIZE,
  }
  function refresh() {
    return listFilesPaged(listParams)
      .then((d) => {
        setFiles(d)
        setLoadError(null)
      })
      .catch((e) => (files ? toast.error(e.message) : setLoadError(e.message)))
  }

  // refetch on any parameter change; keystrokes in search debounce briefly
  useEffect(() => {
    const t = setTimeout(refresh, query ? 250 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, typeFilter, statusFilter, assignedFilter, dupOnly, sortKey, sortDir, page])

  const items = files?.items ?? []
  const types = files?.types ?? []
  const duplicateCount = files?.duplicate_count ?? 0
  const pendingReviewCount = files?.pending_review_count ?? 0
  const failedCount = files?.failed_count ?? 0
  const totalFiltered = files?.total ?? 0
  const grandTotal = files?.grand_total ?? 0
  const pageCount = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)

  // constant-size ↑↓ pair on every sortable column - only the active
  // direction lights up, so nothing ever changes size on click
  const sortIndicator = (key) => (
    <span className="sort-arrow">
      <span className={sortKey === key && sortDir === 'asc' ? 'on' : ''}>↑</span>
      <span className={sortKey === key && sortDir === 'desc' ? 'on' : ''}>↓</span>
    </span>
  )

  // Bulk-confirm every document awaiting review, as extracted (no
  // corrections). Three at a time, same as uploads; each document is
  // protected by the backend's atomic ingest claim.

  // One click re-queues every failed document (deploys and dead workers mark
  // their in-flight extractions failed; re-running them is routine, not rare).
  async function retryAllFailed() {
    setBulkRetrying(true)
    let queue = []
    try {
      const res = await listFilesPaged({ status: 'failed', page_size: 100 })
      queue = res.items
    } catch (e) {
      toast.error(e.message)
      setBulkRetrying(false)
      return
    }
    let ok = 0
    const worker = async () => {
      for (;;) {
        const f = queue.shift()
        if (!f) return
        try {
          await retryExtraction(f.file_id)
          ok++
        } catch {
          // row keeps its error state; individual Retry still available
        }
      }
    }
    await Promise.all(Array.from({ length: 3 }, worker))
    setBulkRetrying(false)
    refresh()
    toast.success(`${ok} document${ok === 1 ? '' : 's'} queued for re-extraction.`)
  }

  async function ingestAll() {
    setConfirmIngestAll(false)
    setBulkIngesting(true)
    // the visible page may not hold every reviewable document - ask the
    // server for the full extracted set
    let queue = []
    try {
      const res = await listFilesPaged({ status: 'extracted', page_size: 100 })
      queue = res.items
    } catch (e) {
      toast.error(e.message)
      setBulkIngesting(false)
      return
    }
    // every document acknowledges the click IMMEDIATELY: those beyond the
    // worker pool show "Queued" until a worker claims them (server status
    // then takes over via refresh)
    setQueuedIds(new Set(queue.map((f) => f.file_id)))
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
        setQueuedIds((prev) => {
          const next = new Set(prev)
          next.delete(f.file_id)
          return next
        })
        refresh()
      }
    }
    // show the Processing badges as soon as the claims land
    setTimeout(refresh, 1200)
    await Promise.all(Array.from({ length: 3 }, worker))
    setBulkIngesting(false)
    setQueuedIds(new Set())
    refresh()
    // confirms return instantly ('ingesting' claims); embedding runs
    // server-side - rows flip to Ingested as each one finishes
    if (failed) toast.error(`${ok} ingesting in the background; ${failed} failed to start - see the list.`)
    else toast.success(`${ok} document${ok === 1 ? '' : 's'} ingesting in the background - status updates as each finishes.`)
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
            {failedCount > 0 && (
              <Button
                variant="light"
                color="orange"
                loading={bulkRetrying}
                onClick={retryAllFailed}
              >
                Retry {failedCount} failed
              </Button>
            )}
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
            duplicate - the same drawing content appears more than once, even across file formats.
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
      ) : grandTotal === 0 ? (
        // keep the table frame even when empty - the page reads as the same
        // screen it will be once documents exist, not a different layout
        <div className="panel table-panel">
          <table className="table-fixed">
              <colgroup>
                <col />
                <col style={{ width: 180 }} />
                <col style={{ width: 74 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 104 }} />
                {/* widest real case: Assign + Review + delete icon */}
                <col style={{ width: 200 }} />
              </colgroup>

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
              <tr className="no-hover">
                <td colSpan={6} className="empty-note center">
                  No documents yet - upload a DXF, DWG, RVT, PDF, or drawing photo to get
                  started.{' '}
                  <Button variant="subtle" size="compact-sm" onClick={() => navigate('/upload')}>
                    Upload drawings
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {/* Filters use the same controls as the rest of the app so the page
              reads as one surface; state and handlers are unchanged. */}
          <div className="filters">
            <TextInput
              placeholder="Search by name…"
              value={query}
              onChange={(e) => setFilter('q', e.currentTarget.value)}
              leftSection={<IconSearch size={16} />}
              size="sm"
              w={280}
            />
            <Select
              size="sm"
              w={128}
              aria-label="Filter by file type"
              value={typeFilter}
              onChange={(v) => setFilter('type', v ?? 'all')}
              allowDeselect={false}
              data={[
                { value: 'all', label: 'All types' },
                ...types.map((t) => ({ value: t, label: t.toUpperCase() })),
              ]}
            />
            <Select
              size="sm"
              w={158}
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(v) => setFilter('status', v ?? 'all')}
              allowDeselect={false}
              data={STATUS_OPTIONS}
            />
            <Select
              size="sm"
              w={158}
              aria-label="Filter by assignment"
              value={assignedFilter}
              onChange={(v) => setFilter('assigned', v ?? 'all')}
              allowDeselect={false}
              data={[
                { value: 'all', label: 'All assignments' },
                { value: 'yes', label: 'Assigned' },
                { value: 'no', label: 'Unassigned' },
              ]}
            />
            <Checkbox
              size="sm"
              label="Duplicates only"
              checked={dupOnly}
              onChange={(e) => setFilter('dup', e.currentTarget.checked)}
              styles={{ label: { fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' } }}
            />
            <span className="filter-count">
              {totalFiltered} of {grandTotal}
            </span>
          </div>

          <div className="panel table-panel">
            <table className="table-fixed">
              <colgroup>
                <col />
                <col style={{ width: 180 }} />
                <col style={{ width: 74 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 104 }} />
                {/* widest real case: Assign + Review + delete icon */}
                <col style={{ width: 200 }} />
              </colgroup>

              <thead>
                <tr>
                  <th className="th-sortable" onClick={() => toggleSort('name')}>
                    Name{sortIndicator('name')}
                  </th>
                  <th className="th-sortable" onClick={() => toggleSort('assignment')}>
                    Assignment{sortIndicator('assignment')}
                  </th>
                  <th className="th-sortable" onClick={() => toggleSort('type')}>
                    Type{sortIndicator('type')}
                  </th>
                  <th className="th-sortable" onClick={() => toggleSort('status')}>
                    Status{sortIndicator('status')}
                  </th>
                  <th className="th-sortable" onClick={() => toggleSort('uploaded')}>
                    Uploaded{sortIndicator('uploaded')}
                  </th>
                  <th className="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((f) => {
                  const match = f.similar_documents?.[0]
                  return (
                  <tr key={f.file_id} onClick={() => navigate(`/documents/${f.file_id}`)}>
                    <td className="cell-name">
                      {/* The name owns its own line at full column width; tags
                          sit on the meta row below. Sharing one flex row made
                          long filenames collapse into a vertical rope of
                          characters and clipped the tag text. */}
                      <div className="name-primary" title={f.filename}>
                        {f.filename}
                      </div>
                      {(f.is_drawing === false || f.is_duplicate || match) && (
                        <div className="name-meta">
                          {f.is_drawing === false && (
                            <span
                              className="dup-tag not-drawing-tag"
                              title="The AI judged this image is not an engineering drawing - check it before ingesting."
                            >
                              Not a drawing
                            </span>
                          )}
                          {f.is_duplicate && (
                            <button
                              className="dup-tag dup-tag-btn"
                              title="Compare the two drawings side by side"
                              onClick={(e) => {
                                e.stopPropagation()
                                setComparing(f)
                              }}
                            >
                              Possible duplicate - compare
                            </button>
                          )}
                          {match && (
                            <span className="dup-match" title={match.filename}>
                              {Math.round(match.similarity * 100)}% similar to {match.filename}
                            </span>
                          )}
                        </div>
                      )}
                      {f.status === 'failed' && f.error && (
                        <div className="error-match" title={f.error}>
                          {f.error}
                        </div>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {f.drawing_id ? (
                        // drawing number leads, project name is context under
                        // it - both truncate independently instead of one long
                        // label being cut mid-word
                        <div className="assign-cell">
                          <button
                            className="assign-dwg"
                            title={`Open drawing ${f.dwg_number ?? ''}`}
                            onClick={() => navigate(`/drawings/${f.drawing_id}`)}
                          >
                            {f.dwg_number ?? 'Drawing'}
                          </button>
                          {(f.project_name || f.auto_assigned) && (
                            <span className="assign-project">
                              {f.project_name}
                              {f.auto_assigned && (
                                <span
                                  className="auto-tag"
                                  style={{ marginLeft: f.project_name ? 6 : 0 }}
                                  title="Assigned automatically from an exact drawing-number match"
                                >
                                  auto
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                    <td className="cell-type">{f.file_type.toUpperCase()}</td>
                    <td>
                      <StatusBadge
                        status={
                          queuedIds.has(f.file_id) && f.status === 'extracted'
                            ? 'queued'
                            : f.status
                        }
                      />
                    </td>
                    <td className="cell-date" title={new Date(f.created_at).toLocaleString()}>
                      {new Date(f.created_at).toLocaleDateString()}
                    </td>
                    <td className="cell-action" onClick={(e) => e.stopPropagation()}>
                      {/* The action that moves the document forward is the
                          visible one; rare and destructive actions live in the
                          overflow menu so a mis-click can't delete a drawing. */}
                      <div className="action-row">
                        <span className="action-slot">
                          {!f.drawing_id && f.status !== 'failed' && (
                            <Button
                              variant="light"
                              color="grape"
                              size="compact-xs"
                              onClick={() => setAssigning(f)}
                            >
                              Assign
                            </Button>
                          )}
                        </span>
                        <span className="action-slot">
                          {f.status === 'failed' ? (
                            <Button
                              variant="light"
                              size="compact-xs"
                              loading={retryingId === f.file_id}
                              onClick={() => handleRetry(f)}
                            >
                              Retry
                            </Button>
                          ) : (
                            <Button
                              variant={f.status === 'extracted' ? 'filled' : 'default'}
                              size="compact-xs"
                              onClick={() => navigate(`/documents/${f.file_id}`)}
                            >
                              {f.status === 'extracted' ? 'Review' : 'View'}
                            </Button>
                          )}
                        </span>
                        {/* icon rather than a text button: same single click,
                            but it frees the width that was clipping this
                            column, and reads as secondary to Review/View */}
                        <Tooltip label="Delete document" withArrow position="left">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            aria-label={`Delete ${f.filename}`}
                            onClick={() => setPendingDelete(f)}
                          >
                            <IconTrash size={15} />
                          </ActionIcon>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                  )
                })}
                {items.length === 0 && (
                  <tr className="no-hover">
                    <td colSpan={6} className="empty-note center">
                      No documents match these filters.
                    </td>
                  </tr>
                )}
                {/* short last pages hold full-page height so the pager
                    below never jumps upward between pages */}
                {pageCount > 1 &&
                  items.length > 0 &&
                  items.length < PAGE_SIZE &&
                  Array.from({ length: PAGE_SIZE - items.length }, (_, i) => (
                    <tr key={`filler-${i}`} className="no-hover row-filler" aria-hidden="true">
                      <td colSpan={6} />
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={currentPage}
            pageSize={PAGE_SIZE}
            totalItems={totalFiltered}
            onChange={(p) => setFilter('page', String(p))}
          />
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
          // `files` is the paged response object, not a list - passing it
          // whole made CompareModal call .find on an object and white-screen
          // the page. `items` is that response's array of documents.
          allFiles={items}
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
              <strong>as extracted, without individual review</strong> - including any
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
