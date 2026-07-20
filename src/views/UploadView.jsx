import { useState } from 'react'
import { uploadFile } from '../api'

const ACCEPTED = '.dxf,.pdf,.png,.jpg,.jpeg'

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

  const missingBoxes = result?.chunks.filter((c) => !c.bbox).length ?? 0
  const lowConfidence = result?.chunks.filter((c) => c.confidence === 'low').length ?? 0

  return (
    <div>
      <p>
        Upload a drawing — CAD (<strong>.dxf</strong>), vector PDF, or a photo/scan
        (<strong>.png / .jpg</strong>, processed with AI vision).
      </p>
      <label className="file-drop">
        <input
          type="file"
          accept={ACCEPTED}
          disabled={busy}
          onChange={(e) => {
            handleFile(e.target.files[0])
            e.target.value = ''
          }}
        />
        {busy ? 'Extracting… (images can take a minute)' : 'Choose a drawing file'}
      </label>
      {error && (
        <div className="error-banner">
          <strong>Upload failed.</strong> {error}
        </div>
      )}
      {result && (
        <div className="success">
          <p>
            Extracted {result.chunks.length} regions from <strong>{result.filename}</strong>.
            Head to the Review tab to verify and ingest them.
          </p>
          {lowConfidence > 0 && (
            <p className="warning">
              {lowConfidence} region{lowConfidence > 1 ? 's are' : ' is'} low-confidence —
              please check them carefully during review.
            </p>
          )}
          {missingBoxes > 0 && (
            <p className="warning">
              {missingBoxes} region{missingBoxes > 1 ? 's' : ''} could not be located on the
              drawing (no highlight will be shown).
            </p>
          )}
        </div>
      )}
    </div>
  )
}
