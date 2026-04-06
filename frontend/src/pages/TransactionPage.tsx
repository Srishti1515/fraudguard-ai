import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, ShieldCheck, ShieldX, AlertTriangle,
  Loader2, KeyRound, RefreshCw, Activity, Info
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../utils/api'
import RiskMeter from '../components/dashboard/RiskMeter'
import clsx from 'clsx'

interface Account { id: number; bank_name: string; account_number: string; account_type: string; balance: number }
interface TxResult {
  status: 'approved' | 'otp_required'; transaction_id: number; transaction_ref: string
  risk_score: number; risk_level: string; message: string
  explanation: { risk_score: number; top_factors: Array<{ factor: string; detail: string; impact: string }>; model: string; ml_active: boolean }
  new_balance?: number; otp_expires_in_seconds?: number
}
interface ModelStatus { ml_model_active: boolean; load_status: string; feature_count: number | null }

const CATEGORIES = [
  'general','groceries','electronics','travel','dining',
  'healthcare','clothing','entertainment','gambling','crypto',
  'jewelry','wire_transfer','utilities','education',
]

// V14 and V17 realistic fraud signals per category/location combo
// These are actual PCA values seen in fraud rows of the Kaggle dataset
function getSmartDefaults(category: string, location: string): { V14: number; V17: number } {
  const highRiskCat  = ['crypto', 'gambling', 'wire_transfer', 'jewelry']
  const medRiskCat   = ['electronics', 'travel']
  const foreignLoc   = ['foreign', 'unknown']
  const isHighCat    = highRiskCat.includes(category)
  const isMedCat     = medRiskCat.includes(category)
  const isForeign    = foreignLoc.includes(location)

  if (isHighCat && isForeign)   return { V14: -14.0, V17: -10.0 }  // very high fraud signal
  if (isHighCat)                return { V14: -10.0, V17: -7.0  }  // high fraud signal
  if (isMedCat && isForeign)    return { V14: -6.0,  V17: -5.0  }  // medium-high
  if (isForeign)                return { V14: -4.0,  V17: -3.0  }  // medium
  if (isMedCat)                 return { V14: -2.0,  V17: -1.5  }  // slightly elevated
  return { V14: 0.5, V17: 0.3 }                                    // normal/legitimate range
}

