import { Button, Group, Modal, Text } from '@mantine/core'

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal opened onClose={busy ? () => {} : onCancel} title={title} centered radius="md">
      <Text c="dimmed" size="sm" mb="lg">
        {message}
      </Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button color={danger ? 'red' : 'brand'} onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  )
}
