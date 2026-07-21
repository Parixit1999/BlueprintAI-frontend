import { Button } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'

// Full-page fetch failure: a calm, customer-appropriate message with a way
// forward - never an endless spinner or technical jargon.
export default function ErrorState({ message, onRetry }) {
  return (
    <div className="empty-state">
      <p>We couldn’t load this page.</p>
      <p className="page-sub">{message}</p>
      {onRetry && (
        <Button
          mt="md"
          variant="default"
          leftSection={<IconRefresh size={16} />}
          onClick={onRetry}
        >
          Try again
        </Button>
      )}
    </div>
  )
}
