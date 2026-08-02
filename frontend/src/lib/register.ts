import type { Site } from '../types'

export type PlantRegister = Record<string, Record<string, string[]>>
// { "DAN3": { "LOLER": ["SL1234", "FK5678"], "EXCAVATOR": ["ASH001"] } }

const KEY = 'plantRegister'

export function getRegister(): PlantRegister | null {
  try {
    const v = localStorage.getItem(KEY)
    return v ? (JSON.parse(v) as PlantRegister) : null
  } catch {
    return null
  }
}

export function saveRegister(r: PlantRegister): void {
  localStorage.setItem(KEY, JSON.stringify(r))
}

export function clearRegister(): void {
  localStorage.removeItem(KEY)
}

const PUWER_MACHINE_TYPES = ['EXCAVATOR', 'DUMPER', 'ROLLER', 'TELEHAND']

export function computeNotes(site: Site, register: PlantRegister): string[] {
  const jobCode = site.job_code ?? ''
  const reg = register[jobCode]
  if (!reg) return []

  const notes: string[] = []

  for (const [col, tpl] of Object.entries(site.templates)) {
    if (tpl.status !== 'ok') continue

    const found = new Set(tpl.found_serials ?? [])

    // For PUWER, compare against union of all 4 machine type registers
    const registered = new Set<string>(
      col === 'PUWER'
        ? PUWER_MACHINE_TYPES.flatMap(t => reg[t] ?? [])
        : (reg[col] ?? [])
    )

    if (registered.size === 0) continue

    if (found.size === 0) {
      notes.push(`No serial no. on ${col}`)
      continue
    }

    const missing = [...registered].filter(s => !found.has(s))
    const unknown = [...found].filter(s => !registered.has(s))

    if (missing.length) notes.push(`Not inspected (${col}): ${missing.join(', ')}`)
    if (unknown.length) notes.push(`Not in register (${col}): ${unknown.join(', ')}`)
  }

  return notes
}
