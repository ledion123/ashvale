import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import type { TemplateStatus } from '../types'
import { fmtDate, fmtDateTime } from '../lib/dates'
import { STATUS_COLORS } from '../lib/statusColors'
import { useFocusTrap } from '../lib/useFocusTrap'

interface Props {
  status: TemplateStatus | undefined
  column: string
  /** Where this cell is rendered from, so InspectionDetail's back link can return here. */
  from?: 'dashboard' | 'sites'
}

export default function StatusCell({ status, column, from = 'dashboard' }: Props) {
  const [showPicker, setShowPicker] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, showPicker, () => setShowPicker(false))

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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPicker(false)} />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={`${column} audits this week`}
              className="relative bg-surface border border-edge rounded-2xl w-full max-w-xs shadow-2xl max-h-[70vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
                <h2 className="text-white font-semibold text-sm">{column} — {audits.length} machines</h2>
                <button onClick={() => setShowPicker(false)} aria-label="Close" className="text-slate-500 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="overflow-y-auto py-1.5">
                {audits.map(a => (
                  <Link
                    key={a.audit_id}
                    to={`/inspections/${a.audit_id}`}
                    state={{ from }}
                    onClick={() => setShowPicker(false)}
                    className="flex items-center justify-between px-4 py-2 text-sm text-slate-300 hover:bg-surface-hover transition-colors"
                  >
                    <span className="font-medium text-white">{a.machine_id}</span>
                    <span className="text-xs text-slate-500">{fmtDateTime(a.date_completed)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
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
