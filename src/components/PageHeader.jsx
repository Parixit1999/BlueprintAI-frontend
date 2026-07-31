import { ActionIcon, Box, Group, Text, Title, Tooltip } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { useState } from 'react'
import { useToast } from './Toast'

/**
 * The one page-header used on every page, so titles and descriptions are
 * identical in size and rhythm across the app.
 *
 * Pass `onRefresh` (sync or async) to get a standard refresh button that
 * spins while the reload is in flight.
 */
export default function PageHeader({
  title,
  description,
  actions,
  onRefresh,
  align = 'left',
  mb = 'lg',
}) {
  const [refreshing, setRefreshing] = useState(false)
  const toast = useToast()

  // Must match the `refresh-rotate` animation duration in App.css.
  const SPIN_MS = 600

  async function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    const started = Date.now()
    try {
      await onRefresh()
      toast.success(`${title} refreshed.`)
    } finally {
      // Local reloads settle in milliseconds - too fast to see. Keep spinning
      // until the CURRENT rotation cycle completes (at least one full turn),
      // so the feedback is visible and the icon never snaps mid-rotation.
      const elapsed = Date.now() - started
      const remaining = SPIN_MS - (elapsed % SPIN_MS)
      setTimeout(() => setRefreshing(false), remaining)
    }
  }

  const heading = (
    <Box ta={align} style={{ minWidth: 0 }}>
      <Title
        order={2}
        fz="var(--fs-display)"
        fw={650}
        lh="var(--lh-tight)"
        style={{ letterSpacing: '-0.022em', overflowWrap: 'anywhere' }}
      >
        {title}
      </Title>
      {description && (
        <Text
          c="dimmed"
          size="sm"
          mt={6}
          maw={640}
          lh={1.5}
          mx={align === 'center' ? 'auto' : undefined}
        >
          {description}
        </Text>
      )}
    </Box>
  )

  const refreshButton = onRefresh && (
    <Tooltip label="Refresh" withArrow>
      {/* No `loading` prop: swapping the icon for a spinner made the button
          visually "bounce" on every click. Rotate the icon in place instead. */}
      <ActionIcon
        variant="default"
        size="lg"
        radius="md"
        aria-label="Refresh"
        onClick={handleRefresh}
      >
        <IconRefresh size={18} className={refreshing ? 'refresh-spinning' : undefined} />
      </ActionIcon>
    </Tooltip>
  )

  if (!actions && !onRefresh) {
    return <Box mb={mb}>{heading}</Box>
  }
  return (
    // wrap (not nowrap): a long title plus four actions must reflow onto a
    // second line rather than push the buttons off the edge of the page
    <Group justify="space-between" align="flex-start" wrap="wrap" gap="md" mb={mb}>
      {heading}
      {/* No flex-shrink pin here: it held the action row at its natural width
          so it could never wrap, and on a phone the last button was cut off
          the side of the screen. Letting it shrink lets the buttons reflow. */}
      <Group gap="xs" justify="flex-end" wrap="wrap">
        {refreshButton}
        {actions}
      </Group>
    </Group>
  )
}
