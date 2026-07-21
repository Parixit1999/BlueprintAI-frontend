import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  Progress,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import {
  IconCheck,
  IconCloudUpload,
  IconExclamationCircle,
  IconFile,
  IconFileZip,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import {
  STATUS,
  ext,
  processingHint,
  useUploadQueue,
} from '../context/UploadQueueContext'

export default function Upload() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const uploadFolderId = searchParams.get('folder')
  const {
    items,
    expanding,
    enqueue,
    clearFinished,
    removeItem,
    total,
    done,
    failed,
    active,
  } = useUploadQueue()

  const handleDrop = (files) => enqueue(files, uploadFolderId)

  return (
    <Box>
      <PageHeader
        title="Upload drawings"
        description={
          uploadFolderId
            ? 'Files uploaded here land in the selected folder in Files.'
            : 'Add CAD (.dxf), PDFs (vector or scanned), or drawing images. Drop many files at once, or a .zip archive of drawings for bulk import.'
        }
      />

      <Dropzone
        onDrop={handleDrop}
        loading={expanding}
        multiple
        radius="lg"
        p="xl"
        maw={560}
        mx="auto"
      >{/* No `accept` filter: DXF has no reliable MIME type, and mixing bare
          MIME types with extensions makes the native file dialog grey out every
          file. We validate the extension in handleDrop and the backend rejects
          anything unsupported with a clear error. */}
        <Stack justify="center" align="center" gap="md" mih={340} style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <ThemeIcon size={72} radius="lg" variant="light" color="brand">
              <IconUpload size={40} />
            </ThemeIcon>
          </Dropzone.Accept>
          <Dropzone.Reject>
            <ThemeIcon size={72} radius="lg" variant="light" color="red">
              <IconX size={40} />
            </ThemeIcon>
          </Dropzone.Reject>
          <Dropzone.Idle>
            <ThemeIcon size={72} radius="lg" variant="light" color="brand">
              <IconCloudUpload size={40} />
            </ThemeIcon>
          </Dropzone.Idle>
          <Box ta="center">
            <Text size="lg" fw={600}>
              Drag drawings here or click to browse
            </Text>
            <Text size="sm" c="dimmed" mt={4}>
              DXF, PDF, PNG, JPG — or a ZIP of drawings. Multiple files supported.
            </Text>
          </Box>
        </Stack>
      </Dropzone>

      {total > 0 && (
        <Paper withBorder radius="md" mt="lg" p="md" maw={560} mx="auto">
          <Group justify="space-between" mb="sm">
            <Group gap="xs">
              <Text fw={600}>Import progress</Text>
              {active && <Loader size="xs" />}
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                {done} of {total} done{failed > 0 ? ` · ${failed} failed` : ''}
              </Text>
              {!active && (
                <Button size="xs" variant="default" onClick={clearFinished}>
                  Clear
                </Button>
              )}
            </Group>
          </Group>

          <Progress
            value={total ? (done / total) * 100 : 0}
            color={failed > 0 ? 'orange' : 'brand'}
            radius="xl"
            mb="md"
          />

          <Stack gap={6}>
            {items.map((item) => {
              const s = STATUS[item.status]
              return (
                <Group
                  key={item.id}
                  justify="space-between"
                  align="flex-start"
                  wrap="nowrap"
                  px="sm"
                  py={8}
                  style={{ border: '1px solid var(--mantine-color-gray-2)', borderRadius: 8 }}
                >
                  <Group gap="sm" wrap="nowrap" align="flex-start" style={{ minWidth: 0, flex: 1 }}>
                    <ThemeIcon variant="light" color={s.color} size="md" radius="md">
                      {item.status === 'done' ? (
                        <IconCheck size={16} />
                      ) : item.status === 'error' ? (
                        <IconExclamationCircle size={16} />
                      ) : item.status === 'uploading' || item.status === 'processing' ? (
                        <Loader size={14} color={s.color} />
                      ) : item.source ? (
                        <IconFileZip size={16} />
                      ) : (
                        <IconFile size={16} />
                      )}
                    </ThemeIcon>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Text size="sm" fw={500} truncate>
                        {item.name}
                      </Text>
                      {item.status === 'error' ? (
                        <Text size="xs" c="red.7" style={{ lineHeight: 1.4 }}>
                          {item.error}
                        </Text>
                      ) : item.status === 'uploading' ? (
                        <>
                          <Text size="xs" c="dimmed">
                            Uploading… {item.percent ?? 0}%
                          </Text>
                          <Progress value={item.percent ?? 0} color="blue" size="xs" radius="xl" mt={4} />
                        </>
                      ) : item.status === 'processing' ? (
                        <>
                          <Text size="xs" c="dimmed" style={{ lineHeight: 1.4 }}>
                            {processingHint(item.name)}
                          </Text>
                          <Progress value={100} color="violet" size="xs" radius="xl" mt={4} animated />
                        </>
                      ) : (
                        <Text size="xs" c="dimmed" truncate>
                          {item.status === 'done'
                            ? `${item.regions} regions extracted`
                            : item.source
                              ? `from ${item.source}`
                              : ext(item.name).toUpperCase()}
                        </Text>
                      )}
                    </div>
                  </Group>
                  <Group gap="xs" wrap="nowrap">
                    <Badge variant="light" color={s.color} size="sm">
                      {s.label}
                    </Badge>
                    {item.status === 'done' && (
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        onClick={() => navigate(`/documents/${item.fileId}`)}
                      >
                        Review
                      </Button>
                    )}
                    {(item.status === 'error' || item.status === 'skipped') && (
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        aria-label="Remove"
                        onClick={() => removeItem(item.id)}
                      >
                        <IconTrash size={15} />
                      </ActionIcon>
                    )}
                  </Group>
                </Group>
              )
            })}
          </Stack>

          {!active && done > 0 && (
            <Group justify="flex-end" mt="md">
              <Button onClick={() => navigate('/documents')}>Go to Documents</Button>
            </Group>
          )}
        </Paper>
      )}
    </Box>
  )
}
