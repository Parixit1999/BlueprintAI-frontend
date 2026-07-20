# Dashboard

`src/pages/Dashboard.jsx`. Overview of the knowledge base from `GET /stats`.

- **Stat tiles**: Documents (+ ingested count), Awaiting review (links to
  Documents when > 0), Extracted regions (+ human-corrected count), Questions
  asked (+ chat session count).
- **Breakdown bars**: "Documents by type" (categorical palette) and "Extraction
  confidence" (green/amber/red status colors with labeled counts).

Terminology: labels avoid "chunk" — the vector-DB rows are shown to users as
"extracted regions".
