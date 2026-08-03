import type { InspectionStatus } from '../types'

// Single source of truth for status -> color, so the status dot (StatusCell),
// per-template mini badge (SiteCard), and row/summary pill (Dashboard) never
// drift out of sync with each other.
export const STATUS_COLORS: Record<InspectionStatus, { bg: string; text: string }> = {
  ok: { bg: 'bg-green-500/15', text: 'text-green-400' },
  overdue: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  missing: { bg: 'bg-red-500/10', text: 'text-red-500' },
  'n/a': { bg: 'bg-slate-500/10', text: 'text-slate-500' },
}
