import { useEffect, useState, useRef } from 'react'
import { useAuthStore } from '../hooks/useAuthStore'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Legend
} from 'recharts'
import {
  ShieldCheck, ShieldX, Activity, TrendingUp,
  CheckCircle2, XCircle, Brain, Target, Zap,
  BarChart2, AlertTriangle, Cpu
} from 'lucide-react'
import api from '../utils/api'
import clsx from 'clsx'

interface Stats {
  total_transactions: number; approved: number; blocked: number
  fraud_detected: number; fraud_rate: number
  total_approved_amount: number; avg_risk_score: number
  ml_model_active: boolean
  ml_metrics: {
    accuracy: number | null; precision: number | null
    recall: number | null; f1_score: number | null
    roc_auc: number | null; cv_roc_auc_mean: number | null
    total_training_samples: number | null; fraud_training_samples: number | null
    model_name: string; dataset: string; features_used: number | null
  }
}
interface TxRow {
  id: number; ref: string; amount: number; merchant: string
  status: string; risk_level: string | null; risk_score: number | null; created_at: string
}

const StatCard = ({ icon: Icon, label, value, sub, color = 'brand' }: any) => (
  <div className="card p-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={clsx('text-2xl font-bold mt-1', {
          'text-white': color === 'brand', 'text-emerald-400': color === 'success',
          'text-red-400': color === 'danger', 'text-amber-400': color === 'warning',
          'text-indigo-400': color === 'indigo',
        })}>{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', {
        'bg-brand-600/20': color === 'brand', 'bg-emerald-500/20': color === 'success',
        'bg-red-500/20': color === 'danger', 'bg-amber-500/20': color === 'warning',
        'bg-indigo-500/20': color === 'indigo',
      })}>
        <Icon className={clsx('w-5 h-5', {
          'text-brand-400': color === 'brand', 'text-emerald-400': color === 'success',
          'text-red-400': color === 'danger', 'text-amber-400': color === 'warning',
          'text-indigo-400': color === 'indigo',
        })} />
      </div>
    </div>
  </div>
)

// ML Metric gauge bar
const MetricBar = ({ label, value, color }: { label: string; value: number | null; color: string }) => {
  const pct = value !== null ? Math.round(value * 100) : null
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-400">{label}</span>
        <span className={clsx('text-sm font-bold font-mono', {
          'text-emerald-400': pct !== null && pct >= 95,
          'text-amber-400':   pct !== null && pct >= 85 && pct < 95,
          'text-red-400':     pct !== null && pct < 85,
          'text-slate-500':   pct === null,
        })}>
          {pct !== null ? `${pct.toFixed(2)}%` : 'N/A'}
        </span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-700', color)}
          style={{ width: pct !== null ? `${Math.min(pct, 100)}%` : '0%' }}
        />
      </div>
    </div>
  )
}

