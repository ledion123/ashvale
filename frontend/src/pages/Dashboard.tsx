import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import StatusTile from '../components/StatusTile'
import StatusCell from '../components/StatusCell'
import { fetchDashboard, syncDashboard } from '../lib/api'
import { getWeekRange } from '../lib/dates'
import type { DashboardData, Site } from '../types'

const COLUMNS = ['EXCAVATOR', 'LOLER', 'DUMPER', 'ROLLER', 'TELEHAND', 'PUWER', 'SITE SUP', 'HAVS', 'TOOLBOX']
const ABBREV: Record<string, string> = {
  EXCAVATOR: 'EXC', LOLER: 'LOL', DUMPER: 'DMP', ROLLER: 'ROL',
  TELEHAND: 'TLH', PUWER: 'PUW', 'SITE SUP': 'SUP', HAVS: 'HVS', TOOLBOX: 'TBX',
}

export default function Dashboard() {
  const [weekOffset, setWeekOffset] = useState(0)
  const week = useMemo(() => getWeekRange(weekOffset), [weekOffset])

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async (from: string, to: string) => {
    setLoading(true)
    setError('')
    try {
      setData(await fetchDashboard(from, to))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(week.from, week.to) }, [week.from, week.to, load])

  const handleSync = async () => {
    setSyncing(true)
    setError('')
    try {
      setData(await syncDashboard(week.from, week.to))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const filteredSites = useMemo(() => {
    if (!data) return []
    const q = search.toLowerCase()
    return q ? data.sites.filter(s => s.name.toLowerCase().includes(q)) : data.sites
  }, [data, search])

  const gapSites = data ? data.sites.filter(s =>
    Object.values(s.templates).some(t => t.status !== 'ok')
  ).length : 0

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-slate-200 min-w-[180px] text-center">{week.label}</span>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            disabled={weekOffset >= 0}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
          {!week.isCurrent && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs text-blue-400 hover:text-blue-300 ml-1 transition-colors"
            >
              This week
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter sites…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-[#1a1d27] border border-[#2a2d3a] rounded-lg px-3 py-1.5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 w-44"
          />
          <button
            onClick={handleSync}
            disabled={loading || syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-4">
        <StatusTile label="Total Sites" value={data?.summary.total ?? 0} />
        <StatusTile label="Fully Compliant" value={data ? data.summary.total - gapSites : 0} color="green" />
        <StatusTile label="Has Gaps" value={gapSites} color="red" />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-12 text-center">
          <div className="inline-block w-8 h-8 border-2 border-[#3a3d4a] border-t-blue-500 rounded-full animate-spin mb-4" />
          <p className="text-slate-400 text-sm">Loading inspection data from SafetyCulture…</p>
          <p className="text-slate-600 text-xs mt-1">This may take 30–60 seconds on first load</p>
        </div>
      )}

      {/* Compliance matrix */}
      {data && (
        <div className="rounded-xl border border-[#2a2d3a] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#1a1d27]">
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-[#2a2d3a] w-52 sticky left-0 bg-[#1a1d27] z-10">
                    Site
                  </th>
                  {COLUMNS.map(col => (
                    <th
                      key={col}
                      title={col}
                      className="px-2 py-3 text-center text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-[#2a2d3a] min-w-[52px]"
                    >
                      {ABBREV[col]}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-[#2a2d3a] w-24">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSites.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length + 2} className="px-4 py-10 text-center text-slate-600 text-sm">
                      {search ? `No sites matching "${search}"` : 'No inspection data found for this week'}
                    </td>
                  </tr>
                )}
                {filteredSites.map((site, i) => (
                  <SiteRow key={site.name} site={site} idx={i} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 px-4 py-3 border-t border-[#2a2d3a] bg-[#13161f]">
            <span className="text-[11px] text-slate-600 font-medium">Legend:</span>
            <LegendItem icon="✓" color="text-green-400" label="Completed this week" />
            <LegendItem icon="⏱" color="text-amber-400" label="Overdue" />
            <LegendItem icon="✗" color="text-red-500" label="Missing" />
          </div>
        </div>
      )}

      {data && (
        <p className="text-xs text-slate-700 text-right">
          Last fetched: {new Date(data.generated_at).toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}

function SiteRow({ site, idx }: { site: Site; idx: number }) {
  const allOk = Object.values(site.templates).every(t => t.status === 'ok')
  const hasRed = Object.values(site.templates).some(t => t.status === 'missing')

  return (
    <tr className={`border-b border-[#2a2d3a]/60 ${idx % 2 === 1 ? 'bg-white/[0.015]' : ''} hover:bg-white/[0.03] transition-colors`}>
      <td className="px-4 py-2.5 sticky left-0 bg-inherit z-10">
        <Link
          to={`/sites`}
          state={{ filter: site.name }}
          className="text-slate-200 font-medium text-sm hover:text-white transition-colors truncate block max-w-[192px]"
          title={site.name}
        >
          {site.name}
        </Link>
      </td>
      {COLUMNS.map(col => (
        <td key={col} className="px-2 py-2.5 text-center">
          <StatusCell status={site.templates[col]} column={col} />
        </td>
      ))}
      <td className="px-4 py-2.5">
        <span
          className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            allOk
              ? 'bg-green-500/10 text-green-400'
              : hasRed
              ? 'bg-red-500/10 text-red-400'
              : 'bg-amber-500/10 text-amber-400'
          }`}
        >
          {allOk ? 'OK' : hasRed ? 'GAPS' : 'OVERDUE'}
        </span>
      </td>
    </tr>
  )
}

function LegendItem({ icon, color, label }: { icon: string; color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs font-bold ${color}`}>{icon}</span>
      <span className="text-[11px] text-slate-600">{label}</span>
    </div>
  )
}
