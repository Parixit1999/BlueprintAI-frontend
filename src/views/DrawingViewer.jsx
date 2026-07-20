import { useEffect, useState } from 'react'
import { getRender } from '../api'

const renderCache = new Map()

/**
 * Shows the rendered drawing with an optional highlighted region.
 * bbox is in model-space coords; extents [xmin, ymin, xmax, ymax] map it to
 * percentage positions on the image (y is flipped: model space is y-up).
 */
export default function DrawingViewer({ fileId, highlightBbox }) {
  const [render, setRender] = useState(renderCache.get(fileId) ?? null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!fileId) return
    if (renderCache.has(fileId)) {
      setRender(renderCache.get(fileId))
      return
    }
    setRender(null)
    getRender(fileId)
      .then((r) => {
        renderCache.set(fileId, r)
        setRender(r)
      })
      .catch((e) => setError(e.message))
  }, [fileId])

  if (error) return <p className="error">Drawing preview unavailable: {error}</p>
  if (!render) return <p className="placeholder">Loading drawing…</p>

  const [xmin, ymin, xmax, ymax] = render.extents
  let highlight = null
  if (highlightBbox) {
    const [x1, y1, x2, y2] = highlightBbox
    highlight = {
      left: `${((x1 - xmin) / (xmax - xmin)) * 100}%`,
      top: `${((ymax - y2) / (ymax - ymin)) * 100}%`,
      width: `${((x2 - x1) / (xmax - xmin)) * 100}%`,
      height: `${((y2 - y1) / (ymax - ymin)) * 100}%`,
    }
  }

  return (
    <div className="viewer">
      <img src={render.url} alt="Drawing render" />
      {highlight && <div className="viewer-highlight" style={highlight} />}
    </div>
  )
}
