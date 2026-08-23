import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
})

// Every function below throws on failure so callers (App.jsx) can decide
// whether to fall back to bundled demo data. We never silently pretend
// fallback data is live backend data (spec section 25).

export async function checkHealth() {
  const { data } = await client.get('/api/health')
  return data
}

export async function fetchVillages() {
  const { data } = await client.get('/api/villages')
  return data
}

export async function fetchVillage(id) {
  const { data } = await client.get(`/api/villages/${id}`)
  return data
}

export async function fetchSafeZones() {
  const { data } = await client.get('/api/safe-zones')
  return data
}

export async function fetchRiskSummary() {
  const { data } = await client.get('/api/risk-summary')
  return data
}

export async function fetchRelocationPriority() {
  const { data } = await client.get('/api/relocation-priority')
  return data
}

export async function fetchRecommendation(villageId) {
  const { data } = await client.get(`/api/recommendation/${villageId}`)
  return data
}

export async function runScenario(adjustments) {
  const { data } = await client.post('/api/scenario', adjustments)
  return data
}

export default client
