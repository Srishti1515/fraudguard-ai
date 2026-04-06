import { useEffect, useState } from 'react'
import { CreditCard, Plus, Trash2, Wallet, Building2, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../utils/api'
import clsx from 'clsx'

interface Account {
  id: number; bank_name: string; account_number: string
  full_account_number: string; ifsc_code: string
  account_type: string; balance: number; is_primary: boolean
}

// 30+ real Indian banks with IFSC prefixes and branch info
const INDIAN_BANKS = [
  { name: 'State Bank of India',          ifsc: 'SBIN0001234', logo: '🏦' },
  { name: 'HDFC Bank',                    ifsc: 'HDFC0001234', logo: '🟦' },
  { name: 'ICICI Bank',                   ifsc: 'ICIC0001234', logo: '🔴' },
  { name: 'Axis Bank',                    ifsc: 'UTIB0001234', logo: '🟣' },
  { name: 'Kotak Mahindra Bank',          ifsc: 'KKBK0001234', logo: '🔴' },
  { name: 'Punjab National Bank',         ifsc: 'PUNB0001234', logo: '🟠' },
  { name: 'Bank of Baroda',               ifsc: 'BARB0001234', logo: '🟡' },
  { name: 'Canara Bank',                  ifsc: 'CNRB0001234', logo: '🟢' },
  { name: 'Union Bank of India',          ifsc: 'UBIN0001234', logo: '🔵' },
  { name: 'Bank of India',                ifsc: 'BKID0001234', logo: '⭐' },
  { name: 'Indian Bank',                  ifsc: 'IDIB0001234', logo: '🏛️' },
  { name: 'Central Bank of India',        ifsc: 'CBIN0001234', logo: '🌟' },
  { name: 'Indian Overseas Bank',         ifsc: 'IOBA0001234', logo: '🌐' },
  { name: 'UCO Bank',                     ifsc: 'UCBA0001234', logo: '🔷' },
  { name: 'Bank of Maharashtra',          ifsc: 'MAHB0001234', logo: '🟧' },
  { name: 'Yes Bank',                     ifsc: 'YESB0001234', logo: '✅' },
  { name: 'IndusInd Bank',               ifsc: 'INDB0001234', logo: '💎' },
  { name: 'IDFC First Bank',              ifsc: 'IDFB0001234', logo: '🔶' },
  { name: 'Federal Bank',                 ifsc: 'FDRL0001234', logo: '🏦' },
  { name: 'RBL Bank',                     ifsc: 'RATN0001234', logo: '💠' },
  { name: 'South Indian Bank',            ifsc: 'SIBL0001234', logo: '🌴' },
  { name: 'Karnataka Bank',               ifsc: 'KARB0001234', logo: '🌿' },
  { name: 'City Union Bank',              ifsc: 'CIUB0001234', logo: '🏙️' },
  { name: 'Dhanlaxmi Bank',               ifsc: 'DLXB0001234', logo: '🌸' },
  { name: 'Karur Vysya Bank',             ifsc: 'KVBL0001234', logo: '🟤' },
  { name: 'Tamilnad Mercantile Bank',     ifsc: 'TMBL0001234', logo: '🌊' },
  { name: 'Nainital Bank',                ifsc: 'NTBL0001234', logo: '🏔️' },
  { name: 'Saraswat Bank',                ifsc: 'SRCB0001234', logo: '📚' },
  { name: 'Paytm Payments Bank',          ifsc: 'PYTM0001234', logo: '💙' },
  { name: 'Airtel Payments Bank',         ifsc: 'AIRP0001234', logo: '📶' },
  { name: 'Fino Payments Bank',           ifsc: 'FINO0001234', logo: '🔗' },
  { name: 'NSDL Payments Bank',           ifsc: 'NSPB0001234', logo: '🏛️' },
  { name: 'Jana Small Finance Bank',      ifsc: 'JSFB0001234', logo: '🌱' },
  { name: 'AU Small Finance Bank',        ifsc: 'AUBL0001234', logo: '🌻' },
  { name: 'Ujjivan Small Finance Bank',   ifsc: 'UJVN0001234', logo: '🌼' },
  { name: 'Equitas Small Finance Bank',   ifsc: 'ESFB0001234', logo: '⚖️' },
  { name: 'ESAF Small Finance Bank',      ifsc: 'ESAF0001234', logo: '🌿' },
  { name: 'Other / Co-operative Bank',    ifsc: '',            logo: '🏦' },
]

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [topUpId, setTopUpId]   = useState<number | null>(null)
  const [topUpAmt, setTopUpAmt] = useState('')
  const [bankSearch, setBankSearch] = useState('')
  const [showBankDrop, setShowBankDrop] = useState(false)

  const [form, setForm] = useState({
    account_number:  '',
    ifsc_code:       '',
    bank_name:       '',
    account_type:    'savings',
    initial_balance: '100000',
  })

  const load = () =>
    api.get('/accounts/my-accounts')
      .then(r => setAccounts(r.data))
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  // Filter banks by search
  const filteredBanks = INDIAN_BANKS.filter(b =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  )

  const selectBank = (bank: typeof INDIAN_BANKS[0]) => {
    setForm(f => ({
      ...f,
      bank_name: bank.name,
      ifsc_code: bank.ifsc,
    }))
    setBankSearch(bank.name)
    setShowBankDrop(false)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.bank_name) { toast.error('Please select a bank'); return }
    try {
      await api.post('/accounts/link', {
        account_number:  form.account_number,
        ifsc_code:       form.ifsc_code,
        bank_name:       form.bank_name,
        account_type:    form.account_type,
        initial_balance: parseFloat(form.initial_balance),
      })
      toast.success('Account linked successfully!')
      setShowForm(false)
      setBankSearch('')
      setForm({ account_number: '', ifsc_code: '', bank_name: '', account_type: 'savings', initial_balance: '100000' })
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to link account')
    }
  }

  const handleTopUp = async (id: number) => {
    if (!topUpAmt) return
    try {
      await api.post('/accounts/topup', { account_id: id, amount: parseFloat(topUpAmt) })
      toast.success('Balance updated!')
      setTopUpId(null); setTopUpAmt(''); load()
    } catch { toast.error('Top-up failed') }
  }

  const handleRemove = async (id: number) => {
    if (!confirm('Remove this account?')) return
    await api.delete(`/accounts/${id}`)
    toast.success('Account removed')
    load()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bank Accounts</h1>
          <p className="text-slate-400 mt-1 text-sm">Manage your linked accounts</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Link Account
        </button>
      </div>

      {/* Link account form */}
      {showForm && (
        <div className="card p-6 border-brand-600/30 bg-brand-600/5 animate-slide-up">
          <div className="flex items-center gap-2 mb-5">
            <Building2 className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-semibold text-slate-200">Link New Bank Account</h3>
          </div>

          <form onSubmit={handleAdd} className="space-y-4">
            {/* Bank selector with search dropdown */}
            <div className="relative">
              <label className="label">Bank Name</label>
              <div className="relative">
                <input
                  className="input pr-8"
                  placeholder="Search bank name (e.g. HDFC, SBI, ICICI)..."
                  value={bankSearch}
                  onChange={e => { setBankSearch(e.target.value); setShowBankDrop(true) }}
                  onFocus={() => setShowBankDrop(true)}
                  required
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>

              {showBankDrop && (
                <div className="absolute z-50 top-full mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                  {filteredBanks.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-500">No banks found</div>
                  ) : filteredBanks.map(bank => (
                    <button
                      key={bank.name}
                      type="button"
                      onClick={() => selectBank(bank)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800 transition-colors text-left"
                    >
                      <span className="text-lg leading-none">{bank.logo}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 font-medium truncate">{bank.name}</p>
                        {bank.ifsc && (
                          <p className="text-xs text-slate-500 font-mono">{bank.ifsc.slice(0, 4)}XXXXXXX</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Click outside to close dropdown */}
            {showBankDrop && (
              <div className="fixed inset-0 z-40" onClick={() => setShowBankDrop(false)} />
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Account Number</label>
                <input className="input font-mono" placeholder="12-16 digit number"
                  value={form.account_number}
                  onChange={e => setForm(f => ({ ...f, account_number: e.target.value.replace(/\D/g, '') }))}
                  maxLength={18} required />
              </div>
              <div>
                <label className="label">IFSC Code</label>
                <input className="input font-mono uppercase" placeholder="e.g. HDFC0001234"
                  value={form.ifsc_code}
                  onChange={e => setForm(f => ({ ...f, ifsc_code: e.target.value.toUpperCase() }))}
                  maxLength={11} required />
                <p className="text-xs text-slate-500 mt-1">Auto-filled from bank selection</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Account Type</label>
                <select className="input" value={form.account_type}
                  onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}>
                  <option value="savings">Savings Account</option>
                  <option value="current">Current Account</option>
                </select>
              </div>
              <div>
                <label className="label">Initial Balance (₹)</label>
                <input type="number" className="input" value={form.initial_balance}
                  onChange={e => setForm(f => ({ ...f, initial_balance: e.target.value }))}
                  min="0" step="1000" />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="submit" className="btn-primary flex-1">Link Account</button>
              <button type="button" onClick={() => { setShowForm(false); setBankSearch('') }} className="btn-ghost flex-1">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Account list */}
      <div className="space-y-4">
        {accounts.length === 0 && (
          <div className="card p-12 text-center">
            <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No accounts linked yet</p>
            <p className="text-slate-500 text-sm mt-1">Click "Link Account" to add your first bank account</p>
          </div>
        )}

        {accounts.map(acc => {
          const bank = INDIAN_BANKS.find(b => b.name === acc.bank_name)
          return (
            <div key={acc.id} className={clsx('card p-5', {
              'border-brand-600/40 bg-brand-600/5': acc.is_primary,
            })}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-2xl">
                    {bank?.logo ?? '🏦'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-white">{acc.bank_name}</p>
                      {acc.is_primary && (
                        <span className="text-xs bg-brand-600/20 text-brand-400 border border-brand-600/30 px-2 py-0.5 rounded-full">Primary</span>
                      )}
                      <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full capitalize">{acc.account_type}</span>
                    </div>
                    <p className="text-sm text-slate-400 font-mono mt-0.5">{acc.account_number}</p>
                    <p className="text-xs text-slate-500">IFSC: {acc.ifsc_code}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-white">
                    ₹{acc.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Available Balance</p>
                </div>
              </div>

              {/* Balance bar */}
              <div className="mt-3 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full"
                  style={{ width: `${Math.min((acc.balance / 500000) * 100, 100)}%` }}
                />
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800">
                {topUpId === acc.id ? (
                  <div className="flex gap-2 flex-1">
                    <input type="number" className="input flex-1" placeholder="Amount to add (₹)"
                      value={topUpAmt} onChange={e => setTopUpAmt(e.target.value)} autoFocus step="1000" />
                    <button onClick={() => handleTopUp(acc.id)} className="btn-primary px-4">Add</button>
                    <button onClick={() => setTopUpId(null)} className="btn-ghost px-4">✕</button>
                  </div>
                ) : (
                  <>
                    <button onClick={() => setTopUpId(acc.id)}
                      className="btn-ghost flex items-center gap-2 text-sm flex-1 justify-center">
                      <Wallet className="w-4 h-4" /> Top Up Balance
                    </button>
                    <button onClick={() => handleRemove(acc.id)}
                      className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      title="Remove account">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