export default function TransactionPage() {
  const [accounts, setAccounts]     = useState<Account[]>([])
  const [loading, setLoading]       = useState(false)
  const [result, setResult]         = useState<TxResult | null>(null)
  const [otp, setOtp]               = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpResult, setOtpResult]   = useState<{ status: string; message: string; new_balance?: number } | null>(null)
  const [countdown, setCountdown]   = useState(0)
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null)
  const [showVInfo, setShowVInfo]   = useState(false)

  const [form, setForm] = useState({
    account_id: '', amount: '', merchant: '',
    merchant_category: 'general', location: 'local', description: '',
  })
  // V14 and V17 are managed separately — auto-updated when category/location changes
  const [V14, setV14] = useState(0.5)
  const [V17, setV17] = useState(0.3)

  // Auto-update V14/V17 whenever category or location changes
  const updateSmartDefaults = useCallback((category: string, location: string) => {
    const defaults = getSmartDefaults(category, location)
    setV14(defaults.V14)
    setV17(defaults.V17)
  }, [])

  useEffect(() => {
    api.get('/accounts/my-accounts').then(r => setAccounts(r.data))
    api.get('/transactions/model-status').then(r => setModelStatus(r.data)).catch(() => {})
  }, [])

  // Countdown for OTP expiry
  useEffect(() => {
    if (!result || result.status !== 'otp_required') return
    setCountdown(result.otp_expires_in_seconds || 300)
    const iv = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(iv); return 0 } return c - 1 }), 1000)
    return () => clearInterval(iv)
  }, [result])

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCat = e.target.value
    setForm(f => ({ ...f, merchant_category: newCat }))
    updateSmartDefaults(newCat, form.location)
  }

  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLoc = e.target.value
    setForm(f => ({ ...f, location: newLoc }))
    updateSmartDefaults(form.merchant_category, newLoc)
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.account_id) { toast.error('Please select a bank account'); return }
    setLoading(true); setResult(null)
    try {
      const { data } = await api.post('/transactions/initiate', {
        account_id:        parseInt(form.account_id),
        amount:            parseFloat(form.amount),
        merchant:          form.merchant,
        merchant_category: form.merchant_category,
        location:          form.location,
        description:       form.description,
        V14, V17,  // smart defaults — set automatically from category + location
      })
      setResult(data)
      if (data.status === 'approved') {
        toast.success('Transaction approved!')
        // Immediately update balance in state so UI reflects new_balance instantly
        if (data.new_balance !== undefined) {
          setAccounts(prev => prev.map(a =>
            a.id === parseInt(form.account_id)
              ? { ...a, balance: data.new_balance }
              : a
          ))
        }
        // Also refetch from server to stay in sync
        api.get('/accounts/my-accounts').then(r => setAccounts(r.data))
      } else {
        toast('OTP required — check your email/phone for the OTP code', { icon: '📲' })
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Transaction failed')
    } finally { setLoading(false) }
  }

  const handleOtpVerify = async () => {
    if (!result || otp.length !== 6) { toast.error('Enter 6-digit OTP'); return }
    setOtpLoading(true)
    try {
      const { data } = await api.post('/transactions/verify-otp', { transaction_id: result.transaction_id, otp })
      setOtpResult(data)
      toast.success('Transaction approved via OTP!')
      // Immediately update balance in state so UI reflects deduction instantly
      if (data.new_balance !== undefined) {
        setAccounts(prev => prev.map(a =>
          a.id === parseInt(form.account_id)
            ? { ...a, balance: data.new_balance }
            : a
        ))
      }
      // Also refetch from server to stay in sync
      api.get('/accounts/my-accounts').then(r => setAccounts(r.data))
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'OTP failed')
      setOtpResult({ status: 'blocked', message: err.response?.data?.detail || 'Blocked' })
    } finally { setOtpLoading(false) }
  }

  const reset = () => {
    setResult(null); setOtpResult(null); setOtp(''); setCountdown(0)
    setForm(f => ({ ...f, amount: '', merchant: '', description: '' }))
    const d = getSmartDefaults(form.merchant_category, form.location)
    setV14(d.V14); setV17(d.V17)
  }

  const selectedAccount = accounts.find(a => a.id === parseInt(form.account_id))
  const riskLevel = V14 < -8 || V17 < -6 ? 'high' : V14 < -3 || V17 < -2 ? 'medium' : 'low'

  return (
    <div className="max-w-4xl space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">New Transaction</h1>
        <p className="text-slate-400 mt-1 text-sm">Real-time fraud detection — ML signals auto-calibrate to your inputs</p>
      </div>

      {/* Model status banner */}
      {modelStatus && (
        <div className={clsx('flex items-center gap-3 px-4 py-3 rounded-xl border text-sm', {
          'bg-emerald-500/10 border-emerald-500/30 text-emerald-300': modelStatus.ml_model_active,
          'bg-amber-500/10  border-amber-500/30  text-amber-300':    !modelStatus.ml_model_active,
        })}>
          <Activity className="w-4 h-4 flex-shrink-0" />
          {modelStatus.ml_model_active
            ? `✅ ML Model Active — Hybrid RF+XGBoost (${modelStatus.feature_count} features) — Risk signals auto-calibrated per transaction`
            : `⚠️ Rule-based mode — run: python ml_pipeline/train_model.py --data ml_pipeline/creditcard.csv`}
        </div>
      )}

      <div className="grid grid-cols-5 gap-6">
        {/* Form */}
        <div className="col-span-3 card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Bank Account</label>
              <select className="input" value={form.account_id}
                onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} required>
                <option value="">Select account...</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.bank_name} — {a.account_number} (₹{a.balance.toLocaleString()})
                  </option>
                ))}
              </select>
              {selectedAccount && (
                <p className="text-xs text-emerald-400 mt-1">
                  Available: ₹{selectedAccount.balance.toLocaleString()}
                </p>
              )}
            </div>

            <div>
              <label className="label">Amount (₹)</label>
              <input type="number" className="input" placeholder="0.00"
                min="1" step="0.01" value={form.amount} onChange={set('amount')} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Merchant Name</label>
                <input className="input" placeholder="Amazon, HDFC ATM..."
                  value={form.merchant} onChange={set('merchant')} required />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.merchant_category} onChange={handleCategoryChange}>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Location</label>
              <select className="input" value={form.location} onChange={handleLocationChange}>
                <option value="local">Local (same city)</option>
                <option value="domestic">Domestic (different city)</option>
                <option value="foreign">Foreign / International</option>
                <option value="unknown">Unknown / VPN</option>
              </select>
            </div>

            <div>
              <label className="label">Description (optional)</label>
              <input className="input" placeholder="Grocery shopping, online purchase..."
                value={form.description} onChange={set('description')} />
            </div>

            {/* Auto-calibrated ML signals panel */}
            <div className={clsx('rounded-xl border p-4 space-y-3', {
              'border-red-500/30    bg-red-500/5':    riskLevel === 'high',
              'border-amber-500/30  bg-amber-500/5':  riskLevel === 'medium',
              'border-emerald-500/30 bg-emerald-500/5': riskLevel === 'low',
            })}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className={clsx('w-4 h-4', {
                    'text-red-400':    riskLevel === 'high',
                    'text-amber-400':  riskLevel === 'medium',
                    'text-emerald-400': riskLevel === 'low',
                  })} />
                  <span className="text-xs font-semibold text-slate-300">
                    ML Fraud Signals — Auto-calibrated from category + location
                  </span>
                </div>
                <button type="button" onClick={() => setShowVInfo(!showVInfo)}
                  className="text-slate-500 hover:text-slate-300">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>

              {showVInfo && (
                <div className="text-xs text-slate-400 bg-slate-800/60 rounded-lg p-3">
                  <b className="text-slate-300">What are V14 and V17?</b><br />
                  These are PCA-transformed features from the Kaggle credit card fraud dataset.
                  They are automatically set based on your category and location to reflect
                  realistic fraud patterns. Negative values indicate fraud-like patterns.
                  You do not need to change these.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs text-slate-400">V14 (Primary fraud signal)</label>
                    <span className={clsx('text-xs font-mono font-bold', {
                      'text-red-400':    V14 < -8,
                      'text-amber-400':  V14 < -2,
                      'text-emerald-400': V14 >= -2,
                    })}>{V14.toFixed(1)}</span>
                  </div>
                  <input type="range" min="-20" max="5" step="0.5"
                    value={V14} onChange={e => setV14(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500" />
                  <div className="flex justify-between text-xs text-slate-600 mt-0.5">
                    <span>Fraud (-20)</span><span>Normal (+5)</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs text-slate-400">V17 (Secondary fraud signal)</label>
                    <span className={clsx('text-xs font-mono font-bold', {
                      'text-red-400':    V17 < -5,
                      'text-amber-400':  V17 < -1.5,
                      'text-emerald-400': V17 >= -1.5,
                    })}>{V17.toFixed(1)}</span>
                  </div>
                  <input type="range" min="-15" max="5" step="0.5"
                    value={V17} onChange={e => setV17(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500" />
                  <div className="flex justify-between text-xs text-slate-600 mt-0.5">
                    <span>Fraud (-15)</span><span>Normal (+5)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className={clsx('w-2 h-2 rounded-full', {
                  'bg-red-400 animate-pulse': riskLevel === 'high',
                  'bg-amber-400':  riskLevel === 'medium',
                  'bg-emerald-400': riskLevel === 'low',
                })} />
                <span className="text-xs text-slate-400">
                  Pre-submission signal:
                  <span className={clsx('font-semibold ml-1', {
                    'text-red-400':    riskLevel === 'high',
                    'text-amber-400':  riskLevel === 'medium',
                    'text-emerald-400': riskLevel === 'low',
                  })}>
                    {riskLevel === 'high' ? 'HIGH — OTP will be required'
                     : riskLevel === 'medium' ? 'MEDIUM — may trigger OTP'
                     : 'LOW — likely auto-approved'}
                  </span>
                </span>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? 'Analyzing transaction...' : 'Submit Transaction'}
            </button>
          </form>
        </div>

        {/* Result panel */}
        <div className="col-span-2">
          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div key="placeholder"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="card p-6 h-full flex flex-col items-center justify-center text-center gap-3 min-h-[300px]">
                <div className="w-14 h-14 rounded-full bg-brand-600/10 border border-brand-600/30 flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7 text-brand-400" />
                </div>
                <p className="text-slate-300 font-medium">Submit a transaction</p>
                <p className="text-slate-500 text-sm">ML signals auto-calibrate based on your category and location selection</p>
                <div className="mt-3 w-full space-y-2 text-xs">
                  {[
                    ['Groceries + Local', 'V14=0.5 → Auto-approved', 'emerald'],
                    ['Electronics + Domestic', 'V14=-2 → Low-medium risk', 'amber'],
                    ['Crypto + Foreign', 'V14=-14 → OTP required', 'red'],
                  ].map(([label, desc, color]) => (
                    <div key={label} className={`flex justify-between px-3 py-2 rounded-lg bg-${color}-500/5 border border-${color}-500/20`}>
                      <span className="text-slate-400">{label}</span>
                      <span className={`text-${color}-400 font-mono`}>{desc}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div key="result"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-4">
                <div className={clsx('card p-5 border', {
                  'border-emerald-500/30 bg-emerald-500/5': result.risk_level === 'low',
                  'border-amber-500/30  bg-amber-500/5':    result.risk_level === 'medium',
                  'border-red-500/30    bg-red-500/5':      result.risk_level === 'high',
                })}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-300">Fraud Risk Analysis</h3>
                    {result.status === 'approved' && !otpResult && (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
                        <ShieldCheck className="w-3 h-3" /> Approved
                      </span>
                    )}
                    {result.status === 'otp_required' && !otpResult && (
                      <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-500/30">
                        <AlertTriangle className="w-3 h-3" /> OTP Required
                      </span>
                    )}
                  </div>
                  <div className="flex justify-center my-3">
                    <RiskMeter score={result.risk_score} size="md" />
                  </div>
                  <p className="text-xs text-slate-400 text-center">{result.explanation?.model}</p>
                  {result.status === 'approved' && result.new_balance !== undefined && (
                    <p className="text-xs text-emerald-400 text-center mt-2 font-medium">
                      ✓ New balance: ₹{result.new_balance.toLocaleString()}
                    </p>
                  )}
                </div>

                {result.explanation?.top_factors?.length > 0 && (
                  <div className="card p-4">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Risk Factors</h4>
                    <div className="space-y-2">
                      {result.explanation.top_factors.map((f, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className={clsx('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', {
                            'bg-red-400': f.impact === 'high', 'bg-amber-400': f.impact === 'medium', 'bg-slate-400': f.impact === 'low',
                          })} />
                          <div>
                            <p className="text-xs font-medium text-slate-300">{f.factor}</p>
                            <p className="text-xs text-slate-500">{f.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.status === 'otp_required' && !otpResult && (
                  <div className="card p-4 border-amber-500/30 bg-amber-500/5">
                    <div className="flex items-center gap-2 mb-2">
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <h4 className="text-sm font-semibold text-amber-300">Enter OTP</h4>
                      {countdown > 0 && (
                        <span className="ml-auto text-xs text-amber-400 font-mono">
                          {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-3">
                      OTP sent to your registered email/phone. Check your inbox or backend terminal (dev mode).
                    </p>
                    <div className="flex gap-2">
                      <input className="input font-mono text-center text-lg tracking-widest flex-1"
                        placeholder="000000" maxLength={6}
                        value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        disabled={countdown === 0} />
                      <button onClick={handleOtpVerify}
                        disabled={otpLoading || otp.length !== 6 || countdown === 0} className="btn-primary px-4">
                        {otpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                      </button>
                    </div>
                    {countdown === 0 && <p className="text-xs text-red-400 mt-2">OTP expired — submit a new transaction</p>}
                  </div>
                )}

                {otpResult && (
                  <div className={clsx('card p-4 border', {
                    'border-emerald-500/30 bg-emerald-500/5': otpResult.status === 'approved',
                    'border-red-500/30 bg-red-500/5': otpResult.status !== 'approved',
                  })}>
                    {otpResult.status === 'approved'
                      ? <div className="flex items-center gap-2 text-emerald-400"><ShieldCheck className="w-5 h-5" /><p className="text-sm font-medium">Approved!</p></div>
                      : <div className="flex items-center gap-2 text-red-400"><ShieldX className="w-5 h-5" /><p className="text-sm font-medium">Blocked</p></div>}
                    <p className="text-xs text-slate-400 mt-1">{otpResult.message}</p>
                    {otpResult.status === 'approved' && otpResult.new_balance !== undefined && (
                      <p className="text-xs text-emerald-400 mt-1 font-medium">
                        ✓ New balance: ₹{otpResult.new_balance.toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                <button onClick={reset} className="btn-ghost w-full flex items-center justify-center gap-2 text-sm">
                  <RefreshCw className="w-4 h-4" /> New Transaction
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}