import {
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconArrowLeft, IconLink, IconTrash, IconUnlink } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  deleteDrawing,
  getDrawing,
  getProject,
  linkVersions,
  unassignFile,
  unlinkVersion,
  updateDrawing,
} from '../api'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorState from '../components/ErrorState'
import Loading from '../components/Loading'
import PageHeader from '../components/PageHeader'
import { StatusBadge } from '../components/Badges'
import { useToast } from '../components/Toast'

export default function DrawingDetail() {
  const { drawingId } = useParams()
  const [drawing, setDrawing] = useState(null)
  const [form, setForm] = useState(null)
  const [projectSets, setProjectSets] = useState([])
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [linkModal, linkModalCtl] = useDisclosure(false)
  const [linkCandidates, setLinkCandidates] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [linkTarget, setLinkTarget] = useState(null)
  const toast = useToast()
  const navigate = useNavigate()

  function refresh() {
    return getDrawing(drawingId)
      .then((d) => {
        setDrawing(d)
        setForm({
          dwg_number: d.dwg_number ?? '',
          description: d.description ?? '',
          contract_number: d.contract_number ?? '',
          drawing_date: d.drawing_date ?? '',
          version_note: d.version_note ?? '',
          set_id: d.set_id ?? null,
        })
        // sets live under the drawing's project - needed for the Set selector
        if (d.project_id) {
          getProject(d.project_id)
            .then((p) => setProjectSets(p.sets ?? []))
            .catch(() => setProjectSets([]))
        } else {
          setProjectSets([])
        }
        setLoadError(null)
      })
      .catch((e) => (drawing ? toast.error(e.message) : setLoadError(e.message)))
  }

  useEffect(() => {
    refresh()
  }, [drawingId])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateDrawing(drawingId, {
        dwg_number: form.dwg_number.trim() || null,
        description: form.description.trim() || null,
        contract_number: form.contract_number.trim() || null,
        drawing_date: form.drawing_date.trim() || null,
        version_note: form.version_note.trim() || null,
        set_id: form.set_id || null,
      })
      toast.success('Drawing updated.')
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function openLinkModal() {
    // candidates: other drawings in the same project (excluding already-linked)
    if (!drawing.project_id) {
      toast.error('Assign this drawing to a project first to link versions.')
      return
    }
    try {
      const project = await getProject(drawing.project_id)
      const linkedIds = new Set([drawingId, ...drawing.other_versions.map((v) => v.drawing_id)])
      setLinkCandidates(
        project.drawings
          .filter((d) => !linkedIds.has(d.drawing_id))
          .map((d) => {
            // versions are told apart by date, so show it when present; only
            // append the separator when there is actually something to show
            const detail = d.drawing_date || d.description || ''
            const base = d.dwg_number ?? 'no DWG #'
            return {
              value: d.drawing_id,
              label: (detail ? `${base} — ${detail}` : base).slice(0, 80),
            }
          }),
      )
      setLinkTarget(null)
      linkModalCtl.open()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleLink() {
    if (!linkTarget) return
    try {
      await linkVersions(drawingId, linkTarget)
      toast.success('Linked as versions of the same drawing.')
      linkModalCtl.close()
      refresh()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleUnlink() {
    try {
      await unlinkVersion(drawingId)
      toast.success('This drawing is now its own version group.')
      refresh()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleDetachFile(fileId) {
    try {
      await unassignFile(fileId)
      toast.success('File detached from this drawing.')
      refresh()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await deleteDrawing(drawingId)
      toast.success('Drawing deleted. Its files were kept.')
      navigate(drawing.project_id ? `/projects/${drawing.project_id}` : '/projects')
    } catch (err) {
      toast.error(err.message)
      setDeleting(false)
    }
  }

  if (drawing === null && loadError) return <ErrorState message={loadError} onRetry={refresh} />
  if (drawing === null || form === null) return <Loading label="Loading drawing…" />

  return (
    <div>
      <Button
        variant="subtle"
        color="gray"
        size="compact-sm"
        leftSection={<IconArrowLeft size={16} />}
        onClick={() =>
          window.history.state?.idx > 0
            ? navigate(-1)
            : navigate(drawing.project_id ? `/projects/${drawing.project_id}` : '/projects')
        }
        mb="xs"
      >
        {drawing.project_name ?? 'Projects'}
      </Button>
      <PageHeader
        onRefresh={refresh}
        title={drawing.dwg_number ?? 'Drawing'}
        description={drawing.description ?? undefined}
        actions={
          <Button variant="light" color="red" onClick={() => setPendingDelete(true)}>
            Delete drawing
          </Button>
        }
      />

      <Group align="flex-start" gap="lg" wrap="wrap">
        <Paper withBorder radius="md" p="md" style={{ flex: '1 1 340px', maxWidth: 480 }}>
          <Text fw={600} mb="sm">
            Metadata
          </Text>
          <form onSubmit={handleSave}>
            <Stack gap="sm">
              <TextInput
                label="DWG #"
                value={form.dwg_number}
                onChange={(e) => setForm({ ...form, dwg_number: e.currentTarget.value })}
              />
              <Textarea
                label="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
                minRows={2}
                autosize
              />
              <Group grow>
                <TextInput
                  label="Contract #"
                  value={form.contract_number}
                  onChange={(e) => setForm({ ...form, contract_number: e.currentTarget.value })}
                />
                <TextInput
                  label="Date / year"
                  value={form.drawing_date}
                  onChange={(e) => setForm({ ...form, drawing_date: e.currentTarget.value })}
                />
              </Group>
              <TextInput
                label="Version note"
                placeholder='e.g. "as-built revision"'
                value={form.version_note}
                onChange={(e) => setForm({ ...form, version_note: e.currentTarget.value })}
              />
              <Select
                label="Drawing set"
                description={
                  drawing?.project_id
                    ? 'Group this drawing with others under a set number'
                    : 'Assign the drawing to a project first'
                }
                placeholder={projectSets.length ? 'No set' : 'No sets in this project yet'}
                data={projectSets.map((s) => ({
                  value: s.set_id,
                  label: s.name ? `${s.set_number} — ${s.name}` : s.set_number,
                }))}
                value={form.set_id}
                onChange={(v) => setForm({ ...form, set_id: v })}
                disabled={!drawing?.project_id || projectSets.length === 0}
                clearable
              />
              <Group justify="flex-end">
                <Button type="submit" loading={saving}>
                  Save changes
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>

        <Stack style={{ flex: '1 1 380px' }} gap="lg">
          <Paper withBorder radius="md" p="md">
            <Group justify="space-between" mb="sm">
              <Text fw={600}>Files ({drawing.files.length})</Text>
              <Button variant="default" size="xs" onClick={() => navigate('/upload')}>
                Upload more
              </Button>
            </Group>
            {drawing.files.length === 0 ? (
              <Text size="sm" c="dimmed">
                No files attached. Upload files, then assign them to this drawing from the
                Documents page.
              </Text>
            ) : (
              <Stack gap={6}>
                {drawing.files.map((f) => (
                  <Group
                    key={f.file_id}
                    justify="space-between"
                    wrap="nowrap"
                    px="sm"
                    py={6}
                    style={{ border: '1px solid var(--mantine-color-gray-2)', borderRadius: 8 }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <Text
                        size="sm"
                        fw={500}
                        truncate
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/documents/${f.file_id}`)}
                      >
                        {f.filename}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {f.sheet_number ? `Sheet ${f.sheet_number} · ` : ''}
                        {f.file_type.toUpperCase()}
                      </Text>
                    </div>
                    <Group gap="xs" wrap="nowrap">
                      <StatusBadge status={f.status} />
                      <Button
                        variant="subtle"
                        color="gray"
                        size="compact-xs"
                        onClick={() => handleDetachFile(f.file_id)}
                      >
                        Detach
                      </Button>
                    </Group>
                  </Group>
                ))}
              </Stack>
            )}
          </Paper>

          <Paper withBorder radius="md" p="md">
            <Group justify="space-between" mb="sm">
              <Text fw={600}>Versions</Text>
              <Group gap="xs">
                {drawing.other_versions.length > 0 && (
                  <Button
                    variant="subtle"
                    color="gray"
                    size="xs"
                    leftSection={<IconUnlink size={14} />}
                    onClick={handleUnlink}
                  >
                    Unlink this one
                  </Button>
                )}
                <Button
                  variant="default"
                  size="xs"
                  leftSection={<IconLink size={14} />}
                  onClick={openLinkModal}
                >
                  Link a version
                </Button>
              </Group>
            </Group>
            {drawing.other_versions.length === 0 ? (
              <Text size="sm" c="dimmed">
                No other versions. If another drawing is an older or newer iteration of this
                one, link it here — versions are told apart by their date and version note.
              </Text>
            ) : (
              <Stack gap={6}>
                {drawing.other_versions.map((v) => (
                  <Group
                    key={v.drawing_id}
                    justify="space-between"
                    wrap="nowrap"
                    px="sm"
                    py={6}
                    style={{ border: '1px solid var(--mantine-color-gray-2)', borderRadius: 8, cursor: 'pointer' }}
                    onClick={() => navigate(`/drawings/${v.drawing_id}`)}
                  >
                    <div style={{ minWidth: 0 }}>
                      <Text size="sm" fw={500} truncate>
                        {v.dwg_number ?? 'Drawing'}
                        {v.version_note ? ` — ${v.version_note}` : ''}
                      </Text>
                      <Text size="xs" c="dimmed" truncate>
                        {v.description ?? ''}
                      </Text>
                    </div>
                    <Badge variant="light" color={v.year ? 'brand' : 'gray'}>
                      {v.year ?? v.drawing_date ?? 'undated'}
                    </Badge>
                  </Group>
                ))}
              </Stack>
            )}
          </Paper>
        </Stack>
      </Group>

      <Modal opened={linkModal} onClose={linkModalCtl.close} title="Link a version" centered>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Pick the drawing that is another iteration of <strong>{drawing.dwg_number}</strong>.
            Both will share one version history.
          </Text>
          <Select
            data={linkCandidates}
            value={linkTarget}
            onChange={setLinkTarget}
            placeholder={
              linkCandidates.length ? 'Choose a drawing…' : 'No other drawings in this project'
            }
            searchable
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={linkModalCtl.close}>
              Cancel
            </Button>
            <Button onClick={handleLink} disabled={!linkTarget}>
              Link versions
            </Button>
          </Group>
        </Stack>
      </Modal>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete drawing?"
          message={
            <>
              <strong>{drawing.dwg_number ?? 'This drawing'}</strong> will be removed from the
              registry. Attached files are kept and become unassigned.
            </>
          }
          confirmLabel="Delete"
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(false)}
        />
      )}
    </div>
  )
}
