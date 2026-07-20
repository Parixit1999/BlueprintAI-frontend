import { useEffect, useRef, useState } from 'react'
import {
  createChatSession,
  getChatMessages,
  listChatSessions,
  sendChatMessage,
} from '../api'
import DrawingViewer from '../components/DrawingViewer'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

function EvidenceChips({ evidence, onOpen }) {
  if (!evidence?.length) return null
  return (
    <div className="evidence-chips">
      {evidence.map((h, i) => (
        <button key={i} className="chip" onClick={() => onOpen(h)}>
          <span className="chip-region">{h.region_type.replace('_', ' ')}</span>
          {(h.chunk_text ?? '').slice(0, 32)}
          {(h.chunk_text ?? '').length > 32 ? '…' : ''}
        </button>
      ))}
    </div>
  )
}

export default function Chat() {
  const [sessions, setSessions] = useState([])
  const [active, setActive] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(null)
  const toast = useToast()
  const bottomRef = useRef(null)

  useEffect(() => {
    listChatSessions()
      .then((s) => {
        setSessions(s)
        if (s.length > 0) openSession(s[0].session_id)
      })
      .catch((e) => toast.error(e.message))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function openSession(sessionId) {
    setActive(sessionId)
    try {
      const res = await getChatMessages(sessionId)
      setMessages(res.messages)
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function newSession() {
    try {
      const s = await createChatSession()
      setSessions((prev) => [{ ...s, message_count: 0 }, ...prev])
      setActive(s.session_id)
      setMessages([])
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function send(e) {
    e.preventDefault()
    const question = input.trim()
    if (!question || busy) return

    let sessionId = active
    if (!sessionId) {
      try {
        const s = await createChatSession()
        setSessions((prev) => [{ ...s, message_count: 0 }, ...prev])
        setActive(s.session_id)
        sessionId = s.session_id
      } catch (err) {
        toast.error(err.message)
        return
      }
    }

    setInput('')
    setBusy(true)
    setMessages((m) => [...m, { message_id: 'pending-user', role: 'user', content: question }])
    try {
      const res = await sendChatMessage(sessionId, question)
      setMessages((m) => [
        ...m.filter((x) => x.message_id !== 'pending-user'),
        res.user_message,
        res.assistant_message,
      ])
      listChatSessions().then(setSessions)
    } catch (err) {
      setMessages((m) => m.filter((x) => x.message_id !== 'pending-user'))
      setInput(question)
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="chat-layout">
      <aside className="chat-sessions">
        <button className="primary full" onClick={newSession}>
          + New chat
        </button>
        <div className="session-list">
          {sessions.map((s) => (
            <button
              key={s.session_id}
              className={s.session_id === active ? 'session-item active' : 'session-item'}
              onClick={() => openSession(s.session_id)}
            >
              <span className="session-title">{s.title}</span>
              <span className="session-meta">{s.message_count} messages</span>
            </button>
          ))}
          {sessions.length === 0 && <p className="empty-note">No chats yet.</p>}
        </div>
      </aside>

      <section className="chat-main">
        <div className="chat-thread">
          {messages.length === 0 && (
            <div className="empty-state">
              <p>Ask anything about your ingested drawings.</p>
              <p className="page-sub">
                Every answer includes clickable evidence pointing at the exact source region.
              </p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.message_id} className={`msg msg-${m.role}`}>
              <div className="msg-bubble">
                <p>{m.content}</p>
                <EvidenceChips evidence={m.evidence} onOpen={setEvidenceOpen} />
              </div>
            </div>
          ))}
          {busy && (
            <div className="msg msg-assistant">
              <div className="msg-bubble thinking">Thinking…</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <form className="chat-input" onSubmit={send}>
          <input
            value={input}
            placeholder="Ask about your drawings — e.g. What material is the mounting plate?"
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="primary" type="submit" disabled={busy || !input.trim()}>
            Send
          </button>
        </form>
      </section>

      {evidenceOpen && (
        <Modal title="Source evidence" wide onClose={() => setEvidenceOpen(null)}>
          <p className="evidence-quote">
            <span className="region">{evidenceOpen.region_type.replace('_', ' ')}</span>“
            {evidenceOpen.chunk_text}” <span className="muted">score {evidenceOpen.score}</span>
          </p>
          <DrawingViewer
            fileId={evidenceOpen.source_file_id}
            highlightBbox={evidenceOpen.bbox}
            page={evidenceOpen.page ?? 1}
          />
        </Modal>
      )}
    </div>
  )
}
