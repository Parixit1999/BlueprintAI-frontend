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
- **Project scope** (Phase 2 integration): a "Search scope" Select in the
  sessions sidebar (All projects / one project). The chosen `project_id` is sent
  with each question and the backend restricts retrieval to files attached to
  that project's drawings. Scoped questions whose answer lives elsewhere return
  "couldn't find" with zero sources.
- **Evidence context**: source rows show the DWG number when the file is
  assigned (falls back to region type); the evidence panel shows a DWG badge,
  filename, and project name.
- **Registry evidence** (Phase 2): answers can be grounded in registry metadata
  cards (projects, drawing metadata, sets, versions) instead of file content.
  Those sources show the entity label + "View record"; the panel renders the
  card text and an "Open <entity> record" button (no DrawingViewer - there is
  no bbox), navigating to the drawing/project page.

Note: retrieval is document-scoped on the backend, so all sources for one answer
come from a single drawing (no cross-document contamination); off-topic questions
return "couldn't find that" with zero sources.
