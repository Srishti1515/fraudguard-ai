import { useEffect, useState } from 'react'
import { Clock, ShieldCheck, ShieldX, AlertTriangle, Search } from 'lucide-react'
import api from '../utils/api'
import clsx from 'clsx'
import { format } from 'date-fns'

interface TxRow {
  id: number; ref: string; amount: number; merchant: string
  category: string; location: string; status: string
  risk_level: string | null; risk_score: number | null; created_at: string
}

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'approved') return <ShieldCheck className="w-4 h-4 text-emerald-400" />
  if (status === 'blocked')  return <ShieldX    className="w-4 h-4 text-red-400"     />
  return <AlertTriangle className="w-4 h-4 text-amber-400" />
}

export default function HistoryPage() {
  const [txns, setTxns]   = useState<TxRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]  = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    api.get('/transactions/history?limit=100')
      .then(r => setTxns(r.data))
      .finally(() => setLoading(false))
  }, [])

  const filtered = txns.filter(t => {
    const matchSearch = !filter || t.merchant.toLowerCase().includes(filter.toLowerCase()) || t.ref.toLowerCase().includes(filter.toLowerCase())
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    return matchSearch && matchStatus
  })

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Transaction History</h1>
        <p className="text-slate-400 mt-1 text-sm">{txns.length} total transactions</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search merchant, ref..." value={filter} onChange={e => setFilter(e.target.value)} />
        </div>
        {['all', 'approved', 'blocked', 'otp_pending', 'pending'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={clsx('px-3 py-2 rounded-xl text-xs font-medium border transition-all capitalize', {
              'bg-brand-600/20 text-brand-400 border-brand-600/30': statusFilter === s,
              'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600': statusFilter !== s,
            })}>
            {s === 'otp_pending' ? 'OTP Pending' : s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                {['Status', 'Ref', 'Merchant', 'Amount', 'Risk Score', 'Date'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500 text-sm">No transactions found</td></tr>
              )}
              {filtered.map(tx => (
                <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={tx.status} />
                      <span className={clsx('text-xs font-medium capitalize', {
                        'text-emerald-400': tx.status === 'approved',
                        'text-red-400':     tx.status === 'blocked',
                        'text-amber-400':   tx.status === 'otp_pending',
                        'text-slate-400':   tx.status === 'pending',
                      })}>{tx.status.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{tx.ref}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-200 font-medium">{tx.merchant}</p>
                    <p className="text-xs text-slate-500 capitalize">{tx.category}</p>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-white">₹{tx.amount.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    {tx.risk_score != null ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-[60px] bg-slate-700 rounded-full h-1.5">
                          <div className={clsx('h-1.5 rounded-full', {
                            'bg-emerald-400': tx.risk_score < 30,
                            'bg-amber-400':   tx.risk_score < 70,
                            'bg-red-400':     tx.risk_score >= 70,
                          })} style={{ width: `${tx.risk_score}%` }} />
                        </div>
                        <span className="text-xs text-slate-400">{tx.risk_score.toFixed(1)}%</span>
                      </div>
                    ) : <span className="text-slate-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {format(new Date(tx.created_at), 'MMM d, yyyy HH:mm')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
