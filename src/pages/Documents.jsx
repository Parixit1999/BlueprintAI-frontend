import { Button } from '@mantine/core'
import { IconUpload } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteFile, listFiles } from '../api'
import { StatusBadge } from '../components/Badges'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'extracted', label: 'Needs review' },
  { value: 'ingested', label: 'Ingested' },
]

export default function Documents() {
  const [files, setFiles] = useState(null)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dupOnly, setDupOnly] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

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
      <div className="page-header row">
        <div>
          <h1>Documents</h1>
          <p className="page-sub">Engineering drawings in the knowledge base</p>
        </div>
        <Button leftSection={<IconUpload size={16} />} onClick={() => navigate('/upload')}>
          Upload drawings
        </Button>
      </div>

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
            onClick={() => setDupOnly((v) => !v)}
          >
            {dupOnly ? 'Show all' : 'Show duplicates'}
          </Button>
        </div>
      )}

      {files === null ? (
        <p className="empty-note">Loading…</p>
      ) : files.length === 0 ? (
        <div className="empty-state">
          <p>No documents yet.</p>
          <p className="page-sub">Upload a DXF, vector PDF, or drawing photo to get started.</p>
        </div>
      ) : (
        <>
          <div className="filters">
            <input
              className="search"
              placeholder="Search by name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t.toUpperCase()}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <label className="dup-toggle">
              <input type="checkbox" checked={dupOnly} onChange={(e) => setDupOnly(e.target.checked)} />
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
