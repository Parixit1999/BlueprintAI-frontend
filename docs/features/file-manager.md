# File gallery & file management

`src/pages/Files.jsx` (route `/files`, "Files" in the sidebar). A standard
file-manager experience over all uploaded documents.

## Capabilities
- **Folders & subfolders**: create anywhere (New folder creates inside the
  current location), unlimited nesting; breadcrumbs navigate back up.
- **Upload here**: forwards to `/upload?folder=<id>`; the upload queue passes
  `folder_id` so files land in that folder (ZIP expansion included).
- **Rename** files and folders (modal).
- **Move** files and folders (Select of destinations; a folder cannot move
  into itself or its own subtree - blocked in UI and enforced server-side
  with a 422).
- **Delete** folders recursively (confirm dialog warns; subtree files are
  deleted properly - storage objects and chunks included). File delete lives
  on the Documents page/detail as before.
- Files show their drawing assignment (DWG badge -> drawing record), type,
  status, and failed-extraction errors inline.

## Integration
Folder location is purely organizational: extraction, project/drawing/set
assignment, and RAG behavior are unchanged wherever a file lives (verified:
a file inside a subfolder answers chat questions with citations). Organize
by project, set, version, or anything else.

## Gotchas
- Modals/menus here use `transitionProps={{ duration: 0 }}` - Mantine mounts
  overlay content via rAF-driven transitions, which stall in throttled or
  embedded webviews (same issue as the mobile drawer).
- Mantine Menu opens on pointer events; synthetic `.click()` alone does not
  open it (relevant for tests).
