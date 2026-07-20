import {
  Badge,
  Button,
  Center,
  Grid,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import { IconArrowsDiff, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { deleteFile } from '../api'
import { StatusBadge } from './Badges'
import ConfirmDialog from './ConfirmDialog'
import DrawingViewer from './DrawingViewer'
import { useToast } from './Toast'

function DocumentPane({ doc, onDelete }) {
  return (
    <Paper withBorder radius="md" p="md" h="100%">
      <Stack gap="xs">
        <div>
          <Text fw={600} truncate title={doc.filename}>
            {doc.filename}
          </Text>
          <Group gap="xs" mt={4}>
            <StatusBadge status={doc.status} />
            <Badge variant="light" color="gray" size="sm">
              {doc.file_type?.toUpperCase()}
            </Badge>
            <Text size="xs" c="dimmed">
              {doc.created_at ? new Date(doc.created_at).toLocaleString() : ''}
            </Text>
          </Group>
        </div>
        <DrawingViewer fileId={doc.file_id} />
        <Button
          variant="light"
          color="red"
          leftSection={<IconTrash size={16} />}
          onClick={() => onDelete(doc)}
        >
          Delete this copy
        </Button>
      </Stack>
    </Paper>
  )
}

/**
 * Side-by-side comparison of a document and one of its possible duplicates,
 * so the user can see both drawings and decide which copy to delete.
 */
export default function CompareModal({ file, allFiles, onClose, onDeleted }) {
  const matches = file.similar_documents ?? []
  const [matchId, setMatchId] = useState(matches[0]?.file_id ?? null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()

  const match = matches.find((m) => m.file_id === matchId)
  // full metadata for the matched document comes from the already-loaded list
  const matchDoc = allFiles.find((f) => f.file_id === matchId) ?? {
    file_id: matchId,
    filename: match?.filename,
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await deleteFile(pendingDelete.file_id)
      toast.success(`Deleted ${pendingDelete.filename}.`)
      setPendingDelete(null)
      onDeleted()
    } catch (e) {
      toast.error(e.message)
      setDeleting(false)
    }
  }

  return (
    <Modal
      opened
      onClose={onClose}
      size={1100}
      radius="md"
      title={
        <Group gap="xs">
          <IconArrowsDiff size={18} />
          <Text fw={600}>Compare possible duplicates</Text>
        </Group>
      }
    >
      {matches.length > 1 && (
        <Select
          label="Compare with"
          data={matches.map((m) => ({
            value: m.file_id,
            label: `${m.filename} — ${Math.round(m.similarity * 100)}% similar`,
          }))}
          value={matchId}
          onChange={(v) => v && setMatchId(v)}
          mb="md"
          maw={420}
        />
      )}

      <Center mb="sm">
        <Badge size="lg" variant="light" color="orange">
          {match ? `${Math.round(match.similarity * 100)}% similar content` : 'No match'}
        </Badge>
      </Center>

      <Grid gutter="md" align="stretch">
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <DocumentPane doc={file} onDelete={setPendingDelete} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <DocumentPane doc={matchDoc} onDelete={setPendingDelete} />
        </Grid.Col>
      </Grid>

      <Text size="xs" c="dimmed" mt="md" ta="center">
        Review both drawings, then delete the copy you don't need. Deleting removes the document and
        its extracted regions permanently.
      </Text>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete document?"
          message={
            <>
              <strong>{pendingDelete.filename}</strong> and all of its extracted regions will be
              permanently removed. This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </Modal>
  )
}
