import { Loader, Paper, Text } from '@mantine/core'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUploadQueue } from '../context/UploadQueueContext'

// Floating indicator shown on every page (except Upload itself) while drawings
// are still uploading/processing, so the user can leave the Upload page and
// still see that work is ongoing. Click to jump back to the full progress list.
export default function UploadIndicator() {
  const { active, activeCount, done, total } = useUploadQueue()
  const location = useLocation()
  const navigate = useNavigate()

  if (!active || location.pathname === '/upload') return null

  return (
    <Paper
      withBorder
      shadow="md"
      radius="md"
      p="sm"
      onClick={() => navigate('/upload')}
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 300,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 300,
      }}
    >
      <Loader size="sm" color="violet" />
      <div style={{ minWidth: 0 }}>
        <Text size="sm" fw={600}>
          Processing {activeCount} drawing{activeCount > 1 ? 's' : ''}…
        </Text>
        <Text size="xs" c="dimmed">
          {done} of {total} done · click to view
        </Text>
      </div>
    </Paper>
  )
}
