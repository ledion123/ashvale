import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { X, Upload, FileSpreadsheet, FileText, RotateCcw } from 'lucide-react'
import { getLastRegisterPdf } from '../lib/sessionFiles'

function getWeekDates() {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { from: fmt(monday), to: fmt(today) }
}

export default function GenerateModal() {
  const [open, setOpen] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [reusablePdf, setReusablePdf] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const { from, to } = getWeekDates()
    setFromDate(from)
    setToDate(to)

    const handler = () => setOpen(true)
    document.addEventListener('open-generate-modal', handler)
    return () => document.removeEventListener('open-generate-modal', handler)
  }, [])

  useEffect(() => {
    if (open) setReusablePdf(getLastRegisterPdf())
  }, [open])

  useEffect(() => {
    if (open) closeBtnRef.current?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    setError('')
    setSuccess(false)
    setLoading(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      close()
      return
    }
    if (e.key !== 'Tab' || !dialogRef.current) return
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!excelFile) { setError('Please upload your weekly Excel template'); return }
    if (!fromDate || !toDate) { setError('Please select both dates'); return }
    if (new Date(fromDate) > new Date(toDate)) { setError('From date must be before To date'); return }

    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('fromDate', fromDate)
      form.append('toDate', toDate)
      form.append('siteFile', excelFile)
      if (pdfFile) form.append('pdfFile', pdfFile)

      const res = await fetch('/generate', { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `Server error ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Ashvale_Summary_${fromDate}_to_${toDate}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-modal-title"
        className="relative bg-surface border border-edge rounded-2xl w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-edge">
          <div>
            <h2 id="generate-modal-title" className="text-white font-semibold text-base">Generate Excel Report</h2>
            <p className="text-slate-500 text-xs mt-0.5">Upload your template, pick a date range, download</p>
          </div>
          <button ref={closeBtnRef} onClick={close} aria-label="Close" className="text-slate-500 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <UploadField
            label="Site Template (Excel)"
            accept=".xlsx,.xls"
            file={excelFile}
            onChange={setExcelFile}
            icon={<FileSpreadsheet size={20} className="text-slate-500" />}
          />
          <UploadField
            label="WHATS WHERE PDF"
            optional
            accept=".pdf"
            file={pdfFile}
            onChange={setPdfFile}
            icon={<FileText size={20} className="text-slate-500" />}
          />
          {reusablePdf && !pdfFile && (
            <button
              type="button"
              onClick={() => setPdfFile(reusablePdf)}
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors -mt-2"
            >
              <RotateCcw size={12} />
              Reuse "{reusablePdf.name}" already uploaded on the Dashboard
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="w-full bg-base border border-edge rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">To</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="w-full bg-base border border-edge rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 [color-scheme:dark]"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
          {success && <p className="text-green-400 text-xs">Report downloaded successfully.</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
          >
            {loading ? 'Fetching inspections…' : 'Generate & Download'}
          </button>
          {loading && (
            <p className="text-center text-xs text-slate-500">This may take 30–60 seconds while fetching from SafetyCulture…</p>
          )}
        </form>
      </div>
    </div>
  )
}

function UploadField({
  label, optional, accept, file, onChange, icon,
}: {
  label: string
  optional?: boolean
  accept: string
  file: File | null
  onChange: (f: File | null) => void
  icon: React.ReactNode
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
        {label} {optional && <span className="normal-case font-normal text-slate-600">(optional)</span>}
      </label>
      <div
        onClick={() => inputRef.current?.click()}
        className={`border rounded-lg px-4 py-3 cursor-pointer flex items-center gap-3 transition-colors ${
          file
            ? 'border-green-500/50 bg-green-500/5'
            : 'border-edge hover:border-edge-hover bg-base'
        }`}
      >
        {icon}
        <span className={`text-sm flex-1 truncate ${file ? 'text-green-400' : 'text-slate-500'}`}>
          {file ? file.name : `Click to upload ${label.toLowerCase()}`}
        </span>
        {file && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(null); if (inputRef.current) inputRef.current.value = '' }}
            className="text-slate-600 hover:text-slate-400 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}
