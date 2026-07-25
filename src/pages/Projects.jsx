import { Badge, Button, Group, Modal, Pagination, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconFolderPlus, IconSearch } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createProject, listFiles, listProjects } from '../api'
import ErrorState from '../components/ErrorState'
import Loading from '../components/Loading'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'

const PAGE_SIZE = 10
const PROJECT_SORTS = {
  name: (p) => p.name?.toLowerCase() ?? '',
  number: (p) => p.number?.toLowerCase() ?? '￿',
  drawings: (p) => p.drawing_count ?? 0,
  sets: (p) => p.set_count ?? 0,
  files: (p) => p.file_count ?? 0,
  created: (p) => p.created_at ?? '',
}

export default function Projects() {
  const [unassigned, setUnassigned] = useState(0)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState('created')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
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

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }
  // constant-size ↑↓ pair on every sortable column - only the active
  // direction lights up, so nothing ever changes size on click
  const sortIndicator = (key) => (
    <span className="sort-arrow">
      <span className={sortKey === key && sortDir === 'asc' ? 'on' : ''}>↑</span>
      <span className={sortKey === key && sortDir === 'desc' ? 'on' : ''}>↓</span>
    </span>
  )

  const visible = (projects ?? []).filter((p) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return [p.name, p.number, p.description]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q))
  })
  const accessor = PROJECT_SORTS[sortKey] ?? PROJECT_SORTS.created
  const dir = sortDir === 'asc' ? 1 : -1
  const sorted = [...visible].sort((a, b) => {
    const va = accessor(a)
    const vb = accessor(b)
    return va < vb ? -dir : va > vb ? dir : 0
  })
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const paged = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

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

      {(projects?.length ?? 0) > 0 && (
        <TextInput
          mb="md"
          w={360}
          size="sm"
          radius="md"
          leftSection={<IconSearch size={16} />}
          placeholder="Search projects by name or number…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
      )}

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
          <table className="table-fixed">
            <colgroup>
              <col style={{ width: '38%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>

            <thead>
              <tr>
                <th className="th-sortable" onClick={() => toggleSort('name')}>
                  Project{sortIndicator('name')}
                </th>
                <th className="th-sortable" onClick={() => toggleSort('number')}>
                  Number{sortIndicator('number')}
                </th>
                <th className="th-sortable" onClick={() => toggleSort('drawings')}>
                  Drawings{sortIndicator('drawings')}
                </th>
                <th className="th-sortable" onClick={() => toggleSort('sets')}>
                  Sets{sortIndicator('sets')}
                </th>
                <th className="th-sortable" onClick={() => toggleSort('files')}>
                  Files{sortIndicator('files')}
                </th>
                <th className="th-sortable" onClick={() => toggleSort('created')}>
                  Created{sortIndicator('created')}
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map((p) => (
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
              {paged.length === 0 && (
                <tr className="no-hover">
                  <td colSpan={6} className="empty-note center">
                    No projects match this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {projects !== null && pageCount > 1 && (
        <div className="table-pagination">
          <Pagination total={pageCount} value={currentPage} onChange={setPage} size="sm" />
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
