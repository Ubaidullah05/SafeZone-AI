import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Shield, Mail, KeyRound, Lock, ArrowLeft, Eye, EyeOff, Fingerprint } from 'lucide-react'
import { useAuth } from './AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, login, pinLogin, authError, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [usePin, setUsePin] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (user) navigate('/authority', { replace: true })
  }, [user, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (usePin) {
        await pinLogin(email.trim(), pin)
      } else {
        await login(email.trim(), password)
      }
      navigate('/authority', { replace: true })
    } catch {
      // error message is set inside AuthContext
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-base-950 text-white">
      <header className="flex items-center justify-between border-b border-theme bg-header/80 px-5 py-3 backdrop-blur-xl">
          <Link to="/" className="flex items-center gap-2 text-muted transition hover:text-white">
          <ArrowLeft size={15} /> Back to public page
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
            <h1 className="font-display text-2xl font-bold">Official Sign In</h1>
            <p className="mt-1 text-sm text-muted">Restricted to authorized district officials.</p>
          </div>

          <div className="rounded-3xl border border-theme bg-sidebar p-7 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-theme bg-panel py-3 pl-10 pr-11 text-sm text-primary outline-none transition placeholder:text-muted focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/20"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button type="button" onClick={() => setUsePin(!usePin)} className="flex items-center gap-1.5 text-xs font-medium text-violet-300 transition hover:text-violet-200">
                  <Fingerprint size={13} /> Use PIN instead
                </button>
              </div>

              {usePin && (
                <div className="animate-fade-in-down rounded-xl border border-theme bg-panel p-3">
                  <label className="mb-1.5 block font-mono text-2xs uppercase tracking-wider text-muted">4-digit security PIN</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type={showPin ? 'text' : 'password'}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="••••"
                      inputMode="numeric"
                      className="w-full rounded-xl border border-theme bg-input py-3 pl-10 pr-11 font-mono text-sm tracking-[0.5em] text-primary outline-none transition placeholder:text-muted focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/20"
                    />
                    <button type="button" onClick={() => setShowPin(!showPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white">
                      {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}

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
                {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Lock size={15} />}
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <div className="mt-5 rounded-xl border border-theme bg-panel p-3">
              <p className="mb-2 font-mono text-2xs uppercase tracking-widest text-muted">Demo credentials</p>
              <button
                type="button"
                onClick={() => { setEmail('admin@safezone.gov'); setPassword('Safezone@123'); setPin('1234') }}
                className="w-full text-left text-xs text-muted transition hover:text-white"
              >
                <span className="font-semibold text-primary">Admin:</span> admin@safezone.gov · Safezone@123 · PIN 1234 (accounts mgmt)
              </button>
              <button
                type="button"
                onClick={() => { setEmail('official@safezone.gov'); setPassword('Safezone@123') }}
                className="mt-1.5 w-full text-left text-xs text-muted transition hover:text-white"
              >
                <span className="font-semibold text-primary">Official:</span> official@safezone.gov · Safezone@123
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}