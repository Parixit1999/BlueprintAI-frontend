import { Center, Stack, Text } from '@mantine/core'

// Centered branded loading state used wherever a page or panel is still
// fetching data: the BlueprintAI mark breathing, with an optional label.
// (Decorative only - prefers-reduced-motion turns the pulse off in CSS.)
export default function Loading({ label, py = 'xl' }) {
  return (
    <Center py={py}>
      <Stack align="center" gap="sm">
        <div className="brand-mark loading-pulse" aria-hidden="true">
          B
        </div>
        {label && (
          <Text size="sm" c="dimmed">
            {label}
          </Text>
        )}
      </Stack>
    </Center>
  )
}
