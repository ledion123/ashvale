import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Plus, Pencil, Trash2, ChevronDown, Loader2, Check, X, CheckCircle2 } from 'lucide-react'
import { getActiveSites, saveActiveSites, parseJobCode, type ActiveSite } from '../lib/sites'
import { fetchSCSites, type SCSite } from '../lib/api'

const EMPTY: ActiveSite = { name: '', job_code: '', supervisor: '' }

export default function ManageSites() {
  const location = useLocation()
  const prefill = (location.state as Partial<ActiveSite>) ?? {}

  const [sites, setSites] = useState<ActiveSite[]>(() => getActiveSites() ?? [])
  const [form, setForm] = useState<ActiveSite>({ ...EMPTY, ...prefill })
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [pendingRemove, setPendingRemove] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')

  const flash = (message: string) => {
    setFeedback(message)
    window.setTimeout(() => setFeedback(f => (f === message ? '' : f)), 3000)
  }

  // "Add from SafetyCulture" dropdown — multi-select from real SC sites,
  // for when the site can't be found/matched in the uploaded Excel.
  const [scOpen, setScOpen] = useState(false)
  const [scSites, setScSites] = useState<SCSite[] | null>(null)
  const [scLoading, setScLoading] = useState(false)
  const [scError, setScError] = useState('')
  const [scSearch, setScSearch] = useState('')
  const [scSelected, setScSelected] = useState<Set<string>>(new Set())
  const scRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scOpen) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setScOpen(false) }
    const onClickOutside = (e: MouseEvent) => {
      if (scRef.current && !scRef.current.contains(e.target as Node)) setScOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onClickOutside)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onClickOutside)
    }
  }, [scOpen])

  const openScPicker = () => {
    setScOpen(v => !v)
    if (scSites === null && !scLoading) {
      setScLoading(true)
      setScError('')
      fetchSCSites()
        .then(r => setScSites(r.sites))
        .catch(e => setScError(e instanceof Error ? e.message : 'Failed to load SafetyCulture sites'))
        .finally(() => setScLoading(false))
    }
  }

  const existingNames = useMemo(() => new Set(sites.map(s => s.name.toLowerCase())), [sites])

  const scAvailable = useMemo(() => {
    if (!scSites) return []
    const q = scSearch.toLowerCase()
    return scSites
      .filter(s => !existingNames.has(s.name.toLowerCase()))
      .filter(s => !q || s.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [scSites, existingNames, scSearch])

  const toggleScSelected = (name: string) => {
    setScSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleAddSelected = () => {
    if (scSelected.size === 0) return
    const additions: ActiveSite[] = [...scSelected].map(name => ({
      name,
      job_code: parseJobCode(name),
      supervisor: '',
    }))
    persist([...sites, ...additions])
    flash(`Added ${additions.length} site${additions.length === 1 ? '' : 's'}`)
    setScSelected(new Set())
  }

  const persist = (next: ActiveSite[]) => {
    setSites(next)
    saveActiveSites(next)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const entry: ActiveSite = {
      name: form.name.trim(),
      job_code: form.job_code.trim(),
      supervisor: form.supervisor.trim(),
    }
    if (editIndex !== null) {
      const next = [...sites]
      next[editIndex] = entry
      persist(next)
      flash(`Saved ${entry.name}`)
    } else {
      persist([...sites, entry])
      flash(`Added ${entry.name}`)
    }
    setForm(EMPTY)
    setEditIndex(null)
  }

  const handleEdit = (i: number) => {
    setForm(sites[i])
    setEditIndex(i)
    setPendingRemove(null)
  }

  const handleCancelEdit = () => {
    setForm(EMPTY)
    setEditIndex(null)
  }

  const handleRemove = (i: number) => {
    const removed = sites[i]
    persist(sites.filter((_, idx) => idx !== i))
    if (editIndex === i) handleCancelEdit()
    setPendingRemove(null)
    flash(`Removed ${removed.name}`)
  }

  const q = search.toLowerCase()
  const filtered = q
    ? sites.filter(s => s.name.toLowerCase().includes(q) || s.job_code.toLowerCase().includes(q))
    : sites

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-white font-semibold text-lg">Manage Sites</h1>
        <div className="flex items-center gap-2">
          <div className="relative" ref={scRef}>
            <button
              onClick={openScPicker}
              aria-expanded={scOpen}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer border bg-surface border-edge text-slate-400 hover:text-white hover:border-slate-500"
            >
              Add from SafetyCulture
              <ChevronDown size={14} className={scOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {scOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-edge rounded-xl shadow-xl p-3 w-96">
                <p className="text-[11px] text-slate-500 mb-2 font-medium uppercase tracking-wider">
                  Pick sites straight from SafetyCulture — for when the Excel can't find them
                </p>
                <input
                  type="text"
                  placeholder="Filter…"
                  value={scSearch}
                  onChange={e => setScSearch(e.target.value)}
                  className="w-full bg-base border border-edge rounded-lg px-3 py-1.5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 mb-2"
                />
                {scLoading && (
                  <div className="flex items-center gap-2 text-slate-500 text-sm py-4 justify-center">
                    <Loader2 size={14} className="animate-spin" />
                    Loading sites…
                  </div>
                )}
                {scError && <p className="text-red-400 text-xs py-2">{scError}</p>}
                {!scLoading && !scError && (
                  <ul className="max-h-72 overflow-y-auto space-y-0.5">
                    {scAvailable.length === 0 && (
                      <li className="text-slate-600 text-sm py-4 text-center">
                        {scSearch ? 'No matches' : 'All SafetyCulture sites are already in your list'}
                      </li>
                    )}
                    {scAvailable.map(s => (
                      <li key={s.id}>
                        <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 cursor-pointer text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={scSelected.has(s.name)}
                            onChange={() => toggleScSelected(s.name)}
                            className="accent-blue-500"
                          />
                          {s.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-edge">
                  <span className="text-xs text-slate-600">{scSelected.size} selected</span>
                  <button
                    onClick={handleAddSelected}
                    disabled={scSelected.size === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    <Plus size={13} />
                    Add {scSelected.size || ''} selected
                  </button>
                </div>
              </div>
            )}
          </div>
          <input
            type="text"
            placeholder="Filter sites…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-surface border border-edge rounded-lg px-3 py-1.5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 w-48"
          />
        </div>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg px-4 py-2.5 text-sm">
          <CheckCircle2 size={15} />
          {feedback}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface border border-edge rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Site name</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. AB0020 Cromwell Place, Wixams"
            className="w-full bg-base border border-edge rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="w-32">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Job code</label>
          <input
            type="text"
            value={form.job_code}
            onChange={e => setForm(f => ({ ...f, job_code: e.target.value }))}
            placeholder="AB20"
            className="w-full bg-base border border-edge rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="w-44">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Supervisor</label>
          <input
            type="text"
            value={form.supervisor}
            onChange={e => setForm(f => ({ ...f, supervisor: e.target.value }))}
            placeholder="Jane Smith"
            className="w-full bg-base border border-edge rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={14} />
            {editIndex !== null ? 'Save' : 'Add site'}
          </button>
          {editIndex !== null && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-3 py-2 text-slate-400 hover:text-white text-sm font-medium rounded-lg border border-edge transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="rounded-xl border border-edge overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-surface">
              <th className="text-left px-4 py-3 text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-edge">Site</th>
              <th className="text-left px-4 py-3 text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-edge w-28">Job code</th>
              <th className="text-left px-4 py-3 text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-edge w-40">Supervisor</th>
              <th className="px-4 py-3 border-b border-edge w-20" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-600 text-sm">
                  {search ? `No sites matching "${search}"` : 'No sites added yet — use the form above'}
                </td>
              </tr>
            )}
            {filtered.map(s => {
              const realIndex = sites.indexOf(s)
              return (
                <tr key={`${s.name}-${realIndex}`} className="border-b border-edge/60 hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-2.5 text-slate-200">{s.name}</td>
                  <td className="px-4 py-2.5 text-slate-400">{s.job_code || <span className="text-slate-700">—</span>}</td>
                  <td className="px-4 py-2.5 text-slate-400">{s.supervisor || <span className="text-slate-700">—</span>}</td>
                  <td className="px-4 py-2.5">
                    {pendingRemove === realIndex ? (
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs text-red-400">Remove?</span>
                        <button
                          onClick={() => handleRemove(realIndex)}
                          aria-label={`Confirm remove ${s.name}`}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setPendingRemove(null)}
                          aria-label="Cancel remove"
                          className="text-slate-500 hover:text-white transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 justify-end">
                        <button onClick={() => handleEdit(realIndex)} aria-label={`Edit ${s.name}`} className="text-slate-500 hover:text-white transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setPendingRemove(realIndex)} aria-label={`Remove ${s.name}`} className="text-slate-500 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      <p className="text-xs text-slate-600">
        {sites.length} site{sites.length === 1 ? '' : 's'} saved locally in this browser. Uploading an Excel on the Dashboard replaces this whole list.
      </p>
    </div>
  )
}
