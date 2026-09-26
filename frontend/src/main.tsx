import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

/**
 * Service worker registration - this is what makes the app work offline.
 *
 * Deliberately NOT registered during `npm run dev` by default: a caching
 * service worker serves stale modules and breaks Vite's HMR. Set
 * VITE_ENABLE_SW=true to opt in when testing offline behaviour.
 *
 * Browsers only allow service workers in a secure context: HTTPS, or
 * http://localhost. Opening the dev server via a LAN IP over plain HTTP
 * will silently fail to register - use VITE_HTTPS=true there, or test on
 * localhost.
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  const enabledInDev = import.meta.env.VITE_ENABLE_SW === 'true'
  if (!import.meta.env.PROD && !enabledInDev) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // A new build ships a new sw.js. Let it wait, then swap it in on the
        // next visit so we never mix an old shell with new assets.
        registration.onupdatefound = () => {
          const installing = registration.installing
          if (!installing) return
          installing.onstatechange = () => {
            if (installing.state !== 'installed') return
            if (navigator.serviceWorker.controller) {
              console.info(
                '[sw] Update ready. It will be used after all tabs are closed.',
              )
            } else {
              console.info('[sw] Content cached for offline use.')
            }
          }
        }
      })
      .catch((error) => {
        // Never let a failed registration break the app.
        console.warn('[sw] Registration failed; offline mode unavailable.', error)
      })
  })
}

registerServiceWorker()

/**
 * A deployed build has no dev-server proxy, so /api/... would be requested
 * from the frontend's own origin and 404. Catch that here rather than leaving
 * someone to debug an empty dashboard.
 */
if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.warn(
    '[config] VITE_API_URL is not set, so API calls go to this origin and ' +
      'will 404 on a static host.\n' +
      '         For local dev this is correct (the Vite proxy handles /api).\n' +
      '         For a deployment, set VITE_API_URL to the backend origin, e.g. ' +
      'https://your-backend.onrender.com, then rebuild.',
  )
}
