export interface ActiveSite {
  name: string
  job_code: string
  supervisor: string
}

const KEY = 'activeSites'

export function getActiveSites(): ActiveSite[] | null {
  try {
    const v = localStorage.getItem(KEY)
    return v ? (JSON.parse(v) as ActiveSite[]) : null
  } catch {
    return null
  }
}

export function saveActiveSites(sites: ActiveSite[]): void {
  localStorage.setItem(KEY, JSON.stringify(sites))
}

function normalizeJob(code: string): string {
  const m = code.toUpperCase().match(/^([A-Z]+)(\d+)$/)
  return m ? m[1] + String(parseInt(m[2], 10)) : code.toUpperCase()
}

function normWords(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(Boolean)
}

export function matchActiveSite(scName: string, activeSites: ActiveSite[]): ActiveSite | null {
  const parts = scName.trim().split(/\s+/)
  const firstWord = parts[0] ?? ''
  const isJobCode = /^[A-Z]{1,4}\d{2,}$/i.test(firstWord)
  const scJob = isJobCode ? normalizeJob(firstWord) : ''

  if (scJob) {
    const byJob = activeSites.find(s => normalizeJob(s.job_code) === scJob)
    if (byJob) return byJob
  }

  // Fuzzy: count overlapping words (excluding the job code word)
  const scWords = new Set(normWords(scName).filter(w => w !== scJob.toLowerCase()))
  let best: ActiveSite | null = null
  let bestScore = 0
  for (const s of activeSites) {
    const sWords = normWords(s.name)
    const overlap = [...scWords].filter(w => sWords.includes(w)).length
    if (overlap > bestScore) {
      bestScore = overlap
      best = s
    }
  }
  return bestScore >= 2 ? best : null
}
