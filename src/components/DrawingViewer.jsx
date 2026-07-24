import { ActionIcon, Button, Group, Modal, Text } from '@mantine/core'
import { IconArrowsMaximize, IconMinus, IconPlus } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { getRender } from '../api'
import Loading from './Loading'

const renderCache = new Map()

/**
 * Shows the rendered drawing with an optional highlighted region.
 * bbox is in model-space coords; extents [xmin, ymin, xmax, ymax] map it to
 * percentage positions on the image (y is flipped: model space is y-up).
 * Click the drawing (or the expand button) for a full-screen view.
 */
export default function DrawingViewer({
  fileId,
  highlightBbox,
  page = 1,
  pageCount = 1,
  onPageChange,
}) {
  const cacheKey = `${fileId}:${page}`
  const [render, setRender] = useState(renderCache.get(cacheKey) ?? null)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(false)
  // 'fit' = drawing fits the screen width; numbers are multiples of that
  const [zoom, setZoom] = useState('fit')
  const scrollRef = useRef(null)
  const pan = useRef(null)

  const zoomIn = () =>
    setZoom((z) => (z === 'fit' ? 1.5 : Math.min(6, +(z * 1.3).toFixed(2))))
  const zoomOut = () =>
    setZoom((z) => (z === 'fit' || z / 1.3 <= 1.02 ? 'fit' : +(z / 1.3).toFixed(2)))

  // drag anywhere on the drawing to pan (scrollbars also work)
  const startPan = (e) => {
    const el = scrollRef.current
    if (!el) return
    pan.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }
    el.setPointerCapture?.(e.pointerId)
  }
  const movePan = (e) => {
    const el = scrollRef.current
    if (!el || !pan.current) return
    el.scrollLeft = pan.current.left - (e.clientX - pan.current.x)
    el.scrollTop = pan.current.top - (e.clientY - pan.current.y)
  }
  const endPan = () => {
    pan.current = null
  }

  useEffect(() => {
    if (!fileId) return
    if (renderCache.has(cacheKey)) {
      setRender(renderCache.get(cacheKey))
      return
    }
    setRender(null)
    setError(null)
    getRender(fileId, page)
      .then((r) => {
        renderCache.set(cacheKey, r)
        setRender(r)
      })
      .catch((e) => setError(e.message))
  }, [fileId, page, cacheKey])

  // sheet navigation stays visible through loading/error states, so paging
  // through a multi-sheet document never makes the controls vanish
  const sheetNav = pageCount > 1 && onPageChange && (
    <div className="sheet-nav">
      <ActionIcon
        variant="default"
        size="sm"
        aria-label="Previous sheet"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        ‹
      </ActionIcon>
      <span className="sheet-nav-label">
        Sheet {page} of {pageCount}
      </span>
      <ActionIcon
        variant="default"
        size="sm"
        aria-label="Next sheet"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        ›
      </ActionIcon>
    </div>
  )

  if (error) {
    return (
      <>
        {sheetNav}
        <div className="viewer-error">
          <p className="error">We couldn’t load this drawing preview.</p>
          <p className="muted">{error}</p>
        </div>
      </>
    )
  }
  if (!render)
    return (
      <>
        {sheetNav}
        <Loading label="Rendering drawing…" py="lg" size="sm" />
      </>
    )

  const [xmin, ymin, xmax, ymax] = render.extents
  // one region may have many locations (component groups highlight every
  // instance); accept a single bbox or a list
  const bboxes = highlightBbox
    ? Array.isArray(highlightBbox[0])
      ? highlightBbox
      : [highlightBbox]
    : []
  const highlights = bboxes.map(([x1, y1, x2, y2]) => ({
    left: `${((x1 - xmin) / (xmax - xmin)) * 100}%`,
    top: `${((ymax - y2) / (ymax - ymin)) * 100}%`,
    width: `${((x2 - x1) / (xmax - xmin)) * 100}%`,
    height: `${((y2 - y1) / (ymax - ymin)) * 100}%`,
  }))

  return (
    <>
      {sheetNav}
      <div
        className="viewer expandable"
        onClick={() => setExpanded(true)}
        title="Click to view full screen"
      >
        <img src={render.url} alt="Drawing render" />
        {highlights.map((h, i) => (
          <div key={i} className="viewer-highlight" style={h} />
        ))}
        <ActionIcon
          className="viewer-expand"
          variant="default"
          size="lg"
          aria-label="View full screen"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(true)
          }}
        >
          <IconArrowsMaximize size={18} />
        </ActionIcon>
      </div>

      <Modal
        opened={expanded}
        onClose={() => setExpanded(false)}
        fullScreen
        transitionProps={{ duration: 0 }}
        title={
          <Group gap="xs">
            <Text size="sm" fw={600} mr="sm">
              Drawing view
            </Text>
            <ActionIcon variant="default" aria-label="Zoom out" onClick={zoomOut}>
              <IconMinus size={16} />
            </ActionIcon>
            <Text size="sm" w={52} ta="center" c="dimmed">
              {zoom === 'fit' ? 'Fit' : `${Math.round(zoom * 100)}%`}
            </Text>
            <ActionIcon variant="default" aria-label="Zoom in" onClick={zoomIn}>
              <IconPlus size={16} />
            </ActionIcon>
            <Button size="compact-xs" variant="default" onClick={() => setZoom('fit')}>
              Fit to screen
            </Button>
          </Group>
        }
        styles={{ body: { padding: 0 } }}
      >
        <div
          className="viewer-fullscreen"
          ref={scrollRef}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerLeave={endPan}
        >
          <div
            className="viewer viewer-large"
            style={{ width: zoom === 'fit' ? '100%' : `${zoom * 100}%` }}
          >
            <img src={render.url} alt="Drawing render, full screen" draggable={false} />
            {highlights.map((h, i) => (
          <div key={i} className="viewer-highlight" style={h} />
        ))}
          </div>
        </div>
      </Modal>
    </>
  )
}
