import { Route, Routes } from 'react-router-dom'
import './App.css'
import Sidebar from './components/Sidebar'
import { ToastProvider } from './components/Toast'
import UploadIndicator from './components/UploadIndicator'
import { AuthProvider } from './context/AuthContext'
import { UploadQueueProvider } from './context/UploadQueueContext'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Dashboard from './pages/Dashboard'
import DocumentDetail from './pages/DocumentDetail'
import Documents from './pages/Documents'
import DrawingDetail from './pages/DrawingDetail'
import Files from './pages/Files'
import ProjectDetail from './pages/ProjectDetail'
import Projects from './pages/Projects'
import Upload from './pages/Upload'

export default function App() {
  return (
    <ToastProvider>
      {/* Auth gate: everything below only renders with a valid session */}
      <AuthProvider loginScreen={(props) => <Login {...props} />}>
      {/* Provider sits above the routes so uploads keep processing across navigation */}
      <UploadQueueProvider>
        <div className="shell">
          <Sidebar />
          <main className="content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:projectId" element={<ProjectDetail />} />
              <Route path="/drawings/:drawingId" element={<DrawingDetail />} />
              <Route path="/files" element={<Files />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/documents/:fileId" element={<DocumentDetail />} />
              <Route path="/chat" element={<Chat />} />
            </Routes>
          </main>
        </div>
        <UploadIndicator />
      </UploadQueueProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
