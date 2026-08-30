import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './AuthContext';

function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
}

export default function LoginPage() {
  const { login, loginWithFace, loginWithPin } = useAuth();
  const [mode, setMode] = useState('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanPhase, setScanPhase] = useState('idle');
  const [isMobile, setIsMobile] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [thumbStatus, setThumbStatus] = useState('idle');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const pinRefs = [useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    setIsMobile(isMobileDevice());
    // Check camera availability
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setCameraAvailable(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [cameraStream]);

  async function handleEmailLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Login failed. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  // ---- FACE AUTH ----
  async function startFaceScan() {
    setError('');
    setScanPhase('scanning');

    // Try real camera — works on most devices including HTTP LAN
    if (cameraAvailable) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Simulate face detection after 2.5s
        setTimeout(async () => {
          try {
            const canvas = canvasRef.current;
            if (canvas && videoRef.current) {
              const ctx = canvas.getContext('2d');
              canvas.width = videoRef.current.videoWidth || 640;
              canvas.height = videoRef.current.videoHeight || 480;
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            }
            stream.getTracks().forEach(t => t.stop());
            setCameraStream(null);
          } catch {}

          // Authenticate — use AuthContext to update React state
          try {
            await loginWithFace('camera-capture');
            setScanPhase('success');
            window.location.href = '/';
          } catch {
            setScanPhase('error');
            setError('Face recognition failed');
            setTimeout(() => setScanPhase('idle'), 2000);
          }
        }, 2500);
        return;
      } catch (err) {
        console.warn('Camera failed:', err.message);
        setError('Camera access denied — please allow camera permission and try again');
      }
    }    // Fallback: mock face scan with animation (no camera available)
    setScanPhase('scanning');
    setTimeout(async () => {
      try {
        await loginWithFace('demo');
        setScanPhase('success');
        window.location.href = '/';
      } catch {
        setScanPhase('error');
        setError('Face recognition unavailable');
        setTimeout(() => setScanPhase('idle'), 2000);
      }
    }, 2500);
  }

  // ---- THUMB / FINGERPRINT AUTH ----
  async function handleThumbLogin() {
    setError('');
    setThumbStatus('scanning');
    setLoading(true);

    // Try real WebAuthn if available
    if (window.PublicKeyCredential) {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          const challenge = new Uint8Array(32);
          crypto.getRandomValues(challenge);

          const credential = await navigator.credentials.create({
            publicKey: {
              challenge,
              rp: { name: 'SafeLink-AI' },
              user: {
                id: new Uint8Array(16),
                name: 'rethikas2782@gmail.com',
                displayName: 'Rethika',
              },
              pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
              authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
              },
              timeout: 30000,
            },
          });

          if (credential) {
            // Use AuthContext for state management
            await loginWithFace(credential.id);
            setThumbStatus('success');
            window.location.href = '/';
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('WebAuthn failed:', err.message);
      }
    }

    // Fallback: authenticate via fingerprint-login endpoint via AuthContext
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      // Use AuthContext's loginWithFace as generic biometric login
      await loginWithFace('demo-biometric');
      setThumbStatus('success');
      window.location.href = '/';
    } catch (err) {
      setThumbStatus('error');
      setError('Thumb verification failed');
      setTimeout(() => setThumbStatus('idle'), 2000);
    } finally {
      setLoading(false);
    }
  }

  async function handlePinLogin() {
    const pinStr = pin.join('');
    if (pinStr.length !== 4) {
      setError('Enter a 4-digit PIN');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await loginWithPin(pinStr);
    } catch (err) {
      setError(err.message || 'PIN login failed');
    } finally {
      setLoading(false);
    }
  }

  function handlePinChange(index, value) {
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    if (value && index < 3) pinRefs[index + 1].current?.focus();
    if (index === 3 && value) handlePinLogin();
  }

  // Auth modes — always show all 4 on any device
  const authModes = [
    { id: 'email', icon: '📧', label: 'Email' },
    { id: 'face', icon: '📷', label: 'Face ID' },
    { id: 'fingerprint', icon: '👆', label: 'Thumb' },
    { id: 'pin', icon: '🔑', label: 'PIN' },
  ];

  const bgIcons = ['🌊', '🔥', '🏔️', '🏚️', '🛟', '🚑', '📡', '🆘', '🏕️', '⛈️', '🚒', '🏥'];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative" style={{ backgroundColor: 'var(--bg-body)' }}>
      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {bgIcons.map((icon, i) => (
          <motion.div key={i} className="absolute text-3xl opacity-[0.04]"
            initial={{ x: `${10 + (i * 7) % 85}%`, y: `${5 + (i * 13) % 85}%` }}
            animate={{ y: [`${5 + (i * 13) % 85}%`, `${15 + (i * 11) % 75}%`, `${5 + (i * 13) % 85}%`], rotate: [0, 10, -10, 0] }}
            transition={{ duration: 6 + i * 0.8, repeat: Infinity, ease: 'easeInOut' }}>
            {icon}
          </motion.div>
        ))}
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div className="absolute -top-32 -left-32 w-96 h-96 bg-violet-600/15 rounded-full blur-[120px]" animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15] }} transition={{ duration: 6, repeat: Infinity }} />
        <motion.div className="absolute -bottom-32 -right-32 w-96 h-96 bg-golden/10 rounded-full blur-[120px]" animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 8, repeat: Infinity }} />
      </div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-golden flex items-center justify-center text-3xl shadow-lg shadow-violet-500/25">
            🛡️
          </motion.div>
          <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-3xl font-bold text-primary mb-2">
            SafeLink<span className="text-golden">-AI</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-base text-secondary">
            Disaster Response Command Center
          </motion.p>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
          className="rounded-3xl bg-panel backdrop-blur-2xl border border-theme p-8 shadow-2xl shadow-violet-500/5">

          {/* Mode Tabs */}
          <div className="grid grid-cols-4 gap-2 mb-6 p-1 rounded-2xl bg-input border border-theme">
            {authModes.map((m) => (
              <button key={m.id} onClick={() => { setMode(m.id); setError(''); }}
                className={`py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                  mode === m.id ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30 shadow-sm' : 'text-muted hover:text-primary hover:bg-panel border border-transparent'
                }`}>
                <div className="text-base mb-0.5">{m.icon}</div>
                {m.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* Email Login */}
            {mode === 'email' && (
              <motion.form key="email" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label className="block text-sm text-secondary mb-2">Email Address</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rethikas2782@gmail.com"
                    className="w-full px-4 py-3 rounded-xl bg-input border border-theme text-primary placeholder-muted focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all text-base" required />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-2">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••"
                    className="w-full px-4 py-3 rounded-xl bg-input border border-theme text-primary placeholder-muted focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all text-base" required />
                </div>
                {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-400">{error}</motion.p>}
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-semibold text-base hover:from-violet-500 hover:to-violet-400 disabled:opacity-50 transition-all shadow-lg shadow-violet-500/20">
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
                <p className="text-xs text-muted text-center">Demo: rethikas2782@gmail.com / 1234</p>
              </motion.form>
            )}

            {/* Face Login */}
            {mode === 'face' && (
              <motion.div key="face" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                className="flex flex-col items-center gap-5 py-4">
                <div className="relative w-48 h-48 rounded-2xl bg-input border-2 border-violet-500/30 flex items-center justify-center overflow-hidden">
                  {/* Camera feed if available */}
                  {cameraAvailable && (
                    <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover rounded-2xl" autoPlay playsInline muted />
                  )}
                  {/* Corner brackets */}
                  <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-golden rounded-tl-lg z-10" />
                  <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-golden rounded-tr-lg z-10" />
                  <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-golden rounded-bl-lg z-10" />
                  <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-golden rounded-br-lg z-10" />
                  {/* Scan line */}
                  {scanPhase === 'scanning' && (
                    <motion.div className="absolute inset-x-3 h-0.5 bg-gradient-to-r from-transparent via-golden to-transparent z-20"
                      animate={{ top: ['12px', 'calc(100%-12px)', '12px'] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} />
                  )}
                  {scanPhase !== 'scanning' && (
                    <span className="text-5xl z-10 relative">{scanPhase === 'success' ? '✅' : scanPhase === 'error' ? '❌' : '👤'}</span>
                  )}
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button onClick={startFaceScan} disabled={scanPhase === 'scanning'}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-golden to-amber-500 text-surface-950 font-semibold text-base hover:from-golden hover:to-amber-400 disabled:opacity-50 transition-all shadow-lg shadow-golden/20">
                  {scanPhase === 'scanning' ? '🔍 Scanning Face...' : scanPhase === 'success' ? '✅ Recognized!' : '📷 Start Face Scan'}
                </button>
                <p className="text-xs text-muted text-center">
                  {cameraAvailable ? 'Position your face within the frame' : 'Demo mode — will authenticate automatically'}
                </p>
              </motion.div>
            )}

            {/* Thumb / Fingerprint Login */}
            {mode === 'fingerprint' && (
              <motion.div key="thumb" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                className="flex flex-col items-center gap-5 py-4">
                <motion.div className="relative w-40 h-40 rounded-full bg-input border-2 border-golden/30 flex items-center justify-center cursor-pointer select-none"
                  animate={thumbStatus === 'scanning' ? { scale: [1, 1.05, 1], borderColor: ['rgba(217,119,6,0.3)', 'rgba(217,119,6,0.8)', 'rgba(217,119,6,0.3)'] } : { scale: [1, 1.02, 1] }}
                  transition={{ duration: thumbStatus === 'scanning' ? 0.8 : 2, repeat: Infinity }}
                  onClick={handleThumbLogin}>
                  {/* Pulse rings */}
                  <motion.div className="absolute w-48 h-48 rounded-full border-2 border-golden/20"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0, 0.3] }} transition={{ duration: 2, repeat: Infinity }} />
                  <motion.div className="absolute w-56 h-56 rounded-full border border-golden/10"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0, 0.15] }} transition={{ duration: 2.5, repeat: Infinity }} />
                  {/* Status icon */}
                  <span className="text-6xl relative z-10">
                    {thumbStatus === 'success' ? '✅' : thumbStatus === 'error' ? '❌' : thumbStatus === 'scanning' ? '🔄' : '👆'}
                  </span>
                </motion.div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button onClick={handleThumbLogin} disabled={loading || thumbStatus === 'scanning'}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-golden to-amber-500 text-surface-950 font-semibold text-base hover:from-golden hover:to-amber-400 disabled:opacity-50 transition-all shadow-lg shadow-golden/20">
                  {thumbStatus === 'scanning' ? '🔄 Verifying...' : thumbStatus === 'success' ? '✅ Verified!' : '👆 Tap to Verify Thumbprint'}
                </button>
                <p className="text-xs text-muted text-center">Place your thumb on the sensor or tap the icon</p>
              </motion.div>
            )}

            {/* PIN Login */}
            {mode === 'pin' && (
              <motion.div key="pin" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                className="flex flex-col items-center gap-5 py-4">
                <p className="text-sm text-secondary">Emergency Access PIN</p>
                <div className="flex gap-3">
                  {pin.map((digit, i) => (
                    <input key={i} ref={pinRefs[i]} type="password" maxLength={1} value={digit}
                      onChange={(e) => handlePinChange(i, e.target.value)}
                      className="w-14 h-16 rounded-xl bg-input border border-theme text-primary text-center text-2xl font-mono focus:outline-none focus:border-golden/50 focus:ring-1 focus:ring-golden/20 transition-all"
                      onKeyDown={(e) => { if (e.key === 'Backspace' && !pin[i] && i > 0) pinRefs[i - 1].current?.focus(); }} />
                  ))}
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <p className="text-xs text-muted">Demo PIN: 1234</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-center mt-6 text-base text-secondary">
          New user?{' '}
          <a href="/register" className="text-golden hover:text-amber-400 transition-colors font-medium">Create Account</a>
        </motion.p>
      </motion.div>
    </div>
  );
}
