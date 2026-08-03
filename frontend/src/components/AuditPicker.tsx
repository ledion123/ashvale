import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import type { TemplateStatus } from '../types'
import { fmtDateTime } from '../lib/dates'
import { useFocusTrap } from '../lib/useFocusTrap'

type IndividualAudit = NonNullable<TemplateStatus['individual_audits']>[number]

interface Props {
  column: string
  audits: IndividualAudit[]
  from: 'dashboard' | 'sites'
  onClose: () => void
}

/** Modal listing every individual audit a status cell covers for the week (e.g.
 * several excavators inspected at one site), so a single cell doesn't hide all
 * but the most-recently-completed one. Shared by StatusCell and SiteCard. */
export default function AuditPicker({ column, audits, from, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, true, onClose)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${column} audits this week`}
        className="relative bg-surface border border-edge rounded-2xl w-full max-w-xs shadow-2xl max-h-[70vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
          <h2 className="text-white font-semibold text-sm">{column} — {audits.length} machines</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto py-1.5">
          {audits.map(a => (
            <Link
              key={a.audit_id}
              to={`/inspections/${a.audit_id}`}
              state={{ from }}
              onClick={onClose}
              className="flex items-center justify-between px-4 py-2 text-sm text-slate-300 hover:bg-surface-hover transition-colors"
            >
              <span className="font-medium text-white">{a.machine_id}</span>
              <span className="text-xs text-slate-500">{fmtDateTime(a.date_completed)}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
