import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // Browsers only register a service worker in a secure context: HTTPS or
  // http://localhost. Serving the LAN URL over plain HTTP means the PWA will
  // not install and offline mode silently does nothing. Opt in with
  // VITE_HTTPS=true (self-signed, so the phone will warn once).
  const https = env.VITE_HTTPS === 'true'

  return {
  plugins: [react(), ...(https ? [basicSsl()] : [])],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Listen on every interface so the dev server is reachable from other
    // devices on the same LAN (phones, tablets) via the printed Network URL.
    host: true,
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  preview: {
    // `npm run preview` serves the real production build, so it is what you
    // want when testing offline/PWA behaviour from a phone.
    host: true,
    port: 4173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:8000', ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
  },
  }
})
