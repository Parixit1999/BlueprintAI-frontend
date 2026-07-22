const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

// Customer-facing copy: plain language, no server/backend jargon, always a
// next step. Backend `detail` messages are already written for users and
// take precedence when present.
const CONNECTION_MESSAGE =
  'We couldn’t connect to BlueprintAI. Please check your internet connection and try again in a moment.'

const STATUS_FALLBACKS = {
  413: 'This file is too large to upload.',
  422: 'We couldn’t process that file. Please check it and try again.',
  500: 'Something went wrong on our side. Please try again in a moment.',
  503: 'BlueprintAI is briefly unavailable. Please try again shortly.',
}

const GENERIC_MESSAGE = 'Something didn’t work as expected. Please try again.'

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, options)
  } catch {
    throw new Error(CONNECTION_MESSAGE)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ?? STATUS_FALLBACKS[res.status] ?? GENERIC_MESSAGE)
  }
  if (res.status === 204) return null
  return res.json()
}

// Uploaded via XHR (not fetch) so we can report real progress. onProgress gets
// { phase: 'uploading', percent } while bytes transfer, then { phase: 'processing' }
// once the request is fully sent and the server is extracting (vision/LLM/parse).
export function uploadFile(file, filename, onProgress, folderId = null) {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    if (filename) form.append('file', file, filename)
    else form.append('file', file)
    if (folderId) form.append('folder_id', folderId)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/files/upload`)

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable || !onProgress) return
      const percent = Math.round((e.loaded / e.total) * 100)
      onProgress(percent >= 100 ? { phase: 'processing' } : { phase: 'uploading', percent })
    }
    // Bytes fully sent; the server is now extracting.
    xhr.upload.onload = () => onProgress?.({ phase: 'processing' })

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText ? JSON.parse(xhr.responseText) : null)
        return
      }
      let detail
      try {
        detail = JSON.parse(xhr.responseText)?.detail
      } catch {
        detail = null
      }
      reject(
        new Error(detail ?? STATUS_FALLBACKS[xhr.status] ?? GENERIC_MESSAGE),
      )
    }
    xhr.onerror = () =>
      reject(new Error(CONNECTION_MESSAGE))

    xhr.send(form)
  })
}

export function listFiles() {
  return request('/files')
}

export function getExtraction(fileId) {
  return request(`/files/${fileId}/extraction`)
}

export function confirmAndIngest(fileId, corrections, rejected) {
  return request(`/review/${fileId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ corrections, rejected }),
  })
}

export function getRender(fileId, page = 1) {
  return request(`/files/${fileId}/render?page=${page}`)
}

export function deleteFile(fileId) {
  return request(`/files/${fileId}`, { method: 'DELETE' })
}

export function retryExtraction(fileId) {
  return request(`/files/${fileId}/retry`, { method: 'POST' })
}

export function reextractFile(fileId) {
  return request(`/files/${fileId}/reextract`, { method: 'POST' })
}

// --- Phase 1: projects / drawings / sets ---

const json = (body) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export function listProjects() {
  return request('/projects')
}

export function createProject(fields) {
  return request('/projects', { method: 'POST', ...json(fields) })
}

export function getProject(projectId) {
  return request(`/projects/${projectId}`)
}

export function updateProject(projectId, fields) {
  return request(`/projects/${projectId}`, { method: 'PATCH', ...json(fields) })
}

export function deleteProject(projectId) {
  return request(`/projects/${projectId}`, { method: 'DELETE' })
}

export function createSet(projectId, fields) {
  return request(`/projects/${projectId}/sets`, { method: 'POST', ...json(fields) })
}

export function deleteSet(setId) {
  return request(`/sets/${setId}`, { method: 'DELETE' })
}

export function createDrawing(fields) {
  return request('/drawings', { method: 'POST', ...json(fields) })
}

export function getDrawing(drawingId) {
  return request(`/drawings/${drawingId}`)
}

export function updateDrawing(drawingId, fields) {
  return request(`/drawings/${drawingId}`, { method: 'PATCH', ...json(fields) })
}

export function deleteDrawing(drawingId) {
  return request(`/drawings/${drawingId}`, { method: 'DELETE' })
}

export function linkVersions(drawingId, otherDrawingId) {
  return request(`/drawings/${drawingId}/link-version`, {
    method: 'POST',
    ...json({ other_drawing_id: otherDrawingId }),
  })
}

export function unlinkVersion(drawingId) {
  return request(`/drawings/${drawingId}/unlink-version`, { method: 'POST' })
}

export function getFileSuggestions(fileId) {
  return request(`/files/${fileId}/suggestions`)
}

export function assignFile(fileId, payload) {
  return request(`/files/${fileId}/assign`, { method: 'POST', ...json(payload) })
}

export function unassignFile(fileId) {
  return request(`/files/${fileId}/unassign`, { method: 'POST' })
}

export function getStats() {
  return request('/stats')
}

export function createChatSession() {
  return request('/chats', { method: 'POST' })
}

export function listChatSessions() {
  return request('/chats')
}

export function getChatMessages(sessionId) {
  return request(`/chats/${sessionId}`)
}

export function sendChatMessage(sessionId, question, projectId = null) {
  return request(`/chats/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, project_id: projectId }),
  })
}

// SSE over fetch (POST bodies rule out EventSource). Emits handler callbacks:
// meta (user message + evidence, before generation), token ({t}), done
// (stored assistant message), error ({detail}).
export async function streamChatMessage(sessionId, question, projectId, handlers) {
  let res
  try {
    res = await fetch(`${API_BASE}/chats/${sessionId}/messages/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, project_id: projectId }),
    })
  } catch {
    throw new Error(CONNECTION_MESSAGE)
  }
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail || STATUS_FALLBACKS[res.status] || GENERIC_MESSAGE)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let sep
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      let event = 'message'
      let data = null
      for (const line of frame.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7).trim()
        else if (line.startsWith('data: ')) data = JSON.parse(line.slice(6))
      }
      handlers[event]?.(data)
    }
  }
}

export function renameChatSession(sessionId, title) {
  return request(`/chats/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
}

export function deleteChatSession(sessionId) {
  return request(`/chats/${sessionId}`, { method: 'DELETE' })
}

export function rateChatMessage(sessionId, messageId, rating) {
  return request(`/chats/${sessionId}/messages/${messageId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating }),
  })
}

// --- File manager ---

export function browseFolder(folderId = null) {
  return request(folderId ? `/folders/browse?folder_id=${folderId}` : '/folders/browse')
}

export function listFolders() {
  return request('/folders')
}

export function createFolder(name, parentId = null) {
  return request('/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parent_id: parentId }),
  })
}

export function renameFolder(folderId, name) {
  return request(`/folders/${folderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

export function moveFolder(folderId, parentId) {
  return request(`/folders/${folderId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parent_id: parentId }),
  })
}

export function deleteFolder(folderId) {
  return request(`/folders/${folderId}`, { method: 'DELETE' })
}

export function renameFile(fileId, filename) {
  return request(`/files/${fileId}/name`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  })
}

export function moveFile(fileId, folderId) {
  return request(`/files/${fileId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_id: folderId }),
  })
}
