# Upload page — bulk + zip + progress

`src/pages/Upload.jsx`. Dedicated page for adding drawings, with drag-and-drop,
multi-file, ZIP archives, and a live progress queue.

## How it works
- **Layout**: standard left-aligned `PageHeader` on top (consistent with other
  pages), then a large near-square dropzone (`mih={340}`, `maw=560`) centered in
  the content area.
- **Dropzone**: Mantine `@mantine/dropzone`, multiple files. Deliberately has
  **no `accept` filter** — DXF has no reliable MIME type (browsers report an
  empty string), and mixing bare MIME types with extensions makes the native
  macOS file dialog grey out every file. Instead the native picker allows any
  file and we validate the extension against `SUPPORTED` in `handleDrop`:
  unsupported files are marked "Unsupported" and never uploaded; supported ones
  are queued, and the backend still rejects bad content with a clear error.
- **ZIP expansion is client-side** via `jszip`: a dropped `.zip` is read in the
  browser, each supported entry is extracted to a Blob and queued; unsupported
  entries (and `__MACOSX`/dotfiles) are marked "Unsupported" and skipped. No
  backend zip endpoint — each extracted file is uploaded through the normal
  `POST /files/upload`.
- **Queue**: items carry `{id, name, file, status, error?, fileId?, regions?}`.
  Statuses: queued → uploading → done | error | skipped.
- **Processing is sequential** (`runningRef` guard) so the local Ollama vision
  model isn't hit by many images at once.
- **Progress UI**: overall `Progress` bar + "N of M done · K failed", per-file
  rows with a status `ThemeIcon`, `Badge`, and the backend's error message on
  failure; done rows link to `/documents/:fileId` (Review).

## API
- `uploadFile(file, filename)` in `api.js` — the optional `filename` is required
  when uploading a Blob extracted from a zip (FormData needs the name so the
  backend infers the extension). Real `File`s carry their own name.

## Gotchas
- Large zips are held in browser memory (fine for MVP; server-side unzip would
  be the scale path).
- Zip entry names may include folders — we upload by `basename`.
- Verified: JSZip expands a bundle, skips `notes.txt`, uploads DXF (8 regions)
  and PDF (5 regions) to the real backend.