// ── UNIQUE FEATURE: Live Fraud Radar ──────────────────────────────────────────
// Animated radar that continuously sweeps and lights up risk zones in real time
function LiveFraudRadar({ transactions }: { transactions: TxRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)
  const angleRef  = useRef(0)

  // Build blips from recent transactions
  const blips = transactions.slice(0, 15).map((t, i) => {
    const angle  = (i / 15) * Math.PI * 2
    const risk   = t.risk_score ?? 20
    const radius = 0.3 + (risk / 100) * 0.65   // closer to edge = higher risk
    const color  = risk >= 60 ? '#ef4444' : risk >= 30 ? '#f59e0b' : '#22c55e'
    return { angle, radius, risk, color, merchant: t.merchant.slice(0, 10) }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width = 280
    const H = canvas.height = 280
    const cx = W / 2, cy = H / 2, R = 120

    const draw = () => {
      ctx.clearRect(0, 0, W, H)

      // Background rings
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1
      for (let r = 1; r <= 4; r++) {
        ctx.beginPath()
        ctx.arc(cx, cy, (R / 4) * r, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Cross-hairs
      ctx.strokeStyle = '#1e293b'
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke()

      // Sweep gradient
      const sweep = ctx.createConicalGradient
        ? null  // not all browsers support it
        : null
      const sweepAngle = angleRef.current
      const grad = ctx.createLinearGradient(cx, cy, cx + R, cy)
      grad.addColorStop(0, 'rgba(99,102,241,0.0)')
      grad.addColorStop(1, 'rgba(99,102,241,0.0)')

      // Draw sweep arc manually
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(sweepAngle)
      const sweepGrad = ctx.createLinearGradient(0, 0, R, 0)
      sweepGrad.addColorStop(0, 'rgba(99,102,241,0.5)')
      sweepGrad.addColorStop(1, 'rgba(99,102,241,0.0)')
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, R, -0.4, 0.05)
      ctx.closePath()
      ctx.fillStyle = sweepGrad
      ctx.fill()
      ctx.restore()

      // Sweep line
      ctx.strokeStyle = '#6366f1'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(sweepAngle) * R, cy + Math.sin(sweepAngle) * R)
      ctx.stroke()

      // Blips
      blips.forEach(b => {
        const bx = cx + Math.cos(b.angle) * b.radius * R
        const by = cy + Math.sin(b.angle) * b.radius * R
        // Fade based on how recently the sweep passed
        const angleDiff = ((sweepAngle - b.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
        const fade = angleDiff < Math.PI / 2 ? 1 - angleDiff / (Math.PI / 2) : 0

        if (fade > 0.05) {
          // Outer glow
          const glowGrad = ctx.createRadialGradient(bx, by, 0, bx, by, 12)
          glowGrad.addColorStop(0, b.color + Math.round(fade * 180).toString(16).padStart(2, '0'))
          glowGrad.addColorStop(1, 'transparent')
          ctx.beginPath(); ctx.arc(bx, by, 12, 0, Math.PI * 2)
          ctx.fillStyle = glowGrad; ctx.fill()

          // Core dot
          ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2)
          ctx.fillStyle = b.color; ctx.globalAlpha = fade; ctx.fill()
          ctx.globalAlpha = 1
        }
      })

      // Center dot
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2)
      ctx.fillStyle = '#6366f1'; ctx.fill()

      // Ring labels
      ctx.fillStyle = '#475569'; ctx.font = '9px monospace'; ctx.textAlign = 'center'
      ctx.fillText('25%', cx + R * 0.25, cy - 3)
      ctx.fillText('50%', cx + R * 0.5,  cy - 3)
      ctx.fillText('75%', cx + R * 0.75, cy - 3)
      ctx.fillText('100%', cx + R,       cy - 3)

      angleRef.current += 0.015
      animRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [blips.length])

  const highCount  = blips.filter(b => b.risk >= 60).length
  const medCount   = blips.filter(b => b.risk >= 30 && b.risk < 60).length
  const lowCount   = blips.filter(b => b.risk < 30).length

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-slate-300">Live Fraud Radar</h3>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-xs text-slate-500">Scanning</span>
        </div>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Each blip = a transaction. Distance from center = risk score. Lights up as sweep passes.
      </p>
      <div className="flex justify-center">
        <canvas ref={canvasRef} className="rounded-xl" style={{ width: 280, height: 280 }} />
      </div>
      <div className="flex justify-center gap-4 mt-3">
        {[
          { label: `${highCount} High`, color: 'bg-red-400',    text: 'text-red-400'    },
          { label: `${medCount} Med`,  color: 'bg-amber-400',  text: 'text-amber-400'  },
          { label: `${lowCount} Low`,  color: 'bg-emerald-400',text: 'text-emerald-400' },
        ].map(({ label, color, text }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <span className={`text-xs font-medium ${text}`}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { fullName } = useAuthStore()
  const [stats, setStats]             = useState<Stats | null>(null)
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/transactions/stats'),
      api.get('/transactions/history?limit=30'),
    ]).then(([sRes, tRes]) => {
      setStats(sRes.data); setTransactions(tRes.data)
    }).finally(() => setLoading(false))
  }, [])

  const pieData = stats ? [
    { name: 'Approved', value: stats.approved },
    { name: 'Blocked',  value: stats.blocked  },
  ] : []

  const riskBarData = (() => {
    const counts = { low: 0, medium: 0, high: 0 }
    transactions.forEach(t => { if (t.risk_level) counts[t.risk_level as keyof typeof counts]++ })
    return [
      { name: 'Low',    value: counts.low,    fill: '#22c55e' },
      { name: 'Medium', value: counts.medium, fill: '#f59e0b' },
      { name: 'High',   value: counts.high,   fill: '#ef4444' },
    ]
  })()

  const areaData = (() => {
    const map: Record<string, { date: string; amount: number; fraud: number }> = {}
    transactions.forEach(t => {
      const d = t.created_at.slice(0, 10)
      if (!map[d]) map[d] = { date: d, amount: 0, fraud: 0 }
      if (t.status === 'approved') map[d].amount += t.amount
      if (t.risk_level === 'high')  map[d].fraud++
    })
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).slice(-7)
  })()

  // Radar chart data for ML model performance
  const m = stats?.ml_metrics
  const radarData = m ? [
    { metric: 'Accuracy',  value: m.accuracy  ? Math.round(m.accuracy  * 100) : 0 },
    { metric: 'Precision', value: m.precision ? Math.round(m.precision * 100) : 0 },
    { metric: 'Recall',    value: m.recall    ? Math.round(m.recall    * 100) : 0 },
    { metric: 'F1-Score',  value: m.f1_score  ? Math.round(m.f1_score  * 100) : 0 },
    { metric: 'ROC-AUC',   value: m.roc_auc   ? Math.round(m.roc_auc   * 100) : 0 },
    { metric: 'CV-AUC',    value: m.cv_roc_auc_mean ? Math.round(m.cv_roc_auc_mean * 100) : 0 },
  ] : []

  const tooltipStyle = { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Good {getGreeting()}, {fullName?.split(' ')[0]} 👋
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Fraud detection overview</p>
        </div>
        <div className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border', {
          'bg-emerald-500/10 border-emerald-500/30 text-emerald-400': stats?.ml_model_active,
          'bg-amber-500/10  border-amber-500/30  text-amber-400':    !stats?.ml_model_active,
        })}>
          <Cpu className="w-3.5 h-3.5" />
          {stats?.ml_model_active ? 'ML Model Active' : 'Rule-based Mode'}
        </div>
      </div>

      {/* Transaction stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Activity}    label="Total Transactions" value={stats?.total_transactions ?? 0} color="brand" />
        <StatCard icon={CheckCircle2} label="Approved"          value={stats?.approved ?? 0}           color="success" />
        <StatCard icon={XCircle}     label="Blocked"            value={stats?.blocked ?? 0}            color="danger" />
        <StatCard icon={ShieldX}     label="Fraud Detected"     value={`${stats?.fraud_rate ?? 0}%`}
                  sub={`${stats?.fraud_detected ?? 0} flagged`}                                        color="warning" />
      </div>

      {/* Row: area chart + fraud radar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 card p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Transaction Volume (Last 7 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={areaData}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fraudGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              <Area type="monotone" dataKey="amount" name="Approved (₹)" stroke="#6366f1" fill="url(#areaGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="fraud"  name="High Risk count" stroke="#ef4444" fill="url(#fraudGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Live Fraud Radar — unique feature */}
        <LiveFraudRadar transactions={transactions} />
      </div>

      {/* ML Model Performance Metrics — full section */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-5">
          <Brain className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-300">ML Model Performance Metrics</h3>
          {m?.model_name && (
            <span className="ml-auto text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-lg">{m.model_name}</span>
          )}
        </div>

        {(!m || !m.accuracy) ? (
          <div className="text-center py-8">
            <Brain className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium">Model not trained yet</p>
            <p className="text-slate-500 text-xs mt-1">
              Run: <span className="font-mono text-indigo-400">python ml_pipeline/train_model.py --data ml_pipeline/creditcard.csv</span>
            </p>
            <p className="text-slate-600 text-xs mt-1">Metrics will appear here after training completes</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            {/* Metric bars */}
            <div className="col-span-2 space-y-4">
              <MetricBar label="Accuracy"  value={m.accuracy}  color="bg-emerald-500" />
              <MetricBar label="Precision" value={m.precision} color="bg-indigo-500" />
              <MetricBar label="Recall"    value={m.recall}    color="bg-teal-500" />
              <MetricBar label="F1-Score"  value={m.f1_score}  color="bg-purple-500" />
              <MetricBar label="ROC-AUC"   value={m.roc_auc}   color="bg-amber-500" />
              <MetricBar label="CV ROC-AUC (5-fold)" value={m.cv_roc_auc_mean} color="bg-cyan-500" />

              {/* Dataset info */}
              {m.total_training_samples && (
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                  {[
                    ['Training Samples', m.total_training_samples?.toLocaleString()],
                    ['Fraud Samples',    m.fraud_training_samples?.toLocaleString()],
                    ['Features Used',   m.features_used?.toString()],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-slate-800/50 rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-400">{label}</p>
                      <p className="text-base font-bold text-white mt-1">{val ?? 'N/A'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Radar chart */}
            <div>
              <p className="text-xs text-slate-500 text-center mb-2">Performance radar</p>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#1e293b" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 9 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}%`]} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Bottom row: pie + bar + recent */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Transaction Status</h3>
          {stats && stats.total_transactions > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={68} paddingAngle={4} dataKey="value">
                  <Cell fill="#22c55e" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No data yet</div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Risk Level Distribution</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={riskBarData} barSize={28}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {riskBarData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Recent Transactions</h3>
          <div className="space-y-2">
            {transactions.slice(0, 5).map(tx => (
              <div key={tx.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', {
                    'bg-emerald-400': tx.status === 'approved',
                    'bg-red-400':     tx.status === 'blocked',
                    'bg-amber-400':   tx.status === 'otp_pending',
                    'bg-slate-400':   tx.status === 'pending',
                  })} />
                  <p className="text-xs font-medium text-slate-200 truncate max-w-[90px]">{tx.merchant}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-white">₹{tx.amount.toLocaleString()}</p>
                  {tx.risk_score != null && (
                    <p className={clsx('text-xs', {
                      'text-emerald-400': tx.risk_level === 'low',
                      'text-amber-400':   tx.risk_level === 'medium',
                      'text-red-400':     tx.risk_level === 'high',
                    })}>{tx.risk_score.toFixed(1)}%</p>
                  )}
                </div>
              </div>
            ))}
            {transactions.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-6">No transactions yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
}
