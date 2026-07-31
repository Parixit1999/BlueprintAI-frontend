# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev      # Vite dev server on :5173, talks to http://localhost:8000/api
npm run build    # dist/ — .env.production sets VITE_API_BASE=/api automatically
npm run lint     # oxlint (react + oxc plugins; rules-of-hooks is an error)
npm run preview  # :4173 — NOT in the backend CORS allowlist, so API calls fail here
```

There is no test suite and no test runner. Verification is manual against a running backend
(`make up` in the sibling `BlueprintAI-backend` repo serves the built frontend at :5175).

## Architecture

React 19 + Vite SPA, plain JS (`.jsx`, no TypeScript), React Router 7. It is the client for the
BlueprintAI drawing registry + RAG backend; there is no local state persistence beyond the auth
token — every screen is a view onto backend state.

**`src/api.js` is the only place that talks to the network.** One `request()` helper wraps
`fetch`, injects the bearer token, and converts every failure into a *customer-facing* `Error`
message (backend `detail` wins; then a per-status fallback; then a generic string). Pages call
the exported functions and surface `e.message` directly via toast — never add raw status codes or
server jargon to user-visible strings. Two deliberate exceptions to the `fetch` pattern:
- `uploadFile()` uses `XMLHttpRequest` for real byte progress and abort support.
- `streamChatMessage()` hand-parses an SSE stream over `fetch` (POST bodies rule out `EventSource`),
  dispatching `meta` / `token` / `done` / `error` frames to handler callbacks.

**Auth is a gate, not a route.** `AuthContext` renders the login screen instead of its children
when there's no valid session. Any 401 anywhere calls `handleUnauthorized()` in `api.js`, which
clears the `bp_token` localStorage key and dispatches a `bp:unauthorized` window event that
`AuthProvider` listens for. Adding a "protected route" wrapper is unnecessary — everything below
`<AuthProvider>` in `App.jsx` is already protected.

**The upload queue lives above the router** (`UploadQueueProvider` in `App.jsx`) so uploads keep
running across navigation; `src/pages/Upload.jsx` is only a view onto `useUploadQueue()`, and
`UploadIndicator.jsx` surfaces active uploads on every other page. The queue is an adaptive
parallel worker pool (starts at 3, ramps to 8, halves on throttling errors). Upload returns fast
and the client **polls** `getExtraction(fileId)` every 4s until the server finishes — no HTTP
request ever blocks on the AI, so long vision extractions can't be faked into failure by proxy
timeouts. ZIP expansion is client-side via `jszip`; there is no backend zip endpoint.

**Domain model** (mirrors the backend): projects contain drawings; drawings carry DWG #, contract #,
date, sheet count; sets group drawings; a drawing can have linked versions. Uploaded *files* are
assigned to drawings, either automatically (DWG/project number parsed from the filename, via
`GET /files/{id}/suggestions`) or manually through `AssignModal.jsx`. `ProjectDetail.jsx` is the
file hub — projects **are** the file system.

**Filter/sort/page state belongs in the URL**, not `useState` — `Documents.jsx` reads everything
from `useSearchParams` (`?q=&type=&status=&sort=&dir=&page=`) so filters survive navigation and
refresh and can be deep-linked (the Dashboard links to `/documents?status=extracted`). Defaults are
deleted from the query string and updates use `{ replace: true }`. Documents paging/sorting is
server-side (`listFilesPaged`); Projects paging is client-side.

## Conventions

- **Mantine 8 for components, hand-rolled CSS for layout.** `src/App.css` (~2000 lines, sectioned
  by `/* ---------- Name ---------- */` comments) and `src/index.css` (design tokens: `--ink`,
  `--accent`, `--hairline`, …) own the shell, tables, chat, and viewer. Mantine owns buttons,
  inputs, modals, dropzone, progress, notifications. Use Mantine `Button`/`ActionIcon` rather than
  `<button className>` for new interactive UI.
- `src/theme.js` defines the `brand` blue ramp around the accent `#2a78d6`. Icons are
  `@tabler/icons-react`.
- Every page starts with `<PageHeader title description actions onRefresh>` so titles stay
  consistent. Toasts go through `useToast()` (`src/components/Toast.jsx`), a thin adapter over
  Mantine notifications — `ToastProvider` is a no-op pass-through kept for compatibility.
- Destructive actions use `ConfirmDialog.jsx`. Note there are **two** modal components:
  Mantine's `Modal` (used in most pages) and the hand-rolled `src/components/Modal.jsx`.
- **Always pass `transitionProps={{ duration: 0 }}`** to Mantine `Modal`, `Drawer`, and `Menu`.
  Mantine's default transition mounts overlay content through `requestAnimationFrame`, which stalls
  in throttled/embedded webviews and leaves the overlay invisible while `opened` is true.
- **User-facing terminology**: "documents" and "extracted regions" — never "chunks", "sources", or
  "vectors". This is enforced in copy across Dashboard, Documents, and the chat prompt.
- `DrawingViewer.jsx` maps a model-space bbox onto the rendered PNG. Drawings are y-up, images are
  y-down, so **Y is flipped**: `top = (ymax - y2) / (ymax - ymin)`.

## Environment & deployment

`VITE_API_BASE` is baked in at build time (default `http://localhost:8000/api`). `.env.production`
is committed and sets it to `/api` — same-origin through CloudFront, so production needs no CORS
config. `.env.local` overrides for dev. The `Dockerfile` builds a static bundle served by nginx
with an SPA fallback; any host must serve `index.html` for unknown paths.

## Stale code to be aware of

`src/pages/Files.jsx` (581 lines) and `docs/features/file-manager.md` describe the retired `/files`
route and the folder tree. `App.jsx` now redirects `/files` → `/projects` and nothing imports
`Files.jsx`. The folder API functions in `api.js` (`browseFolder`, `createFolder`, `moveFolder`, …)
are likewise unused by live pages. Don't extend these; projects replaced folders.

`docs/features/*.md` is otherwise the best per-feature reference (each file maps to the branch that
introduced it — see `docs/features/README.md`), but check it against the code before trusting it.
