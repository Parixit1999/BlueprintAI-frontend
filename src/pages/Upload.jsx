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
import JSZip from 'jszip'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadFile } from '../api'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'

const SUPPORTED = ['dxf', 'pdf', 'png', 'jpg', 'jpeg']

let uid = 0
const ext = (name) => name.split('.').pop().toLowerCase()
const basename = (path) => path.split('/').pop()

const STATUS = {
  queued: { label: 'Queued', color: 'gray' },
  uploading: { label: 'Processing', color: 'blue' },
  done: { label: 'Done', color: 'teal' },
  error: { label: 'Failed', color: 'red' },
  skipped: { label: 'Unsupported', color: 'gray' },
}

export default function Upload() {
  const [items, setItems] = useState([])
  const [expanding, setExpanding] = useState(false)
  const runningRef = useRef(false)
  const toast = useToast()
  const navigate = useNavigate()

  const total = items.length
  const done = items.filter((i) => i.status === 'done').length
  const failed = items.filter((i) => i.status === 'error').length
  const active = items.some((i) => i.status === 'uploading' || i.status === 'queued')

  function patch(id, changes) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)))
  }

  async function processQueue() {
    if (runningRef.current) return
    runningRef.current = true
    // sequential: the local vision model can't handle many images at once
    while (true) {
      const next = await new Promise((resolve) =>
        setItems((prev) => {
          resolve(prev.find((i) => i.status === 'queued') ?? null)
          return prev
        }),
      )
      if (!next) break
      patch(next.id, { status: 'uploading' })
      try {
        const res = await uploadFile(next.file, next.name)
        patch(next.id, { status: 'done', fileId: res.file_id, regions: res.chunks.length })
      } catch (e) {
        patch(next.id, { status: 'error', error: e.message })
      }
    }
    runningRef.current = false
  }

  async function handleDrop(files) {
    setExpanding(true)
    const additions = []
    for (const file of files) {
      if (ext(file.name) === 'zip') {
        try {
          const zip = await JSZip.loadAsync(file)
          const entries = Object.values(zip.files).filter((e) => !e.dir)
          for (const entry of entries) {
            const name = basename(entry.name)
            if (name.startsWith('.') || name.startsWith('__MACOSX')) continue
            const supported = SUPPORTED.includes(ext(name))
            const blob = supported ? await entry.async('blob') : null
            additions.push({
              id: ++uid,
              name,
              file: blob,
              source: file.name,
              status: supported ? 'queued' : 'skipped',
            })
          }
        } catch {
          toast.error(`Could not read ${file.name} as a zip archive.`)
        }
      } else {
        const supported = SUPPORTED.includes(ext(file.name))
        additions.push({
          id: ++uid,
          name: file.name,
          file,
          status: supported ? 'queued' : 'skipped',
        })
      }
    }
    setExpanding(false)
    if (additions.length === 0) return
    setItems((prev) => [...prev, ...additions])
    // let state flush, then start the worker
    setTimeout(processQueue, 0)
  }

  function clearFinished() {
    setItems((prev) => prev.filter((i) => i.status === 'uploading' || i.status === 'queued'))
  }

  return (
    <Box>
      <PageHeader
        title="Upload drawings"
        description="Add CAD (.dxf), vector PDFs, or drawing images. Drop many files at once, or a .zip archive of drawings for bulk import."
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
                  wrap="nowrap"
                  px="sm"
                  py={8}
                  style={{ border: '1px solid var(--mantine-color-gray-2)', borderRadius: 8 }}
                >
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    <ThemeIcon variant="light" color={s.color} size="md" radius="md">
                      {item.status === 'done' ? (
                        <IconCheck size={16} />
                      ) : item.status === 'error' ? (
                        <IconExclamationCircle size={16} />
                      ) : item.status === 'uploading' ? (
                        <Loader size={14} color={s.color} />
                      ) : item.source ? (
                        <IconFileZip size={16} />
                      ) : (
                        <IconFile size={16} />
                      )}
                    </ThemeIcon>
                    <div style={{ minWidth: 0 }}>
                      <Text size="sm" fw={500} truncate>
                        {item.name}
                      </Text>
                      <Text size="xs" c="dimmed" truncate>
                        {item.status === 'error'
                          ? item.error
                          : item.status === 'done'
                            ? `${item.regions} regions extracted`
                            : item.source
                              ? `from ${item.source}`
                              : ext(item.name).toUpperCase()}
                      </Text>
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
                        onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
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
