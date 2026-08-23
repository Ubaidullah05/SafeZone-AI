import { useState } from 'react'
import { Zap, RotateCcw } from 'lucide-react'
import { fmtNumber, fmtSigned } from '../utils'

const DEMO_SCENARIO = {
  hazard_severity_delta_pct: 20,
  rainfall_intensity_delta_pct: 30,
  population_exposure_delta_pct: 10,
  road_accessibility_delta_pct: -15,
  road_closure: false,
}

const DEFAULT_SCENARIO = {
  hazard_severity_delta_pct: 0,
  rainfall_intensity_delta_pct: 0,
  population_exposure_delta_pct: 0,
  road_accessibility_delta_pct: 0,
  road_closure: false,
}

function Slider({ label, value, min, max, onChange, unit = '%' }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-slate-400">{value > 0 ? '+' : ''}{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  )
}

export default function ScenarioSimulator({ onRunScenario, comparison, isRunning }) {
  const [params, setParams] = useState(DEFAULT_SCENARIO)

  const update = (key) => (value) => setParams((p) => ({ ...p, [key]: value }))

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">What-If Disaster Scenario</p>
          <button
            onClick={() => setParams(DEMO_SCENARIO)}
            className="font-mono text-[10px] uppercase tracking-wide text-signal-zone hover:underline"
          >
            Load demo scenario
          </button>
        </div>

        <div className="space-y-3.5 rounded-lg border border-base-700 bg-base-850 p-3">
          <Slider label="Hazard Severity" value={params.hazard_severity_delta_pct} min={-50} max={100} onChange={update('hazard_severity_delta_pct')} />
          <Slider label="Rainfall / Event Intensity" value={params.rainfall_intensity_delta_pct} min={-50} max={100} onChange={update('rainfall_intensity_delta_pct')} />
          <Slider label="Population Exposure" value={params.population_exposure_delta_pct} min={-50} max={100} onChange={update('population_exposure_delta_pct')} />
          <Slider label="Road Accessibility" value={params.road_accessibility_delta_pct} min={-50} max={50} onChange={update('road_accessibility_delta_pct')} />

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-300">Road Closure</span>
            <button
              onClick={() => setParams((p) => ({ ...p, road_closure: !p.road_closure }))}
              className={`relative h-5 w-9 rounded-full transition ${params.road_closure ? 'bg-signal-critical' : 'bg-base-600'}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${params.road_closure ? 'left-4.5 translate-x-0.5' : 'left-0.5'}`}
              />
            </button>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onRunScenario(params)}
            disabled={isRunning}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-signal-critical px-4 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            <Zap size={16} />
            {isRunning ? 'Running…' : 'Run Scenario'}
          </button>
          <button
            onClick={() => {
              setParams(DEFAULT_SCENARIO)
              onRunScenario(DEFAULT_SCENARIO)
            }}
            title="Reset to baseline"
            className="flex items-center justify-center rounded-lg border border-base-600 px-3 text-slate-400 transition hover:text-white"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {comparison && (
        <div className="rounded-lg border border-base-700 bg-base-850 p-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">Before → After</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="mb-1 text-slate-500">Before Scenario</p>
              <p className="text-slate-300">High Risk: <strong className="text-signal-high">{comparison.before_high_risk}</strong></p>
              <p className="text-slate-300">Critical: <strong className="text-signal-critical">{comparison.before_critical}</strong></p>
              <p className="text-slate-300">Pop. at Risk: <strong className="text-slate-100">{fmtNumber(comparison.before_population_at_risk)}</strong></p>
            </div>
            <div>
              <p className="mb-1 text-slate-500">After Scenario</p>
              <p className="text-slate-300">High Risk: <strong className="text-signal-high">{comparison.after_high_risk}</strong></p>
              <p className="text-slate-300">Critical: <strong className="text-signal-critical">{comparison.after_critical}</strong></p>
              <p className="text-slate-300">Pop. at Risk: <strong className="text-slate-100">{fmtNumber(comparison.after_population_at_risk)}</strong></p>
            </div>
          </div>
          <div className="mt-3 rounded-md border border-signal-critical/40 bg-signal-critical/10 px-3 py-2 text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-signal-critical">Additional Population At Risk</p>
            <p className="font-display text-xl font-bold text-signal-critical">{fmtSigned(comparison.additional_population_at_risk)}</p>
          </div>
        </div>
      )}
    </div>
  )
}
