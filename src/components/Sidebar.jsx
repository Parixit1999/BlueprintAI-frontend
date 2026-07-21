import { Burger, Drawer } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconFolderOpen,
  IconFolders,
  IconLayoutDashboard,
  IconMessageCircle,
  IconFileText,
  IconUpload,
} from '@tabler/icons-react'
import { NavLink } from 'react-router-dom'

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
  return (
    <div className="sidebar-footer">
      <div className="avatar">A</div>
      <div>
        <div className="user-name">Admin</div>
        <div className="user-sub">Workspace owner</div>
      </div>
    </div>
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
