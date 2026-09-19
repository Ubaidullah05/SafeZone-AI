'use client'

import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import RiskLegend from './RiskLegend'
import { riskColor, fmtNumber } from '../utils'
import type { SafeZoneResult, VillageResult } from '../types'

const DISTRICT_CENTER: [number, number] = [30.14, 78.46]

interface RiskMapProps {
  villages: VillageResult[]
  safeZones: SafeZoneResult[]
  selectedVillageId: string | null
  onSelectVillage: (id: string) => void
}

export default function RiskMap({ villages, safeZones, selectedVillageId, onSelectVillage }: RiskMapProps) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-theme bg-panel">
      <MapContainer center={DISTRICT_CENTER} zoom={11} scrollWheelZoom className="h-full w-full" style={{ background: '#0A0A12' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Hazard zone shading */}
        {villages.map((v) => (
          <Circle
            key={`hazard-${v.id}`}
            center={[v.latitude, v.longitude]}
            radius={500 + v.risk_score * 12}
            pathOptions={{
              color: riskColor(v.risk_level),
              fillColor: riskColor(v.risk_level),
              fillOpacity: 0.08,
              weight: 1,
              opacity: 0.35,
            }}
          />
        ))}

        {/* Safe zones */}
        {safeZones.map((sz) => (
          <CircleMarker
            key={sz.id}
            center={[sz.latitude, sz.longitude]}
            radius={9}
            pathOptions={{ color: '#0A0A12', weight: 2, fillColor: '#A78BFA', fillOpacity: 1 }}
          >
            <Tooltip direction="top" offset={[0, -6]}>{sz.name}</Tooltip>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold text-white">{sz.name}</p>
                <p className="text-violet-400">Safe Zone / Shelter</p>
                <div className="mt-2 space-y-0.5 text-xs text-surface-300">
                  <p>Capacity: <strong className="text-white">{fmtNumber(sz.capacity)}</strong></p>
                  <p>Remaining: <strong className="text-white">{fmtNumber(sz.remaining_capacity)}</strong></p>
                  <p>Safety Score: <strong className="text-white">{sz.safety_score}</strong></p>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Habitation markers */}
        {villages.map((v) => {
          const isSelected = v.id === selectedVillageId
          return (
            <CircleMarker
              key={v.id}
              center={[v.latitude, v.longitude]}
              radius={isSelected ? 12 : 8}
              pathOptions={{
                color: isSelected ? '#F5F0E8' : '#0A0A12',
                weight: isSelected ? 3 : 1.5,
                fillColor: riskColor(v.risk_level),
                fillOpacity: 1,
              }}
              eventHandlers={{ click: () => onSelectVillage(v.id) }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                {v.name} · {v.risk_level}
              </Tooltip>
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold text-white">{v.name}</p>
                  <p style={{ color: riskColor(v.risk_level) }} className="font-semibold">{v.risk_level} · {v.risk_score}/100</p>
                  <div className="mt-2 space-y-0.5 text-xs text-surface-300">
                    <p>Population: <strong className="text-white">{fmtNumber(v.population)}</strong></p>
                    {v.relocation_required && (
                      <p>Needs relocation: <strong className="text-white">{fmtNumber(v.people_requiring_relocation)}</strong></p>
                    )}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
      <RiskLegend />
    </div>
  )
}