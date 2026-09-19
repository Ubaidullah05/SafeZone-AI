import { useState } from 'react'
import { Zap, RotateCcw } from 'lucide-react'
import { fmtNumber, fmtSigned } from '../utils'
import type { ScenarioAdjustments, ScenarioComparison } from '../types'

const EXAMPLE_SCENARIO: ScenarioAdjustments = {
  hazard_severity_delta_pct: 20,
  rainfall_intensity_delta_pct: 30,
  population_exposure_delta_pct: 10,
  road_accessibility_delta_pct: -15,
  road_closure: false,
}

const DEFAULT_SCENARIO: ScenarioAdjustments = {
  hazard_severity_delta_pct: 0,
  rainfall_intensity_delta_pct: 0,
  population_exposure_delta_pct: 0,
  road_accessibility_delta_pct: 0,
  road_closure: false,
}

function Slider({ label, value, min, max, onChange, unit = '%' }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-surface-400">{label}</span>
        <span className="font-mono text-violet-400">{value > 0 ? '+' : ''}{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-violet-500"
      />
    </div>
  )
}

interface ScenarioSimulatorProps {
  onRunScenario: (params: ScenarioAdjustments) => void
  comparison: ScenarioComparison | null
  isRunning: boolean
}

export default function ScenarioSimulator({ onRunScenario, comparison, isRunning }: ScenarioSimulatorProps) {
  const [params, setParams] = useState<ScenarioAdjustments>(DEFAULT_SCENARIO)

  const update = (key: keyof ScenarioAdjustments) => (value: number | boolean) => setParams((p) => ({ ...p, [key]: value }))

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pr-1 scrollbar-thin sm:gap-4">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-widest text-surface-500">What If Things Change</p>
          <button
            onClick={() => setParams(EXAMPLE_SCENARIO)}
            className="font-mono text-xs uppercase tracking-wide text-golden hover:text-amber-400 transition-colors"
          >
            Load demo scenario
          </button>
        </div>

        <div className="space-y-4 rounded-2xl border border-theme bg-panel p-4">
          <Slider label="Danger Level" value={params.hazard_severity_delta_pct} min={-50} max={100} onChange={update('hazard_severity_delta_pct')} />
          <Slider label="Rainfall / Event Strength" value={params.rainfall_intensity_delta_pct} min={-50} max={100} onChange={update('rainfall_intensity_delta_pct')} />
          <Slider label="People in Danger" value={params.population_exposure_delta_pct} min={-50} max={100} onChange={update('population_exposure_delta_pct')} />
          <Slider label="Road Access" value={params.road_accessibility_delta_pct} min={-50} max={50} onChange={update('road_accessibility_delta_pct')} />

          <div className="flex items-center justify-between pt-1">
            <span className="text-sm text-surface-400">Road Closure</span>
            <button
              onClick={() => setParams((p) => ({ ...p, road_closure: !p.road_closure }))}
              className={`relative h-6 w-11 rounded-full transition ${params.road_closure ? 'bg-red-500' : 'bg-surface-700'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${params.road_closure ? 'left-5.5' : 'left-0.5'}`}
              />
            </button>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onRunScenario(params)}
            disabled={isRunning}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-5 py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-60 shadow-lg shadow-red-500/20 text-base"
          >
            <Zap size={18} />
            {isRunning ? 'Running…' : 'See What Happens'}
          </button>
          <button
            onClick={() => {
              setParams(DEFAULT_SCENARIO)
              onRunScenario(DEFAULT_SCENARIO)
            }}
            title="Reset to baseline"
            className="flex items-center justify-center rounded-xl border border-theme px-4 text-surface-500 transition hover:text-white hover:bg-white/5"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {comparison && (
        <div className="rounded-2xl border border-theme bg-panel p-4">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-surface-500">Before vs After</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="mb-1 text-surface-400">Before Change</p>
              <p className="text-surface-400">High Risk: <strong className="text-amber-400">{comparison.before_high_risk}</strong></p>
              <p className="text-surface-400">Critical: <strong className="text-red-400">{comparison.before_critical}</strong></p>
              <p className="text-surface-400">People in Danger: <strong className="text-white">{fmtNumber(comparison.before_population_at_risk)}</strong></p>
            </div>
            <div>
              <p className="mb-1 text-surface-400">After Change</p>
              <p className="text-surface-400">High Risk: <strong className="text-amber-400">{comparison.after_high_risk}</strong></p>
              <p className="text-surface-400">Critical: <strong className="text-red-400">{comparison.after_critical}</strong></p>
              <p className="text-surface-400">People in Danger: <strong className="text-white">{fmtNumber(comparison.after_population_at_risk)}</strong></p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-red-400">Extra People In Danger</p>
            <p className="text-2xl font-bold text-red-400">{fmtSigned(comparison.additional_population_at_risk)}</p>
          </div>
        </div>
      )}
    </div>
  )
}