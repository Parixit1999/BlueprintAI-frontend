# BlueprintAI Frontend

BlueprintAI lets engineers upload engineering drawings (CAD/DXF files or vector PDFs),
automatically extract their content, and ask questions against them in plain language.
Every answer comes with **evidence** — a cropped, highlighted region of the original
drawing — so users can verify the answer against the source instead of trusting it blindly.

This is the React (Vite) web client. It provides three views matching the pipeline:

- **Upload** — drag & drop a DXF / vector PDF and kick off extraction
- **Review** — human-in-the-loop verification: source crop on the left, editable
  extracted fields with confidence badges on the right, one "Confirm & ingest" button
- **Query** — ask a question, get an answer with the highlighted source-crop evidence

## Setup & run

```bash
npm install
npm run dev      # http://localhost:5173
```

The backend API base defaults to `http://localhost:8000`; override with
`VITE_API_BASE` in a `.env` file.

## Stack

- React 19 + Vite
- Talks to the BlueprintAI FastAPI backend
