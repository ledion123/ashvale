import { Link } from 'react-router-dom'
import type { TemplateStatus } from '../types'
import { fmtDate } from '../lib/dates'

interface Props {
  status: TemplateStatus | undefined
  column: string
}

export default function StatusCell({ status, column }: Props) {
  if (!status) {
    return <span className="text-slate-700 text-base leading-none">—</span>
  }

  const { status: s, audit_id, last_completed, inspector } = status

  const tooltip = [
    column,
    last_completed ? `Last: ${fmtDate(last_completed)}` : null,
    inspector || null,
    s === 'missing' ? 'Not completed this week' : s === 'overdue' ? 'Overdue — completed before this week' : 'Completed this week',
  ]
    .filter(Boolean)
    .join('\n')

  const dot =
    s === 'ok' ? (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/15 text-green-400 text-xs font-bold"
        title={tooltip}
      >
        ✓
      </span>
    ) : s === 'overdue' ? (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/15 text-amber-400 text-xs font-bold"
        title={tooltip}
      >
        ⏱
      </span>
    ) : (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/10 text-red-500 text-xs font-bold"
        title={tooltip}
      >
        ✗
      </span>
    )

  if ((s === 'ok' || s === 'overdue') && audit_id) {
    return (
      <Link to={`/inspections/${audit_id}`} className="inline-flex">
        {dot}
      </Link>
    )
  }

  return <>{dot}</>
}
