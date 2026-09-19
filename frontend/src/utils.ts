import type { RiskLevel } from './types'

export const RISK_COLORS: Record<RiskLevel, string> = {
  SAFE: '#2FD180',
  MODERATE: '#F5B942',
  HIGH: '#F5793A',
  CRITICAL: '#F5384C',
}

export const RISK_LABELS: Record<RiskLevel, string> = {
  SAFE: 'Safe',
  MODERATE: 'Moderate',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

export function riskColor(level: RiskLevel | string): string {
  return RISK_COLORS[level as RiskLevel] || '#64748B'
}

export function fmtNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return Math.round(n).toLocaleString('en-IN')
}

export function fmtSigned(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${fmtNumber(n)}`
}