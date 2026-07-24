import { Badge, Button, Group, Modal, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconFolderPlus } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createProject, listFiles, listProjects } from '../api'
import ErrorState from '../components/ErrorState'
import Loading from '../components/Loading'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'

export default function Projects() {
  const [unassigned, setUnassigned] = useState(0)
  const [projects, setProjects] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [opened, { open, close }] = useDisclosure(false)
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  function refresh() {
    return listProjects()
      .then((p) => {
        setProjects(p)
        setLoadError(null)
      })
      .catch((e) => (projects ? toast.error(e.message) : setLoadError(e.message)))
      .finally(() =>
        listFiles()
          .then((fs) => setUnassigned(fs.filter((f) => !f.drawing_id).length))
          .catch(() => {}),
      )
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const p = await createProject({
        name: name.trim(),
        number: number.trim() || null,
        description: description.trim() || null,
      })
      toast.success(`Project "${p.name}" created.`)
      close()
      setName('')
      setNumber('')
      setDescription('')
      navigate(`/projects/${p.project_id}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Each project groups its drawings, drawing sets, and files"
        onRefresh={refresh}
        actions={
          <Button leftSection={<IconFolderPlus size={16} />} onClick={open}>
            New project
          </Button>
        }
      />

      {unassigned > 0 && (
        <div className="notice">
          <span className="notice-icon">!</span>
          <span>
            {unassigned} file{unassigned === 1 ? ' is' : 's are'} not filed under any
            drawing yet.
          </span>
          <button className="link-btn" onClick={() => navigate('/documents?assigned=no')}>
            Review and assign
          </button>
        </div>
      )}

      {projects === null && loadError ? (
        <ErrorState message={loadError} onRetry={refresh} />
      ) : projects === null ? (
        <Loading label="Loading projects…" />
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <p>No projects yet.</p>
          <p className="page-sub">
            Create a project, then add drawings and upload files to it. Uploaded files are
            matched to projects automatically from their names.
          </p>
        </div>
      ) : (
        <div className="panel table-panel">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Number</th>
                <th>Drawings</th>
                <th>Sets</th>
                <th>Files</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.project_id} onClick={() => navigate(`/projects/${p.project_id}`)}>
                  <td className="cell-name">
                    <div className="name-cell">
                      <span>{p.name}</span>
                      {p.source === 'book_import' && (
                        <Badge variant="light" color="gray" size="xs">
                          imported
                        </Badge>
                      )}
                    </div>
                    {p.description && (
                      <Text size="xs" c="dimmed" truncate maw={420}>
                        {p.description}
                      </Text>
                    )}
                  </td>
                  <td>{p.number ?? '—'}</td>
                  <td>{p.drawing_count}</td>
                  <td>{p.set_count}</td>
                  <td>{p.file_count}</td>
                  <td className="cell-date">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal opened={opened} onClose={close} title="New project" centered>
        <form onSubmit={handleCreate}>
          <Stack gap="sm">
            <TextInput
              label="Project name"
              placeholder="e.g. Engineering Building Additions"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              required
              data-autofocus
            />
            <TextInput
              label="Project number"
              placeholder="e.g. 1206 — matched against pj1206 in file names"
              value={number}
              onChange={(e) => setNumber(e.currentTarget.value)}
            />
            <Textarea
              label="Description"
              placeholder="Optional"
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
              minRows={2}
            />
            <Group justify="flex-end" mt="xs">
              <Button variant="default" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Create project
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </div>
  )
}
