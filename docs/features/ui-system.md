# UI system — Mantine, theme, toasts

The app uses **Mantine 8** for components and **Tabler icons** for iconography.
Layout and design tokens remain in `src/index.css` / `src/App.css`.

## Setup
- `src/main.jsx` wraps the app in `MantineProvider theme={theme}` and renders
  `<Notifications position="top-right" />`. Mantine core/dropzone/notifications
  CSS is imported there.
- `postcss.config.js` uses `postcss-preset-mantine` + `postcss-simple-vars`
  (required by Mantine).
- `src/theme.js` defines a `brand` blue ramp built around the app accent
  `#2a78d6`, `primaryColor: 'brand'`, `defaultRadius: 'md'`.

## Toasts
- `src/components/Toast.jsx` keeps the app's `useToast()` API (`success/error/
  info`) but renders **Mantine notifications** underneath (teal/red/blue with
  Tabler icons). `ToastProvider` is a no-op pass-through kept for compatibility,
  so no call sites changed.

## Modals
- `src/components/ConfirmDialog.jsx` is a Mantine `Modal` + `Button`s used for
  all destructive confirms (delete document, delete chat).

## Conventions
- Buttons: Mantine `Button` (`variant` filled/light/subtle/default; `color`
  brand/red/gray/orange; `size` compact-* for inline actions). Icon-only actions
  use `ActionIcon`. Prefer these over hand-rolled `<button className>`.
- Bundle note: Mantine adds weight (~500KB). Code-splitting is a later
  optimization if needed.
