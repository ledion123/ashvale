import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink, AlertCircle, CheckCircle, XCircle, Minus } from 'lucide-react'
import { fetchInspectionDetail } from '../lib/api'
import { fmtDateTime } from '../lib/dates'
import type { AuditDetail } from '../types'

export default function InspectionDetail() {
  const { auditId } = useParams<{ auditId: string }>()
  const [data, setData] = useState<AuditDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!auditId) return
    setLoading(true)
    fetchInspectionDetail(auditId)
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [auditId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="inline-block w-8 h-8 border-2 border-[#3a3d4a] border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      </div>
    )
  }

  if (!data) return null

  const ad = data.audit_data
  const inspector = typeof ad.owner === 'object' ? ad.owner?.name ?? '—' : String(ad.owner ?? '—')
  const siteName = ad.site?.name ?? '—'
  const scorePct = ad.score_percentage != null ? Math.round(ad.score_percentage) : null
  const scUrl = `https://app.safetyculture.io/audits/${auditId}`

  // Group items by section (items with type 'section' are section headers)
  const sections: Array<{ title: string; items: typeof data.items }> = []
  let currentSection = { title: 'General', items: [] as typeof data.items }
  for (const item of data.items) {
    if (item.type === 'section') {
      if (currentSection.items.length) sections.push(currentSection)
      currentSection = { title: item.label, items: [] }
    } else {
      currentSection.items.push(item)
    }
  }
  if (currentSection.items.length) sections.push(currentSection)

  return (
    <div className="space-y-5 max-w-3xl">
      <BackLink />

      {/* Header card */}
      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-white font-semibold text-lg leading-snug">{ad.name}</h1>
            <p className="text-slate-400 text-sm mt-0.5">{siteName}</p>
          </div>
          <a
            href={scUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400/40 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            <ExternalLink size={12} />
            View in SafetyCulture
          </a>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
          <MetaItem label="Date" value={fmtDateTime(ad.date_completed || ad.modified_at)} />
          <MetaItem label="Inspector" value={inspector} />
          <MetaItem label="Site" value={siteName} />
          {scorePct != null && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Score</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-[#0f1117] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${scorePct >= 80 ? 'bg-green-500' : scorePct >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${scorePct}%` }}
                  />
                </div>
                <span className={`text-sm font-semibold ${scorePct >= 80 ? 'text-green-400' : scorePct >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                  {scorePct}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inspection items */}
      {sections.map((section, si) => (
        <div key={si} className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2a2d3a] bg-[#13161f]">
            <h2 className="text-slate-300 font-semibold text-sm">{section.title}</h2>
          </div>
          <div className="divide-y divide-[#2a2d3a]/50">
            {section.items.map((item, ii) => (
              <ItemRow key={item.item_id ?? ii} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
    >
      <ArrowLeft size={14} />
      Back to Dashboard
    </Link>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className="text-slate-200 text-sm">{value}</p>
    </div>
  )
}

function ItemRow({ item }: { item: AuditDetail['items'][number] }) {
  const selected = item.responses?.selected?.[0]
  const text = item.responses?.text
  const label = selected?.label ?? ''

  const isAtRisk = label === 'At Risk' || label === 'No'
  const isOk = label === 'Yes' || label === 'Safe' || label === 'OK' || label === 'Pass'
  const isNa = label === 'N/A' || label === 'Not Applicable'

  const icon = isAtRisk
    ? <XCircle size={14} className="text-red-400 shrink-0" />
    : isOk
    ? <CheckCircle size={14} className="text-green-400 shrink-0" />
    : isNa
    ? <Minus size={14} className="text-slate-600 shrink-0" />
    : null

  if (!item.label && !text && !label) return null

  return (
    <div className={`flex items-start gap-3 px-4 py-2.5 ${isAtRisk ? 'bg-red-500/5' : ''}`}>
      <div className="mt-0.5 w-4">{icon}</div>
      <div className="flex-1 min-w-0">
        {item.label && (
          <p className="text-slate-300 text-sm leading-snug">{item.label}</p>
        )}
        {text && (
          <p className="text-slate-500 text-xs mt-0.5">{text}</p>
        )}
        {item.note && (
          <p className="text-amber-400/80 text-xs mt-0.5 italic">Note: {item.note}</p>
        )}
      </div>
      {label && !isNa && (
        <span
          className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            isAtRisk
              ? 'bg-red-500/15 text-red-400'
              : isOk
              ? 'bg-green-500/15 text-green-400'
              : 'bg-slate-700 text-slate-400'
          }`}
        >
          {label}
        </span>
      )}
    </div>
  )
}
