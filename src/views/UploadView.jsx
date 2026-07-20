import { useState } from 'react'
import { uploadFile } from '../api'

export default function UploadView({ onUploaded }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function handleFile(file) {
    if (!file) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await uploadFile(file)
      setResult(res)
      onUploaded?.(res.file_id)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p>Upload a drawing (DXF for now) to extract its content.</p>
      <label className="file-drop">
        <input
          type="file"
          accept=".dxf"
          disabled={busy}
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {busy ? 'Extracting…' : 'Choose a DXF file'}
      </label>
      {error && <p className="error">{error}</p>}
      {result && (
        <p className="success">
          Extracted {result.chunks.length} regions from <strong>{result.filename}</strong>.
          Head to the Review tab to verify and ingest them.
        </p>
      )}
    </div>
  )
}
