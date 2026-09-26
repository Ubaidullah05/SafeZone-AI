/**
 * Post-build step: rewrite dist/sw.js with the real precache manifest.
 *
 * Vite emits content-hashed filenames (index-a1b2c3.js), which cannot be
 * known ahead of time. Without this step the service worker would only ever
 * cache what a user happened to visit, so the app would fail offline on a
 * first-visit-then-disconnect. This script walks dist/, records every built
 * asset, and injects the list plus a build id into the two marker lines in
 * public/sw.js.
 *
 * Wired into `npm run build`. Safe to run standalone: `node scripts/generate-sw.mjs`.
 */

import { createHash } from 'node:crypto'
import { statSync } from 'node:fs'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')
const SW_PATH = join(DIST, 'sw.js')

/** Extensions worth precaching. Source maps are excluded. */
const PRECACHE_EXTENSIONS = new Set([
  '.html',
  '.js',
  '.css',
  '.json',
  '.png',
  '.svg',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
])

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full)))
    else out.push(full)
  }
  return out
}

function toUrl(absPath) {
  return '/' + relative(DIST, absPath).split(sep).join('/')
}

function extensionOf(path) {
  const dot = path.lastIndexOf('.')
  return dot === -1 ? '' : path.slice(dot).toLowerCase()
}

function sizeOf(path) {
  try {
    return statSync(path).size
  } catch {
    return 0
  }
}

async function main() {
  if (!(await exists(DIST))) {
    console.error('[generate-sw] dist/ not found - run `vite build` first.')
    process.exitCode = 1
    return
  }

  const files = await walk(DIST)

  const assets = files
    .filter((file) => {
      const ext = extensionOf(file)
      if (ext === '.map') return false
      // The service worker must never precache itself.
      if (file === SW_PATH) return false
      return PRECACHE_EXTENSIONS.has(ext)
    })
    .map(toUrl)
    .sort()

  // '/' is the SPA entry the navigation fallback resolves to.
  const precache = [...new Set(['/', ...assets])].sort()

  // Build id changes whenever the asset set or any asset's bytes change, so
  // a new deploy evicts the previous cache instead of serving stale files.
  const hash = createHash('sha256')
  for (const file of files.sort()) {
    if (file === SW_PATH) continue
    hash.update(file)
    hash.update(await readFile(file))
  }
  const buildId = hash.digest('hex').slice(0, 12)

  const template = await readFile(SW_PATH, 'utf8')

  const stamped = template
    .replace(
      /^const CACHE_VERSION = '[^']*'; \/\/ __SW_BUILD_ID__$/m,
      `const CACHE_VERSION = '${buildId}'; // __SW_BUILD_ID__`,
    )
    .replace(
      /^const PRECACHE_MANIFEST = \[\]; \/\/ __SW_PRECACHE__$/m,
      `const PRECACHE_MANIFEST = ${JSON.stringify(precache)}; // __SW_PRECACHE__`,
    )

  if (stamped === template) {
    console.error(
      '[generate-sw] Marker lines not found in dist/sw.js. ' +
        'public/sw.js must keep the __SW_BUILD_ID__ / __SW_PRECACHE__ markers.',
    )
    process.exitCode = 1
    return
  }

  await writeFile(SW_PATH, stamped, 'utf8')

  const totalBytes = files.reduce((sum, file) => sum + sizeOf(file), 0)

  console.log(
    `[generate-sw] build ${buildId}: precaching ${precache.length} assets ` +
      `(${(totalBytes / 1024).toFixed(0)} kB total in dist).`,
  )
}

await main()
