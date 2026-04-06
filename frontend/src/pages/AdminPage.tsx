import { useEffect, useState } from 'react'
import { Users, ShieldX, Activity, DollarSign, AlertTriangle, TrendingUp } from 'lucide-react'
import api from '../utils/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface AdminData {
  summary: {
    total_users: number; total_transactions: number; fraud_detected: number
    blocked_transactions: number; fraud_rate_pct: number
    total_volume_approved: number; high_risk_transactions: number
  }
  recent_fraud: Array<{
    id: number; ref: string; amount: number; merchant: string; risk_score: number; created_at: string
  }>
}

const StatCard = ({ icon: Icon, label, value, color = 'default' }: any) => (
  <div className="card p-5">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color === 'danger' ? 'text-red-400' : color === 'success' ? 'text-emerald-400' : color === 'warning' ? 'text-amber-400' : 'text-white'}`}>{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color === 'danger' ? 'bg-red-500/20' : color === 'success' ? 'bg-emerald-500/20' : color === 'warning' ? 'bg-amber-500/20' : 'bg-brand-600/20'}`}>
        <Icon className={`w-5 h-5 ${color === 'danger' ? 'text-red-400' : color === 'success' ? 'text-emerald-400' : color === 'warning' ? 'text-amber-400' : 'text-brand-400'}`} />
      </div>
    </div>
  </div>
)

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/dashboard').then(r => setData(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>

  if (!data) return <p className="text-slate-400">Failed to load admin data.</p>

  const s = data.summary

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-2 h-8 bg-red-500 rounded-full" />
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-slate-400 text-sm">System-wide fraud detection analytics</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}      label="Total Users"         value={s.total_users}                         />
        <StatCard icon={Activity}   label="Total Transactions"  value={s.total_transactions}                  />
        <StatCard icon={ShieldX}    label="Fraud Detected"      value={s.fraud_detected}       color="danger"  />
        <StatCard icon={AlertTriangle} label="Fraud Rate"       value={`${s.fraud_rate_pct}%`} color="warning" />
        <StatCard icon={DollarSign} label="Volume Approved"     value={`₹${(s.total_volume_approved/100000).toFixed(1)}L`} color="success" />
        <StatCard icon={ShieldX}    label="Blocked Transactions" value={s.blocked_transactions} color="danger" />
        <StatCard icon={TrendingUp} label="High Risk Flagged"    value={s.high_risk_transactions} color="warning" />
      </div>

      {/* Recent fraud table */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <ShieldX className="w-4 h-4 text-red-400" />
          Recent Fraud Detections
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-slate-800">{['Ref', 'Merchant', 'Amount', 'Risk Score', 'Detected At'].map(h => (
              <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-2">{h}</th>
            ))}</tr></thead>
            <tbody className="divide-y divide-slate-800">
              {data.recent_fraud.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-slate-500 text-sm">No fraud detected yet</td></tr>}
              {data.recent_fraud.map(f => (
                <tr key={f.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-3 py-3 font-mono text-xs text-slate-400">{f.ref}</td>
                  <td className="px-3 py-3 text-sm text-slate-200">{f.merchant}</td>
                  <td className="px-3 py-3 text-sm font-semibold text-white">₹{f.amount.toLocaleString()}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-12 bg-slate-700 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-red-500" style={{ width: `${Math.min(f.risk_score, 100)}%` }} />
                      </div>
                      <span className="text-xs text-red-400 font-medium">{f.risk_score.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-400">{new Date(f.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
