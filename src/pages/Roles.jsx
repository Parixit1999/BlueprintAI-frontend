import {
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  MultiSelect,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core'
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { createRole, deleteRole, listRegistryTabs, listRoles, updateRole } from '../api'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorState from '../components/ErrorState'
import Loading from '../components/Loading'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'

// The five page toggles, in sidebar order - one checkbox each, exactly like
// the whiteboard sketch this screen came from.
const PAGE_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'numberbook', label: 'Number Book' },
  { value: 'upload', label: 'Upload' },
  { value: 'documents', label: 'Documents' },
  { value: 'chat', label: 'Chat' },
]
const PAGE_LABEL = Object.fromEntries(PAGE_OPTIONS.map((p) => [p.value, p.label]))

const EMPTY_FORM = { name: '', pages: [], all_sheets: true, project_ids: [] }

/**
 * Admin-only: the roles an administrator can hand out. A role is a name,
 * a set of page toggles, and Number Book sheet access (every sheet or a
 * picked list). Assignments happen on the People page.
 */
export default function Roles() {
  const [roles, setRoles] = useState(null)
  const [sheets, setSheets] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [editing, setEditing] = useState(null) // null | {role_id?} form target
  const [form, setForm] = useState(EMPTY_FORM)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  function refresh() {
    return listRoles()
      .then((d) => {
        setRoles(d.roles)
        setLoadError(null)
      })
      .catch((e) => (roles ? toast.error(e.message) : setLoadError(e.message)))
  }

  useEffect(() => {
    refresh()
    // sheet options for the picker; admins see every tab. Main Book (id null)
    // is not a sheet - roles grant either ALL sheets or specific ones.
    listRegistryTabs()
      .then((d) =>
        setSheets(
          d.tabs
            .filter((t) => t.id !== null)
            .map((t) => ({ value: t.id, label: t.name })),
        ),
      )
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openCreate() {
    setForm(EMPTY_FORM)
    setEditing({})
  }

  function openEdit(role) {
    setForm({
      name: role.name,
      pages: role.pages,
      all_sheets: role.all_sheets,
      project_ids: role.project_ids,
    })
    setEditing(role)
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      if (editing?.role_id) {
        await updateRole(editing.role_id, form)
        toast.success(`Role “${form.name}” updated. It applies immediately.`)
      } else {
        await createRole(form)
        toast.success(`Role “${form.name}” created. Assign it on the People page.`)
      }
      setEditing(null)
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    try {
      await deleteRole(pendingDelete.role_id)
      toast.success(`Role “${pendingDelete.name}” deleted.`)
      setPendingDelete(null)
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Roles"
        description="What each kind of teammate can see and do. Assign roles to people on the People page; changes apply on their next click."
        onRefresh={refresh}
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New role
          </Button>
        }
      />

      {roles === null && loadError ? (
        <ErrorState message={loadError} onRetry={refresh} />
      ) : roles === null ? (
        <Loading label="Loading roles…" />
      ) : roles.length === 0 ? (
        <div className="panel">
          <p className="empty-note">
            No roles yet. Create one, then assign it to teammates on the People
            page - anyone without a role (and without admin) has no access.
          </p>
        </div>
      ) : (
        <div className="role-grid">
          {roles.map((r) => (
            <div key={r.role_id} className="panel role-card">
              <div className="role-card-head">
                <h2>{r.name}</h2>
                <Group gap={4}>
                  <Button
                    variant="subtle"
                    size="compact-xs"
                    leftSection={<IconPencil size={14} />}
                    onClick={() => openEdit(r)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="subtle"
                    color="red"
                    size="compact-xs"
                    leftSection={<IconTrash size={14} />}
                    onClick={() => setPendingDelete(r)}
                  >
                    Delete
                  </Button>
                </Group>
              </div>
              <Group gap={6} mt={4}>
                {r.pages.length === 0 && (
                  <Text size="sm" c="dimmed">No pages</Text>
                )}
                {r.pages.map((p) => (
                  <Badge key={p} variant="light" radius="sm">
                    {PAGE_LABEL[p] ?? p}
                  </Badge>
                ))}
              </Group>
              <div className="role-card-meta">
                <span>
                  {r.all_sheets
                    ? 'All Number Book sheets'
                    : `${r.project_ids.length} sheet${r.project_ids.length === 1 ? '' : 's'}`}
                </span>
                <span>
                  {r.user_count} {r.user_count === 1 ? 'person' : 'people'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.role_id ? 'Edit role' : 'New role'}
        centered
        radius="md"
        transitionProps={{ duration: 0 }}
      >
        <form onSubmit={submit}>
          <Stack gap="sm">
            <TextInput
              label="Role name"
              placeholder="e.g. Field engineer"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.currentTarget.value }))}
              required
              autoFocus
            />
            <div>
              <Text size="sm" fw={500} mb={6}>
                Pages
              </Text>
              <Stack gap={6}>
                {PAGE_OPTIONS.map((p) => (
                  <Checkbox
                    key={p.value}
                    label={p.label}
                    checked={form.pages.includes(p.value)}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        pages: e.currentTarget.checked
                          ? [...f.pages, p.value]
                          : f.pages.filter((x) => x !== p.value),
                      }))
                    }
                  />
                ))}
              </Stack>
            </div>
            <Switch
              label="Access all Number Book sheets"
              description="Off = pick the specific sheets this role may see (applies to the book, documents, and chat answers)"
              checked={form.all_sheets}
              onChange={(e) =>
                setForm((f) => ({ ...f, all_sheets: e.currentTarget.checked }))
              }
            />
            {!form.all_sheets && (
              <MultiSelect
                label="Sheet access"
                placeholder={form.project_ids.length ? undefined : 'Pick sheets…'}
                data={sheets}
                value={form.project_ids}
                onChange={(v) => setForm((f) => ({ ...f, project_ids: v }))}
                searchable
                comboboxProps={{ transitionProps: { duration: 0 } }}
              />
            )}
            <Button type="submit" loading={busy}>
              {editing?.role_id ? 'Save role' : 'Create role'}
            </Button>
          </Stack>
        </form>
      </Modal>

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete the “${pendingDelete.name}” role?`}
          message={`${pendingDelete.user_count} ${pendingDelete.user_count === 1 ? 'person holds' : 'people hold'} this role - they will lose access until an administrator assigns them another one.`}
          confirmLabel="Delete role"
          danger
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
