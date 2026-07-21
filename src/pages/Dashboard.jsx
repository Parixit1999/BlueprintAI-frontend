import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getStats } from '../api'
import Loading from '../components/Loading'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'

const TYPE_LABEL = { dxf: 'CAD (DXF)', pdf: 'PDF', png: 'Image (PNG)', jpg: 'Image (JPG)', jpeg: 'Image (JPEG)' }
// categorical slots 1-3 from the reference palette, fixed order
const TYPE_COLORS = ['#2a78d6', '#1baf7a', '#eda100', '#4a3aa7', '#e87ba4']
const CONF_META = [
  { key: 'high', label: 'High confidence', color: '#0ca30c' },
  { key: 'medium', label: 'Medium confidence', color: '#fab219' },
  { key: 'low', label: 'Low confidence', color: '#d03b3b' },
]

function Tile({ label, value, hint }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {hint && <div className="tile-hint">{hint}</div>}
    </div>
  )
}

function BreakdownBar({ parts }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  if (total === 0) return <p className="empty-note">No data yet.</p>
  return (
    <>
      <div className="breakdown-bar">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <div
              key={p.label}
              className="breakdown-seg"
              style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
            />
          ))}
      </div>
      <div className="breakdown-legend">
        {parts.map((p) => (
          <span key={p.label} className="legend-item">
            <span className="legend-swatch" style={{ background: p.color }} />
            {p.label} <strong>{p.value}</strong>
          </span>
        ))}
      </div>
    </>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const toast = useToast()

  function refresh() {
    return getStats()
      .then(setStats)
      .catch((e) => toast.error(e.message))
  }

  useEffect(() => {
    refresh()
  }, [])

  if (!stats) return <Loading label="Loading statistics…" />

  const pendingReview = stats.documents_by_status.extracted ?? 0
  const typeParts = Object.entries(stats.documents_by_type).map(([type, value], i) => ({
    label: TYPE_LABEL[type] ?? type,
    value,
    color: TYPE_COLORS[i % TYPE_COLORS.length],
  }))
  const confParts = CONF_META.map((c) => ({
    label: c.label,
    value: stats.chunks_by_confidence[c.key] ?? 0,
    color: c.color,
  }))

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your drawing knowledge base"
        onRefresh={refresh}
      />

      <div className="tile-grid">
        <Tile label="Documents" value={stats.documents_total} hint={`${stats.documents_by_status.ingested ?? 0} ingested`} />
        <Tile
          label="Awaiting review"
          value={pendingReview}
          hint={
            pendingReview > 0 ? (
              <Link to="/documents?status=extracted">Review now →</Link>
            ) : (
              'All caught up'
            )
          }
        />
        <Tile label="Extracted regions" value={stats.chunks_total} hint={`${stats.chunks_corrected} human-corrected`} />
        <Tile label="Questions asked" value={stats.questions_asked} hint={`${stats.chat_sessions} chat sessions`} />
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h2>Documents by type</h2>
          <BreakdownBar parts={typeParts} />
        </div>
        <div className="panel">
          <h2>Extraction confidence</h2>
          <BreakdownBar parts={confParts} />
        </div>
      </div>
    </div>
  )
}
