# Responsive layout — mobile & cross-browser

Branch `feat/responsive-layout`. The app adapts from desktop (fixed dark
sidebar) down to phones (top bar + slide-in drawer nav). No new pages — only
`Sidebar.jsx`, `App.css`, and small page tweaks.

## Breakpoints
- `62em` (~992px): chat evidence panel narrows to 320px.
- `48em` (~768px): the mobile layout kicks in (see below).

## Mobile shell (`src/components/Sidebar.jsx`)
- Desktop `<aside class="sidebar">` is hidden; a `<header class="mobile-topbar">`
  appears with a Mantine `Burger` + brand.
- The nav renders inside a Mantine `Drawer` (`size={260}`, no close button,
  `padding={0}`) reusing the same `.sidebar` styles via `.sidebar.drawer-mode`.
- `Brand`/`Nav`/`Footer` are shared subcomponents so desktop sidebar and drawer
  stay identical; `Nav` takes `onNavigate` so tapping a link closes the drawer.
- `transitionProps={{ duration: 0 }}` on the Drawer: opens instantly. Keep it —
  Mantine's default transition mounts drawer content through
  `requestAnimationFrame`, which throttled/embedded webviews may stall,
  leaving the drawer invisible even though `opened` is true.

## Mobile CSS (`src/App.css`, bottom block)
- `.shell` uses `100dvh` (fallback `100vh`) so iOS browser chrome doesn't clip
  the layout; below 48em it stacks vertically under the topbar.
- Tables: `.table-panel { overflow-x: auto }` with `min-width: 720px` on the
  table — rows scroll horizontally instead of crushing columns.
- Chat: sessions become a horizontal chip row (`.session-list` row + scroll),
  the thread gets `65dvh`, and the evidence panel goes full-width below.
- Viewer panel drops `position: sticky` on mobile.

## Verified (375×812)
Burger → drawer opens → tap nav link navigates and closes drawer; Dashboard
stat tiles stack; Documents table scrolls; Upload dropzone and Chat layouts fit.
Desktop layout unchanged.

## Gotcha
`localhost:4173` (vite preview) is not in the backend CORS allowlist — use the
dev server (5173/5174) for local testing against the API, or add the origin in
`app/main.py` on the backend.
