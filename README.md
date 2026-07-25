# BlueprintAI Frontend

React (Vite + Mantine) client for BlueprintAI — the drawing registry and RAG
application. Pages:

- **Dashboard** — knowledge-base overview with clickable metrics
- **Projects** — the file hub: each project's sets, drawings, and files in one
  explorer (search, status filters, inline rename/move/detach, scoped uploads)
- **Upload** — drag-and-drop any supported format; parallel uploads with live
  progress; automatic project/drawing filing with AUTO badges
- **Documents** — every document with type/status/duplicate filters and bulk ingest
- **Chat** — ChatGPT-style Q&A with streaming answers, region-highlighted evidence,
  citations, sessions, and feedback
- **Login** — all routes require sign-in (see backend README for the seeded account)

## Development

Normally run as part of the full stack — `make up` in the backend repo serves the
built frontend at http://localhost:5175.

For frontend-only iteration with hot reload:

```bash
npm install
npm run dev          # http://localhost:5173, talks to http://localhost:8000/api
```

The API base URL comes from `VITE_API_BASE` (defaults to `http://localhost:8000/api`).

## Production build

```bash
npm run build    # output in dist/, served via S3 + CloudFront
```

The committed `.env.production` sets `VITE_API_BASE=/api` automatically, so a
plain build is production-correct. (Passing the variable explicitly still works
and overrides it.)

Same-origin `/api/*` requests are routed by CloudFront to the backend, so no CORS
configuration is needed in production.
