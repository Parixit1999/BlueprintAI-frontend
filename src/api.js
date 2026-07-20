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

export function uploadFile(file, filename) {
  const form = new FormData()
  if (filename) form.append('file', file, filename)
  else form.append('file', file)
  return request('/files/upload', { method: 'POST', body: form })
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

export function sendChatMessage(sessionId, question) {
  return request(`/chats/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
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
