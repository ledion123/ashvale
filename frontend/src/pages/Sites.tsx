import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { RefreshCw, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react'
import { fetchDashboard } from '../lib/api'
import { getWeekRange } from '../lib/dates'
import Spinner from '../components/Spinner'
import { COLUMNS, type DashboardData, type Site } from '../types'

export default function Sites() {
  const location = useLocation()
  const initialFilter = (location.state as { filter?: string })?.filter ?? ''

  const week = useMemo(() => {
    try {
      const s = localStorage.getItem('ashvale_selected_week')
      if (s) return JSON.parse(s) as { from: string; to: string; label: string }
    } catch {}
    return getWeekRange(0)
  }, [])

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState(initialFilter)
  const [sortBy, setSortBy] = useState<'gaps' | 'name'>('gaps')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await fetchDashboard(week.from, week.to))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [week.from, week.to])

  useEffect(() => { load() }, [load])

  const sites = useMemo(() => {
    if (!data) return []
    let list = data.sites
    if (search) list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    if (sortBy === 'gaps') {
      list = [...list].sort((a, b) => {
        const gA = Object.values(a.templates).filter(t => t.status !== 'ok').length
        const gB = Object.values(b.templates).filter(t => t.status !== 'ok').length
        return gB - gA
      })
    } else {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    }
    return list
  }, [data, search, sortBy])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-white font-semibold text-lg">All Sites</h1>
          <p className="text-slate-500 text-sm">Compliance status for {week.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter sites…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-surface border border-edge rounded-lg px-3 py-1.5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 w-44"
          />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'gaps' | 'name')}
            className="bg-surface border border-edge rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500 [color-scheme:dark]"
          >
            <option value="gaps">Sort: Most gaps first</option>
            <option value="name">Sort: A–Z</option>
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors disabled:opacity-30"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="bg-surface border border-edge rounded-xl p-12 text-center">
          <Spinner className="w-8 h-8 mb-4" />
          <p className="text-slate-400 text-sm">Loading…</p>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sites.map(site => (
            <SiteCard key={site.name} site={site} />
          ))}
          {sites.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-600 text-sm">
              {search ? `No sites matching "${search}"` : 'No site data found'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SiteCard({ site }: { site: Site }) {
  const statuses = Object.values(site.templates)
  const ok = statuses.filter(t => t.status === 'ok').length
  const overdue = statuses.filter(t => t.status === 'overdue').length
  const missing = statuses.filter(t => t.status === 'missing').length
  const total = COLUMNS.length
  const pct = Math.round((ok / total) * 100)

  const borderColor =
    pct === 100 ? 'border-green-500/30' : missing > 0 ? 'border-red-500/20' : 'border-amber-500/20'

  return (
    <div className={`bg-surface border ${borderColor} rounded-xl p-4 space-y-3 hover:bg-surface-hover transition-colors`}>
      <div>
        <p className="text-white font-semibold text-sm leading-snug">{site.name}</p>
      </div>

      <div className="flex items-center gap-3 text-xs">
        {ok > 0 && (
          <span className="flex items-center gap-1 text-green-400">
            <CheckCircle size={11} /> {ok}
          </span>
        )}
        {overdue > 0 && (
          <span className="flex items-center gap-1 text-amber-400">
            <Clock size={11} /> {overdue}
          </span>
        )}
        {missing > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <XCircle size={11} /> {missing}
          </span>
        )}
        <span className="ml-auto text-slate-500">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-base rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : missing > 0 ? 'bg-red-500' : 'bg-amber-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Per-template dots */}
      <div className="flex flex-wrap gap-1">
        {COLUMNS.map(col => {
          const t = site.templates[col]
          const s = t?.status ?? 'missing'
          return (
            <div key={col}>
              {t?.audit_id && (s === 'ok' || s === 'overdue') ? (
                <Link
                  to={`/inspections/${t.audit_id}`}
                  title={`${col}: ${s}`}
                  aria-label={`${col}: ${s}`}
                  className="inline-flex items-center justify-center w-11 h-11 -m-3"
                >
                  <span
                    className={`inline-flex w-5 h-5 rounded text-[9px] font-bold items-center justify-center transition-opacity hover:opacity-80 ${
                      s === 'ok'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {col.slice(0, 2)}
                  </span>
                </Link>
              ) : (
                <span
                  title={`${col}: ${s}`}
                  aria-label={`${col}: ${s}`}
                  className={`inline-flex w-5 h-5 rounded text-[9px] font-bold items-center justify-center ${
                    s === 'ok'
                      ? 'bg-green-500/20 text-green-400'
                      : s === 'overdue'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-red-500/10 text-red-500'
                  }`}
                >
                  {col.slice(0, 2)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
