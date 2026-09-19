/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Custom Next.js server that also proxies /api and /ws to the FastAPI backend,
 * so the whole product runs behind one origin (same as the old Vite proxy).
 *
 *   npm run dev   -> NODE_ENV=development  (default)
 *   npm start     -> NODE_ENV=production   (after `npm run build`)
 *
 * Backend target overridable via BACKEND_URL (default http://127.0.0.1:8000).
 */
const { createServer } = require('node:http')
const httpProxy = require('http-proxy')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)
const backend = process.env.BACKEND_URL || 'http://127.0.0.1:8000'

const app = next({ dev })
const handle = app.getRequestHandler()

const proxy = httpProxy.createProxyServer({
  target: backend,
  changeOrigin: true,
  ws: true,
})

proxy.on('error', (err, req, res) => {
  if (res && typeof res.writeHead === 'function') {
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'backend_unreachable', detail: 'Could not reach the SafeLink-AI backend.' }))
  } else if (req.socket) {
    req.socket.destroy()
  }
})

// Strip the query string to get the pathname without requiring node:url.
const pathname = (url) => (url || '').split('?')[0]

const server = createServer((req, res) => {
  const p = pathname(req.url)

  if (p.startsWith('/api')) {
    proxy.web(req, res)
  } else {
    handle(req, res)
  }
})

// WebSocket upgrade for /ws/alerts
server.on('upgrade', (req, socket, head) => {
  if (pathname(req.url).startsWith('/ws')) {
    proxy.ws(req, socket, head)
  } else {
    socket.destroy()
  }
})

app.prepare().then(() => {
  server.listen(port, () => {
    console.log(`> SafeLink-AI frontend ready on http://localhost:${port} (proxy -> ${backend})`)
  })
})
