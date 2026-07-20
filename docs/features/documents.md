# Documents list

`src/pages/Documents.jsx`. Table of all ingested drawings with filtering,
duplicate flagging, and delete.

- **Filters** (client-side): name search, type, status, and a "Duplicates only"
  toggle, with a live "N of M" count.
- **Duplicate detection** is embedding-based (backend). Each row with
  `is_duplicate` shows a "Possible duplicate" tag and a "N% similar to <file>"
  subline (from `similar_documents[0]`). A top notice banner summarizes and
  offers a quick "Show duplicates" filter.
- **Row actions**: Review/View (opens detail) and Delete (Mantine buttons).
  Delete opens `ConfirmDialog`; on success the list refreshes.
- **Upload** button navigates to `/upload` (the dedicated page); inline picker
  was removed.

Gotcha: "chunk" terminology is intentionally hidden from users — this page shows
no chunk count; drawings are described in terms of documents and regions.
