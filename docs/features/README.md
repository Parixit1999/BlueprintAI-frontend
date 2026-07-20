# BlueprintAI Frontend — Feature Reference

Concise per-feature notes for future contributors and AI assistants. Each file
describes what the feature does, the key files, and any gotchas. Feature names
roughly map to the git branch that introduced them.

| Feature | File | Branch |
|---|---|---|
| App shell, routing, navigation | `app-shell.md` | feat/professional-ui |
| Dashboard (stats + breakdowns) | `dashboard.md` | feat/chat-and-stats, feat/dedup-and-terminology |
| Documents list (filter, delete, duplicates) | `documents.md` | feat/doc-management-ui, feat/dedup-and-terminology |
| Document detail + HITL review | `document-detail.md` | feat/pipeline-ui, feat/evidence-viewer |
| Drawing viewer + evidence highlight | `drawing-viewer.md` | feat/evidence-viewer |
| Chat (sessions, evidence, rename/delete) | `chat.md` | feat/professional-ui, feat/chat-session-actions |
| Upload page (bulk + zip + progress) | `upload.md` | feat/upload-and-ui-polish |
| UI system (Mantine, theme, toasts) | `ui-system.md` | feat/upload-and-ui-polish |

## Stack
- React 19 + Vite, React Router 7.
- **Mantine 8** component library + `@tabler/icons-react` for all interactive UI.
- `src/api.js` is the single fetch client; backend base is `VITE_API_BASE`
  (default `http://localhost:8000`).
- Hand-rolled CSS in `src/App.css` / `src/index.css` handles layout + design
  tokens; Mantine handles components (buttons, inputs, modals, dropzone,
  progress, notifications).
