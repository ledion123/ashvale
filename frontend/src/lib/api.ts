import type { DashboardData, AuditDetail } from '../types'

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
