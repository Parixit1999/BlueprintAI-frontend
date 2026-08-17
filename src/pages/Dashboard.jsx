import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getStats } from '../api'
import Loading from '../components/Loading'
import ErrorState from '../components/ErrorState'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'

// Every format the backend's extractor registry accepts, so no real type
// ever falls through to the raw-extension fallback.
const TYPE_LABEL = {
  dxf: 'CAD (DXF)',
  dwg: 'CAD (DWG)',
  rvt: 'Revit (RVT)',
  pdf: 'PDF',
  png: 'Image (PNG)',
  jpg: 'Image (JPG)',
  jpeg: 'Image (JPEG)',
  tif: 'Image (TIF)',
  tiff: 'Image (TIFF)',
  bmp: 'Image (BMP)',
  webp: 'Image (WEBP)',
  heic: 'Image (HEIC)',
  heif: 'Image (HEIF)',
}
// Color follows the TYPE, not its position: a fixed map means a type keeps
// its color no matter which other types are present (an index-cycled palette
// repainted every segment whenever the mix changed). Formats of one family
// share a hue and differ in depth (CAD blues, photo violets, scan rusts);
// unknown types fall back to the neutral swatch. Identity never rides on
// color alone - the legend and slice gaps carry it too.
const TYPE_COLOR = {
  dxf: '#2a78d6', // blueprint blue - the native format leads with the accent
  dwg: '#164a89',
  rvt: '#17879e',
  pdf: '#eda100',
  png: '#1baf7a',
  jpg: '#4a3aa7',
  jpeg: '#8a5fd6',
  tif: '#c05a3a',
  tiff: '#e08a6d',
  bmp: '#6d8f3d',
  webp: '#b3529e',
  heic: '#8c6d1f',
  heif: '#bfa03a',
}
const TYPE_COLOR_OTHER = '#93a0ad' // --ink-faint
// Confidence is a status, so it wears the app's status tokens (index.css)
// rather than a second, slightly-different green/amber/red.
const CONF_META = [
  { key: 'high', label: 'High confidence', color: 'var(--good)' },
  { key: 'medium', label: 'Medium confidence', color: 'var(--warning)' },
  { key: 'low', label: 'Low confidence', color: 'var(--critical)' },
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

/**
 * Documents-by-type as a donut: slices in data order, hairline gaps between
 * slices, and the archive total in the hole so the "how many documents"
 * question is answered before any slice is read. Pure SVG - no chart dep.
 */
function DonutChart({ parts, centerLabel }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  if (total === 0) return <p className="empty-note">No data yet.</p>
  const shown = parts.filter((p) => p.value > 0)
  const R = 62
  const STROKE = 26
  const C = 2 * Math.PI * R
  const GAP = shown.length > 1 ? 2 : 0 // px of arc between slices
  let offset = 0
  return (
    <>
      <div className="donut-wrap">
        <svg
          viewBox="0 0 160 160"
          className="donut"
          role="img"
          aria-label={shown.map((p) => `${p.label} ${p.value}`).join(', ')}
        >
          <g transform="rotate(-90 80 80)">
            {shown.map((p) => {
              const arc = (p.value / total) * C
              const seg = (
                <circle
                  key={p.label}
                  className="donut-slice"
                  cx="80"
                  cy="80"
                  r={R}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${Math.max(arc - GAP, 0.5)} ${C - Math.max(arc - GAP, 0.5)}`}
                  strokeDashoffset={-offset}
                >
                  <title>{`${p.label}: ${p.value} (${Math.round((p.value / total) * 100)}%)`}</title>
                </circle>
              )
              offset += arc
              return seg
            })}
          </g>
          <text x="80" y="76" textAnchor="middle" className="donut-total">
            {total.toLocaleString()}
          </text>
          <text x="80" y="94" textAnchor="middle" className="donut-caption">
            {centerLabel}
          </text>
        </svg>
        <div className="breakdown-legend donut-legend">
          {shown.map((p) => (
            <span key={p.label} className="legend-item">
              <span className="legend-swatch" style={{ background: p.color }} />
              {p.label} <strong>{p.value}</strong>
            </span>
          ))}
        </div>
      </div>
    </>
  )
}

const DAY_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

/**
 * Two aligned rows of day-bars for the last-14-days trend. Uploads and
 * questions are different units, so each row scales to its own max instead
 * of sharing a fake common axis.
 *
 * Hovering any day highlights that day's column in BOTH rows and shows one
 * shared stats card (date + uploads + questions) - the day is the entity,
 * the rows are just its two measures.
 */
function ActivityRows({ days }) {
  const [hover, setHover] = useState(null) // day index or null
  const rows = [
    { key: 'uploads', label: 'Uploads', color: 'var(--accent)' },
    { key: 'questions', label: 'Questions', color: '#17879e' },
  ]
  const any = days.some((d) => d.uploads > 0 || d.questions > 0)
  if (!any) return <p className="empty-note">No activity in the last 14 days.</p>
  const hovered = hover !== null ? days[hover] : null
  return (
    <div className="activity-rows" onMouseLeave={() => setHover(null)}>
      {hovered && (
        <div
          className="activity-tooltip"
          role="status"
          style={{ '--tip-x': `${((hover + 0.5) / days.length) * 100}%` }}
        >
          <div className="activity-tooltip-date">
            {DAY_FMT.format(new Date(`${hovered.date}T00:00:00`))}
          </div>
          {rows.map(({ key, label, color }) => (
            <div key={key} className="activity-tooltip-row">
              <span className="legend-swatch" style={{ background: color }} />
              {label}
              <strong>{hovered[key].toLocaleString()}</strong>
            </div>
          ))}
        </div>
      )}
      {rows.map(({ key, label, color }) => {
        const max = Math.max(...days.map((d) => d[key]), 1)
        const totalRow = days.reduce((s, d) => s + d[key], 0)
        return (
          <div key={key} className="activity-row">
            <span className="activity-label">
              {label} <strong className="tabular">{totalRow.toLocaleString()}</strong>
            </span>
            <span className="activity-bars">
              {days.map((d, i) => (
                <span
                  key={d.date}
                  className={i === hover ? 'activity-bar hovered' : 'activity-bar'}
                  onMouseEnter={() => setHover(i)}
                  aria-label={`${d.date}: ${d[key]} ${label.toLowerCase()}`}
                >
                  <span
                    className="activity-bar-fill"
                    style={{
                      height: `${(d[key] / max) * 100}%`,
                      background: color,
                      opacity: d[key] === 0 ? 0 : 1,
                    }}
                  />
                </span>
              ))}
            </span>
          </div>
        )
      })}
      <div className="activity-axis">
        <span>{days[0]?.date.slice(5)}</span>
        <span>today</span>
      </div>
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
  const [loadError, setLoadError] = useState(null)
  const toast = useToast()

  function refresh() {
    return getStats()
      .then((s) => {
        setStats(s)
        setLoadError(null)
      })
      .catch((e) => (stats ? toast.error(e.message) : setLoadError(e.message)))
  }

  useEffect(() => {
    refresh()
  }, [])

  if (!stats && loadError) return <ErrorState message={loadError} onRetry={refresh} />
  if (!stats) return <Loading label="Loading statistics…" />

  const pendingReview = stats.documents_by_status.extracted ?? 0
  const failed = stats.documents_by_status.failed ?? 0
  const processing = stats.documents_by_status.ingesting ?? 0
  const unassigned = stats.documents_unassigned ?? 0
  const rated = (stats.feedback_helpful ?? 0) + (stats.feedback_unhelpful ?? 0)
  // Largest slice first: the donut starts at 12 o'clock with the biggest
  // type and the legend reads in the same descending order.
  const typeParts = Object.entries(stats.documents_by_type)
    .sort(([, a], [, b]) => b - a)
    .map(([type, value]) => ({
      label: TYPE_LABEL[type] ?? type.toUpperCase(),
      value,
      color: TYPE_COLOR[type] ?? TYPE_COLOR_OTHER,
    }))
  const confParts = CONF_META.map((c) => ({
    label: c.label,
    value: stats.chunks_by_confidence[c.key] ?? 0,
    color: c.color,
  }))
  // Pipeline stages in processing order, wearing the same colors as the
  // status badges: green = done, amber = waiting on a person, red = failed.
  const statusParts = [
    { key: 'uploaded', label: 'Processing upload', color: '#93a0ad' },
    { key: 'extracted', label: 'Needs review', color: 'var(--warning)' },
    { key: 'ingesting', label: 'Processing', color: 'var(--accent)' },
    { key: 'reviewed', label: 'Reviewed', color: '#17879e' },
    { key: 'ingested', label: 'Ingested', color: 'var(--good)' },
    { key: 'failed', label: 'Failed', color: 'var(--critical)' },
  ]
    .map((s) => ({ ...s, value: stats.documents_by_status[s.key] ?? 0 }))
    .filter((s) => s.value > 0)
  const regionsTotal = stats.chunks_total ?? 0
  const corrected = stats.chunks_corrected ?? 0
  const highConf = stats.chunks_by_confidence.high ?? 0
  const highPct = regionsTotal > 0 ? Math.round((highConf / regionsTotal) * 100) : 0

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
          to="/registry"
        />
        <Tile
          label="Documents"
          value={stats.documents_total}
          hint={[
            `${stats.documents_by_status.ingested ?? 0} ingested`,
            processing > 0 && `${processing} processing`,
            failed > 0 && `${failed} failed`,
          ]
            .filter(Boolean)
            .join(' · ')}
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
          label="Extracted regions"
          value={regionsTotal.toLocaleString()}
          hint={
            regionsTotal > 0
              ? [`${highPct}% high confidence`, corrected > 0 && `${corrected} corrected`]
                  .filter(Boolean)
                  .join(' · ')
              : 'Ingest documents to build the index'
          }
          to="/documents?status=ingested"
        />
        <Tile
          label="Questions asked"
          value={stats.questions_asked}
          hint={
            rated > 0
              ? `${stats.chat_sessions} sessions · ${stats.feedback_helpful} helpful · ${stats.feedback_unhelpful} not`
              : `${stats.chat_sessions} chat sessions`
          }
          to="/chat"
        />
      </div>

      {/* Deliberate composition, not auto-fit: the two content-heavy panels
          share the top row; the three one-liner panels share the bottom.
          Spans are set per-panel in App.css and collapse 6→2→1 columns. */}
      <div className="panel-grid dashboard-panels">
        <div className="panel panel-projects">
          <h2>Drawings per project</h2>
          <ProjectBars rows={stats.drawings_per_project ?? []} />
        </div>
        <div className="panel panel-types">
          <h2>Documents by type</h2>
          <DonutChart parts={typeParts} centerLabel="documents" />
        </div>
        <div className="panel panel-activity">
          <h2>Activity — last 14 days</h2>
          <ActivityRows days={stats.activity_daily ?? []} />
        </div>
        <div className="panel panel-pipeline">
          <h2>Document pipeline</h2>
          <BreakdownBar parts={statusParts} />
        </div>
        <div className="panel panel-confidence">
          <h2>Extraction confidence</h2>
          <BreakdownBar parts={confParts} />
        </div>
      </div>
    </div>
  )
}
