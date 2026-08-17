import JSZip from 'jszip'
import { createContext, useContext, useRef, useState } from 'react'
import { assignFile, deleteFile, getFileStatuses, getFileSuggestions, listFiles, uploadFile } from '../api'
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
  // null when idle; while the pool runs, holds a kick() that wakes idle
  // worker slots so files dropped MID-RUN start immediately instead of
  // waiting behind whatever the surviving workers are grinding through
  const runningRef = useRef(null)
  // per-item XHR abort functions for in-flight uploads
  const abortHandles = useRef(new Map())
  const toast = useToast()

  function patch(id, changes) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)))
  }

  // Two decoupled stages, so a slow extraction never blocks an upload:
  //   1. an upload pool pushes EVERY file to the server as fast as the
  //      network allows (the server queues extraction itself and paces it
  //      with its own per-worker concurrency limit), then
  //   2. ONE poller tracks every processing file with a single batched
  //      status request per tick - N documents cost one HTTP call, not N.
  const UPLOAD_WORKERS = 5
  const POLL_MS = 4000

  // fileId -> queue item, for everything uploaded but not yet extracted
  const pendingRef = useRef(new Map())

  async function uploadOne(next) {
    patch(next.id, { status: 'uploading', percent: 0 })
    const handle = {}
    abortHandles.current.set(next.id, handle)
    try {
      const res = await uploadFile(
        next.file,
        next.name,
        (p) => {
          patch(next.id, { percent: p })
        },
        next.folderId ?? null,
        handle,
      )
      patch(next.id, { status: 'processing', fileId: res.file_id })
      pendingRef.current.set(res.file_id, next)
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
    } finally {
      abortHandles.current.delete(next.id)
    }
  }

  // A document finished extracting: run the same filing flow as before -
  // scoped attach, or suggestions for the Assign step.
  async function finishOne(next, row) {
    if (next.projectId && !next.drawingId) {
      try {
        await assignFile(row.file_id, { new_drawing: { project_id: next.projectId } })
        patch(next.id, {
          status: 'done',
          fileId: row.file_id,
          regions: row.region_count,
          autoAssignment: { project_name: next.projectName ?? 'this project' },
        })
        return
      } catch {
        // filing failed - fall through to normal suggestion handling
      }
    }
    if (next.drawingId) {
      try {
        await assignFile(row.file_id, { drawing_id: next.drawingId })
        patch(next.id, {
          status: 'done',
          fileId: row.file_id,
          regions: row.region_count,
          autoAssignment: { dwg_number: next.drawingName ?? 'this drawing' },
        })
        return
      } catch {
        // attach failed - fall through to normal suggestion handling
      }
    }
    let topDrawing = null
    let topProject = null
    if (!row.dwg_number) {
      try {
        const sugg = await getFileSuggestions(row.file_id)
        topDrawing = (sugg.drawing_suggestions ?? [])[0] ?? null
        topProject = (sugg.project_suggestions ?? [])[0] ?? null
      } catch {
        // suggestions are a nicety - the Documents page offers Assign anyway
      }
    }
    patch(next.id, {
      status: 'done',
      fileId: row.file_id,
      regions: row.region_count,
      autoAssignment:
        row.dwg_number && row.auto_assigned ? { dwg_number: row.dwg_number } : null,
      topDrawing,
      topProject,
    })
  }

  async function pollTick() {
    const ids = [...pendingRef.current.keys()]
    if (ids.length === 0) return
    let res
    try {
      res = await getFileStatuses(ids.slice(0, 500))
    } catch {
      return // transient fetch problem - next tick retries
    }
    for (const row of res.statuses ?? []) {
      const next = pendingRef.current.get(row.file_id)
      if (!next) continue
      if (row.status === 'failed') {
        pendingRef.current.delete(row.file_id)
        patch(next.id, {
          status: 'error',
          error: row.error ?? 'Processing failed. Use Retry from Documents.',
        })
      } else if (row.status !== 'uploaded') {
        pendingRef.current.delete(row.file_id)
        finishOne(next, row) // async filing; poller moves on
      }
    }
  }

  async function processQueue() {
    if (runningRef.current) {
      runningRef.current.kick()
      return
    }
    runningRef.current = { kick: () => {} }

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

    // Supervisor: keeps the upload pool full AND polls, until both are idle.
    const uploads = new Set()
    let lastPoll = 0
    let wake = () => {}
    runningRef.current = { kick: () => wake() }
    for (;;) {
      while (uploads.size < UPLOAD_WORKERS) {
        const next = await claimNext()
        if (!next) break
        const job = uploadOne(next)
        uploads.add(job)
        job.finally(() => {
          uploads.delete(job)
          wake()
        })
      }
      if (Date.now() - lastPoll >= POLL_MS) {
        lastPoll = Date.now()
        await pollTick()
      }
      if (uploads.size === 0 && pendingRef.current.size === 0) {
        const more = await claimNext()
        if (!more) break
        const job = uploadOne(more)
        uploads.add(job)
        job.finally(() => {
          uploads.delete(job)
          wake()
        })
      }
      // sleep until the next poll is due, or until a worker frees up /
      // new files arrive (kick)
      await new Promise((r) => {
        const t = setTimeout(r, pendingRef.current.size > 0 ? 1000 : 400)
        wake = () => {
          clearTimeout(t)
          r()
        }
      })
    }
    runningRef.current = null
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
