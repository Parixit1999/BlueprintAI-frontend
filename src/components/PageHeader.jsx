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
    <Box ta={align}>
      <Title order={2} fz={24} fw={650} lh={1.25}>
        {title}
      </Title>
      {description && (
        <Text c="dimmed" size="sm" mt={4} maw={640} mx={align === 'center' ? 'auto' : undefined}>
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
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="lg" mb={mb}>
      {heading}
      <Group gap="sm" style={{ flexShrink: 0 }}>
        {refreshButton}
        {actions}
      </Group>
    </Group>
  )
}
