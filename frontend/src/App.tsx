import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './hooks/useAuthStore'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import TransactionPage from './pages/TransactionPage'
import AccountsPage from './pages/AccountsPage'
import HistoryPage from './pages/HistoryPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"   element={<DashboardPage />} />
        <Route path="transaction" element={<TransactionPage />} />
        <Route path="accounts"    element={<AccountsPage />} />
        <Route path="history"     element={<HistoryPage />} />
        <Route path="profile"     element={<ProfilePage />} />
      </Route>
      <Route path="/admin" element={<AdminRoute><Layout /></AdminRoute>}>
        <Route index element={<AdminPage />} />
      </Route>
    </Routes>
  )
}
