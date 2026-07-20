import { Box, Group, Text, Title } from '@mantine/core'

/**
 * The one page-header used on every page, so titles and descriptions are
 * identical in size and rhythm across the app.
 */
export default function PageHeader({ title, description, actions, align = 'left', mb = 'lg' }) {
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

  if (!actions) {
    return <Box mb={mb}>{heading}</Box>
  }
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="lg" mb={mb}>
      {heading}
      <Group gap="sm" style={{ flexShrink: 0 }}>
        {actions}
      </Group>
    </Group>
  )
}
