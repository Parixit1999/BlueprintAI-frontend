# App shell, routing & navigation

Dark left **sidebar** + scrollable content area. `src/App.jsx` defines routes;
`src/components/Sidebar.jsx` is the nav.

- Routes: `/` Dashboard, `/upload` Upload, `/documents` list,
  `/documents/:fileId` detail, `/chat` Chat.
- Sidebar nav items use Tabler icons (`IconLayoutDashboard`, `IconUpload`,
  `IconFileText`, `IconMessageCircle`) and `NavLink` active state.
- Footer shows a single **Admin / Workspace owner** identity — the app is
  single-user for now; the backend already carries `user_id` (defaults to
  `"global"`) so real auth slots in later without schema change.
- `ToastProvider` wraps the app but is now a pass-through; toasts render via
  Mantine notifications (see `ui-system.md`).

Gotcha: SPA routing needs a host-level fallback (serve `index.html` for unknown
paths) when deployed.
