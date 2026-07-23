import {
  ActionIcon,
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Group,
  Menu,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconArrowsMove,
  IconDotsVertical,
  IconFile,
  IconFolder,
  IconFolderPlus,
  IconPencil,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  browseFolder,
  createFolder,
  deleteFolder,
  listFolders,
  moveFile,
  moveFolder,
  renameFile,
  renameFolder,
} from '../api'
import { StatusBadge } from '../components/Badges'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorState from '../components/ErrorState'
import Loading from '../components/Loading'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'

export default function Files() {
  const [searchParams, setSearchParams] = useSearchParams()
  const folderId = searchParams.get('folder')
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [allFolders, setAllFolders] = useState([])
  const [newFolderOpen, newFolderCtl] = useDisclosure(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renaming, setRenaming] = useState(null) // {kind: 'file'|'folder', id, name}
  const [renameValue, setRenameValue] = useState('')
  const [moving, setMoving] = useState(null) // {kind, id, name, subtree?}
  const [moveTarget, setMoveTarget] = useState(null)
  const [moveSearch, setMoveSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null) // folder
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  function refresh() {
    return Promise.all([browseFolder(folderId), listFolders()])
      .then(([b, all]) => {
        setData(b)
        setAllFolders(all)
        setLoadError(null)
      })
      .catch((e) => (data ? toast.error(e.message) : setLoadError(e.message)))
  }

  useEffect(() => {
    refresh()
  }, [folderId])

  function openFolder(id) {
    setSearchParams(id ? { folder: id } : {})
  }

  async function handleCreateFolder(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await createFolder(newFolderName.trim(), folderId)
      toast.success('Folder created.')
      newFolderCtl.close()
      setNewFolderName('')
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRename(e) {
    e.preventDefault()
    setBusy(true)
    try {
      if (renaming.kind === 'folder') await renameFolder(renaming.id, renameValue.trim())
      else await renameFile(renaming.id, renameValue.trim())
      toast.success('Renamed.')
      setRenaming(null)
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  // folders a folder may move into: anywhere except itself and its subtree.
  // Options carry the FULL path ("Riverside Pump Station / 2022 Rebid") so
  // same-named folders in different places stay distinguishable, and sorting
  // by path keeps siblings grouped. The current location is disabled - moving
  // there would be a no-op.
  const moveOptions = useMemo(() => {
    if (!moving) return []
    const blocked = new Set(moving.kind === 'folder' ? [moving.id] : [])
    if (moving.kind === 'folder') {
      // walk down: children of blocked folders are blocked too
      let changed = true
      while (changed) {
        changed = false
        for (const f of allFolders) {
          if (f.parent_id && blocked.has(f.parent_id) && !blocked.has(f.folder_id)) {
            blocked.add(f.folder_id)
            changed = true
          }
        }
      }
    }
    const byId = new Map(allFolders.map((f) => [f.folder_id, f]))
    const pathOf = (f) => {
      const parts = [f.name]
      let cur = f
      while (cur.parent_id && byId.has(cur.parent_id)) {
        cur = byId.get(cur.parent_id)
        parts.unshift(cur.name)
      }
      return parts.join(' / ')
    }
    const here = folderId ?? 'root'
    return [
      { value: 'root', label: '/ (root)', disabled: here === 'root' },
      ...allFolders
        .filter((f) => !blocked.has(f.folder_id))
        .map((f) => ({
          value: f.folder_id,
          label: pathOf(f),
          disabled: f.folder_id === here,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ]
  }, [moving, allFolders, folderId])

  // Path-aware search: "riverside/2022" or "riverside 2022" matches
  // "Riverside Pump Station / 2022 Rebid" - every token must appear, in order.
  function filterMoveOptions({ options, search }) {
    const tokens = search.toLowerCase().split(/[/\s]+/).filter(Boolean)
    if (!tokens.length) return options
    return options.filter((o) => {
      const label = o.label.toLowerCase()
      let from = 0
      for (const t of tokens) {
        const at = label.indexOf(t, from)
        if (at === -1) return false
        from = at + t.length
      }
      return true
    })
  }

  async function handleMove() {
    setBusy(true)
    const target = moveTarget === 'root' ? null : moveTarget
    try {
      if (moving.kind === 'folder') await moveFolder(moving.id, target)
      else await moveFile(moving.id, target)
      toast.success('Moved.')
      setMoving(null)
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Create the typed destination on the fly, reusing any path segments that
  // already exist ("riverside/2022" reuses folder riverside, creates 2022),
  // then move the item into the deepest one - no leaving the dialog.
  async function createAndMove() {
    const segments = moveSearch.split('/').map((s) => s.trim()).filter(Boolean)
    if (!segments.length) return
    setBusy(true)
    try {
      let parentId = null
      let known = allFolders
      for (const name of segments) {
        const existing = known.find(
          (f) =>
            (f.parent_id ?? null) === parentId &&
            f.name.toLowerCase() === name.toLowerCase(),
        )
        if (existing) {
          parentId = existing.folder_id
        } else {
          const created = await createFolder(name, parentId)
          parentId = created.folder_id
          known = [...known, created]
        }
      }
      if (moving.kind === 'folder') await moveFolder(moving.id, parentId)
      else await moveFile(moving.id, parentId)
      toast.success(`Created “${segments.join(' / ')}” and moved.`)
      setMoving(null)
      setMoveSearch('')
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function confirmDeleteFolder() {
    setDeleting(true)
    try {
      const res = await deleteFolder(pendingDelete.folder_id)
      toast.success(
        `Deleted ${res.deleted_folders} folder(s) and ${res.deleted_files} file(s).`,
      )
      setPendingDelete(null)
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeleting(false)
    }
  }

  if (data === null && loadError) return <ErrorState message={loadError} onRetry={refresh} />
  if (data === null) return <Loading label="Loading files…" />

  const crumbs = [
    <Anchor key="root" size="sm" onClick={() => openFolder(null)}>
      All files
    </Anchor>,
    ...data.breadcrumbs.map((b) => (
      <Anchor key={b.folder_id} size="sm" onClick={() => openFolder(b.folder_id)}>
        {b.name}
      </Anchor>
    )),
  ]

  return (
    <div>
      <PageHeader
        title="Files"
        description="Organize drawings in folders — by project, set, version, or any structure you like"
        onRefresh={refresh}
        actions={
          <Group gap="xs">
            <Button
              variant="default"
              leftSection={<IconFolderPlus size={16} />}
              onClick={newFolderCtl.open}
            >
              New folder
            </Button>
            <Button
              leftSection={<IconUpload size={16} />}
              onClick={() => navigate(folderId ? `/upload?folder=${folderId}` : '/upload')}
            >
              Upload here
            </Button>
          </Group>
        }
      />

      <Breadcrumbs mb="md">{crumbs}</Breadcrumbs>

      {data.folders.length === 0 && data.files.length === 0 ? (
        <div className="empty-state">
          <p>This folder is empty.</p>
          <p className="page-sub">Create a folder or upload files here.</p>
        </div>
      ) : (
        <Stack gap="lg">
          {data.folders.length > 0 && (
            <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }} spacing="sm">
              {data.folders.map((f) => (
                <Paper
                  key={f.folder_id}
                  withBorder
                  radius="md"
                  p="sm"
                  style={{ cursor: 'pointer' }}
                  onClick={() => openFolder(f.folder_id)}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                      <IconFolder size={22} color="var(--mantine-color-brand-6)" />
                      <div style={{ minWidth: 0 }}>
                        <Text size="sm" fw={550} truncate>
                          {f.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {f.subfolder_count} folder{f.subfolder_count === 1 ? '' : 's'} ·{' '}
                          {f.file_count} file{f.file_count === 1 ? '' : 's'}
                        </Text>
                      </div>
                    </Group>
                    <Menu position="bottom-end" withArrow transitionProps={{ duration: 0 }}>
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Folder actions"
                        >
                          <IconDotsVertical size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                        <Menu.Item
                          leftSection={<IconPencil size={14} />}
                          onClick={() => {
                            setRenaming({ kind: 'folder', id: f.folder_id, name: f.name })
                            setRenameValue(f.name)
                          }}
                        >
                          Rename
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconArrowsMove size={14} />}
                          onClick={() => {
                            setMoving({ kind: 'folder', id: f.folder_id, name: f.name })
                            setMoveTarget(null)
                          }}
                        >
                          Move
                        </Menu.Item>
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={() => setPendingDelete(f)}
                        >
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Paper>
              ))}
            </SimpleGrid>
          )}

          {data.files.length > 0 && (
            <div className="panel table-panel">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Assignment</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th className="th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.files.map((f) => (
                    <tr key={f.file_id} onClick={() => navigate(`/documents/${f.file_id}`)}>
                      <td className="cell-name">
                        <Group gap="xs" wrap="nowrap">
                          <IconFile size={16} />
                          <span>{f.filename}</span>
                        </Group>
                        {f.status === 'failed' && f.error && (
                          <div className="error-match">{f.error}</div>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {f.drawing_id ? (
                          <Button
                            variant="light"
                            size="compact-xs"
                            onClick={() => navigate(`/drawings/${f.drawing_id}`)}
                          >
                            {f.dwg_number ?? 'Drawing'}
                          </Button>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="cell-type">{f.file_type.toUpperCase()}</td>
                      <td>
                        <StatusBadge status={f.status} />
                      </td>
                      <td className="cell-action" onClick={(e) => e.stopPropagation()}>
                        <div className="action-grid" style={{ gridTemplateColumns: '64px 56px 60px' }}>
                          <span>
                            <Button
                              variant="subtle"
                              size="compact-xs"
                              onClick={() => {
                                setRenaming({ kind: 'file', id: f.file_id, name: f.filename })
                                setRenameValue(f.filename)
                              }}
                            >
                              Rename
                            </Button>
                          </span>
                          <span>
                            <Button
                              variant="subtle"
                              size="compact-xs"
                              onClick={() => {
                                setMoving({ kind: 'file', id: f.file_id, name: f.filename })
                                setMoveTarget(null)
                              }}
                            >
                              Move
                            </Button>
                          </span>
                          <span>
                            <Button
                              variant="subtle"
                              size="compact-xs"
                              onClick={() => navigate(`/documents/${f.file_id}`)}
                            >
                              {f.status === 'extracted' ? 'Review' : 'View'}
                            </Button>
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Stack>
      )}

      <Modal opened={newFolderOpen} onClose={newFolderCtl.close} title="New folder" centered transitionProps={{ duration: 0 }}>
        <form onSubmit={handleCreateFolder}>
          <Stack gap="sm">
            <TextInput
              label="Folder name"
              placeholder='e.g. "Project Alpha" or "Set 12A"'
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.currentTarget.value)}
              required
              data-autofocus
            />
            <Text size="xs" c="dimmed">
              Created inside: {data.folder ? data.folder.name : '/ (root)'}
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={newFolderCtl.close}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Create
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={renaming !== null}
        onClose={() => setRenaming(null)}
        title={`Rename ${renaming?.kind ?? ''}`}
        centered
        transitionProps={{ duration: 0 }}
      >
        <form onSubmit={handleRename}>
          <Stack gap="sm">
            <TextInput
              value={renameValue}
              onChange={(e) => setRenameValue(e.currentTarget.value)}
              required
              data-autofocus
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setRenaming(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Rename
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={moving !== null}
        onClose={() => setMoving(null)}
        title={`Move "${moving?.name ?? ''}"`}
        centered
        transitionProps={{ duration: 0 }}
      >
        <Stack gap="sm">
          <Select
            label="Destination folder"
            description="Type any part of the path — e.g. “riverside/2022”"
            placeholder="Choose a destination…"
            data={moveOptions}
            value={moveTarget}
            onChange={setMoveTarget}
            searchValue={moveSearch}
            onSearchChange={setMoveSearch}
            filter={filterMoveOptions}
            searchable
            nothingFoundMessage={
              // the open dropdown covers everything below the input, so the
              // create action must live INSIDE it to be reachable mid-typing
              <Button
                variant="subtle"
                size="compact-sm"
                fullWidth
                loading={busy}
                onMouseDown={(e) => e.preventDefault()}
                onClick={createAndMove}
              >
                + Create “{moveSearch.split('/').map((s) => s.trim()).filter(Boolean).join(' / ')}”
                and move here
              </Button>
            }
            comboboxProps={{ transitionProps: { duration: 0 } }}
          />
          {moveSearch.trim() && (
            <Button
              variant="light"
              size="compact-sm"
              loading={busy}
              onClick={createAndMove}
              styles={{ inner: { justifyContent: 'flex-start' } }}
            >
              + Create “{moveSearch.split('/').map((s) => s.trim()).filter(Boolean).join(' / ')}”
              and move here
            </Button>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setMoving(null)}>
              Cancel
            </Button>
            <Button onClick={handleMove} loading={busy} disabled={!moveTarget}>
              Move
            </Button>
          </Group>
        </Stack>
      </Modal>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete folder?"
          message={
            <>
              <strong>{pendingDelete.name}</strong> will be deleted along with all its
              subfolders and the files inside. This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          danger
          busy={deleting}
          onConfirm={confirmDeleteFolder}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
