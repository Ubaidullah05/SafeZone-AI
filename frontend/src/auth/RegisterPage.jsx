import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from './AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('CITIZEN');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ name, email, password, role });
      setSuccess(true);
      setTimeout(() => window.location.href = '/login', 2000);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const bgIcons = ['🌊', '🔥', '🏔️', '🏚️', '🛟', '🚑', '📡', '🆘'];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative" style={{ backgroundColor: 'var(--bg-body)' }}>
      {/* Animated background icons */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {bgIcons.map((icon, i) => (
          <motion.div
            key={i}
            className="absolute text-3xl opacity-[0.04]"
            initial={{ x: `${10 + (i * 10) % 80}%`, y: `${10 + (i * 15) % 80}%` }}
            animate={{
              y: [`${10 + (i * 15) % 80}%`, `${20 + (i * 10) % 70}%`, `${10 + (i * 15) % 80}%`],
              rotate: [0, 15, -15, 0],
            }}
            transition={{ duration: 7 + i, repeat: Infinity, ease: 'easeInOut' }}
          >
            {icon}
          </motion.div>
        ))}
      </div>

      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-32 -right-32 w-96 h-96 bg-golden/10 rounded-full blur-[120px]"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-32 -left-32 w-96 h-96 bg-violet-600/15 rounded-full blur-[120px]"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-golden to-violet-500 flex items-center justify-center text-3xl shadow-lg shadow-golden/25"
          >
            🛡️
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Join SafeLink<span className="text-golden">-AI</span>
          </h1>
          <p className="text-base text-surface-400">Create your disaster response account</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-3xl bg-panel backdrop-blur-2xl border border-theme p-8 shadow-2xl shadow-violet-500/5"
        >
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <div className="text-5xl mb-4">✅</div>
              <h3 className="text-xl font-bold text-white mb-2">Account Created!</h3>
              <p className="text-surface-400">Redirecting to login...</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-surface-400 mb-2">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-4 py-3 rounded-xl bg-input border border-theme text-white placeholder-surface-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-surface-400 mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl bg-input border border-theme text-white placeholder-surface-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-surface-400 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full px-4 py-3 rounded-xl bg-input border border-theme text-white placeholder-surface-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all text-base"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="block text-sm text-surface-400 mb-2">Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'ADMIN', icon: '👔', label: 'Admin' },
                    { id: 'OFFICIAL', icon: '👮', label: 'Official' },
                    { id: 'CITIZEN', icon: '👤', label: 'Citizen' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.id)}
                      className={`py-3 rounded-xl text-sm font-medium transition-all border ${
                        role === r.id
                          ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                          : 'bg-panel text-surface-500 border-theme hover:text-white hover:border-theme'
                      }`}
                    >
                      <div className="text-xl mb-1">{r.icon}</div>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-400">
                  {error}
                </motion.p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-golden to-amber-500 text-surface-950 font-semibold text-base hover:from-golden hover:to-amber-400 disabled:opacity-50 transition-all shadow-lg shadow-golden/20"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}
        </motion.div>

        <p className="text-center mt-6 text-base text-surface-400">
          Already have an account?{' '}
          <a href="/login" className="text-golden hover:text-amber-400 transition-colors font-medium">
            Sign In
          </a>
        </p>
      </motion.div>
    </div>
  );
}
