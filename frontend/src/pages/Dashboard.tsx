import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, ChevronLeft, ChevronRight, FileUp, Users, X, Info, ClipboardList, UserPlus } from 'lucide-react'
import StatusTile from '../components/StatusTile'
import StatusCell from '../components/StatusCell'
import Spinner from '../components/Spinner'
import ErrorBanner from '../components/ErrorBanner'
import { fetchDashboard, syncDashboard, uploadRegister, uploadSites } from '../lib/api'
import { getWeekRange } from '../lib/dates'
import { getRegister, saveRegister, clearRegister, computeNotes, type PlantRegister } from '../lib/register'
import { getActiveSites, saveActiveSites, clearActiveSites, matchActiveSite, getUnmatchReason, normalizeJob, type ActiveSite } from '../lib/sites'
import { setLastRegisterPdf } from '../lib/sessionFiles'
import { STATUS_COLORS } from '../lib/statusColors'
import { useFocusTrap } from '../lib/useFocusTrap'
import { COLUMNS, ABBREV, type DashboardData, type Site, type TemplateStatus } from '../types'
import { SiteCard } from './Sites'

function missingTemplates(): Record<string, TemplateStatus> {
  return Object.fromEntries(COLUMNS.map(c => [c, {
    status: 'missing' as const,
    last_completed: null,
    audit_id: null,
    inspector: null,
    found_serials: [],
    register_only: false,
  }]))
}

