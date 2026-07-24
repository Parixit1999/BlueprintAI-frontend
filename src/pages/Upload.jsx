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
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { assignFile, unassignFile } from '../api'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'
import {
  STATUS,
  ext,
  processingHint,
  useUploadQueue,
} from '../context/UploadQueueContext'

export default function Upload() {
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const uploadFolderId = searchParams.get('folder')
  const scopeDrawingId = searchParams.get('drawing')
  const scopeDrawingName = searchParams.get('drawingName')
  const scopeProjectId = searchParams.get('project')
  const scopeProjectName = searchParams.get('projectName')
  // per-item overrides after the user acts on a suggestion / undo
  const [resolved, setResolved] = useState({}) // itemId -> {kind: 'undone'|'assigned', label?}
  const [actingOn, setActingOn] = useState(null)

  async function undoAutoAssign(item) {
    setActingOn(item.id)
    try {
      await unassignFile(item.fileId)
      setResolved((prev) => ({ ...prev, [item.id]: { kind: 'undone' } }))
      toast.success('Assignment undone.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setActingOn(null)
    }
  }

  async function acceptSuggestion(item) {
    setActingOn(item.id)
    try {
      if (item.topDrawing) {
        await assignFile(item.fileId, { drawing_id: item.topDrawing.drawing_id })
        setResolved((prev) => ({ ...prev, [item.id]: { kind: 'assigned', label: item.topDrawing.dwg_number } }))
        toast.success(`Attached to drawing ${item.topDrawing.dwg_number}.`)
      } else if (item.topProject) {
        await assignFile(item.fileId, { new_drawing: { project_id: item.topProject.project_id } })
        setResolved((prev) => ({ ...prev, [item.id]: { kind: 'assigned', label: item.topProject.name } }))
        toast.success(`Added to ${item.topProject.name} as a new drawing.`)
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setActingOn(null)
    }
  }
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

  const handleDrop = (files) =>
    enqueue(files, uploadFolderId, {
      drawingId: scopeDrawingId,
      drawingName: scopeDrawingName,
      projectId: scopeProjectId,
      projectName: scopeProjectName,
    })

  return (
    <Box>
      <PageHeader
        title="Upload drawings"
        description={
          scopeDrawingId
            ? `Files uploaded here attach directly to drawing ${scopeDrawingName ?? 'you came from'} — no assignment step needed.`
            : scopeProjectId
            ? `Files uploaded here are filed into project ${scopeProjectName ?? 'you came from'} as new drawings.`
            : uploadFolderId
              ? 'Files uploaded here land in the selected folder in Files.'
              : 'Add CAD (.dxf, .dwg), Revit models (.rvt), PDFs (vector or scanned), or drawing images (PNG, JPG, TIFF, HEIC...). Drop many files at once, or a .zip archive for bulk import.'
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
              DXF, DWG, RVT, PDF, PNG, JPG, TIFF, HEIC — or a ZIP of drawings. Multiple files supported.
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
                      {item.status === 'done' && (() => {
                        const state = resolved[item.id]
                        if (state?.kind === 'undone') {
                          return (
                            <Text size="xs" c="dimmed" mt={4}>
                              Unassigned — use Assign on the Documents page.
                            </Text>
                          )
                        }
                        if (state?.kind === 'assigned') {
                          return (
                            <Badge variant="light" color="teal" size="sm" mt={4}>
                              Assigned to {state.label}
                            </Badge>
                          )
                        }
                        if (item.autoAssignment) {
                          return (
                            <Group gap="xs" mt={4}>
                              <Badge
                                variant="light"
                                color={item.autoAssignment.kind === 'new_version' ? 'yellow' : 'teal'}
                                size="sm"
                              >
                                {item.autoAssignment.kind === 'new_version'
                                  ? `New version of ${item.autoAssignment.dwg_number} (${item.autoAssignment.of_year} → ${item.autoAssignment.new_year})`
                                  : item.autoAssignment.project_name
                                    ? `Filed into ${item.autoAssignment.project_name}`
                                    : `Auto-assigned to ${item.autoAssignment.dwg_number}`}
                              </Badge>
                              <Button
                                variant="subtle"
                                color="gray"
                                size="compact-xs"
                                loading={actingOn === item.id}
                                onClick={() => undoAutoAssign(item)}
                              >
                                Undo
                              </Button>
                            </Group>
                          )
                        }
                        const top = item.topDrawing ?? item.topProject
                        if (top) {
                          const label = item.topDrawing
                            ? `drawing ${item.topDrawing.dwg_number}`
                            : `project ${item.topProject.name}`
                          return (
                            <Group gap="xs" mt={4} wrap="nowrap">
                              <Text size="xs" c="dimmed" truncate>
                                Looks like {label} ({Math.round(top.score * 100)}%)
                              </Text>
                              <Button
                                variant="light"
                                size="compact-xs"
                                loading={actingOn === item.id}
                                onClick={() => acceptSuggestion(item)}
                              >
                                Assign
                              </Button>
                            </Group>
                          )
                        }
                        return null
                      })()}
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
