# Documents list

`src/pages/Documents.jsx`. Table of all ingested drawings with filtering,
duplicate flagging, and delete.

- **Filters** (client-side): name search, type, status, and a "Duplicates only"
  toggle, with a live "N of M" count.
- **Duplicate detection** is embedding-based (backend). Each row with
  `is_duplicate` shows a "Possible duplicate" tag and a "N% similar to <file>"
  subline (from `similar_documents[0]`). A top notice banner summarizes and
  offers a quick "Show duplicates" filter.
- **Row actions**: Compare (duplicates only), Review/View (opens detail) and
  Delete (Mantine buttons). Delete opens `ConfirmDialog`; on success the list
  refreshes.
- **Compare** (`src/components/CompareModal.jsx`): side-by-side comparison of a
  duplicate and its match — both drawings rendered live (`DrawingViewer`), with
  status/type/date metadata, a similarity badge, a Select when a document has
  multiple matches, and a "Delete this copy" button under each pane (nested
  confirm). This is how users decide which copy to keep. Match metadata is looked
  up client-side from the already-loaded files list.
- **Upload** button navigates to `/upload` (the dedicated page); inline picker
  was removed.

Gotcha: "chunk" terminology is intentionally hidden from users — this page shows
no chunk count; drawings are described in terms of documents and regions.
Page headers app-wide come from `src/components/PageHeader.jsx` — use it for any
new page so title sizes stay consistent.
