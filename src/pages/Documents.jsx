import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listFiles, uploadFile } from '../api'
import { StatusBadge } from '../components/Badges'
import { useToast } from '../components/Toast'

const ACCEPTED = '.dxf,.pdf,.png,.jpg,.jpeg'

export default function Documents() {
  const [files, setFiles] = useState(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)
  const toast = useToast()
  const navigate = useNavigate()

  function refresh() {
    listFiles()
      .then(setFiles)
      .catch((e) => toast.error(e.message))
  }

  useEffect(refresh, [])

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

      {files === null ? (
        <p className="empty-note">Loading…</p>
      ) : files.length === 0 ? (
        <div className="empty-state">
          <p>No documents yet.</p>
          <p className="page-sub">Upload a DXF, vector PDF, or drawing photo to get started.</p>
        </div>
      ) : (
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
              {files.map((f) => (
                <tr key={f.file_id} onClick={() => navigate(`/documents/${f.file_id}`)}>
                  <td className="cell-name">{f.filename}</td>
                  <td className="cell-type">{f.file_type.toUpperCase()}</td>
                  <td>
                    <StatusBadge status={f.status} />
                  </td>
                  <td className="cell-date">{new Date(f.created_at).toLocaleString()}</td>
                  <td className="cell-action">
                    {f.status === 'extracted' ? 'Review →' : 'View →'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
