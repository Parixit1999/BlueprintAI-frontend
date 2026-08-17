import { Button, Modal, PasswordInput, Stack, TextInput } from '@mantine/core'
import { IconTrash, IconUserPlus } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { createUser, deleteUser, listUsers } from '../api'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorState from '../components/ErrorState'
import Loading from '../components/Loading'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'

/**
 * Everyone who can sign in to this workspace. Deliberately role-free: the
 * pilot is one shared team, so an account either exists or it doesn't.
 */
export default function Users() {
  const [users, setUsers] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [adding, setAdding] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', username: '', password: '' })
  const toast = useToast()
  const { user } = useAuth()

  function refresh() {
    return listUsers()
      .then((d) => {
        setUsers(d.users)
        setLoadError(null)
      })
      .catch((e) => (users ? toast.error(e.message) : setLoadError(e.message)))
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Typing a name suggests the usual username shape (first initial + surname)
  // so the person filling this in doesn't have to invent a convention.
  function onNameChange(value) {
    const parts = value.trim().split(/\s+/).filter(Boolean)
    const suggestion =
      parts.length > 1
        ? (parts[0][0] + parts[parts.length - 1]).toLowerCase().replace(/[^a-z0-9]/g, '')
        : (parts[0] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
    setForm((f) => ({
      ...f,
      full_name: value,
      // only auto-fill while the user hasn't typed their own username
      username: f.usernameTouched ? f.username : suggestion,
    }))
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await createUser(form)
      toast.success(`${form.full_name || form.username} can now sign in.`)
      setAdding(false)
      setForm({ full_name: '', email: '', username: '', password: '' })
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
      await deleteUser(pendingDelete.user_id)
      toast.success(`${pendingDelete.username} can no longer sign in.`)
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
        title="People"
        description="Everyone with access to this workspace. Anyone here can sign in and work with the full archive."
        onRefresh={refresh}
        actions={
          <Button leftSection={<IconUserPlus size={16} />} onClick={() => setAdding(true)}>
            Add person
          </Button>
        }
      />

      {users === null && loadError ? (
        <ErrorState message={loadError} onRetry={refresh} />
      ) : users === null ? (
        <Loading label="Loading people…" />
      ) : (
        <div className="panel table-panel">
          <table className="table-fixed">
            <colgroup>
              <col />
              <col />
              <col style={{ width: 170 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 110 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Username</th>
                <th>Added</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMe = u.username === user?.username
                return (
                  <tr key={u.user_id} className="no-hover">
                    <td className="cell-name">
                      <div className="name-primary">
                        {u.full_name || u.username}
                        {isMe && <span className="auto-tag" style={{ marginLeft: 8 }}>you</span>}
                      </div>
                    </td>
                    <td className={u.email ? undefined : 'muted'}>{u.email || '-'}</td>
                    <td className="cell-type">{u.username}</td>
                    <td className="cell-date" title={new Date(u.created_at).toLocaleString()}>
                      {new Date(u.created_at).toLocaleDateString('en-CA')}
                    </td>
                    <td className="cell-action">
                      {!isMe && (
                        <Button
                          variant="subtle"
                          color="red"
                          size="compact-xs"
                          leftSection={<IconTrash size={14} />}
                          onClick={() => setPendingDelete(u)}
                        >
                          Remove
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        opened={adding}
        onClose={() => setAdding(false)}
        title="Add a person"
        centered
        radius="md"
        transitionProps={{ duration: 0 }}
      >
        <form onSubmit={submit}>
          <Stack gap="sm">
            <TextInput
              label="Full name"
              placeholder="e.g. Christopher Bergeron"
              value={form.full_name}
              onChange={(e) => onNameChange(e.currentTarget.value)}
              autoFocus
            />
            <TextInput
              label="Email"
              type="email"
              placeholder="e.g. cbergeron@msmmeng.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.currentTarget.value }))}
            />
            <TextInput
              label="Username"
              description="What they type to sign in"
              value={form.username}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  username: e.currentTarget.value,
                  usernameTouched: true,
                }))
              }
              required
            />
            <PasswordInput
              label="Temporary password"
              description="At least 8 characters. They can change it from the menu after signing in."
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.currentTarget.value }))}
              autoComplete="new-password"
              required
            />
            <Button type="submit" loading={busy}>
              Add person
            </Button>
          </Stack>
        </form>
      </Modal>

      {pendingDelete && (
        <ConfirmDialog
          title={`Remove ${pendingDelete.full_name || pendingDelete.username}?`}
          message="They will be signed out everywhere and will no longer be able to sign in. Drawings, documents, and chat history stay exactly as they are."
          confirmLabel="Remove"
          danger
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
