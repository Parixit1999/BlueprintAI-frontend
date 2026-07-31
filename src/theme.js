import { createTheme } from '@mantine/core'

/**
 * Mantine is bound to the tokens in index.css so components and hand-rolled
 * CSS cannot drift apart. Anything defined here has a `--` twin there.
 */

// Blueprint blue, built around the app accent #2a78d6 (shade 6).
const brand = [
  '#eaf2fc',
  '#dbe9fa',
  '#b3d0f2',
  '#86b4e9',
  '#5b99e0',
  '#3a85da',
  '#2a78d6',
  '#1c5cab',
  '#164a89',
  '#0f3563',
]

// Structural navy used by the sidebar, login sheet and dark chrome.
const navy = [
  '#eef2f6',
  '#dbe3ec',
  '#b6c6d8',
  '#8ea7c2',
  '#6b8dae',
  '#4e759b',
  '#345c82',
  '#234764',
  '#16324e',
  '#10263d',
]

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: 6,
  colors: { brand, navy },

  fontFamily:
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontFamilyMonospace:
    "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",

  fontSizes: {
    xs: '0.75rem',
    sm: '0.8125rem',
    md: '0.875rem',
    lg: '1rem',
    xl: '1.125rem',
  },
  lineHeights: {
    xs: '1.4',
    sm: '1.45',
    md: '1.55',
    lg: '1.55',
    xl: '1.5',
  },
  headings: {
    fontWeight: '650',
    sizes: {
      h1: { fontSize: '1.75rem', lineHeight: '1.22' },
      h2: { fontSize: '1.375rem', lineHeight: '1.25' },
      h3: { fontSize: '1rem', lineHeight: '1.3' },
      h4: { fontSize: '0.875rem', lineHeight: '1.35' },
    },
  },

  radius: { xs: '4px', sm: '6px', md: '10px', lg: '14px', xl: '18px' },
  defaultRadius: 'md',
  cursorType: 'pointer',
  focusRing: 'auto',

  shadows: {
    xs: '0 1px 2px rgba(16, 24, 32, 0.05)',
    sm: '0 1px 2px rgba(16, 24, 32, 0.05), 0 2px 8px rgba(16, 24, 32, 0.05)',
    md: '0 2px 4px rgba(16, 24, 32, 0.05), 0 8px 24px rgba(16, 24, 32, 0.08)',
    lg: '0 12px 40px rgba(16, 24, 32, 0.16)',
    xl: '0 24px 64px rgba(16, 24, 32, 0.2)',
  },

  components: {
    Button: {
      defaultProps: { fw: 550 },
      styles: { root: { letterSpacing: '-0.005em' } },
    },
    Badge: {
      defaultProps: { radius: 'sm' },
      styles: { label: { overflow: 'visible', textOverflow: 'clip' } },
    },
    Paper: { defaultProps: { radius: 'md' } },
    Tooltip: { defaultProps: { withArrow: true, radius: 'sm', fz: 'xs' } },

    /* Overlay components mount their content through rAF-driven transitions,
       which stall in throttled or embedded webviews and leave the overlay
       invisible while `opened` is true. The codebase already pinned this per
       call site; making it the theme default removes the whole bug class.
       Motion lives in CSS on content we own instead. */
    Modal: { defaultProps: { transitionProps: { duration: 0 }, radius: 'lg' } },
    Drawer: { defaultProps: { transitionProps: { duration: 0 } } },
    Menu: { defaultProps: { transitionProps: { duration: 0 }, radius: 'md' } },
    Popover: { defaultProps: { transitionProps: { duration: 0 } } },
    Select: {
      defaultProps: { comboboxProps: { transitionProps: { duration: 0 } } },
    },
  },
})
