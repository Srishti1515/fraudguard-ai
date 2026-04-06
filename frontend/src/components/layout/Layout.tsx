import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../hooks/useAuthStore'
import {
  LayoutDashboard, Send, CreditCard, Clock, User, ShieldAlert,
  LogOut, Shield, Bell
} from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transaction', icon: Send,             label: 'New Transaction' },
  { to: '/accounts',    icon: CreditCard,       label: 'Bank Accounts' },
  { to: '/history',     icon: Clock,            label: 'History' },
  { to: '/profile',     icon: User,             label: 'Profile' },
]

export default function Layout() {
  const { fullName, isAdmin, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-glow-indigo">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">FraudGuard</p>
              <p className="text-xs text-slate-400">AI Security</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}

          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mt-2',
                isActive
                  ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              )}
            >
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              Admin Panel
            </NavLink>
          )}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-brand-600/30 border border-brand-600/50 flex items-center justify-center">
              <span className="text-xs font-bold text-brand-400">
                {fullName?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{fullName}</p>
              <p className="text-xs text-slate-500">{isAdmin ? 'Administrator' : 'User'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400
                       hover:bg-red-500/10 hover:text-red-400 transition-all duration-150"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-8 py-4 flex items-center justify-between">
          <div />
          <button className="relative p-2 rounded-lg hover:bg-slate-800 transition-colors">
            <Bell className="w-5 h-5 text-slate-400" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </header>

        <div className="px-8 py-6 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
