import JSZip from 'jszip'
import { createContext, useContext, useRef, useState } from 'react'
import { uploadFile } from '../api'
import { useToast } from '../components/Toast'

export const SUPPORTED = ['dxf', 'pdf', 'png', 'jpg', 'jpeg']
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
  pdf: 'Extracting text — scanned pages are read with the vision model…',
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
  const toast = useToast()

  function patch(id, changes) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)))
  }

  async function processQueue() {
    if (runningRef.current) return
    runningRef.current = true
    // sequential: the local vision model can't handle many images at once
    while (true) {
      const next = await new Promise((resolve) =>
        setItems((prev) => {
          resolve(prev.find((i) => i.status === 'queued') ?? null)
          return prev
        }),
      )
      if (!next) break
      patch(next.id, { status: 'uploading', percent: 0 })
      try {
        const res = await uploadFile(
          next.file,
          next.name,
          (p) => {
            if (p.phase === 'uploading') patch(next.id, { status: 'uploading', percent: p.percent })
            else patch(next.id, { status: 'processing' })
          },
          next.folderId ?? null,
        )
        patch(next.id, { status: 'done', fileId: res.file_id, regions: res.chunks.length })
      } catch (e) {
        patch(next.id, { status: 'error', error: e.message })
      }
    }
    runningRef.current = false
  }

  async function enqueue(files, folderId = null) {
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
