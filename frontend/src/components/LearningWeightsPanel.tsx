import { useEffect, useState } from 'react'
import * as api from '../services/api'
import type { CorpusInfo, LearningDetail } from '../types'

const FACTOR_LABELS: Record<string, string> = {
  hazard_severity: 'Danger Level',
  slope_risk: 'Slope / Elevation',
  population_exposure: 'People in Danger',
  accessibility_risk: 'Road Access',
  facility_access_risk: 'Facility Access',
  historical_event_risk: 'Past Disasters',
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

/**
 * Authority-only view of how the model learned what it learned.
 *
 * The emphasis is deliberate: the model must be able to explain which factors
 * it trusts and on what evidence, and must be explicit that seeded and derived
 * scenarios are not real historical records.
 */
export default function LearningWeightsPanel() {
  const [detail, setDetail] = useState<LearningDetail | null>(null)
  const [corpus, setCorpus] = useState<CorpusInfo | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    api.fetchLearningDetail().then(setDetail).catch(() => setError(true))
    api.fetchCorpusInfo().then(setCorpus).catch(() => {})
  }, [])

  if (error) {
    return (
      <div className="rounded-2xl border border-theme bg-panel p-4">
        <p className="text-sm text-surface-500">Learning detail requires an official account.</p>
      </div>
    )
  }
  if (!detail) {
    return (
      <div className="rounded-2xl border border-theme bg-panel p-4">
        <p className="text-sm text-surface-500">Loading model state...</p>
      </div>
    )
  }

  const split = detail.provenance_split ?? {}
  const r = detail.factor_correlations ?? {}
  const prior = detail.prior ?? {}
  const rows = Object.entries(detail.weights).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-theme bg-panel p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-mono text-xs uppercase tracking-widest text-surface-500">
            How this model learned
          </h3>
          <span className="rounded bg-surface-500/10 px-2 py-0.5 font-mono text-2xs text-surface-500">
            {detail.mode}
          </span>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-surface-500">
          Factor weights are derived from how each factor co-varies with confirmed
          outcome severity, then blended toward the published prior until enough
          evidence exists. A factor that is high but outcome-flat earns nothing.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg bg-surface-500/5 p-2.5">
            <p className="font-mono text-2xs uppercase text-surface-500">Live evidence</p>
            <p className="text-lg font-bold text-emerald-400">{detail.n_live_observations ?? 0}</p>
            <p className="text-2xs text-surface-500">adjudicated SOS</p>
          </div>
          <div className="rounded-lg bg-surface-500/5 p-2.5">
            <p className="font-mono text-2xs uppercase text-surface-500">Live confidence</p>
            <p className="text-lg font-bold text-emerald-400">{pct(detail.confidence)}</p>
            <p className="text-2xs text-surface-500">capped at 95%</p>
          </div>
          <div className="rounded-lg bg-surface-500/5 p-2.5">
            <p className="font-mono text-2xs uppercase text-surface-500">Historical</p>
            <p className="text-lg font-bold text-violet-300">{detail.n_historical_observations ?? 0}</p>
            <p className="text-2xs text-surface-500">{pct(detail.historical_confidence ?? 0)} strength</p>
          </div>
          <div className="rounded-lg bg-surface-500/5 p-2.5">
            <p className="font-mono text-2xs uppercase text-surface-500">Provenance</p>
            <p className="text-lg font-bold text-white">
              {split.documented ?? 0}
              <span className="text-sm text-surface-500"> / {split.derived ?? 0}</span>
            </p>
            <p className="text-2xs text-surface-500">documented / derived</p>
          </div>
        </div>

        <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-2xs leading-relaxed text-amber-300/90">
          Live confidence is computed from live adjudications only. Replaying the
          historical corpus changes the weights but never inflates the confidence
          shown to the public.
        </p>
      </div>

      <div className="rounded-2xl border border-theme bg-panel p-4">
        <p className="font-mono text-xs uppercase tracking-widest text-surface-500">
          Factor weights vs outcome correlation
        </p>
        <div className="mt-3 space-y-2.5">
          {rows.map(([key, weight]) => {
            const corr = r[key] ?? 0
            const p = prior[key]
            const delta = p === undefined ? null : weight - p
            return (
              <div key={key}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="text-surface-400">{FACTOR_LABELS[key] ?? key}</span>
                  <span className="font-mono text-xs text-surface-500">
                    <span className="text-violet-400">{pct(weight)}</span>
                    {delta !== null && Math.abs(delta) >= 0.005 && (
                      <span className={delta > 0 ? 'text-emerald-400' : 'text-surface-500'}>
                        {' '}
                        ({delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)} vs prior)
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-500/10">
                  <div
                    className="h-full rounded-full bg-violet-500/70"
                    style={{ width: `${Math.max(1, weight * 100)}%` }}
                  />
                </div>
                <p className="mt-1 font-mono text-2xs text-surface-500">
                  outcome correlation r = {corr >= 0 ? '+' : ''}{corr.toFixed(2)}
                  {Math.abs(corr) < 0.05 && ' (no measurable signal)'}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {corpus?.honesty_note && (
        <div className="rounded-2xl border border-theme bg-panel p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-surface-500">
            Training corpus provenance
          </p>
          <p className="mt-2 text-2xs leading-relaxed text-surface-500">
            {corpus.honesty_note}
          </p>
          {corpus.counts && (
            <p className="mt-2 font-mono text-2xs text-surface-500">
              corpus v{corpus.version} ({corpus.design} design): {corpus.counts.total} events (
              {corpus.counts.documented} documented, {corpus.counts.derived} derived)
            </p>
          )}
        </div>
      )}

      {corpus?.causal_weights && (
        <div className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-violet-300">
            What the corpus assumed
          </p>
          <p className="mt-2 text-2xs leading-relaxed text-surface-500">
            These are <span className="text-violet-300">assumptions the corpus was built
            on</span>, not facts discovered about the region. The model was given scenarios
            built this way, then had to find them unaided.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(corpus.causal_weights).map(([k, v]) => (
              <span
                key={k}
                className="rounded bg-surface-500/10 px-2 py-0.5 font-mono text-2xs text-surface-400"
              >
                {FACTOR_LABELS[k] ?? k} {v.toFixed(2)}
              </span>
            ))}
          </div>
          {corpus.control_factors && corpus.control_factors.length > 0 && (
            <p className="mt-2 font-mono text-2xs text-surface-500">
              controls (should score ~0):{' '}
              {corpus.control_factors.map((f) => FACTOR_LABELS[f] ?? f).join(', ')}
            </p>
          )}
          {corpus.why_crossed && (
            <p className="mt-3 border-t border-theme pt-3 text-2xs leading-relaxed text-surface-500">
              {corpus.why_crossed}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
