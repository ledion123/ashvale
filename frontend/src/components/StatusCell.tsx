import { Link } from 'react-router-dom'
import type { TemplateStatus } from '../types'
import { fmtDate } from '../lib/dates'

interface Props {
  status: TemplateStatus | undefined
  column: string
  /** Where this cell is rendered from, so InspectionDetail's back link can return here. */
  from?: 'dashboard' | 'sites'
}

export default function StatusCell({ status, column, from = 'dashboard' }: Props) {
  if (!status) {
    return <span className="text-slate-700 text-base leading-none">—</span>
  }

  const { status: s, audit_id, last_completed, inspector, register_only } = status

  const tooltip = [
    column,
    last_completed ? `Last: ${fmtDate(last_completed)}` : null,
    inspector || null,
    s === 'missing' ? 'Not completed this week' : s === 'overdue' ? 'Overdue — completed before this week' : 'Completed this week',
    register_only ? 'Only covered by PUWER Register — no individual inspection filed' : null,
  ]
    .filter(Boolean)
    .join('\n')

  const dot =
    s === 'ok' ? (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/15 text-green-400 text-xs font-bold">
        ✓
      </span>
    ) : s === 'overdue' ? (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/15 text-amber-400 text-xs font-bold">
        ⏱
      </span>
    ) : (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/10 text-red-500 text-xs font-bold">
        ✗
      </span>
    )

  const badge = register_only ? (
    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-orange-400 ring-2 ring-slate-900" />
  ) : null

  if ((s === 'ok' || s === 'overdue') && audit_id) {
    return (
      <Link
        to={`/inspections/${audit_id}`}
        state={{ from }}
        title={tooltip}
        aria-label={tooltip}
        className="relative inline-flex items-center justify-center w-11 h-11 -m-2.5"
      >
        {dot}
        {badge}
      </Link>
    )
  }

  return (
    <span className="relative inline-flex" title={tooltip} aria-label={tooltip}>
      {dot}
      {badge}
    </span>
  )
}
