import { ActionIcon, Button, TextInput } from '@mantine/core'
import { IconPencil, IconPlus, IconSend, IconTrash } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import {
  createChatSession,
  deleteChatSession,
  getChatMessages,
  listChatSessions,
  renameChatSession,
  sendChatMessage,
} from '../api'
import ConfirmDialog from '../components/ConfirmDialog'
import DrawingViewer from '../components/DrawingViewer'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'

function SessionRow({ session, active, renaming, onOpen, onStartRename, onSaveRename, onDelete }) {
  const [value, setValue] = useState(session.title)

  useEffect(() => {
    if (renaming) setValue(session.title)
  }, [renaming, session.title])

  if (renaming) {
    return (
      <div className="session-item editing">
        <TextInput
          size="xs"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSaveRename(session.session_id, value)
            if (e.key === 'Escape') onSaveRename(session.session_id, null)
          }}
          onBlur={() => onSaveRename(session.session_id, value)}
          styles={{ input: { fontSize: 13 } }}
        />
      </div>
    )
  }

  return (
    <div className={active ? 'session-item active' : 'session-item'}>
      <button className="session-open" onClick={() => onOpen(session.session_id)}>
        <span className="session-title">{session.title}</span>
        <span className="session-meta">{session.message_count} messages</span>
      </button>
      <div className="session-actions">
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label="Rename chat"
          onClick={() => onStartRename(session.session_id)}
        >
          <IconPencil size={15} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          color="red"
          size="sm"
          aria-label="Delete chat"
          onClick={() => onDelete(session)}
        >
          <IconTrash size={15} />
        </ActionIcon>
      </div>
    </div>
  )
}

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
  const [renamingId, setRenamingId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
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

  function refreshChats() {
    return Promise.all([
      listChatSessions().then(setSessions),
      active ? getChatMessages(active).then((res) => setMessages(res.messages)) : Promise.resolve(),
    ]).catch((e) => toast.error(e.message))
  }

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

  async function saveRename(sessionId, value) {
    setRenamingId(null)
    if (value == null) return // cancelled
    const title = value.trim()
    const current = sessions.find((s) => s.session_id === sessionId)
    if (!title || title === current?.title) return
    try {
      const res = await renameChatSession(sessionId, title)
      setSessions((prev) =>
        prev.map((s) => (s.session_id === sessionId ? { ...s, title: res.title } : s)),
      )
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    const sessionId = pendingDelete.session_id
    try {
      await deleteChatSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId))
      setPendingDelete(null)
      if (active === sessionId) {
        setActive(null)
        setMessages([])
        setSourceOpen(null)
      }
      toast.success('Chat deleted.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setDeleting(false)
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
    <div>
      <PageHeader
        title="Chat"
        description="Ask questions about your drawings — every answer cites its source regions"
        onRefresh={refreshChats}
        mb="md"
      />
      <div className={sourceOpen ? 'chat-layout panel-open' : 'chat-layout'}>
      <aside className="chat-sessions">
        <Button fullWidth leftSection={<IconPlus size={16} />} onClick={newSession}>
          New chat
        </Button>
        <div className="session-list">
          {sessions.map((s) => (
            <SessionRow
              key={s.session_id}
              session={s}
              active={s.session_id === active}
              renaming={renamingId === s.session_id}
              onOpen={openSession}
              onStartRename={setRenamingId}
              onSaveRename={saveRename}
              onDelete={setPendingDelete}
            />
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
          <Button type="submit" loading={busy} disabled={!input.trim()} rightSection={<IconSend size={16} />}>
            Send
          </Button>
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

      {pendingDelete && (
        <ConfirmDialog
          title="Delete chat?"
          message={
            <>
              <strong>{pendingDelete.title}</strong> and its {pendingDelete.message_count} message
              {pendingDelete.message_count === 1 ? '' : 's'} will be permanently removed. This cannot
              be undone.
            </>
          }
          confirmLabel="Delete"
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      </div>
    </div>
  )
}
