import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteFile, listFiles, uploadFile } from '../api'
import { StatusBadge } from '../components/Badges'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'

const ACCEPTED = '.dxf,.pdf,.png,.jpg,.jpeg'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'extracted', label: 'Needs review' },
  { value: 'ingested', label: 'Ingested' },
]

export default function Documents() {
  const [files, setFiles] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dupOnly, setDupOnly] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const inputRef = useRef(null)
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

  async function handleFile(file) {
    if (!file) return
    setUploading(true)
    toast.info(`Extracting ${file.name}… ${/\.(png|jpe?g)$/i.test(file.name) ? 'Images can take a minute.' : ''}`)
    try {
      const res = await uploadFile(file)
      const low = res.chunks.filter((c) => c.confidence === 'low').length
      toast.success(`Extracted ${res.chunks.length} regions from ${file.name}.`)
      if (low > 0) toast.info(`${low} region${low > 1 ? 's are' : ' is'} low-confidence — check carefully.`)
      navigate(`/documents/${res.file_id}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
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
      <div className="page-header row">
        <div>
          <h1>Documents</h1>
          <p className="page-sub">Engineering drawings in the knowledge base</p>
        </div>
        <button className="primary" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? 'Extracting…' : '+ Upload drawing'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          hidden
          onChange={(e) => {
            handleFile(e.target.files[0])
            e.target.value = ''
          }}
        />
      </div>

      {duplicateCount > 0 && (
        <div className="notice">
          <span className="notice-icon">!</span>
          <span>
            {duplicateCount} document{duplicateCount > 1 ? 's appear' : ' appears'} to be a
            duplicate (identical file content). Review and delete the extra copies.
          </span>
          <button className="link-btn" onClick={() => setDupOnly((v) => !v)}>
            {dupOnly ? 'Show all' : 'Show duplicates'}
          </button>
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
                  <th>Chunks</th>
                  <th>Uploaded</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.file_id} onClick={() => navigate(`/documents/${f.file_id}`)}>
                    <td className="cell-name">
                      {f.filename}
                      {f.is_duplicate && <span className="dup-tag">Duplicate</span>}
                    </td>
                    <td className="cell-type">{f.file_type.toUpperCase()}</td>
                    <td>
                      <StatusBadge status={f.status} />
                    </td>
                    <td className="cell-num">{f.chunk_count}</td>
                    <td className="cell-date">{new Date(f.created_at).toLocaleString()}</td>
                    <td className="cell-action" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <button className="link-btn" onClick={() => navigate(`/documents/${f.file_id}`)}>
                          {f.status === 'extracted' ? 'Review' : 'View'}
                        </button>
                        <button className="link-btn danger-link" onClick={() => setPendingDelete(f)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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

      {pendingDelete && (
        <ConfirmDialog
          title="Delete document?"
          message={
            <>
              <strong>{pendingDelete.filename}</strong> and its {pendingDelete.chunk_count} ingested
              chunk{pendingDelete.chunk_count === 1 ? '' : 's'} will be permanently removed. This
              cannot be undone.
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
