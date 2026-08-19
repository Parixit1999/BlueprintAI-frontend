import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import Sidebar from './components/Sidebar'
import { ToastProvider } from './components/Toast'
import TopProgress from './components/TopProgress'
import UploadIndicator from './components/UploadIndicator'
import { AuthProvider, useAuth } from './context/AuthContext'
import { UploadQueueProvider } from './context/UploadQueueContext'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Dashboard from './pages/Dashboard'
import DocumentDetail from './pages/DocumentDetail'
import Documents from './pages/Documents'
import DrawingDetail from './pages/DrawingDetail'
import ProjectDetail from './pages/ProjectDetail'
import Registry from './pages/Registry'
import DeletedRegistry from './pages/DeletedRegistry'
import Roles from './pages/Roles'
import Upload from './pages/Upload'
import Users from './pages/Users'

// NAV order = the order we fall back through when a page is off-limits
const PAGE_HOME = [
  ['dashboard', '/'],
  ['numberbook', '/registry'],
  ['upload', '/upload'],
  ['documents', '/documents'],
  ['chat', '/chat'],
]

function firstAllowedPath(can, isAdmin) {
  const hit = PAGE_HOME.find(([page]) => can(page))
  if (hit) return hit[1]
  // an admin with no role still administers people and roles
  return isAdmin ? '/users' : '/'
}

// Route guard: pages the role doesn't include silently redirect to the first
// page it does - the sidebar never shows them, so this only catches deep
// links and stale bookmarks.
function RequirePage({ page, admin = false, children }) {
  const { can, isAdmin } = useAuth()
  const ok = admin ? isAdmin : can(page)
  if (!ok) return <Navigate to={firstAllowedPath(can, isAdmin)} replace />
  return children
}

function Home() {
  const { can, isAdmin } = useAuth()
  if (can('dashboard')) return <Dashboard />
  return <Navigate to={firstAllowedPath(can, isAdmin)} replace />
}

function CatchAll() {
  const { can, isAdmin } = useAuth()
  return <Navigate to={firstAllowedPath(can, isAdmin)} replace />
}

export default function App() {
  return (
    <ToastProvider>
      {/* Auth gate: everything below only renders with a valid session AND
          either an admin flag or an assigned role (see AuthContext) */}
      <AuthProvider loginScreen={(props) => <Login {...props} />}>
      {/* Provider sits above the routes so uploads keep processing across navigation */}
      <UploadQueueProvider>
        <TopProgress />
        <div className="shell">
          <Sidebar />
          <main className="content">
            <Routes>
              <Route path="/" element={<Home />} />
              {/* the Projects list page is retired: the Registry's sheet
                  tabs are the project navigation now */}
              <Route path="/projects" element={<Navigate to="/registry" replace />} />
              <Route path="/projects/:projectId" element={<RequirePage page="numberbook"><ProjectDetail /></RequirePage>} />
              <Route path="/drawings/:drawingId" element={<RequirePage page="numberbook"><DrawingDetail /></RequirePage>} />
              <Route path="/files" element={<Navigate to="/registry" replace />} />
              <Route path="/upload" element={<RequirePage page="upload"><Upload /></RequirePage>} />
              <Route path="/registry" element={<RequirePage page="numberbook"><Registry /></RequirePage>} />
              <Route path="/registry/deleted" element={<RequirePage page="numberbook"><DeletedRegistry /></RequirePage>} />
              <Route path="/documents" element={<RequirePage page="documents"><Documents /></RequirePage>} />
              <Route path="/documents/:fileId" element={<RequirePage page="documents"><DocumentDetail /></RequirePage>} />
              <Route path="/chat" element={<RequirePage page="chat"><Chat /></RequirePage>} />
              <Route path="/users" element={<RequirePage admin><Users /></RequirePage>} />
              <Route path="/roles" element={<RequirePage admin><Roles /></RequirePage>} />
              <Route path="*" element={<CatchAll />} />
            </Routes>
          </main>
        </div>
        <UploadIndicator />
      </UploadQueueProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
