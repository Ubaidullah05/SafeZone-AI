import { useEffect, useState } from 'react'
import { UserPlus, RefreshCw, ShieldCheck } from 'lucide-react'
import * as api from '../services/api'
import { useAuth } from '../auth/AuthContext'
import type { AuthUser, Role } from '../types'

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  OFFICIAL: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  VOLUNTEER: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
}

interface AccountForm {
  name: string
  email: string
  password: string
  role: Role
  department: string
  pin: string
}

const EMPTY_FORM: AccountForm = { name: '', email: '', password: '', role: 'OFFICIAL', department: '', pin: '' }

export default function AccountsPanel() {
  const { register } = useAuth()
  const [users, setUsers] = useState<AuthUser[] | null>(null)
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const loadUsers = () => {
    api.fetchUsers().then(setUsers).catch(() => {})
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setDone('')
    try {
      const created = await register(form.name, form.email, form.password, form.role, form.department, form.pin)
      setDone(`Created ${created.name} (${created.email}) as ${created.role}.`)
      setForm(EMPTY_FORM)
      loadUsers()
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Failed to create account')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-primary">People & Accounts</h2>
          <p className="text-sm text-muted">Create and manage sign-in access for team members.</p>
        </div>
        <button onClick={loadUsers} className="flex items-center gap-1.5 rounded-xl border border-theme bg-panel px-3 py-2 text-xs text-muted transition hover:text-white">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* Create form */}
        <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-theme bg-bg-card p-5 shadow-card">
          <div className="mb-2 flex items-center gap-2">
            <UserPlus size={16} className="text-golden" />
            <h3 className="font-display text-sm font-bold text-primary">New Account</h3>
          </div>

          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Full name *"
            required
            className="w-full rounded-xl border border-theme bg-input px-3 py-2.5 text-sm text-primary outline-none placeholder:text-muted focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-all"
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="name@authority.gov *"
            required
            className="w-full rounded-xl border border-theme bg-input px-3 py-2.5 text-sm text-primary outline-none placeholder:text-muted focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-all"
          />
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder="Password (min 8) *"
            minLength={8}
            required
            className="w-full rounded-xl border border-theme bg-input px-3 py-2.5 text-sm text-primary outline-none placeholder:text-muted focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-all"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={form.department}
              onChange={(e) => setForm(f => ({ ...f, department: e.target.value }))}
              placeholder="Department"
              className="w-full rounded-xl border border-theme bg-input px-3 py-2.5 text-sm text-primary outline-none placeholder:text-muted focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-all"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={form.pin}
              onChange={(e) => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
              placeholder="4-digit PIN"
              className="w-full rounded-xl border border-theme bg-input px-3 py-2.5 text-sm text-primary outline-none placeholder:text-muted focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-all"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(ROLE_BADGE) as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setForm(f => ({ ...f, role: r }))}
                className={`rounded-lg border py-2 font-mono text-xs font-semibold transition-all ${
                  form.role === r
                    ? 'border-violet-500/40 bg-violet-500/10 text-violet-300'
                    : 'border-theme bg-panel text-muted hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-center text-sm text-red-400">{error}</div>
          )}
          {done && (
            <div className="rounded-xl border border-safe/20 bg-safe/5 px-3 py-2.5 text-center text-sm text-safe">{done}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-violet-400 disabled:opacity-60"
          >
            {submitting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <><UserPlus size={15} /> Create Account</>
            )}
          </button>
        </form>

        {/* List */}
        <div className="rounded-2xl border border-theme bg-bg-card p-5 shadow-card">
          <h3 className="mb-3 font-display text-sm font-bold text-primary">
            Active Accounts <span className="text-muted">({users ? users.length : '…'})</span>
          </h3>
          {!users ? (
            <p className="py-8 text-center text-sm text-muted">Loading accounts…</p>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No accounts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-theme text-left font-mono text-2xs uppercase tracking-widest text-muted">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Email</th>
                    <th className="py-2 pr-3 font-medium">Department</th>
                    <th className="py-2 font-medium">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-theme/60 last:border-0">
                      <td className="py-2.5 pr-3 text-primary">{u.name}</td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-muted">{u.email}</td>
                      <td className="py-2.5 pr-3 text-xs text-muted">{u.department || '—'}</td>
                      <td className="py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-2xs ${ROLE_BADGE[u.role] || ROLE_BADGE.VOLUNTEER}`}>
                          <ShieldCheck size={10} /> {u.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}