import { ActionIcon, Badge, Button, Select, Text, TextInput, Textarea, Tooltip } from '@mantine/core'
import {
  IconArrowDown,
  IconCheck,
  IconCopy,
  IconPencil,
  IconPlus,
  IconSearch,
  IconSend,
  IconSparkles,
  IconThumbDown,
  IconThumbUp,
  IconTrash,
} from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { useNavigate, useSearchParams } from 'react-router-dom'
import remarkGfm from 'remark-gfm'
import {
  createChatSession,
  deleteChatSession,
  getChatMessages,
  listChatSessions,
  listProjects,
  rateChatMessage,
  renameChatSession,
  streamChatMessage,
} from '../api'
import ConfirmDialog from '../components/ConfirmDialog'
import DrawingViewer from '../components/DrawingViewer'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'


// Session recency: relative while it is still "just now" territory, then the
// clock time, because "3d ago" is not enough to find the conversation you had
// after lunch on Tuesday. Anything older than an hour carries hour:minute.
//   just now · 12m ago · 14:32 · Yesterday 14:32 · Sat 14:32 · Aug 14, 14:32
function timeAgo(iso) {
  if (!iso) return ''
  const then = new Date(iso)
  const mins = Math.floor((Date.now() - then.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`

  const clock = then.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const dayDiff = Math.round((startOfToday - new Date(then).setHours(0, 0, 0, 0)) / 86400000)

  if (dayDiff <= 0) return clock
  if (dayDiff === 1) return `Yesterday ${clock}`
  if (dayDiff < 7) return `${then.toLocaleDateString(undefined, { weekday: 'short' })} ${clock}`
  return `${then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${clock}`
}

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
        <span
          className="session-meta"
          title={new Date(session.updated_at ?? session.created_at).toLocaleString()}
        >
          {session.message_count} messages · {timeAgo(session.updated_at ?? session.created_at)}
        </span>
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

// Distinct drawings/records the answer drew from, for the combined-sources line
function sourceLabels(sources) {
  const labels = []
  for (const s of sources) {
    const label = s.region_type === 'registry' ? s.label : (s.dwg_number ?? s.filename)
    if (label && !labels.includes(label)) labels.push(label)
  }
  return labels
}

// Staged status lines shown while an answer streams in: retrieval first,
// then generation. The evidence arrives before the first word of the answer.
function streamingStatus(phase, sourceCount) {
  if (phase === 'searching') return 'Searching your drawings…'
  if (sourceCount > 0) {
    return `Found ${sourceCount} source${sourceCount > 1 ? 's' : ''} - writing the answer…`
  }
  return 'Writing the answer…'
}

function AssistantMessage({ messageId, content, evidence, versionContext, feedback, streaming, phase, onOpenSource, onRate }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  function copyAnswer() {
    navigator.clipboard?.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  const sources = dedupeEvidence(evidence)
  const combined = sourceLabels(sources)
  return (
    <div className="msg msg-assistant">
      <div className="assistant-avatar">B</div>
      <div className="assistant-body">
        {streaming && !content ? (
          <div className="msg-bubble thinking">
            <span className="status-phrase">{streamingStatus(phase, sources.length)}</span>
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        ) : (
        <div className="msg-bubble markdown-body">
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: (props) => (
                <div className="md-table-wrap">
                  <table {...props} />
                </div>
              ),
              a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
            }}
          >
            {content}
          </Markdown>
          {streaming && <span className="stream-cursor" />}
        </div>
        )}
        {combined.length > 1 && (
          <div className="version-context">
            Combined from {combined.length} sources: {combined.join(' · ')}
          </div>
        )}
        {versionContext && (
          <div className="version-context">
            Answer based on version <Badge variant="light" size="sm">{versionContext.used.label}</Badge>
            {' '}· other version{versionContext.other_versions.length > 1 ? 's' : ''}:{' '}
            {versionContext.other_versions
              .map((v) => v.label + (v.also_matched ? ' (also matched this question)' : ''))
              .join('; ')}
          </div>
        )}
        {onRate && !streaming && (
          <div className="feedback-row">
            <ActionIcon
              variant={feedback === 1 ? 'filled' : 'subtle'}
              color={feedback === 1 ? 'teal' : 'gray'}
              size="sm"
              aria-label="Helpful"
              onClick={() => onRate(messageId, 1)}
            >
              <IconThumbUp size={15} />
            </ActionIcon>
            <ActionIcon
              variant={feedback === -1 ? 'filled' : 'subtle'}
              color={feedback === -1 ? 'red' : 'gray'}
              size="sm"
              aria-label="Not helpful"
              onClick={() => onRate(messageId, -1)}
            >
              <IconThumbDown size={15} />
            </ActionIcon>
            <Tooltip label={copied ? 'Copied' : 'Copy answer'} withArrow>
              <ActionIcon
                variant="subtle"
                color={copied ? 'teal' : 'gray'}
                size="sm"
                aria-label="Copy answer"
                onClick={copyAnswer}
              >
                {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
              </ActionIcon>
            </Tooltip>
          </div>
        )}
        {sources.length > 0 && (
          <div className="sources">
            {/* Citations are the point of the product, so opening one is a
                single click on a numbered chip. The expandable list below
                still carries the quoted text for anyone who wants it. */}
            <div className="source-chips">
              {sources.map((s, i) => (
                <button
                  key={i}
                  className="source-chip"
                  onClick={() => onOpenSource(s)}
                  title={s.chunk_text ?? undefined}
                >
                  <span className="source-index">{i + 1}</span>
                  <span className="source-chip-label">
                    {s.region_type === 'registry'
                      ? (s.label ?? 'registry')
                      : (s.dwg_number ?? s.filename ?? s.region_type.replace('_', ' '))}
                  </span>
                </button>
              ))}
            </div>
            <button className="sources-toggle" onClick={() => setOpen((v) => !v)}>
              <span className={open ? 'caret open' : 'caret'}>▸</span>
              {open ? 'Hide quoted text' : `Show quoted text from ${sources.length} source${sources.length > 1 ? 's' : ''}`}
            </button>
            {open && (
              <ol className="sources-list">
                {sources.map((s, i) => (
                  <li key={i}>
                    <button className="source-row" onClick={() => onOpenSource(s)}>
                      <span className="source-index">{i + 1}</span>
                      <span className="source-region">
                        {s.region_type === 'registry'
                          ? (s.label ?? 'registry')
                          : (s.dwg_number ?? s.region_type.replace('_', ' '))}
                        {s.region_type === 'summary' && (
                          <Tooltip
                            label="AI-written description of the drawing - reviewed at ingestion, not text printed on the drawing."
                            maw={280}
                            multiline
                            withArrow
                          >
                            <IconSparkles size={12} style={{ marginLeft: 4 }} />
                          </Tooltip>
                        )}
                      </span>
                      <span className="source-text">{s.chunk_text ?? '(unreadable)'}</span>
                      <span className="source-view">
                        {s.region_type === 'registry' ? 'View record →' : 'View on drawing →'}
                      </span>
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
  const [projects, setProjects] = useState([])
  const [projectScope, setProjectScope] = useState(null) // null = all projects
  const [renamingId, setRenamingId] = useState(null)
  const [sessionQuery, setSessionQuery] = useState('')
  const [showJump, setShowJump] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // arriving via "Ask about this drawing": scope every question to that document
  const fileScope = searchParams.get('file')
  const fileScopeName = searchParams.get('name')

  // a document-scoped conversation is its own context: start clean rather
  // than appending to whatever chat happened to be open
  useEffect(() => {
    if (fileScope) {
      setActive(null)
      setMessages([])
      setSourceOpen(null)
    }
  }, [fileScope])
  const bottomRef = useRef(null)
  const threadRef = useRef(null)
  const composerRef = useRef(null)
  // follow the newest message only while the reader is already at the bottom;
  // scrolled-up reading is never yanked back down by streaming tokens
  const stickRef = useRef(true)

  function onThreadScroll() {
    const el = threadRef.current
    if (!el) return
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stickRef.current = fromBottom < 120
    setShowJump(fromBottom > 300)
  }

  function jumpToLatest() {
    stickRef.current = true
    setShowJump(false)
    bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }

  useEffect(() => {
    listChatSessions()
      .then((s) => {
        setSessions(s)
        // arriving scoped to a document starts fresh - don't auto-open
        if (s.length > 0 && !fileScope) openSession(s[0].session_id)
      })
      .catch((e) => toast.error(e.message))
    // scope selector options; chat still works if this fails
    listProjects().then(setProjects).catch(() => {})
  }, [])

  function refreshChats() {
    return Promise.all([
      listChatSessions().then(setSessions),
      active ? getChatMessages(active).then((res) => setMessages(res.messages)) : Promise.resolve(),
    ]).catch((e) => toast.error(e.message))
  }

  // Keep the newest message in view.
  // Deferred a frame because, called synchronously after a session loads, the
  // thread has not been laid out yet. Instant rather than smooth: animated
  // scrolling is driven by the same rAF machinery that stalls in throttled and
  // embedded webviews, where it silently no-ops and leaves the reader looking
  // at the top of the conversation.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (stickRef.current) bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
    })
    return () => cancelAnimationFrame(frame)
  }, [messages, busy])

  async function handleRate(messageId, rating) {
    const current = messages.find((m) => m.message_id === messageId)?.feedback ?? null
    const next = current === rating ? 0 : rating // clicking again clears
    try {
      await rateChatMessage(active, messageId, next)
      setMessages((prev) =>
        prev.map((m) =>
          m.message_id === messageId ? { ...m, feedback: next === 0 ? null : next } : m,
        ),
      )
      toast.success(
        next === 0
          ? 'Feedback cleared.'
          : 'Thanks - your feedback adjusts how these sources rank in future answers.',
      )
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function openSession(sessionId) {
    if (fileScope && sessionId !== active) setSearchParams({}) // other sessions are their own context
    setActive(sessionId)
    setSourceOpen(null)
    try {
      const res = await getChatMessages(sessionId)
      setMessages(res.messages)
      stickRef.current = true
      composerRef.current?.focus()
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
      composerRef.current?.focus()
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
    stickRef.current = true
    setMessages((m) => [
      ...m,
      { message_id: 'pending-user', role: 'user', content: question },
      {
        message_id: 'streaming',
        role: 'assistant',
        content: '',
        evidence: [],
        version_context: null,
        streaming: true,
        phase: 'searching',
      },
    ])
    let streamError = null
    try {
      // evidence arrives first (meta), then the answer streams token by token
      await streamChatMessage(sessionId, question, fileScope ? null : projectScope, {
        meta: (d) =>
          setMessages((m) =>
            m.map((x) =>
              x.message_id === 'streaming'
                ? { ...x, phase: 'writing', evidence: d.evidence, version_context: d.version_context }
                : x.message_id === 'pending-user'
                  ? d.user_message
                  : x,
            ),
          ),
        token: (d) =>
          setMessages((m) =>
            m.map((x) =>
              x.message_id === 'streaming' ? { ...x, content: x.content + d.t } : x,
            ),
          ),
        done: (d) =>
          setMessages((m) =>
            m.map((x) => (x.message_id === 'streaming' ? d.assistant_message : x)),
          ),
        error: (d) => {
          streamError = d?.detail || 'Generation failed'
        },
      }, fileScope)
      if (streamError) throw new Error(streamError)
      listChatSessions().then(setSessions)
    } catch (err) {
      setMessages((m) =>
        m.filter((x) => x.message_id !== 'pending-user' && x.message_id !== 'streaming'),
      )
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
        description="Ask questions about your drawings - every answer cites its source regions"
        onRefresh={refreshChats}
        mb="md"
      />
      <div className={sourceOpen ? 'chat-layout panel-open' : 'chat-layout'}>
      <aside className="chat-sessions">
        <Button fullWidth leftSection={<IconPlus size={16} />} onClick={newSession}>
          New chat
        </Button>
        <Select
          size="xs"
          mt="xs"
          label="Search scope"
          data={[
            { value: 'all', label: 'All projects' },
            ...projects.map((p) => ({
              value: p.project_id,
              label: p.number ? `${p.name} (#${p.number})` : p.name,
            })),
          ]}
          value={projectScope ?? 'all'}
          onChange={(v) => setProjectScope(v === 'all' ? null : v)}
          searchable
        />
        {sessions.length > 3 && (
          <TextInput
            size="xs"
            mt={6}
            placeholder="Find a chat…"
            leftSection={<IconSearch size={13} />}
            value={sessionQuery}
            onChange={(e) => setSessionQuery(e.currentTarget.value)}
            aria-label="Find a conversation"
          />
        )}
        <div className="session-list">
          {sessions.length > 0 && <div className="session-group-label">Conversations</div>}
          {(sessionQuery
            ? sessions.filter((s) =>
                s.title.toLowerCase().includes(sessionQuery.trim().toLowerCase()),
              )
            : sessions
          ).map((s) => (
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
          {sessions.length === 0 && (
            <Text size="sm" c="dimmed" px="xs" py="sm">
              No chats yet - ask a question to start one.
            </Text>
          )}
        </div>
      </aside>

      <section className="chat-main">
        <div className="chat-thread" ref={threadRef} onScroll={onThreadScroll}>
          {messages.length === 0 && !busy && (
            <div className="empty-state">
              <p>Ask anything about your ingested drawings</p>
              <p className="page-sub">
                Every answer cites the regions it came from - click a citation to see it
                highlighted on the drawing itself.
              </p>
              {/* Examples that fill the composer (they do not send) so an
                  empty thread suggests what this can actually answer. */}
              <div className="chat-starters">
                {[
                  'What material is specified for the mounting plate?',
                  'List every drawing that mentions anchor bolts',
                  'What is the scale on the foundation plan?',
                  'Which sheets were revised most recently?',
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="chat-starter"
                    onClick={() => {
                      setInput(q)
                      composerRef.current?.focus()
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.message_id} className="msg msg-user">
                <div
                  className="msg-bubble"
                  title={m.created_at ? new Date(m.created_at).toLocaleString() : undefined}
                >
                  <p>{m.content}</p>
                </div>
                {m.created_at && (
                  <span className="msg-time">
                    {new Date(m.created_at).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
            ) : (
              <AssistantMessage
                key={m.message_id}
                messageId={m.message_id}
                content={m.content}
                evidence={m.evidence}
                versionContext={m.version_context}
                feedback={m.feedback}
                streaming={m.streaming}
                phase={m.phase}
                onOpenSource={setSourceOpen}
                onRate={handleRate}
              />
            ),
          )}
          <div ref={bottomRef} />
        </div>
        {showJump && (
          <button type="button" className="jump-latest" onClick={jumpToLatest}>
            <IconArrowDown size={14} />
            Latest
          </button>
        )}
        {fileScope && (
          <div className="file-scope-chip">
            <Badge
              variant="light"
              size="lg"
              rightSection={
                <ActionIcon
                  variant="transparent"
                  size="xs"
                  aria-label="Stop chatting about this document"
                  onClick={() => setSearchParams({})}
                >
                  ×
                </ActionIcon>
              }
            >
              Chatting about: {fileScopeName ?? 'this document'}
            </Badge>
          </div>
        )}
        <form className="chat-input" onSubmit={send}>
          <Textarea
            className="chat-input-field"
            ref={composerRef}
            value={input}
            size="md"
            radius="md"
            autosize
            minRows={1}
            maxRows={6}
            placeholder="Ask about your drawings - Enter sends, Shift+Enter starts a new line"
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(e)
              }
            }}
            aria-label="Ask a question about your drawings"
          />
          <Button
            type="submit"
            size="md"
            loading={busy}
            disabled={!input.trim()}
            rightSection={<IconSend size={16} />}
          >
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
              <span className="region">
                {sourceOpen.region_type === 'registry'
                  ? `${sourceOpen.entity_type} record`
                  : sourceOpen.region_type.replace('_', ' ')}
              </span>
              “{sourceOpen.chunk_text}”
            </p>
            {(sourceOpen.dwg_number || sourceOpen.project_name || sourceOpen.filename) && (
              // div, not p: Mantine's Badge renders a div, and a div inside a
              // p makes the browser close the paragraph early, splitting this
              // line into two mis-styled blocks
              <div className="evidence-score muted">
                {sourceOpen.dwg_number && (
                  <Badge variant="light" size="sm" mr={6}>
                    {sourceOpen.dwg_number}
                  </Badge>
                )}
                {[
                  sourceOpen.filename,
                  sourceOpen.project_name && `Project: ${sourceOpen.project_name}`,
                  sourceOpen.set_number && `Set ${sourceOpen.set_number}`,
                  (sourceOpen.drawing_date || sourceOpen.year) &&
                    `Version: ${sourceOpen.drawing_date || sourceOpen.year}${
                      sourceOpen.version_note ? ` (${sourceOpen.version_note})` : ''
                    }`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            )}
            <p className="evidence-score muted">Relevance score {sourceOpen.score}</p>
            {sourceOpen.source_file_id ? (
              <DrawingViewer
                fileId={sourceOpen.source_file_id}
                highlightBbox={sourceOpen.bbox}
                page={sourceOpen.page ?? 1}
              />
            ) : sourceOpen.region_type === 'registry' ? (
              // Registry cards have no drawing to render; link to the record.
              <Button
                variant="light"
                size="xs"
                onClick={() =>
                  navigate(
                    sourceOpen.entity_type === 'drawing'
                      ? `/drawings/${sourceOpen.entity_id}`
                      : sourceOpen.entity_type === 'project'
                        ? `/projects/${sourceOpen.entity_id}`
                        : `/projects/${sourceOpen.project_id}`,
                  )
                }
              >
                Open {sourceOpen.entity_type} record →
              </Button>
            ) : null}
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
