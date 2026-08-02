import type { DashboardData, AuditDetail } from '../types'
import type { PlantRegister } from './register'
import type { ActiveSite } from './sites'

// Generous on purpose: the Dashboard/Generate flows legitimately take 30-60s
// on a first (uncached) SafetyCulture fetch — this is a ceiling against a
// truly hung request, not a normal-case limit.
const TIMEOUT_MS = 90_000

export async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('Request timed out — SafetyCulture may be slow to respond. Try again in a moment.')
    }
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`/api${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `API error ${res.status}`)
  }
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const b = await res.json().catch(() => ({}))
    throw new Error((b as { error?: string }).error ?? `API error ${res.status}`)
  }
  return res.json()
}

export interface SCSite {
  id: string
  name: string
}

export function fetchSCSites(): Promise<{ sites: SCSite[] }> {
  return get('/sites')
}

export function fetchDashboard(from?: string, to?: string): Promise<DashboardData> {
  const p = new URLSearchParams()
  if (from) p.set('from', from)
  if (to) p.set('to', to)
  const q = p.toString()
  return get(`/dashboard${q ? '?' + q : ''}`)
}

export function syncDashboard(from?: string, to?: string): Promise<DashboardData> {
  return post('/sync', { from, to })
}

export function fetchInspectionDetail(auditId: string): Promise<AuditDetail> {
  return get(`/inspections/${auditId}`)
}

export async function uploadRegister(file: File): Promise<{ register: PlantRegister; name_to_job: Record<string, string> }> {
  const form = new FormData()
  form.append('pdf', file)
  const res = await fetchWithTimeout('/api/parse-register', { method: 'POST', body: form })
  if (!res.ok) {
    const b = await res.json().catch(() => ({}))
    throw new Error((b as { error?: string }).error ?? 'Failed to parse register')
  }
  return res.json()
}

export async function uploadSites(file: File): Promise<{ sites: ActiveSite[] }> {
  const form = new FormData()
  form.append('excel', file)
  const res = await fetchWithTimeout('/api/parse-sites', { method: 'POST', body: form })
  if (!res.ok) {
    const b = await res.json().catch(() => ({}))
    throw new Error((b as { error?: string }).error ?? 'Failed to parse sites Excel')
  }
  return res.json()
}
