'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, Mail, KeyRound, Lock, ArrowLeft, UserPlus, Eye, EyeOff, Fingerprint, ShieldAlert } from 'lucide-react'
import { useAuth } from './AuthContext'

export default function RegisterPage() {
  const router = useRouter()
  const { user, register, authError, loading } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (submitted) {
      const t = setTimeout(() => router.replace('/login'), 1600)
      return () => clearTimeout(t)
    }
  }, [submitted, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await register(name.trim(), email.trim(), password, 'OFFICIAL', undefined, pin.trim())
      setSubmitted(true)
    } catch {
      // error message is set inside AuthContext
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-base-950 text-white">
      <header className="flex items-center justify-between border-b border-theme bg-header/80 px-5 py-3 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2 text-muted transition hover:text-white">
          <ArrowLeft size={15} /> Back to public portal
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-golden shadow-glow-v">
            <Shield size={15} className="text-white" />
          </div>
          <span className="font-display text-sm font-bold">SafeLink<span className="text-golden">-AI</span></span>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <h1 className="font-display text-2xl font-bold">Create Official Account</h1>
            <p className="mt-1 text-sm text-muted">New officials are created by an existing admin.</p>
          </div>

          {!isAdmin && !submitted && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-golden/20 bg-golden/5 p-4 text-sm text-golden-300">
              <ShieldAlert size={17} className="mt-0.5 shrink-0 text-golden" />
              <p>
                Registration is restricted to admins. Sign in as an admin, then visit the
                <Link href="/authority" className="ml-1 font-semibold text-white underline decoration-golden/40 underline-offset-2 hover:text-golden">control room &rarr; Accounts</Link>
                to add officials.
              </p>
            </div>
          )}

          {submitted ? (
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center animate-fade-in">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h2 className="font-display text-lg font-bold text-emerald-400">Account created</h2>
              <p className="mt-1 text-sm text-muted">Redirecting to sign in…</p>
            </div>
          ) : (
            <div className="rounded-3xl border border-theme bg-sidebar p-7 shadow-2xl">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted">Full name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ravi Kumar"
                    className="w-full rounded-xl border border-theme bg-panel px-4 py-3 text-sm text-primary outline-none transition placeholder:text-muted focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted">Email</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="official@safezone.gov"
                      className="w-full rounded-xl border border-theme bg-panel py-3 pl-10 pr-4 text-sm text-primary outline-none transition placeholder:text-muted focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted">Password</label>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full rounded-xl border border-theme bg-panel py-3 pl-10 pr-11 text-sm text-primary outline-none transition placeholder:text-muted focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/20"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted">4-digit security PIN</label>
                  <div className="relative">
                    <Fingerprint size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type={showPin ? 'text' : 'password'}
                      required
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="••••"
                      inputMode="numeric"
                      className="w-full rounded-xl border border-theme bg-panel py-3 pl-10 pr-11 font-mono text-sm tracking-[0.5em] text-primary outline-none transition placeholder:text-muted focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/20"
                    />
                    <button type="button" onClick={() => setShowPin(!showPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white">
                      {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {authError && (
                  <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger animate-fade-in-down">
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-violet-400 disabled:opacity-60"
                >
                  {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <UserPlus size={15} />}
                  {loading ? 'Creating account…' : 'Create Official Account'}
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-muted">
                Already registered?{' '}
                <Link href="/login" className="font-medium text-violet-300 hover:text-violet-200">Sign in</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}