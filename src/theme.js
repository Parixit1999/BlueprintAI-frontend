import { createTheme } from '@mantine/core'

// Brand blue ramp (10 steps) built around the existing accent #2a78d6, so
// Mantine components match the app's established palette.
const blue = [
  '#eaf2fc',
  '#cde2fb',
  '#9ec5f4',
  '#6da7ec',
  '#4a90e4',
  '#3382df',
  '#2a78d6',
  '#1c5cab',
  '#164d90',
  '#0d366b',
]

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: 6,
  colors: { brand: blue },
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
    Button: { defaultProps: { fw: 550 } },
  },
})
