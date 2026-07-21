import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getStats } from '../api'
import Loading from '../components/Loading'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'

const TYPE_LABEL = {
  dxf: 'CAD (DXF)',
  dwg: 'CAD (DWG)',
  pdf: 'PDF',
  png: 'Image (PNG)',
  jpg: 'Image (JPG)',
  jpeg: 'Image (JPEG)',
  tif: 'Image (TIF)',
  tiff: 'Image (TIFF)',
}
// categorical slots 1-5 from the reference palette, fixed order
const TYPE_COLORS = ['#2a78d6', '#1baf7a', '#eda100', '#4a3aa7', '#e87ba4']
const CONF_META = [
  { key: 'high', label: 'High confidence', color: '#0ca30c' },
  { key: 'medium', label: 'Medium confidence', color: '#fab219' },
  { key: 'low', label: 'Low confidence', color: '#d03b3b' },
]

// A stat tile that navigates somewhere useful when clicked.
function Tile({ label, value, hint, to }) {
  return (
    <Link className="tile tile-link" to={to}>
      <div className="tile-label">
        {label}
        <span className="tile-go">→</span>
      </div>
      <div className="tile-value">{value}</div>
      {hint && <div className="tile-hint">{hint}</div>}
    </Link>
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

// Horizontal bars, one row per project, each row navigating to the project.
// Single hue: identity is carried by the row label, magnitude by bar length.
function ProjectBars({ rows }) {
  const navigate = useNavigate()
  if (!rows.length) return <p className="empty-note">No projects yet.</p>
  const max = Math.max(...rows.map((r) => r.drawings), 1)
  return (
    <div className="project-bars">
      {rows.map((r) => (
        <button
          key={r.project_id}
          className="project-bar-row"
          onClick={() => navigate(`/projects/${r.project_id}`)}
          title={`Open ${r.name}`}
        >
          <span className="project-bar-label">
            {r.number ? `${r.name} (#${r.number})` : r.name}
          </span>
          <span className="project-bar-track">
            <span
              className="project-bar-fill"
              style={{ width: `${(r.drawings / max) * 100}%` }}
            />
          </span>
          <span className="project-bar-value">{r.drawings}</span>
        </button>
      ))}
    </div>
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
  const failed = stats.documents_by_status.failed ?? 0
  const unassigned = stats.documents_unassigned ?? 0
  const rated = (stats.feedback_helpful ?? 0) + (stats.feedback_unhelpful ?? 0)
  const typeParts = Object.entries(stats.documents_by_type).map(([type, value], i) => ({
    label: TYPE_LABEL[type] ?? type.toUpperCase(),
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
        <Tile
          label="Projects"
          value={stats.projects_total ?? 0}
          hint={`${stats.drawings_total ?? 0} drawings · ${stats.sets_total ?? 0} sets`}
          to="/projects"
        />
        <Tile
          label="Documents"
          value={stats.documents_total}
          hint={
            failed > 0
              ? `${stats.documents_by_status.ingested ?? 0} ingested · ${failed} failed`
              : `${stats.documents_by_status.ingested ?? 0} ingested`
          }
          to="/documents"
        />
        <Tile
          label="Awaiting review"
          value={pendingReview}
          hint={pendingReview > 0 ? 'Review and ingest them' : 'All caught up'}
          to="/documents?status=extracted"
        />
        <Tile
          label="Unassigned documents"
          value={unassigned}
          hint={unassigned > 0 ? 'Link them to their drawings' : 'Every document is linked'}
          to="/documents?assigned=no"
        />
        <Tile
          label="Questions asked"
          value={stats.questions_asked}
          hint={
            rated > 0
              ? `${stats.chat_sessions} sessions · ${stats.feedback_helpful} 👍 ${stats.feedback_unhelpful} 👎`
              : `${stats.chat_sessions} chat sessions`
          }
          to="/chat"
        />
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h2>Drawings per project</h2>
          <ProjectBars rows={stats.drawings_per_project ?? []} />
        </div>
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
