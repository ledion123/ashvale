interface Props {
  label: string
  value: number
  color?: 'green' | 'red' | 'default'
  sub?: string
}

export default function StatusTile({ label, value, color = 'default', sub }: Props) {
  const accent =
    color === 'green'
      ? 'text-green-400'
      : color === 'red'
      ? 'text-red-400'
      : 'text-white'

  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl px-5 py-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-3xl font-bold ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  )
}
