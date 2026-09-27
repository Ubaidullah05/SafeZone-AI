import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Keeps a render failure from becoming a blank page.
 *
 * The app previously had no boundary, so one thrown error during render
 * unmounted the whole tree and left an empty `#root`. The failure was
 * invisible until the console was opened. This shows what broke instead.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[SafeZone] render error:', error, info.componentStack)
  }

  private reload = () => {
    window.location.href = '/'
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-dvh items-center justify-center bg-base-950 p-6 text-white">
        <div className="w-full max-w-md rounded-xl border border-theme bg-header p-6">
          <h1 className="text-xl font-bold text-golden">SafeZone-AI could not start</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            The dashboard hit an unexpected error before it could render. This is
            usually a deployment setting rather than a problem with your data.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-lg border border-theme bg-base-900 p-3 text-xs text-red-400">
            {error.message}
          </pre>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={this.reload}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
            >
              Reload dashboard
            </button>
            <a
              href="https://github.com/Ubaidullah05/SafeZone-AI"
              className="rounded-lg border border-theme px-4 py-2 text-sm text-muted hover:text-white"
            >
              Troubleshooting
            </a>
          </div>
        </div>
      </div>
    )
  }
}
