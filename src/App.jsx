import { Route, Routes } from 'react-router-dom'
import './App.css'
import Sidebar from './components/Sidebar'
import { ToastProvider } from './components/Toast'
import TopProgress from './components/TopProgress'
import UploadIndicator from './components/UploadIndicator'
import { AuthProvider } from './context/AuthContext'
import { UploadQueueProvider } from './context/UploadQueueContext'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Dashboard from './pages/Dashboard'
import DocumentDetail from './pages/DocumentDetail'
import Documents from './pages/Documents'
import DrawingDetail from './pages/DrawingDetail'
import { Navigate } from 'react-router-dom'
import ProjectDetail from './pages/ProjectDetail'
import Registry from './pages/Registry'
import DeletedRegistry from './pages/DeletedRegistry'
import Upload from './pages/Upload'
import Users from './pages/Users'

export default function App() {
  return (
    <ToastProvider>
      {/* Auth gate: everything below only renders with a valid session */}
      <AuthProvider loginScreen={(props) => <Login {...props} />}>
      {/* Provider sits above the routes so uploads keep processing across navigation */}
      <UploadQueueProvider>
        <TopProgress />
        <div className="shell">
          <Sidebar />
          <main className="content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              {/* the Projects list page is retired: the Registry's sheet
                  tabs are the project navigation now */}
              <Route path="/projects" element={<Navigate to="/registry" replace />} />
              <Route path="/projects/:projectId" element={<ProjectDetail />} />
              <Route path="/drawings/:drawingId" element={<DrawingDetail />} />
              <Route path="/files" element={<Navigate to="/registry" replace />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/registry" element={<Registry />} />
              <Route path="/registry/deleted" element={<DeletedRegistry />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/documents/:fileId" element={<DocumentDetail />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/users" element={<Users />} />
            </Routes>
          </main>
        </div>
        <UploadIndicator />
      </UploadQueueProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
