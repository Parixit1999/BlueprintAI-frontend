import { Button } from '@mantine/core'
import { IconUpload } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { deleteFile, listFiles } from '../api'
import { StatusBadge } from '../components/Badges'
import CompareModal from '../components/CompareModal'
import ConfirmDialog from '../components/ConfirmDialog'
import Loading from '../components/Loading'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'extracted', label: 'Needs review' },
  { value: 'ingested', label: 'Ingested' },
]

export default function Documents() {
  const [files, setFiles] = useState(null)
  // Filters live in the URL so they survive navigating to a document and back
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const typeFilter = searchParams.get('type') ?? 'all'
  const statusFilter = searchParams.get('status') ?? 'all'
  const dupOnly = searchParams.get('dup') === '1'
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [comparing, setComparing] = useState(null)
  const toast = useToast()
  const navigate = useNavigate()

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
    listFiles()
      .then(setFiles)
      .catch((e) => toast.error(e.message))
  }

  useEffect(refresh, [])

  const types = useMemo(
    () => [...new Set((files ?? []).map((f) => f.file_type))].sort(),
    [files],
  )
  const duplicateCount = useMemo(
    () => (files ?? []).filter((f) => f.is_duplicate).length,
    [files],
  )

  const filtered = useMemo(() => {
    return (files ?? []).filter((f) => {
      if (query && !f.filename.toLowerCase().includes(query.toLowerCase())) return false
      if (typeFilter !== 'all' && f.file_type !== typeFilter) return false
      if (statusFilter !== 'all' && f.status !== statusFilter) return false
      if (dupOnly && !f.is_duplicate) return false
      return true
    })
  }, [files, query, typeFilter, statusFilter, dupOnly])

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
        actions={
          <Button leftSection={<IconUpload size={16} />} onClick={() => navigate('/upload')}>
            Upload drawings
          </Button>
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

      {files === null ? (
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
                  <th>Type</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th />
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
                    </td>
                    <td className="cell-type">{f.file_type.toUpperCase()}</td>
                    <td>
                      <StatusBadge status={f.status} />
                    </td>
                    <td className="cell-date">{new Date(f.created_at).toLocaleString()}</td>
                    <td className="cell-action" onClick={(e) => e.stopPropagation()}>
                      <div>
                        {f.is_duplicate && (
                          <Button
                            variant="subtle"
                            color="orange"
                            size="compact-sm"
                            onClick={() => setComparing(f)}
                          >
                            Compare
                          </Button>
                        )}
                        <Button
                          variant="subtle"
                          size="compact-sm"
                          onClick={() => navigate(`/documents/${f.file_id}`)}
                        >
                          {f.status === 'extracted' ? 'Review' : 'View'}
                        </Button>
                        <Button
                          variant="subtle"
                          color="red"
                          size="compact-sm"
                          onClick={() => setPendingDelete(f)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr className="no-hover">
                    <td colSpan={5} className="empty-note center">
                      No documents match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
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