export default function Dashboard() {
  const [weekOffset, setWeekOffset] = useState(0)
  const week = useMemo(() => getWeekRange(weekOffset), [weekOffset])

  useEffect(() => {
    localStorage.setItem('ashvale_selected_week', JSON.stringify({ from: week.from, to: week.to, label: week.label }))
  }, [week.from, week.to, week.label])

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  // Scoped per action so one failure can't show a stale/misattributed message
  // over an unrelated action, and each can be dismissed independently.
  const [loadError, setLoadError] = useState('')
  const [syncError, setSyncError] = useState('')
  const [registerError, setRegisterError] = useState('')
  const [sitesError, setSitesError] = useState('')
  const [search, setSearch] = useState('')
  const [showUnmatched, setShowUnmatched] = useState(false)
  const unmatchedRef = useRef<HTMLDivElement>(null)
  const unmatchedPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showUnmatched) return
    const onClickOutside = (e: MouseEvent) => {
      if (unmatchedRef.current && !unmatchedRef.current.contains(e.target as Node)) setShowUnmatched(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [showUnmatched])

  useFocusTrap(unmatchedPanelRef, showUnmatched, () => setShowUnmatched(false))

  const [showRegisterView, setShowRegisterView] = useState(false)
  const registerViewRef = useRef<HTMLDivElement>(null)
  const registerViewPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showRegisterView) return
    const onClickOutside = (e: MouseEvent) => {
      if (registerViewRef.current && !registerViewRef.current.contains(e.target as Node)) setShowRegisterView(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [showRegisterView])

  useFocusTrap(registerViewPanelRef, showRegisterView, () => setShowRegisterView(false))

  // Plant register (PDF) stored in localStorage
  const [register, setRegister] = useState<PlantRegister | null>(getRegister)
  const [registerUploading, setRegisterUploading] = useState(false)
  const registerRef = useRef<HTMLInputElement>(null)

  // Active sites Excel stored in localStorage
  const [activeSites, setActiveSites] = useState<ActiveSite[] | null>(getActiveSites)
  const [sitesUploading, setSitesUploading] = useState(false)
  const sitesRef = useRef<HTMLInputElement>(null)

  // Guards against an older in-flight request resolving after a newer one
  // (e.g. rapid week navigation) and clobbering the current week's data.
  const loadIdRef = useRef(0)

  const load = useCallback(async (from: string, to: string) => {
    const requestId = ++loadIdRef.current
    setLoading(true)
    setLoadError('')
    try {
      const d = await fetchDashboard(from, to)
      if (requestId === loadIdRef.current) setData(d)
    } catch (e) {
      if (requestId === loadIdRef.current) setLoadError(e instanceof Error ? e.message : 'Failed to load dashboard')
    } finally {
      if (requestId === loadIdRef.current) setLoading(false)
    }
  }, [])

  const hasRoster = !!activeSites && activeSites.length > 0

  useEffect(() => {
    if (hasRoster) load(week.from, week.to)
  }, [week.from, week.to, load, hasRoster])

  const handleSync = async () => {
    setSyncing(true)
    setSyncError('')
    try {
      setData(await syncDashboard(week.from, week.to))
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleRegisterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRegisterUploading(true)
    setRegisterError('')
    try {
      const { register: r } = await uploadRegister(file)
      saveRegister(r)
      setRegister(r)
      setLastRegisterPdf(file)
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Failed to upload register')
    } finally {
      setRegisterUploading(false)
      if (registerRef.current) registerRef.current.value = ''
    }
  }

  const handleClearRegister = () => {
    clearRegister()
    setRegister(null)
    setLastRegisterPdf(null)
  }

  const handleSitesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (activeSites && activeSites.length > 0) {
      const ok = window.confirm(
        `This replaces your current ${activeSites.length} sites (including any manual edits) with what's in this Excel. Continue?`
      )
      if (!ok) {
        if (sitesRef.current) sitesRef.current.value = ''
        return
      }
    }
    setSitesUploading(true)
    setSitesError('')
    try {
      const { sites } = await uploadSites(file)
      saveActiveSites(sites)
      setActiveSites(sites)
    } catch (err) {
      setSitesError(err instanceof Error ? err.message : 'Failed to upload sites Excel')
    } finally {
      setSitesUploading(false)
      if (sitesRef.current) sitesRef.current.value = ''
    }
  }

  const handleClearSites = () => {
    clearActiveSites()
    setActiveSites(null)
  }

  // Your roster (activeSites) is authoritative for WHICH sites show; SafetyCulture
  // only supplies per-site compliance status. A roster site with no matching
  // SafetyCulture activity this week still shows, marked fully missing rather
  // than silently disappearing.
  const { enrichedSites, unmatchedSites } = useMemo(() => {
    type Unmatched = { name: string; job_code: string; reason: string }
    if (!activeSites || activeSites.length === 0 || !data) {
      return { enrichedSites: [] as Site[], unmatchedSites: [] as Unmatched[] }
    }

    const byJob = new Map<string, Site>()
    const byName = new Map<string, Site>()
    for (const s of data.sites) {
      if (s.job_code) byJob.set(normalizeJob(s.job_code), s)
      byName.set(s.name.toLowerCase(), s)
    }

    const enrichedSites: Site[] = activeSites.map(roster => {
      const jobKey = roster.job_code ? normalizeJob(roster.job_code) : ''
      const match = (jobKey && byJob.get(jobKey)) || byName.get(roster.name.toLowerCase())
      if (match) {
        return { ...match, job_code: roster.job_code || match.job_code, supervisor: roster.supervisor }
      }
      return { name: roster.name, job_code: roster.job_code, supervisor: roster.supervisor, templates: missingTemplates() }
    })

    // SafetyCulture sites with real activity this week that aren't on your roster —
    // informational only, doesn't feed the table.
    const unmatchedSites: Unmatched[] = data.sites
      .filter(s => !matchActiveSite(s.name, activeSites))
      .map(s => {
        const firstWord = s.name.trim().split(/\s+/)[0] ?? ''
        const isJobCode = /^[A-Z]{1,4}\d{2,}$/i.test(firstWord)
        const jobCode = isJobCode ? normalizeJob(firstWord) : (s.job_code ?? '')
        return { name: s.name, job_code: jobCode, reason: getUnmatchReason(s.name) }
      })

    return { enrichedSites, unmatchedSites }
  }, [data, activeSites])

  const filteredSites = useMemo(() => {
    const q = search.toLowerCase()
    return q
      ? enrichedSites.filter(s => s.name.toLowerCase().includes(q) || (s.supervisor ?? '').toLowerCase().includes(q))
      : enrichedSites
  }, [enrichedSites, search])

  const gapSites = enrichedSites.filter(s =>
    Object.values(s.templates).some(t => t.status !== 'ok')
  ).length

  const showSupervisor = hasRoster
  const showNotes = register !== null

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            aria-label="Previous week"
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-slate-200 min-w-[180px] text-center">{week.label}</span>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            disabled={weekOffset >= 0}
            aria-label="Next week"
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
          <label htmlFor="dashboard-filter" className="sr-only">Filter sites by name or supervisor</label>
          <div className="relative">
            <input
              id="dashboard-filter"
              type="text"
              placeholder="Filter sites or supervisor…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-surface border border-edge rounded-lg pl-3 pr-7 py-1.5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 w-44"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear filter"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Upload Sites Excel */}
          <div className="flex items-center">
            <label className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer border ${
              activeSites ? 'rounded-l-lg' : 'rounded-lg'
            } ${
              activeSites
                ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30'
                : 'bg-surface border-edge text-slate-400 hover:text-white hover:border-slate-500'
            } ${sitesUploading ? 'opacity-60 cursor-wait' : ''}`}>
              <Users size={13} />
              {sitesUploading ? 'Loading…' : activeSites ? `${activeSites.length} sites` : 'Upload Sites'}
              <input ref={sitesRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleSitesUpload} disabled={sitesUploading} />
            </label>
            {activeSites && !sitesUploading && (
              <button
                onClick={handleClearSites}
                aria-label="Clear uploaded sites Excel"
                title="Clear uploaded sites Excel"
                className="px-2 py-1.5 rounded-r-lg border border-l-0 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Upload Plant Register PDF */}
          <div className="flex items-center">
            <label className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer border ${
              register ? 'rounded-l-lg' : 'rounded-lg'
            } ${
              register
                ? 'bg-violet-600/20 border-violet-500/30 text-violet-400 hover:bg-violet-600/30'
                : 'bg-surface border-edge text-slate-400 hover:text-white hover:border-slate-500'
            } ${registerUploading ? 'opacity-60 cursor-wait' : ''}`}>
              <FileUp size={13} />
              {registerUploading ? 'Parsing…' : register ? 'Register ✓' : 'Upload Register'}
              <input ref={registerRef} type="file" accept=".pdf" className="hidden" onChange={handleRegisterUpload} disabled={registerUploading} />
            </label>
            {register && !registerUploading && (
              <>
                <button
                  onClick={() => setShowRegisterView(true)}
                  aria-label="View parsed plant register"
                  title="View what was parsed from the register PDF"
                  className="px-2 py-1.5 border-y border-violet-500/30 text-violet-400 hover:bg-violet-600/30 transition-colors"
                >
                  <ClipboardList size={13} />
                </button>
                <button
                  onClick={handleClearRegister}
                  aria-label="Clear uploaded plant register"
                  title="Clear uploaded plant register"
                  className="px-2 py-1.5 rounded-r-lg border border-l-0 border-violet-500/30 text-violet-400 hover:bg-violet-600/30 transition-colors"
                >
                  <X size={13} />
                </button>
              </>
            )}
          </div>
          {showRegisterView && register && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" ref={registerViewRef}>
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRegisterView(false)} />
              <div
                ref={registerViewPanelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Parsed plant register contents"
                className="relative bg-surface border border-edge rounded-2xl w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
                  <h2 className="text-white font-semibold text-sm">Parsed Plant Register</h2>
                  <button onClick={() => setShowRegisterView(false)} aria-label="Close" className="text-slate-500 hover:text-white transition-colors">
                    <X size={16} />
                  </button>
                </div>
                <div className="px-5 py-4 overflow-y-auto space-y-4">
                  {Object.keys(register).length === 0 && (
                    <p className="text-slate-600 text-sm">No machines were parsed from the uploaded PDF.</p>
                  )}
                  {Object.entries(register).map(([job, types]) => (
                    <div key={job}>
                      <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{job}</p>
                      <div className="mt-1 space-y-0.5">
                        {Object.entries(types).map(([mtype, serials]) => (
                          <p key={mtype} className="text-xs text-slate-500 pl-2">
                            <span className="text-slate-400">{mtype}:</span> {serials.length > 0 ? serials.join(', ') : '—'}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {unmatchedSites.length > 0 && (
            <div className="relative" ref={unmatchedRef}>
              <button
                onClick={() => setShowUnmatched(v => !v)}
                aria-expanded={showUnmatched}
                className="text-xs text-amber-400/70 cursor-pointer border border-amber-500/20 px-2 py-1 rounded-md hover:bg-amber-500/10 transition-colors"
              >
                ⚠ {unmatchedSites.length} sites not on your roster
              </button>
              {showUnmatched && (
                <div
                  ref={unmatchedPanelRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Sites not on your roster"
                  className="absolute right-0 top-full mt-1 z-50 bg-surface border border-edge rounded-xl shadow-xl p-3 min-w-[320px]"
                >
                  <p className="text-[11px] text-slate-500 mb-2 font-medium uppercase tracking-wider">SafetyCulture activity not on your roster</p>
                  <ul className="space-y-2">
                    {unmatchedSites.map(({ name, job_code, reason }) => (
                      <li key={name} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-slate-200 font-medium">{name}</p>
                          <p className="text-xs text-amber-400/70">{reason}</p>
                        </div>
                        <Link
                          to="/manage-sites"
                          state={{ name, job_code }}
                          className="shrink-0 text-xs font-medium text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400/50 px-2 py-1 rounded-md transition-colors"
                        >
                          Add
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-slate-600 mt-3 border-t border-edge pt-2">
                    SafetyCulture has inspections for these sites this week, but they're not on your roster so they're hidden from the dashboard. Click "Add" to include them going forward.
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleSync}
            disabled={loading || syncing}
            title="Force a fresh fetch from SafetyCulture, bypassing the 1-hour cache (the page already auto-loads on open/week change)"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Errors — scoped per action so a stale one can't be misattributed, each dismissable */}
      <ErrorBanner message={loadError} onDismiss={() => setLoadError('')} onRetry={() => load(week.from, week.to)} />
      <ErrorBanner message={syncError} onDismiss={() => setSyncError('')} onRetry={handleSync} />
      <ErrorBanner message={registerError} onDismiss={() => setRegisterError('')} />
      <ErrorBanner message={sitesError} onDismiss={() => setSitesError('')} />

      {/* Local-storage disclosure — supervisor/notes data is per-browser, not shared */}
      {(activeSites || register) && (
        <div className="flex items-center gap-2 text-slate-600 text-xs">
          <Info size={13} />
          {activeSites && register
            ? 'Uploaded sites and plant register are saved in this browser only — not visible on other devices.'
            : activeSites
            ? 'Uploaded sites Excel is saved in this browser only — not visible on other devices.'
            : 'Uploaded plant register is saved in this browser only — not visible on other devices.'}
        </div>
      )}

      {!hasRoster ? (
        <EmptyRosterState onUpload={handleSitesUpload} uploading={sitesUploading} />
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-3 gap-4">
            <StatusTile label="Active Sites" value={activeSites?.length ?? 0} />
            <StatusTile label="Fully Compliant" value={enrichedSites.length - gapSites} color="green" />
            <StatusTile label="Has Gaps" value={gapSites} color="red" />
          </div>

          {/* Loading */}
          {loading && !data && (
            <div className="bg-surface border border-edge rounded-xl p-12 text-center">
              <Spinner className="w-8 h-8 mb-4" />
              <p className="text-slate-400 text-sm">Loading inspection data from SafetyCulture…</p>
              <p className="text-slate-600 text-xs mt-1">This may take 30–60 seconds on first load</p>
            </div>
          )}

          {/* Compliance matrix — card grid on narrow viewports, full table from md up */}
          {data && (
            <>
              <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredSites.length === 0 ? (
                  <div className="col-span-full py-10 text-center text-slate-600 text-sm bg-surface border border-edge rounded-xl">
                    {search ? `No sites matching "${search}"` : 'No sites on your roster'}
                  </div>
                ) : (
                  filteredSites.map(site => <SiteCard key={site.name} site={site} from="dashboard" />)
                )}
              </div>

              <div className="hidden md:block rounded-xl border border-edge overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface">
                      <th className="text-left px-4 py-3 text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-edge w-48 sticky left-0 bg-surface z-10">
                        Site
                      </th>
                      {showSupervisor && (
                        <th className="px-3 py-3 text-left text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-edge w-32">
                          Supervisor
                        </th>
                      )}
                      {COLUMNS.map(col => (
                        <th
                          key={col}
                          title={col}
                          className="px-2 py-3 text-center text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-edge min-w-[52px]"
                        >
                          {ABBREV[col]}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-edge w-20">
                        Status
                      </th>
                      {showNotes && (
                        <th className="px-4 py-3 text-left text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-edge min-w-[200px]">
                          Notes
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSites.length === 0 && (
                      <tr>
                        <td colSpan={COLUMNS.length + (showSupervisor ? 1 : 0) + (showNotes ? 1 : 0) + 2} className="px-4 py-10 text-center text-slate-600 text-sm">
                          {search ? `No sites matching "${search}"` : 'No sites on your roster'}
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
              <div className="flex items-center gap-5 px-4 py-3 border-t border-edge bg-overlay">
                <span className="text-[11px] text-slate-600 font-medium">Legend:</span>
                <LegendItem icon="✓" color="text-green-400" label="Completed this week" />
                <LegendItem icon="⏱" color="text-amber-400" label="Overdue" />
                <LegendItem icon="✗" color="text-red-500" label="Missing" />
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-400" />
                  <span className="text-[11px] text-slate-600">PUWER Register only — no individual inspection filed</span>
                </div>
              </div>
              </div>
            </>
          )}

          {data && (
            <p className="text-xs text-slate-700 text-right">
              Last fetched: {new Date(data.generated_at).toLocaleTimeString()}
            </p>
          )}
        </>
      )}
    </div>
  )
}

function EmptyRosterState({
  onUpload, uploading,
}: {
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  uploading: boolean
}) {
  return (
    <div className="bg-surface border border-edge rounded-xl p-10 text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto">
        <Users size={22} className="text-blue-400" />
      </div>
      <div>
        <h2 className="text-white font-semibold text-base">No sites set up yet</h2>
        <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
          Choose which sites to track before the dashboard shows anything — add them manually, or upload an Excel with your site list.
        </p>
      </div>
      <div className="flex items-center justify-center gap-3 pt-1">
        <Link
          to="/manage-sites"
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <UserPlus size={14} />
          Manage Sites
        </Link>
        <label className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer border bg-base border-edge text-slate-300 hover:text-white hover:border-slate-500 ${uploading ? 'opacity-60 cursor-wait' : ''}`}>
          <FileUp size={14} />
          {uploading ? 'Loading…' : 'Upload Sites Excel'}
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onUpload} disabled={uploading} />
        </label>
      </div>
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
  const allOk  = Object.values(site.templates).every(t => t.status === 'ok' || t.status === 'n/a')
  const hasRed = Object.values(site.templates).some(t => t.status === 'missing')
  const notes  = register ? computeNotes(site, register) : []

  return (
    <tr className={`border-b border-edge/60 ${idx % 2 === 1 ? 'bg-white/[0.015]' : ''} hover:bg-white/[0.03] transition-colors`}>
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
            STATUS_COLORS[allOk ? 'ok' : hasRed ? 'missing' : 'overdue'].bg
          } ${STATUS_COLORS[allOk ? 'ok' : hasRed ? 'missing' : 'overdue'].text}`}
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
