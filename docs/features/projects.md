# Projects, drawings, sets & versions (Phase 1)

Replaces the client's spreadsheet "Drawings Number Book" workflow. Structure
(not data) mirrors the sample workbook: projects contain drawings; drawings
carry DWG #, contract #, date, sheet count; Set # groups drawings; the same
drawing may exist in several versions.

## Pages
- `src/pages/Projects.jsx` — list with drawing/set/file counts + New project
  modal (name, number, description). Project number matters: `pj1206` in a
  filename auto-suggests project #1206.
- `src/pages/ProjectDetail.jsx` — tabs for Drawings (table: DWG#, description,
  contract, date, set, sheets, files) and Sets (create/delete; deleting a set
  keeps its drawings). Add-drawing modal. Delete project keeps drawings/files
  (they become unassigned).
- `src/pages/DrawingDetail.jsx` — metadata edit form; Files panel (sheet
  number badge, detach, link to document viewer); Versions panel (link another
  drawing in the project as a version - both share one version group; unlink
  splits it back out). Versions are distinguished by year/date + version note.

## Assignment flow (smart recognition)
- `src/components/AssignModal.jsx`, opened from the Documents page "Assign"
  action on unassigned files. Calls `GET /files/{id}/suggestions`:
  - drawing suggestions (DWG number parsed from the filename matched against
    the registry) -> "Attach" adds the file to that drawing (sheet number
    parsed from "SHT 23"/"6 of 31" patterns);
  - project suggestions (pj#### number, full/partial name, initials like
    "Project Alpha Gamma" ~ "AG") -> "Add here" creates a drawing under the
    project (DWG # auto-parsed from filename when present);
  - manual fallback: pick any project.
- Documents rows show "DWG <number>" once assigned; the Assign action hides.

## Gotchas
- Suggestion quality depends on what exists: with an empty registry there are
  no drawing matches - create projects (with numbers) first.
- The backend importer `scripts/import_book.py` can seed a real Drawings
  Number Book workbook, but is OPTIONAL tooling and never run automatically
  (per client: the sample workbook is structure reference only, not data).
