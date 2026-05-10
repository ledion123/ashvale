import type { DashboardData, AuditDetail } from '../types'
import type { PlantRegister } from './register'
import type { ActiveSite } from './sites'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `API error ${res.status}`)
  }
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
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
  const res = await fetch('/api/parse-register', { method: 'POST', body: form })
  if (!res.ok) {
    const b = await res.json().catch(() => ({}))
    throw new Error((b as { error?: string }).error ?? 'Failed to parse register')
  }
  return res.json()
}

export async function uploadSites(file: File): Promise<{ sites: ActiveSite[] }> {
  const form = new FormData()
  form.append('excel', file)
  const res = await fetch('/api/parse-sites', { method: 'POST', body: form })
  if (!res.ok) {
    const b = await res.json().catch(() => ({}))
    throw new Error((b as { error?: string }).error ?? 'Failed to parse sites Excel')
  }
  return res.json()
}
