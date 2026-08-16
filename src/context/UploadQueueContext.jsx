import JSZip from 'jszip'
import { createContext, useContext, useRef, useState } from 'react'
import { assignFile, deleteFile, getExtraction, getFileSuggestions, listFiles, uploadFile } from '../api'
import { useToast } from '../components/Toast'

export const SUPPORTED = ['dxf', 'dwg', 'rvt', 'pdf', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'bmp', 'webp', 'heic', 'heif']
export const ext = (name) => name.split('.').pop().toLowerCase()
const basename = (path) => path.split('/').pop()

export const STATUS = {
  queued: { label: 'Queued', color: 'gray' },
  uploading: { label: 'Uploading', color: 'blue' },
  processing: { label: 'Processing', color: 'violet' },
  done: { label: 'Done', color: 'teal' },
  error: { label: 'Failed', color: 'red' },
  skipped: { label: 'Unsupported', color: 'gray' },
}

const ACTIVE_STATUSES = ['queued', 'uploading', 'processing']

// What the backend is doing during the "processing" phase, by file type.
const PROCESSING_HINT = {
  dxf: 'Parsing CAD geometry and extracting regions…',
  pdf: 'Extracting text - scanned pages are read with the vision model…',
  png: 'Analyzing the drawing with the vision model…',
  jpg: 'Analyzing the drawing with the vision model…',
  jpeg: 'Analyzing the drawing with the vision model…',
}
export const processingHint = (name) =>
  PROCESSING_HINT[ext(name)] ?? 'Reading the drawing and extracting regions…'

let uid = 0

const UploadQueueContext = createContext(null)

/**
 * App-level upload queue. Lives above the router so an in-progress upload keeps
 * processing and stays visible when the user navigates away from the Upload
 * page (a global indicator surfaces it on other pages).
 */
