import { Burger, Button, Drawer, Menu, PasswordInput, Stack } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconFolderOpen,
  IconFolders,
  IconKey,
  IconLayoutDashboard,
  IconLogout,
  IconMessageCircle,
  IconFileText,
  IconUpload,
} from '@tabler/icons-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { changePassword } from '../api'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'
import { useToast } from './Toast'

const NAV = [
  { to: '/', label: 'Dashboard', icon: IconLayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: IconFolders },
  { to: '/files', label: 'Files', icon: IconFolderOpen },
  { to: '/upload', label: 'Upload', icon: IconUpload },
  { to: '/documents', label: 'Documents', icon: IconFileText },
  { to: '/chat', label: 'Chat', icon: IconMessageCircle },
]

function Brand() {
  return (
    <div className="sidebar-brand">
      <div className="brand-mark">B</div>
      <div>
        <div className="brand-name">BlueprintAI</div>
        <div className="brand-sub">Drawing intelligence</div>
      </div>
    </div>
  )
}

function Nav({ onNavigate }) {
  return (
    <nav className="sidebar-nav">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
        >
          <Icon size={18} stroke={1.7} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function Footer() {
  const { user, logout } = useAuth()
  const toast = useToast()
  const [changing, setChanging] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [nextError, setNextError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submitPassword(e) {
    e.preventDefault()
    if (next.length < 8) {
      setNextError('Password must be at least 8 characters long.')
      return
    }
    setNextError(null)
    setBusy(true)
    try {
      await changePassword(current, next)
      toast.success('Password changed. Other sessions were signed out.')
      setChanging(false)
      setCurrent('')
      setNext('')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Menu position="top-start" width={210} withArrow>
        <Menu.Target>
          <button type="button" className="sidebar-footer sidebar-footer-btn">
            <div className="avatar">{(user?.username ?? '?')[0].toUpperCase()}</div>
            <div>
              <div className="user-name">{user?.username}</div>
              <div className="user-sub">Workspace owner</div>
            </div>
          </button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconKey size={15} />} onClick={() => setChanging(true)}>
            Change password
          </Menu.Item>
          <Menu.Item leftSection={<IconLogout size={15} />} color="red" onClick={logout}>
            Log out
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {changing && (
        <Modal title="Change password" onClose={() => setChanging(false)}>
          <form onSubmit={submitPassword}>
            <Stack gap="sm">
              <PasswordInput
                label="Current password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                required
                autoFocus
              />
              <PasswordInput
                label="New password"
                description="At least 8 characters"
                error={nextError}
                value={next}
                onChange={(e) => {
                  setNext(e.target.value)
                  if (nextError && e.target.value.length >= 8) setNextError(null)
                }}
                autoComplete="new-password"
                required
              />
              <Button type="submit" loading={busy}>
                Change password
              </Button>
            </Stack>
          </form>
        </Modal>
      )}
    </>
  )
}

export default function Sidebar() {
  const [opened, { close, toggle }] = useDisclosure(false)

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="sidebar">
        <Brand />
        <Nav />
        <Footer />
      </aside>

      {/* Mobile: top bar with burger + drawer */}
      <header className="mobile-topbar">
        <Burger opened={opened} onClick={toggle} color="#fff" size="sm" aria-label="Menu" />
        <div className="brand-mark small">B</div>
        <span className="brand-name">BlueprintAI</span>
      </header>
      <Drawer
        opened={opened}
        onClose={close}
        size={260}
        padding={0}
        withCloseButton={false}
        transitionProps={{ duration: 0 }}
        styles={{ body: { height: '100%', padding: 0 } }}
      >
        <div className="sidebar drawer-mode">
          <Brand />
          <Nav onNavigate={close} />
          <Footer />
        </div>
      </Drawer>
    </>
  )
}
