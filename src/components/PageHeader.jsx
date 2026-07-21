import { ActionIcon, Box, Group, Text, Title, Tooltip } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { useState } from 'react'

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

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      // brief minimum spin so an instant reload still gives visible feedback
      setTimeout(() => setRefreshing(false), 350)
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
      <ActionIcon
        variant="default"
        size="lg"
        radius="md"
        aria-label="Refresh"
        onClick={handleRefresh}
        loading={refreshing}
      >
        <IconRefresh size={18} />
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
