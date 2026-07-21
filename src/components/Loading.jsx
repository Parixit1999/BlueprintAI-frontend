import { Center, Loader, Stack, Text } from '@mantine/core'

// Centered spinner used wherever a page or panel is still fetching data.
export default function Loading({ label, py = 'xl', size = 'md' }) {
  return (
    <Center py={py}>
      <Stack align="center" gap="xs">
        <Loader size={size} />
        {label && (
          <Text size="sm" c="dimmed">
            {label}
          </Text>
        )}
      </Stack>
    </Center>
  )
}
