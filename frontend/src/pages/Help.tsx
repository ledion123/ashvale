const GLOSSARY: { name: string; body: string }[] = [
  {
    name: 'PUWER (Excavator / Dumper / Roller / Telehandler)',
    body: 'Provision and Use of Work Equipment Regulations — a weekly safety check of powered plant. One form ("PUWER Equipment Register & Inspection") covers Excavator, Dumper, Roller, and Telehandler all at once, so completing it satisfies all four columns simultaneously. Large sites sometimes instead use a separate daily check sheet per machine (uploaded weekly) — either one counts toward compliance.',
  },
  {
    name: 'LOLER',
    body: 'Lifting Operations and Lifting Equipment Regulations — a weekly inspection of lifting accessories: chains, shackles, hooks, forks, block grabs, slings, harnesses. This is separate from the PUWER machine checks above — it’s about the lifting gear attached to a machine, not the machine itself.',
  },
  {
    name: 'SITE SUP',
    body: 'Site Supervisor Weekly Inspection — a walkaround check done by the site supervisor at the start of each week.',
  },
  {
    name: 'HAVS',
    body: 'Hand-Arm Vibration Syndrome check — assessing exposure and safety of vibrating hand tools (breakers, drills, saws).',
  },
  {
    name: 'TOOLBOX',
    body: 'Toolbox Talk — a short team safety briefing covering a weekly topic.',
  },
]

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Why doesn’t a site show up on the Dashboard?',
    a: 'The Dashboard only shows sites on your roster — the list you build on the Manage Sites page or by uploading a Sites Excel. SafetyCulture activity for a site that isn’t on your roster is hidden from the Dashboard, but still listed in the "sites not on your roster" panel so you can add it with one click.',
  },
  {
    q: 'Why does the first load take so long?',
    a: 'The Dashboard fetches live inspection data from SafetyCulture across every template for the selected week, which can take 30–60 seconds the first time. Results are cached afterward (per browser session) so repeat loads of the same week are close to instant — until the cache expires after an hour.',
  },
  {
    q: 'What’s the difference between "GAPS" and "OVERDUE"?',
    a: '"GAPS" means at least one required inspection is completely missing this week. "OVERDUE" means everything has been inspected at some point, but at least one inspection was last completed before this week started, not during it.',
  },
  {
    q: 'What does the small orange "R" mark mean on a status icon?',
    a: 'It means that column was only satisfied by the combined PUWER Register submission — no individual inspection was filed for that specific machine type. Not necessarily a problem, just worth knowing which source covered it.',
  },
  {
    q: 'Does removing a site in Manage Sites delete anything in SafetyCulture?',
    a: 'No. Manage Sites only controls your local roster (which sites the Dashboard tracks) — it never reads, writes, or deletes anything in SafetyCulture itself.',
  },
  {
    q: 'Where is my uploaded Sites Excel / Plant Register PDF stored?',
    a: 'In this browser only (not on a server), so it won’t show up if you open the app on a different device or browser. Re-upload there if needed.',
  },
]

export default function Help() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-white font-semibold text-lg">Help</h1>
        <p className="text-slate-500 text-sm mt-1">How Ashvale works, and what everything means.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-slate-200 font-semibold text-sm uppercase tracking-wider">Getting started</h2>
        <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
          <li>Set up your site roster — add sites manually on <span className="text-slate-400">Manage Sites</span>, or upload a Sites Excel from the Dashboard. The Dashboard only shows sites on this list.</li>
          <li>Optionally upload your plant register PDF ("whats where") on the Dashboard — it cross-checks machine/lifting-gear serials against what LOLER inspections actually mention.</li>
          <li>Open the Dashboard to see this week's compliance status per site, per inspection type.</li>
          <li>Green check = done this week. Amber clock = done, but before this week. Red cross = missing entirely.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-slate-200 font-semibold text-sm uppercase tracking-wider">Inspection types</h2>
        <div className="space-y-3">
          {GLOSSARY.map(g => (
            <div key={g.name} className="bg-surface border border-edge rounded-lg p-4">
              <p className="text-slate-200 font-medium text-sm">{g.name}</p>
              <p className="text-slate-500 text-sm mt-1 leading-relaxed">{g.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-slate-200 font-semibold text-sm uppercase tracking-wider">FAQ</h2>
        <div className="space-y-3">
          {FAQ.map(f => (
            <div key={f.q} className="bg-surface border border-edge rounded-lg p-4">
              <p className="text-slate-200 font-medium text-sm">{f.q}</p>
              <p className="text-slate-500 text-sm mt-1 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
