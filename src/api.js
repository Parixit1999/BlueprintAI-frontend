const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `Request failed (${res.status})`)
  }
  return res.json()
}

export function uploadFile(file) {
  const form = new FormData()
  form.append('file', file)
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

export function ask(question, topK = 5) {
  return request('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, top_k: topK }),
  })
}
