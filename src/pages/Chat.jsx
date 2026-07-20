import { useEffect, useRef, useState } from 'react'
import {
  createChatSession,
  getChatMessages,
  listChatSessions,
  sendChatMessage,
} from '../api'
import DrawingViewer from '../components/DrawingViewer'
import { useToast } from '../components/Toast'

// The retriever can return the same region more than once; show each unique
// source once in the references list.
function dedupeEvidence(evidence) {
  if (!evidence?.length) return []
  const seen = new Set()
  const out = []
  for (const e of evidence) {
    const key = `${e.source_file_id}|${e.page ?? 1}|${e.chunk_text}|${JSON.stringify(e.bbox)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(e)
  }
  return out
}

function AssistantMessage({ content, evidence, onOpenSource }) {
  const [open, setOpen] = useState(false)
  const sources = dedupeEvidence(evidence)
  return (
    <div className="msg msg-assistant">
      <div className="assistant-avatar">B</div>
      <div className="assistant-body">
        <div className="msg-bubble">
          <p>{content}</p>
        </div>
        {sources.length > 0 && (
          <div className="sources">
            <button className="sources-toggle" onClick={() => setOpen((v) => !v)}>
              <span className={open ? 'caret open' : 'caret'}>▸</span>
              {sources.length} source{sources.length > 1 ? 's' : ''}
            </button>
            {open && (
              <ol className="sources-list">
                {sources.map((s, i) => (
                  <li key={i}>
                    <button className="source-row" onClick={() => onOpenSource(s)}>
                      <span className="source-index">{i + 1}</span>
                      <span className="source-region">{s.region_type.replace('_', ' ')}</span>
                      <span className="source-text">{s.chunk_text ?? '(unreadable)'}</span>
                      <span className="source-view">View on drawing →</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Chat() {
  const [sessions, setSessions] = useState([])
  const [active, setActive] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(null)
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
  }, [messages, busy])

  async function openSession(sessionId) {
    setActive(sessionId)
    setSourceOpen(null)
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
      setSourceOpen(null)
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
    <div className={sourceOpen ? 'chat-layout panel-open' : 'chat-layout'}>
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
          {messages.length === 0 && !busy && (
            <div className="empty-state">
              <p>Ask anything about your ingested drawings.</p>
              <p className="page-sub">
                Answers cite their source regions — expand “Sources” to see each one highlighted on
                the drawing.
              </p>
            </div>
          )}
          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.message_id} className="msg msg-user">
                <div className="msg-bubble">
                  <p>{m.content}</p>
                </div>
              </div>
            ) : (
              <AssistantMessage
                key={m.message_id}
                content={m.content}
                evidence={m.evidence}
                onOpenSource={setSourceOpen}
              />
            ),
          )}
          {busy && (
            <div className="msg msg-assistant">
              <div className="assistant-avatar">B</div>
              <div className="assistant-body">
                <div className="msg-bubble thinking">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
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

      {sourceOpen && (
        <aside className="evidence-panel">
          <div className="evidence-panel-header">
            <h3>Source evidence</h3>
            <button className="icon-btn" onClick={() => setSourceOpen(null)} aria-label="Close">
              ✕
            </button>
          </div>
          <div className="evidence-panel-body">
            <p className="evidence-quote">
              <span className="region">{sourceOpen.region_type.replace('_', ' ')}</span>
              “{sourceOpen.chunk_text}”
            </p>
            <p className="evidence-score muted">Relevance score {sourceOpen.score}</p>
            <DrawingViewer
              fileId={sourceOpen.source_file_id}
              highlightBbox={sourceOpen.bbox}
              page={sourceOpen.page ?? 1}
            />
          </div>
        </aside>
      )}
    </div>
  )
}
