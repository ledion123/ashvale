import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { getActiveSites, saveActiveSites, type ActiveSite } from '../lib/sites'

const EMPTY: ActiveSite = { name: '', job_code: '', supervisor: '' }

export default function ManageSites() {
  const location = useLocation()
  const prefill = (location.state as Partial<ActiveSite>) ?? {}

  const [sites, setSites] = useState<ActiveSite[]>(() => getActiveSites() ?? [])
  const [form, setForm] = useState<ActiveSite>({ ...EMPTY, ...prefill })
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [search, setSearch] = useState('')

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
    } else {
      persist([...sites, entry])
    }
    setForm(EMPTY)
    setEditIndex(null)
  }

  const handleEdit = (i: number) => {
    setForm(sites[i])
    setEditIndex(i)
  }

  const handleCancelEdit = () => {
    setForm(EMPTY)
    setEditIndex(null)
  }

  const handleRemove = (i: number) => {
    persist(sites.filter((_, idx) => idx !== i))
    if (editIndex === i) handleCancelEdit()
  }

  const q = search.toLowerCase()
  const filtered = q
    ? sites.filter(s => s.name.toLowerCase().includes(q) || s.job_code.toLowerCase().includes(q))
    : sites

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-white font-semibold text-lg">Manage Sites</h1>
        <input
          type="text"
          placeholder="Filter sites…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-surface border border-edge rounded-lg px-3 py-1.5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 w-48"
        />
      </div>

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
                    <div className="flex items-center gap-3 justify-end">
                      <button onClick={() => handleEdit(realIndex)} aria-label={`Edit ${s.name}`} className="text-slate-500 hover:text-white transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleRemove(realIndex)} aria-label={`Remove ${s.name}`} className="text-slate-500 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-600">
        {sites.length} site{sites.length === 1 ? '' : 's'} saved locally in this browser. Uploading an Excel on the Dashboard replaces this whole list.
      </p>
    </div>
  )
}
