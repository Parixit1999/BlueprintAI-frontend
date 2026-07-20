import {
  IconLayoutDashboard,
  IconMessageCircle,
  IconFileText,
  IconUpload,
} from '@tabler/icons-react'
import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Dashboard', icon: IconLayoutDashboard, end: true },
  { to: '/upload', label: 'Upload', icon: IconUpload },
  { to: '/documents', label: 'Documents', icon: IconFileText },
  { to: '/chat', label: 'Chat', icon: IconMessageCircle },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">B</div>
        <div>
          <div className="brand-name">BlueprintAI</div>
          <div className="brand-sub">Drawing intelligence</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            <Icon size={18} stroke={1.7} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="avatar">A</div>
        <div>
          <div className="user-name">Admin</div>
          <div className="user-sub">Workspace owner</div>
        </div>
      </div>
    </aside>
  )
}
