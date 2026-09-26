/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Absolute API origin. Leave EMPTY for local dev so requests go to the
   * relative /api path, which the Vite dev server proxies to the backend.
   * Setting a LAN IP here breaks same-origin proxying.
   */
  readonly VITE_API_URL?: string
  /**
   * Set to "true" to register the service worker during `npm run dev`.
   * Off by default because a caching service worker fights Vite's HMR.
   * Needed to test offline behaviour on a dev build.
   */
  readonly VITE_ENABLE_SW?: string
  /**
   * Set to "true" to serve the dev/preview server over HTTPS. Required for
   * service workers on a LAN IP, since browsers only allow them on HTTPS
   * or localhost.
   */
  readonly VITE_HTTPS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
