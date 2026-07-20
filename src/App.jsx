import { Route, Routes } from 'react-router-dom'
import './App.css'
import Sidebar from './components/Sidebar'
import { ToastProvider } from './components/Toast'
import Chat from './pages/Chat'
import Dashboard from './pages/Dashboard'
import DocumentDetail from './pages/DocumentDetail'
import Documents from './pages/Documents'

export default function App() {
  return (
    <ToastProvider>
      <div className="shell">
        <Sidebar />
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/documents/:fileId" element={<DocumentDetail />} />
            <Route path="/chat" element={<Chat />} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  )
}