export function UploadQueueProvider({ children }) {
  const [items, setItems] = useState([])
  const [expanding, setExpanding] = useState(false)
  const runningRef = useRef(false)
  // per-item XHR abort functions for in-flight uploads
  const abortHandles = useRef(new Map())
  const toast = useToast()

  function patch(id, changes) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)))
  }

  // Adaptive parallel ingestion. Starts at 3 documents at once, ramps toward
  // MAX while extractions succeed, and halves itself if the AI provider
  // starts rate-limiting - so batches run as fast as the account's quotas
  // allow without hand-tuning. (True autoscaling - server-side workers - is
  // an AWS-deployment concern; this governs the browser's upload queue.)
  const MIN_WORKERS = 2
  const MAX_WORKERS = 8
  const START_WORKERS = 3

  // Upload returns in seconds (the server stores the file and extracts in
  // the background); we then POLL the document status until extraction
  // lands. No HTTP request ever waits on the AI, so proxy timeouts cannot
  // fake a failure - a 12-minute multi-sheet scan just polls longer.
  const POLL_MS = 4000

  async function waitForExtraction(fileId, patchItem) {
    for (;;) {
      await new Promise((r) => setTimeout(r, POLL_MS))
      let doc
      try {
        doc = await getExtraction(fileId)
      } catch {
        continue // transient fetch problem - keep polling
      }
      if (doc.status === 'failed') {
        throw new Error(doc.error ?? 'Processing failed. Use Retry from Documents.')
      }
      if (doc.status !== 'uploaded') return doc // extracted (or beyond)
      patchItem()
    }
  }

  async function processOne(next) {
    patch(next.id, { status: 'uploading', percent: 0 })
    const handle = {}
    abortHandles.current.set(next.id, handle)
    try {
      const res = await uploadFile(
        next.file,
        next.name,
        (p) => {
          if (p.phase === 'uploading') patch(next.id, { status: 'uploading', percent: p.percent })
          else patch(next.id, { status: 'processing' })
        },
        next.folderId ?? null,
        handle,
      )
      patch(next.id, { status: 'processing', fileId: res.file_id })
      const doc = await waitForExtraction(res.file_id, () =>
        patch(next.id, { status: 'processing' }),
      )
      // scoped upload: attach straight to the drawing the user uploaded from,
      // bypassing the suggestion step entirely
      if (next.projectId && !next.drawingId) {
        // project-scoped upload: file a new drawing under that project
        try {
          await assignFile(res.file_id, { new_drawing: { project_id: next.projectId } })
          patch(next.id, {
            status: 'done',
            fileId: res.file_id,
            regions: doc.chunks.length,
            autoAssignment: { project_name: next.projectName ?? 'this project' },
          })
          return 'ok'
        } catch {
          // filing failed - fall through to normal suggestion handling
        }
      }
      if (next.drawingId) {
        try {
          await assignFile(res.file_id, { drawing_id: next.drawingId })
          patch(next.id, {
            status: 'done',
            fileId: res.file_id,
            regions: doc.chunks.length,
            autoAssignment: { dwg_number: next.drawingName ?? 'this drawing' },
          })
          return 'ok'
        } catch {
          // attach failed - fall through to normal suggestion handling
        }
      }
      // the matcher ran server-side in the background: the document record
      // now carries the outcome; suggestions come from the standing endpoint
      let topDrawing = null
      let topProject = null
      if (!doc.dwg_number) {
        try {
          const sugg = await getFileSuggestions(res.file_id)
          topDrawing = (sugg.drawing_suggestions ?? [])[0] ?? null
          topProject = (sugg.project_suggestions ?? [])[0] ?? null
        } catch {
          // suggestions are a nicety - the Documents page offers Assign anyway
        }
      }
      patch(next.id, {
        status: 'done',
        fileId: res.file_id,
        regions: doc.chunks.length,
        autoAssignment:
          doc.dwg_number && doc.auto_assigned ? { dwg_number: doc.dwg_number } : null,
        topDrawing,
        topProject,
      })
      return 'ok'
    } catch (e) {
      if (e.canceled) {
        // the abort may have raced a request that already reached the server:
        // reconcile by deleting the ghost record (same name, still in the
        // pre-extraction 'uploaded' state - never touches older documents)
        try {
          const existing = await listFiles()
          const ghost = existing.find(
            (f) => f.filename === next.name && f.status === 'uploaded',
          )
          if (ghost) await deleteFile(ghost.file_id)
        } catch {
          // best effort - a missed ghost shows up on Documents for manual delete
        }
        setItems((prev) => prev.filter((i) => i.id !== next.id))
        return
      }
      patch(next.id, { status: 'error', error: e.message })
      return /throttl|rate limit|too many requests|slow down/i.test(e.message)
        ? 'throttled'
        : 'error'
    }
  }

  async function processQueue() {
    if (runningRef.current) return
    runningRef.current = true
    const claimNext = () =>
      new Promise((resolve) =>
        setItems((prev) => {
          const next = prev.find((i) => i.status === 'queued') ?? null
          resolve(next)
          // claim immediately so parallel workers never pick the same item
          return next
            ? prev.map((i) => (i.id === next.id ? { ...i, status: 'uploading', percent: 0 } : i))
            : prev
        }),
      )

    const state = { target: START_WORKERS, active: 0 }
    await new Promise((finish) => {
      const spawnOne = () => {
        state.active++
        claimNext().then((next) => {
          if (!next) {
            state.active--
            if (state.active === 0) finish()
            return
          }
          processOne(next).then((outcome) => {
            if (outcome === 'throttled') {
              state.target = Math.max(MIN_WORKERS, Math.ceil(state.target / 2))
            } else if (outcome === 'ok') {
              state.target = Math.min(MAX_WORKERS, state.target + 1)
            }
            state.active--
            maybeSpawn()
            if (state.active === 0) finish()
          })
        })
      }
      const maybeSpawn = () => {
        while (state.active < state.target) spawnOne()
      }
      maybeSpawn()
    })
    runningRef.current = false
  }

  function retryItem(id) {
    // A failed row whose File object is still in memory can simply rejoin
    // the queue - no re-picking the file. Covers uploads that died because
    // the server was briefly unavailable (deploy, task replacement).
    setItems((prev) =>
      prev.map((i) =>
        i.id === id && i.status === 'error' && i.file
          ? { ...i, status: 'queued', error: null, percent: 0, fileId: null }
          : i,
      ),
    )
    // let the state update land before the runner claims work
    setTimeout(processQueue, 0)
  }

  async function enqueue(files, folderId = null, scope = {}) {
    const { drawingId = null, drawingName = null, projectId = null, projectName = null } = scope
    setExpanding(true)
    const additions = []
    for (const file of files) {
      if (ext(file.name) === 'zip') {
        try {
          const zip = await JSZip.loadAsync(file)
          const entries = Object.values(zip.files).filter((e) => !e.dir)
          for (const entry of entries) {
            const name = basename(entry.name)
            if (name.startsWith('.') || name.startsWith('__MACOSX')) continue
            const supported = SUPPORTED.includes(ext(name))
            const blob = supported ? await entry.async('blob') : null
            additions.push({
              id: ++uid,
              name,
              file: blob,
              source: file.name,
              folderId,
              drawingId,
              projectId,
              projectName,
              drawingName,
              status: supported ? 'queued' : 'skipped',
            })
          }
        } catch {
          toast.error(`Could not read ${file.name} as a zip archive.`)
        }
      } else {
        const supported = SUPPORTED.includes(ext(file.name))
        additions.push({
          id: ++uid,
          name: file.name,
          file,
          folderId,
          drawingId,
          drawingName,
          status: supported ? 'queued' : 'skipped',
        })
      }
    }
    setExpanding(false)
    if (additions.length === 0) return
    setItems((prev) => [...prev, ...additions])
    // let state flush, then start the worker
    setTimeout(processQueue, 0)
  }

  function clearFinished() {
    setItems((prev) => prev.filter((i) => ACTIVE_STATUSES.includes(i.status)))
  }

  function removeItem(id) {
    // real cancel, phase-aware: an in-flight upload is aborted; a file
    // already processing server-side is deleted (its background job's
    // result is discarded with the record). Finished rows just clear.
    const item = items.find((i) => i.id === id)
    if (item?.status === 'uploading') {
      abortHandles.current.get(id)?.abort?.()
    } else if (item?.fileId && item.status === 'processing') {
      deleteFile(item.fileId).catch(() => {})
    }
    abortHandles.current.delete(id)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const total = items.length
  const done = items.filter((i) => i.status === 'done').length
  const failed = items.filter((i) => i.status === 'error').length
  const activeCount = items.filter((i) => ACTIVE_STATUSES.includes(i.status)).length

  const value = {
    items,
    expanding,
    enqueue,
    clearFinished,
    removeItem,
    retryItem,
    total,
    done,
    failed,
    active: activeCount > 0,
    activeCount,
  }
  return <UploadQueueContext.Provider value={value}>{children}</UploadQueueContext.Provider>
}

export function useUploadQueue() {
  const ctx = useContext(UploadQueueContext)
  if (!ctx) throw new Error('useUploadQueue must be used within an UploadQueueProvider')
  return ctx
}
