import { useEffect, useState } from 'react'
import { User, Bell, Shield, Loader2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../utils/api'
import RiskMeter from '../components/dashboard/RiskMeter'

interface Profile {
  id: number; full_name: string; email: string; phone_number: string
  address: string; transaction_count: number; avg_transaction_amount: number
  risk_profile_score: number; created_at: string
}

interface Alert { id: number; alert_type: string; message: string; is_resolved: boolean; created_at: string }

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [alerts, setAlerts]   = useState<Alert[]>([])
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({ full_name: '', phone_number: '', address: '' })

  useEffect(() => {
    Promise.all([api.get('/users/me'), api.get('/users/alerts')]).then(([p, a]) => {
      setProfile(p.data)
      setAlerts(a.data)
      setForm({ full_name: p.data.full_name, phone_number: p.data.phone_number, address: p.data.address || '' })
    })
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put('/users/me', form)
      toast.success('Profile updated!')
      setEditing(false)
      setProfile(p => p ? { ...p, ...form } : p)
    } catch { toast.error('Update failed') }
    finally { setSaving(false) }
  }

  if (!profile) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">My Profile</h1>
        <p className="text-slate-400 mt-1 text-sm">Manage your account and view security status</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Profile card */}
        <div className="col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-brand-600/20 border border-brand-600/40 flex items-center justify-center">
                <span className="text-2xl font-bold text-brand-400">{profile.full_name.charAt(0)}</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{profile.full_name}</h2>
                <p className="text-sm text-slate-400">{profile.email}</p>
                <p className="text-xs text-slate-500 mt-0.5">Member since {new Date(profile.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <button onClick={() => setEditing(!editing)} className="btn-ghost text-sm">
              {editing ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>

          {editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div><label className="label">Full Name</label><input className="input" value={form.full_name} onChange={e => setForm(f => ({...f, full_name: e.target.value}))} /></div>
              <div><label className="label">Phone Number</label><input className="input" value={form.phone_number} onChange={e => setForm(f => ({...f, phone_number: e.target.value}))} /></div>
              <div><label className="label">Address</label><input className="input" value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} /></div>
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              {[
                ['Email', profile.email],
                ['Phone', profile.phone_number],
                ['Address', profile.address || 'Not set'],
                ['Transactions', profile.transaction_count.toString()],
                ['Avg Transaction', `₹${(profile.avg_transaction_amount || 0).toLocaleString('en-IN', {maximumFractionDigits: 0})}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-slate-800 last:border-0">
                  <span className="text-sm text-slate-400">{k}</span>
                  <span className="text-sm text-slate-200 font-medium">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Risk profile */}
        <div className="card p-6 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-4 self-start">
            <Shield className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-semibold text-slate-300">Behavioral Risk Profile</h3>
          </div>
          <RiskMeter score={(profile.risk_profile_score || 0) * 100} size="lg" />
          <p className="text-xs text-slate-500 text-center mt-4">
            Score based on your transaction history, fraud flags, and account behavior
          </p>
        </div>
      </div>

      {/* Fraud Alerts */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-300">Recent Security Alerts</h3>
          <span className="ml-auto text-xs text-slate-500">{alerts.length} alerts</span>
        </div>
        <div className="space-y-2">
          {alerts.length === 0 && <p className="text-sm text-slate-500 text-center py-6">No alerts — your account looks clean ✅</p>}
          {alerts.map(a => (
            <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <Bell className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200">{a.message}</p>
                <p className="text-xs text-slate-500 mt-0.5">{new Date(a.created_at).toLocaleString()}</p>
              </div>
              {a.is_resolved && <span className="text-xs text-emerald-400 flex-shrink-0">Resolved</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
