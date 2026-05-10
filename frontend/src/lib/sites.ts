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

  // 1. Job code exact match (most reliable)
  if (scJob) {
    const byJob = activeSites.find(s => s.job_code && normalizeJob(s.job_code) === scJob)
    if (byJob) return byJob
  }

  // 2. Substring containment for sites without job codes (e.g. "Vandome Close" ↔ "Vandome")
  if (!scJob) {
    const scNorm = normWords(scName).join(' ')
    const contained = activeSites.find(s => {
      const sNorm = normWords(s.name).join(' ')
      return sNorm.length > 0 && (scNorm.includes(sNorm) || sNorm.includes(scNorm))
    })
    if (contained) return contained
  }

  // 3. Word overlap fallback — threshold 1 when no job code, 2 when job code present
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
  return bestScore >= (scJob ? 2 : 1) ? best : null
}
