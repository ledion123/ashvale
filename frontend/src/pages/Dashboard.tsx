import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, ChevronLeft, ChevronRight, AlertCircle, FileUp, Users } from 'lucide-react'
import StatusTile from '../components/StatusTile'
import StatusCell from '../components/StatusCell'
import { fetchDashboard, syncDashboard, uploadRegister, uploadSites } from '../lib/api'
import { getWeekRange } from '../lib/dates'
import { getRegister, saveRegister, computeNotes, type PlantRegister } from '../lib/register'
import { getActiveSites, saveActiveSites, matchActiveSite, type ActiveSite } from '../lib/sites'
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

  // Plant register (PDF) stored in localStorage
  const [register, setRegister] = useState<PlantRegister | null>(getRegister)
  const [registerUploading, setRegisterUploading] = useState(false)
  const registerRef = useRef<HTMLInputElement>(null)

  // Active sites Excel stored in localStorage
  const [activeSites, setActiveSites] = useState<ActiveSite[] | null>(getActiveSites)
  const [sitesUploading, setSitesUploading] = useState(false)
  const sitesRef = useRef<HTMLInputElement>(null)

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

  const handleRegisterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRegisterUploading(true)
    setError('')
    try {
      const { register: r } = await uploadRegister(file)
      saveRegister(r)
      setRegister(r)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload register')
    } finally {
      setRegisterUploading(false)
      if (registerRef.current) registerRef.current.value = ''
    }
  }

  const handleSitesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSitesUploading(true)
    setError('')
    try {
      const { sites } = await uploadSites(file)
      saveActiveSites(sites)
      setActiveSites(sites)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload sites Excel')
    } finally {
      setSitesUploading(false)
      if (sitesRef.current) sitesRef.current.value = ''
    }
  }

  // Merge activeSites into the API response and filter to only active sites
  const enrichedSites: Site[] = useMemo(() => {
    if (!data) return []
    return data.sites.flatMap(site => {
      if (activeSites) {
        const match = matchActiveSite(site.name, activeSites)
        if (!match) return []  // hide sites not in the active list
        return [{ ...site, job_code: match.job_code || site.job_code, supervisor: match.supervisor }]
      }
      return [site]
    })
  }, [data, activeSites])

  const filteredSites = useMemo(() => {
    const q = search.toLowerCase()
    return q ? enrichedSites.filter(s => s.name.toLowerCase().includes(q)) : enrichedSites
  }, [enrichedSites, search])

  const gapSites = enrichedSites.filter(s =>
    Object.values(s.templates).some(t => t.status !== 'ok')
  ).length

  const showSupervisor = activeSites !== null
  const showNotes = register !== null

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

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Filter sites…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-[#1a1d27] border border-[#2a2d3a] rounded-lg px-3 py-1.5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 w-40"
          />

          {/* Upload Sites Excel */}
          <label className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer border ${
            activeSites
              ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30'
              : 'bg-[#1a1d27] border-[#2a2d3a] text-slate-400 hover:text-white hover:border-slate-500'
          } ${sitesUploading ? 'opacity-60 cursor-wait' : ''}`}>
            <Users size={13} />
            {sitesUploading ? 'Loading…' : activeSites ? `${activeSites.length} sites` : 'Upload Sites'}
            <input ref={sitesRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleSitesUpload} disabled={sitesUploading} />
          </label>

          {/* Upload Plant Register PDF */}
          <label className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer border ${
            register
              ? 'bg-violet-600/20 border-violet-500/30 text-violet-400 hover:bg-violet-600/30'
              : 'bg-[#1a1d27] border-[#2a2d3a] text-slate-400 hover:text-white hover:border-slate-500'
          } ${registerUploading ? 'opacity-60 cursor-wait' : ''}`}>
            <FileUp size={13} />
            {registerUploading ? 'Parsing…' : register ? 'Register ✓' : 'Upload Register'}
            <input ref={registerRef} type="file" accept=".pdf" className="hidden" onChange={handleRegisterUpload} disabled={registerUploading} />
          </label>

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
        <StatusTile label="Active Sites" value={enrichedSites.length || (data?.summary.total ?? 0)} />
        <StatusTile label="Fully Compliant" value={enrichedSites.length - gapSites} color="green" />
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
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-[#2a2d3a] w-48 sticky left-0 bg-[#1a1d27] z-10">
                    Site
                  </th>
                  {showSupervisor && (
                    <th className="px-3 py-3 text-left text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-[#2a2d3a] w-32">
                      Supervisor
                    </th>
                  )}
                  {COLUMNS.map(col => (
                    <th
                      key={col}
                      title={col}
                      className="px-2 py-3 text-center text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-[#2a2d3a] min-w-[52px]"
                    >
                      {ABBREV[col]}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-[#2a2d3a] w-20">
                    Status
                  </th>
                  {showNotes && (
                    <th className="px-4 py-3 text-left text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-[#2a2d3a] min-w-[200px]">
                      Notes
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredSites.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length + (showSupervisor ? 1 : 0) + (showNotes ? 1 : 0) + 2} className="px-4 py-10 text-center text-slate-600 text-sm">
                      {search ? `No sites matching "${search}"` : 'No inspection data found for this week'}
                    </td>
                  </tr>
                )}
                {filteredSites.map((site, i) => (
                  <SiteRow
                    key={site.name}
                    site={site}
                    idx={i}
                    showSupervisor={showSupervisor}
                    register={register}
                    showNotes={showNotes}
                  />
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

function SiteRow({
  site, idx, showSupervisor, register, showNotes,
}: {
  site: Site
  idx: number
  showSupervisor: boolean
  register: PlantRegister | null
  showNotes: boolean
}) {
  const allOk  = Object.values(site.templates).every(t => t.status === 'ok')
  const hasRed = Object.values(site.templates).some(t => t.status === 'missing')
  const notes  = register ? computeNotes(site, register) : []

  return (
    <tr className={`border-b border-[#2a2d3a]/60 ${idx % 2 === 1 ? 'bg-white/[0.015]' : ''} hover:bg-white/[0.03] transition-colors`}>
      <td className="px-4 py-2.5 sticky left-0 bg-inherit z-10">
        <Link
          to="/sites"
          state={{ filter: site.name }}
          className="text-slate-200 font-medium text-sm hover:text-white transition-colors truncate block max-w-[176px]"
          title={site.name}
        >
          {site.name}
        </Link>
      </td>
      {showSupervisor && (
        <td className="px-3 py-2.5">
          <span className="text-slate-400 text-xs truncate block max-w-[120px]" title={site.supervisor}>
            {site.supervisor || <span className="text-slate-700">—</span>}
          </span>
        </td>
      )}
      {['EXCAVATOR', 'LOLER', 'DUMPER', 'ROLLER', 'TELEHAND', 'PUWER', 'SITE SUP', 'HAVS', 'TOOLBOX'].map(col => (
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
      {showNotes && (
        <td className="px-4 py-2.5 text-xs max-w-xs">
          {notes.length > 0
            ? <span className="text-amber-400/90 leading-relaxed">{notes.join('; ')}</span>
            : <span className="text-slate-700">—</span>
          }
        </td>
      )}
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
