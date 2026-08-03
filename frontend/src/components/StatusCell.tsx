import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { TemplateStatus } from '../types'
import { fmtDate } from '../lib/dates'
import { STATUS_COLORS } from '../lib/statusColors'
import AuditPicker from './AuditPicker'

interface Props {
  status: TemplateStatus | undefined
  column: string
  /** Where this cell is rendered from, so InspectionDetail's back link can return here. */
  from?: 'dashboard' | 'sites'
}

export default function StatusCell({ status, column, from = 'dashboard' }: Props) {
  const [showPicker, setShowPicker] = useState(false)

  if (!status) {
    return <span className="text-slate-700 text-base leading-none">—</span>
  }

  const { status: s, audit_id, last_completed, inspector, register_only, individual_audits } = status
  const audits = individual_audits ?? []

  const tooltip = [
    column,
    last_completed ? `Last: ${fmtDate(last_completed)}` : null,
    inspector || null,
    s === 'n/a'
      ? 'Not applicable — PUWER Register confirms no equipment of this type on site'
      : s === 'missing'
        ? 'Not completed this week'
        : s === 'overdue'
          ? 'Overdue — completed before this week'
          : 'Completed this week',
    register_only ? 'Only covered by PUWER Register — no individual inspection filed' : null,
    audits.length > 1 ? `${audits.length} machines inspected this week` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const glyph = s === 'ok' ? '✓' : s === 'overdue' ? '⏱' : s === 'n/a' ? '–' : '✗'
  const colors = STATUS_COLORS[s]
  const dot = (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${colors.bg} ${colors.text} text-xs font-bold`}>
      {glyph}
    </span>
  )

  // Shape (letter), not just color, marks "PUWER Register only" so it isn't a color-only cue
  const badge = register_only ? (
    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-orange-400 ring-2 ring-slate-900 flex items-center justify-center">
      <span className="text-[6px] font-bold text-slate-900 leading-none">R</span>
    </span>
  ) : null

  if ((s === 'ok' || s === 'overdue' || s === 'n/a') && audit_id && audits.length > 1) {
    return (
      <div className="relative inline-block">
        <button
          onClick={() => setShowPicker(true)}
          title={tooltip}
          aria-label={tooltip}
          className="relative inline-flex items-center justify-center w-11 h-11 -m-2.5"
        >
          {dot}
          {badge}
        </button>
        {showPicker && (
          <AuditPicker column={column} audits={audits} from={from} onClose={() => setShowPicker(false)} />
        )}
      </div>
    )
  }

  if ((s === 'ok' || s === 'overdue' || s === 'n/a') && audit_id) {
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
