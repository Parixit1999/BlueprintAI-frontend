const CONFIDENCE_LABEL = { high: 'High', medium: 'Medium', low: 'Low' }
const STATUS_LABEL = {
  uploaded: 'Uploaded',
  extracted: 'Needs review',
  ingesting: 'Processing',
  reviewed: 'Reviewed',
  ingested: 'Ingested',
  failed: 'Failed',
}

export function ConfidenceBadge({ level }) {
  return (
    <span className={`badge badge-conf-${level}`}>
      <span className="badge-dot" />
      {CONFIDENCE_LABEL[level] ?? level}
    </span>
  )
}

export function StatusBadge({ status }) {
  return (
    <span className={`badge badge-status-${status}`}>{STATUS_LABEL[status] ?? status}</span>
  )
}
