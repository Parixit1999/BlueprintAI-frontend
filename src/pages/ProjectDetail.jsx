import {
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconArrowLeft,
  IconChevronDown,
  IconChevronRight,
  IconFilePlus,
  IconPencil,
  IconStack2,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  assignFile,
  createDrawing,
  createSet,
  deleteFile,
  deleteProject,
  deleteSet,
  getProject,
  renameFile,
  unassignFile,
  updateProject,
} from '../api'
import { StatusBadge } from '../components/Badges'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorState from '../components/ErrorState'
import Loading from '../components/Loading'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'

export default function ProjectDetail() {
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [drawingModal, drawingModalCtl] = useDisclosure(false)
  const [setModal, setModalCtl] = useDisclosure(false)
  const [editModal, editModalCtl] = useDisclosure(false)
  const [editForm, setEditForm] = useState({ name: '', number: '', description: '' })
  const [pendingDelete, setPendingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dwg, setDwg] = useState({ dwg_number: '', description: '', contract_number: '', drawing_date: '', sheet_count: null, set_id: null })
  const [setForm, setSetForm] = useState({ set_number: '', name: '' })
  // file explorer state: which drawings are expanded + in-flight file action
  const [expanded, setExpanded] = useState(new Set())
  const [renamingFile, setRenamingFile] = useState(null) // {file, name}
  const [movingFile, setMovingFile] = useState(null) // {file, target}
  const [deletingFile, setDeletingFile] = useState(null) // file
  const [fileBusy, setFileBusy] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  function toggleExpand(drawingId) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(drawingId) ? next.delete(drawingId) : next.add(drawingId)
      return next
    })
  }

  async function handleRenameFile() {
    setFileBusy(true)
    try {
      await renameFile(renamingFile.file.file_id, renamingFile.name.trim())
      toast.success('File renamed.')
      setRenamingFile(null)
      refresh()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setFileBusy(false)
    }
  }

  async function handleMoveFile() {
    setFileBusy(true)
    try {
      await assignFile(movingFile.file.file_id, { drawing_id: movingFile.target })
      toast.success('File moved.')
      setMovingFile(null)
      refresh()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setFileBusy(false)
    }
  }

  async function handleDetachFile(file) {
    try {
      await unassignFile(file.file_id)
      toast.success('File detached — find it under Documents to reassign.')
      refresh()
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function handleDeleteFile() {
    setFileBusy(true)
    try {
      await deleteFile(deletingFile.file_id)
      toast.success('File deleted.')
      setDeletingFile(null)
      refresh()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setFileBusy(false)
    }
  }

  function refresh() {
    return getProject(projectId)
      .then((p) => {
        setProject(p)
        setLoadError(null)
      })
      .catch((e) => (project ? toast.error(e.message) : setLoadError(e.message)))
  }

  useEffect(() => {
    refresh()
  }, [projectId])

  async function handleCreateDrawing(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await createDrawing({
        project_id: projectId,
        dwg_number: dwg.dwg_number.trim() || null,
        description: dwg.description.trim() || null,
        contract_number: dwg.contract_number.trim() || null,
        drawing_date: dwg.drawing_date.trim() || null,
        sheet_count: dwg.sheet_count || null,
        set_id: dwg.set_id || null,
      })
      toast.success('Drawing added.')
      drawingModalCtl.close()
      setDwg({ dwg_number: '', description: '', contract_number: '', drawing_date: '', sheet_count: null, set_id: null })
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateSet(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await createSet(projectId, {
        set_number: setForm.set_number.trim(),
        name: setForm.name.trim() || null,
      })
      toast.success('Drawing set created.')
      setModalCtl.close()
      setSetForm({ set_number: '', name: '' })
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  function openEdit() {
    setEditForm({
      name: project.name ?? '',
      number: project.number ?? '',
      description: project.description ?? '',
    })
    editModalCtl.open()
  }

  async function handleEditProject(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProject(projectId, {
        name: editForm.name.trim(),
        number: editForm.number.trim() || null,
        description: editForm.description.trim() || null,
      })
      toast.success('Project updated.')
      editModalCtl.close()
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteSet(setId) {
    try {
      await deleteSet(setId)
      toast.success('Set deleted; its drawings were kept.')
      refresh()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function confirmDeleteProject() {
    setDeleting(true)
    try {
      await deleteProject(projectId)
      toast.success('Project deleted.')
      navigate('/projects')
    } catch (err) {
      toast.error(err.message)
      setDeleting(false)
    }
  }

  if (project === null && loadError) return <ErrorState message={loadError} onRetry={refresh} />
  if (project === null) return <Loading label="Loading project…" />

  return (
    <div>
      <Button
        variant="subtle"
        color="gray"
        size="compact-sm"
        leftSection={<IconArrowLeft size={16} />}
        onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/projects'))}
        mb="xs"
      >
        Projects
      </Button>
      <PageHeader
        onRefresh={refresh}
        title={project.name}
        description={
          [project.number ? `Project #${project.number}` : null, project.description]
            .filter(Boolean)
            .join(' — ') || undefined
        }
        actions={
          <Group gap="xs">
            <Button
              variant="default"
              leftSection={<IconUpload size={16} />}
              onClick={() => navigate('/upload')}
            >
              Upload files
            </Button>
            <Button leftSection={<IconFilePlus size={16} />} onClick={drawingModalCtl.open}>
              Add drawing
            </Button>
            <Button variant="default" leftSection={<IconPencil size={16} />} onClick={openEdit}>
              Edit
            </Button>
            <Button variant="light" color="red" onClick={() => setPendingDelete(true)}>
              Delete
            </Button>
          </Group>
        }
      />

      {/* The project IS the file system: Set -> Drawing -> File hierarchy,
          every level expandable, file operations inline. */}
      <Group mb="sm" justify="space-between">
        <Text size="sm" c="dimmed">
          {project.drawings.length} drawing{project.drawings.length === 1 ? '' : 's'} ·{' '}
          {project.drawings.reduce((n, d) => n + (d.files?.length ?? 0), 0)} file
          {project.drawings.reduce((n, d) => n + (d.files?.length ?? 0), 0) === 1 ? '' : 's'}
        </Text>
        <Button
          variant="default"
          size="xs"
          leftSection={<IconStack2 size={15} />}
          onClick={setModalCtl.open}
        >
          New set
        </Button>
      </Group>

      {project.drawings.length === 0 && project.sets.length === 0 ? (
        <div className="empty-state">
          <p>No drawings in this project yet.</p>
          <p className="page-sub">
            Add a drawing manually, or upload files — they can be assigned here with
            automatic name matching.
          </p>
        </div>
      ) : (
        [
          ...project.sets.map((set) => ({
            key: set.set_id,
            set,
            drawings: project.drawings.filter((d) => d.set_id === set.set_id),
          })),
          {
            key: 'standalone',
            set: null,
            drawings: project.drawings.filter((d) => !d.set_id),
          },
        ]
          .filter((g) => g.set || g.drawings.length > 0)
          .map((group) => (
            <div key={group.key} className="explorer-section panel">
              <div className="explorer-section-head">
                {group.set ? (
                  <>
                    <Badge variant="light">{group.set.set_number}</Badge>
                    <span className="explorer-section-name">
                      {group.set.name ?? 'Drawing set'}
                    </span>
                    <span className="muted">
                      {group.drawings.length} drawing{group.drawings.length === 1 ? '' : 's'}
                    </span>
                    <Button
                      variant="subtle"
                      color="red"
                      size="compact-xs"
                      ml="auto"
                      onClick={() => handleDeleteSet(group.set.set_id)}
                    >
                      Delete set
                    </Button>
                  </>
                ) : (
                  <span className="explorer-section-name">Standalone drawings</span>
                )}
              </div>
              {group.drawings.length === 0 && (
                <p className="empty-note">
                  Empty set — assign drawings to it from their drawing page.
                </p>
              )}
              {group.drawings.map((d) => (
                <div key={d.drawing_id} className="explorer-drawing">
                  <div className="explorer-drawing-row" onClick={() => toggleExpand(d.drawing_id)}>
                    {expanded.has(d.drawing_id) ? (
                      <IconChevronDown size={16} className="muted" />
                    ) : (
                      <IconChevronRight size={16} className="muted" />
                    )}
                    <span className="explorer-dwg">{d.dwg_number ?? 'no DWG #'}</span>
                    <span className="explorer-desc">
                      {d.description ?? ''}
                    </span>
                    <span className="muted">{d.drawing_date ?? d.year ?? ''}</span>
                    <Badge variant="light" color={d.files?.length ? 'brand' : 'gray'}>
                      {d.files?.length ?? 0} file{(d.files?.length ?? 0) === 1 ? '' : 's'}
                    </Badge>
                    <Button
                      variant="subtle"
                      size="compact-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/drawings/${d.drawing_id}`)
                      }}
                    >
                      Details
                    </Button>
                  </div>
                  {expanded.has(d.drawing_id) && (
                    <div className="explorer-files">
                      {(d.files ?? []).length === 0 && (
                        <p className="empty-note">No files attached to this drawing.</p>
                      )}
                      {(d.files ?? []).map((f) => (
                        <div key={f.file_id} className="explorer-file-row">
                          <span className="explorer-filename">{f.filename}</span>
                          {f.sheet_number && (
                            <span className="muted">Sheet {f.sheet_number}</span>
                          )}
                          <StatusBadge status={f.status} />
                          <span className="explorer-file-actions">
                            <Button
                              variant="subtle"
                              size="compact-xs"
                              onClick={() => navigate(`/documents/${f.file_id}`)}
                            >
                              View
                            </Button>
                            <Button
                              variant="subtle"
                              size="compact-xs"
                              onClick={() =>
                                setRenamingFile({ file: f, name: f.filename })
                              }
                            >
                              Rename
                            </Button>
                            <Button
                              variant="subtle"
                              size="compact-xs"
                              onClick={() => setMovingFile({ file: f, target: null })}
                            >
                              Move
                            </Button>
                            <Button
                              variant="subtle"
                              size="compact-xs"
                              onClick={() => handleDetachFile(f)}
                            >
                              Detach
                            </Button>
                            <Button
                              variant="subtle"
                              color="red"
                              size="compact-xs"
                              onClick={() => setDeletingFile(f)}
                            >
                              Delete
                            </Button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
      )}

      <Modal
        opened={!!renamingFile}
        onClose={() => setRenamingFile(null)}
        title="Rename file"
        centered
      >
        {renamingFile && (
          <Stack gap="sm">
            <TextInput
              value={renamingFile.name}
              onChange={(e) =>
                setRenamingFile({ ...renamingFile, name: e.currentTarget.value })
              }
              data-autofocus
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setRenamingFile(null)}>
                Cancel
              </Button>
              <Button loading={fileBusy} onClick={handleRenameFile}>
                Rename
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={!!movingFile}
        onClose={() => setMovingFile(null)}
        title={movingFile ? `Move "${movingFile.file.filename}"` : ''}
        centered
      >
        {movingFile && (
          <Stack gap="sm">
            <Select
              label="Move to drawing"
              placeholder="Choose a drawing…"
              searchable
              data={project.drawings
                .filter((d) => d.drawing_id !== movingFile.file.drawing_id)
                .map((d) => ({
                  value: d.drawing_id,
                  label: `${d.dwg_number ?? 'no DWG #'}${d.description ? ` — ${d.description}` : ''}`.slice(0, 70),
                }))}
              value={movingFile.target}
              onChange={(v) => setMovingFile({ ...movingFile, target: v })}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setMovingFile(null)}>
                Cancel
              </Button>
              <Button loading={fileBusy} disabled={!movingFile.target} onClick={handleMoveFile}>
                Move
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {deletingFile && (
        <ConfirmDialog
          title="Delete file?"
          message={`"${deletingFile.filename}" and its extracted regions will be permanently removed. This cannot be undone.`}
          confirmLabel="Delete"
          danger
          busy={fileBusy}
          onConfirm={handleDeleteFile}
          onCancel={() => setDeletingFile(null)}
        />
      )}

      <Modal opened={drawingModal} onClose={drawingModalCtl.close} title="Add drawing" centered>
        <form onSubmit={handleCreateDrawing}>
          <Stack gap="sm">
            <TextInput
              label="DWG #"
              placeholder="e.g. 11767-W-59"
              value={dwg.dwg_number}
              onChange={(e) => setDwg({ ...dwg, dwg_number: e.currentTarget.value })}
              data-autofocus
            />
            <Textarea
              label="Description"
              value={dwg.description}
              onChange={(e) => setDwg({ ...dwg, description: e.currentTarget.value })}
              minRows={2}
            />
            <Group grow>
              <TextInput
                label="Contract #"
                value={dwg.contract_number}
                onChange={(e) => setDwg({ ...dwg, contract_number: e.currentTarget.value })}
              />
              <TextInput
                label="Date / year"
                placeholder="e.g. 2017-2018"
                value={dwg.drawing_date}
                onChange={(e) => setDwg({ ...dwg, drawing_date: e.currentTarget.value })}
              />
            </Group>
            <NumberInput
              label="Number of sheets"
              min={1}
              value={dwg.sheet_count ?? ''}
              onChange={(v) => setDwg({ ...dwg, sheet_count: typeof v === 'number' ? v : null })}
            />
            <Group justify="flex-end" mt="xs">
              <Button variant="default" onClick={drawingModalCtl.close}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Add drawing
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={editModal} onClose={editModalCtl.close} title="Edit project" centered>
        <form onSubmit={handleEditProject}>
          <Stack gap="sm">
            <TextInput
              label="Project name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.currentTarget.value })}
              required
              data-autofocus
            />
            <TextInput
              label="Project number"
              description="The registry/job number (e.g. 1234). Powers automatic file-to-project matching."
              placeholder="e.g. 1234 or 490-W"
              value={editForm.number}
              onChange={(e) => setEditForm({ ...editForm, number: e.currentTarget.value })}
            />
            <Textarea
              label="Description"
              autosize
              minRows={2}
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.currentTarget.value })}
            />
            <Group justify="flex-end" mt="xs">
              <Button variant="default" onClick={editModalCtl.close}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Save changes
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={setModal} onClose={setModalCtl.close} title="New drawing set" centered>
        <form onSubmit={handleCreateSet}>
          <Stack gap="sm">
            <TextInput
              label="Set #"
              placeholder='e.g. "12A"'
              value={setForm.set_number}
              onChange={(e) => setSetForm({ ...setForm, set_number: e.currentTarget.value })}
              required
              data-autofocus
            />
            <TextInput
              label="Name"
              placeholder="Optional"
              value={setForm.name}
              onChange={(e) => setSetForm({ ...setForm, name: e.currentTarget.value })}
            />
            <Group justify="flex-end" mt="xs">
              <Button variant="default" onClick={setModalCtl.close}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Create set
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete project?"
          message={
            <>
              <strong>{project.name}</strong> will be deleted along with its{' '}
              <strong>
                {project.drawings.length} drawing{project.drawings.length === 1 ? '' : 's'}
              </strong>{' '}
              and{' '}
              <strong>
                {project.sets.length} set{project.sets.length === 1 ? '' : 's'}
              </strong>
              .{' '}
              {(() => {
                const files = project.drawings.reduce((s, d) => s + (d.file_count ?? 0), 0)
                return files > 0 ? (
                  <>
                    The <strong>{files} uploaded document{files === 1 ? '' : 's'}</strong> will
                    be kept and become unassigned — no documents are ever deleted by this.
                  </>
                ) : (
                  'No uploaded documents are attached to this project.'
                )
              })()}{' '}
              This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          danger
          busy={deleting}
          onConfirm={confirmDeleteProject}
          onCancel={() => setPendingDelete(false)}
        />
      )}
    </div>
  )
}
