export const RISK_COLORS = {
  SAFE: '#2FD180',
  MODERATE: '#F5B942',
  HIGH: '#F5793A',
  CRITICAL: '#F5384C',
}

export const RISK_LABELS = {
  SAFE: 'Safe',
  MODERATE: 'Moderate',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

export function riskColor(level) {
  return RISK_COLORS[level] || '#64748B'
}

export function fmtNumber(n) {
  if (n === null || n === undefined) return '—'
  return Math.round(n).toLocaleString('en-IN')
}

export function fmtSigned(n) {
  const sign = n > 0 ? '+' : ''
  return `${sign}${fmtNumber(n)}`
}
