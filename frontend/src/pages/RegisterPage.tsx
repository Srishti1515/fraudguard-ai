import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../utils/api'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [form, setForm] = useState({
    full_name: '', email: '', phone_number: '', address: '', password: '', confirm: ''
  })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setErrorMsg(null)
    setForm(f => ({ ...f, [k]: e.target.value }))
  }

  // Normalise phone: strip spaces/dashes, ensure +91 prefix for Indian numbers
  const normalizePhone = (raw: string): string => {
    const digits = raw.replace(/[\s\-().+]/g, '')
    if (digits.length === 10) return `+91${digits}`
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
    return raw.trim()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (form.password !== form.confirm) {
      setErrorMsg('Passwords do not match')
      return
    }
    if (form.password.length < 8) {
      setErrorMsg('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/register', {
        full_name:    form.full_name.trim(),
        email:        form.email.trim().toLowerCase(),
        phone_number: normalizePhone(form.phone_number),
        address:      form.address.trim(),
        password:     form.password,
      })
      toast.success('Account created! Please sign in.')
      navigate('/login')
    } catch (err: any) {
      const data = err.response?.data

      // Log full error to console for debugging
      console.error('Registration error:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      })

      // No response at all — backend not reachable
      if (!err.response) {
        setErrorMsg('Cannot reach server — make sure the backend is running on port 8000')
        return
      }

      // Pydantic v2 validation errors: detail is an array of {loc, msg, type}
      if (Array.isArray(data?.detail)) {
        const messages = data.detail
          .map((e: any) => {
            const field = e.loc?.slice(1).join(' → ') || ''
            return field ? `${field}: ${e.msg}` : e.msg
          })
          .join('\n')
        setErrorMsg(messages || 'Validation error — check your inputs')
        return
      }

      // Standard string detail
      if (data?.detail) {
        setErrorMsg(data.detail)
        return
      }

      // Fallback: show the raw response so we can debug it
      setErrorMsg(
        `HTTP ${err.response.status} — ${JSON.stringify(data || err.message)}`
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-80 h-80 bg-brand-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="w-full max-w-lg relative z-10 animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-600 rounded-2xl shadow-glow-indigo mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-slate-400 mt-1 text-sm">Start protecting your finances</p>
        </div>

        <div className="card p-8">
          {/* Inline error box — shows the exact server error */}
          {errorMsg && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300 whitespace-pre-line">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Full Name</label>
                <input className="input" placeholder="John Doe"
                  value={form.full_name} onChange={set('full_name')} required />
              </div>
              <div className="col-span-2">
                <label className="label">Email Address</label>
                <input type="email" className="input" placeholder="you@gmail.com or you@example.com"
                  value={form.email} onChange={set('email')} required />
              </div>
              <div className="col-span-2">
                <label className="label">Phone Number</label>
                <input className="input" placeholder="9876543210 or +91 98765 43210"
                  value={form.phone_number} onChange={set('phone_number')} required />
                <p className="text-xs text-slate-500 mt-1">10-digit number — +91 prefix added automatically</p>
              </div>
              <div className="col-span-2">
                <label className="label">Address (optional)</label>
                <input className="input" placeholder="Your city, state"
                  value={form.address} onChange={set('address')} />
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" placeholder="Min 8 characters"
                  value={form.password} onChange={set('password')} minLength={8} maxLength={72} required />
                <p className="text-xs text-slate-500 mt-1">8–72 characters</p>
              </div>
              <div>
                <label className="label">Confirm Password</label>
                <input type="password" className="input" placeholder="Repeat password"
                  value={form.confirm} onChange={set('confirm')} maxLength={72} required />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}