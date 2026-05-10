const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmt(d: Date): string {
  return d.toISOString().split('T')[0]
}

export interface WeekRange {
  from: string
  to: string
  label: string
  isCurrent: boolean
}

export function getWeekRange(offset = 0): WeekRange {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dayOfWeek = today.getDay() // 0=Sun
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  const monday = new Date(today)
  monday.setDate(today.getDate() - daysFromMonday + offset * 7)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  // For current week cap to today; for past weeks use full Mon-Sun
  const endDate = offset === 0 ? today : sunday

  const label =
    monday.getMonth() === endDate.getMonth()
      ? `${monday.getDate()}–${endDate.getDate()} ${MONTHS[monday.getMonth()]} ${monday.getFullYear()}`
      : `${monday.getDate()} ${MONTHS[monday.getMonth()]} – ${endDate.getDate()} ${MONTHS[endDate.getMonth()]} ${endDate.getFullYear()}`

  return {
    from: fmt(monday),
    to: fmt(endDate),
    label,
    isCurrent: offset === 0,
  }
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
