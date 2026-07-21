import {
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconArrowLeft, IconFilePlus, IconStack2, IconTrash, IconUpload } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createDrawing, createSet, deleteProject, deleteSet, getProject } from '../api'
import ConfirmDialog from '../components/ConfirmDialog'
import Loading from '../components/Loading'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'

export default function ProjectDetail() {
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [drawingModal, drawingModalCtl] = useDisclosure(false)
  const [setModal, setModalCtl] = useDisclosure(false)
  const [pendingDelete, setPendingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dwg, setDwg] = useState({ dwg_number: '', description: '', contract_number: '', drawing_date: '', sheet_count: null, set_id: null })
  const [setForm, setSetForm] = useState({ set_number: '', name: '' })
  const toast = useToast()
  const navigate = useNavigate()

  function refresh() {
    getProject(projectId)
      .then(setProject)
      .catch((e) => toast.error(e.message))
  }

  useEffect(refresh, [projectId])

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
            <Button variant="light" color="red" onClick={() => setPendingDelete(true)}>
              Delete
            </Button>
          </Group>
        }
      />

      <Tabs defaultValue="drawings">
        <Tabs.List mb="md">
          <Tabs.Tab value="drawings">Drawings ({project.drawings.length})</Tabs.Tab>
          <Tabs.Tab value="sets">Sets ({project.sets.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="drawings">
          {project.drawings.length === 0 ? (
            <div className="empty-state">
              <p>No drawings in this project yet.</p>
              <p className="page-sub">
                Add a drawing manually, or upload files — they can be assigned here with
                automatic name matching.
              </p>
            </div>
          ) : (
            <div className="panel table-panel">
              <table>
                <thead>
                  <tr>
                    <th>DWG #</th>
                    <th>Description</th>
                    <th>Contract #</th>
                    <th>Date</th>
                    <th>Set</th>
                    <th>Sheets</th>
                    <th>Files</th>
                  </tr>
                </thead>
                <tbody>
                  {project.drawings.map((d) => (
                    <tr key={d.drawing_id} onClick={() => navigate(`/drawings/${d.drawing_id}`)}>
                      <td className="cell-name">{d.dwg_number ?? '—'}</td>
                      <td>
                        <Text size="sm" truncate maw={380}>
                          {d.description ?? '—'}
                        </Text>
                      </td>
                      <td>{d.contract_number ?? '—'}</td>
                      <td>{d.drawing_date ?? d.year ?? '—'}</td>
                      <td>{d.set_number ? <Badge variant="light">{d.set_number}</Badge> : '—'}</td>
                      <td>{d.sheet_count ?? '—'}</td>
                      <td>{d.file_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="sets">
          <Group mb="sm">
            <Button
              variant="default"
              size="xs"
              leftSection={<IconStack2 size={15} />}
              onClick={setModalCtl.open}
            >
              New set
            </Button>
          </Group>
          {project.sets.length === 0 ? (
            <div className="empty-state">
              <p>No drawing sets.</p>
              <p className="page-sub">
                Sets group multiple drawings that belong together (like the book's Set #
                column, e.g. "12A").
              </p>
            </div>
          ) : (
            <div className="panel table-panel">
              <table>
                <thead>
                  <tr>
                    <th>Set #</th>
                    <th>Name</th>
                    <th>Drawings</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {project.sets.map((s) => (
                    <tr key={s.set_id} className="no-hover">
                      <td className="cell-name">{s.set_number}</td>
                      <td>{s.name ?? '—'}</td>
                      <td>{s.drawing_count}</td>
                      <td className="cell-action">
                        <Button
                          variant="subtle"
                          color="red"
                          size="compact-sm"
                          leftSection={<IconTrash size={14} />}
                          onClick={() => handleDeleteSet(s.set_id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tabs.Panel>
      </Tabs>

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
              <strong>{project.name}</strong> will be deleted. Its drawings and files are kept
              but become unassigned.
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
