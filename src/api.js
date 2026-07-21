const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

const STATUS_FALLBACKS = {
  413: 'The file is too large.',
  422: 'The file could not be processed.',
  500: 'Something went wrong on the server. Please try again.',
  503: 'A required service is temporarily unavailable. Please try again shortly.',
}

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, options)
  } catch {
    throw new Error('Cannot reach the BlueprintAI server. Is the backend running?')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(
      body?.detail ?? STATUS_FALLBACKS[res.status] ?? `Request failed (HTTP ${res.status})`,
    )
  }
  if (res.status === 204) return null
  return res.json()
}

// Uploaded via XHR (not fetch) so we can report real progress. onProgress gets
// { phase: 'uploading', percent } while bytes transfer, then { phase: 'processing' }
// once the request is fully sent and the server is extracting (vision/LLM/parse).
export function uploadFile(file, filename, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    if (filename) form.append('file', file, filename)
    else form.append('file', file)

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
        new Error(detail ?? STATUS_FALLBACKS[xhr.status] ?? `Request failed (HTTP ${xhr.status})`),
      )
    }
    xhr.onerror = () =>
      reject(new Error('Cannot reach the BlueprintAI server. Is the backend running?'))

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
