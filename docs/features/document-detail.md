# Document detail + HITL review

`src/pages/DocumentDetail.jsx`. Two-column layout: rendered drawing on the left
(`DrawingViewer`), extracted regions on the right.

- **Review mode** (status `extracted`): each region is an editable field with a
  confidence badge; click a region to highlight it on the drawing; Reject/Restore
  per region; "Confirm & ingest" applies corrections + rejections and embeds the
  confirmed regions. Only confirmed/corrected regions enter the vector DB.
- **View mode** (status `ingested`): regions are read-only.
- **Delete** (light-red button) removes the document via `ConfirmDialog`.
- Back button is a Mantine subtle button with `IconArrowLeft` → `/documents`.

Data: `getExtraction(fileId)` returns the provisional regions; `confirmAndIngest`
takes `{corrections: {index: text}, rejected: [index]}`.
