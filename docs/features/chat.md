# Chat

`src/pages/Chat.jsx`. ChatGPT-style conversation grounded in the ingested
drawings, with persistent sessions and verifiable evidence.

- **Sessions** persist in the DB. Sidebar lists them; `SessionRow` supports
  inline **rename** (pencil → TextInput, Enter/blur saves, Escape cancels) and
  **delete** (trash → `ConfirmDialog`). Icons are Mantine `ActionIcon` + Tabler.
- **Messages**: user bubbles right, assistant answers left with a "B" avatar.
  Answers are conversational prose (backend prompt forbids leaking "chunk/source"
  references into the text).
- **Evidence**: each answer has a collapsible "N sources" list (deduped). Clicking
  a source opens a right-hand **evidence panel** with the drawing and the cited
  region highlighted (`DrawingViewer`).
- **Send** posts to `POST /chats/:id/messages`; a new session is created lazily on
  first send. Optimistic pending-user bubble + animated typing dots.

Note: retrieval is document-scoped on the backend, so all sources for one answer
come from a single drawing (no cross-document contamination); off-topic questions
return "couldn't find that" with zero sources.
