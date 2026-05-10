import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, MapPin } from 'lucide-react'

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#0f1117]">
      <header className="sticky top-0 z-20 border-b border-[#2a2d3a] bg-[#13161f]/95 backdrop-blur">
        <div className="max-w-[1440px] mx-auto px-5 h-13 flex items-center gap-6" style={{ height: 52 }}>
          <div className="flex items-center gap-2.5 mr-2">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">A</span>
            </div>
            <span className="text-white font-semibold text-sm tracking-wide">Ashvale</span>
          </div>

          <nav className="flex items-center gap-0.5">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`
              }
            >
              <LayoutDashboard size={14} />
              Dashboard
            </NavLink>
            <NavLink
              to="/sites"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`
              }
            >
              <MapPin size={14} />
              Sites
            </NavLink>
          </nav>

          <div className="ml-auto">
            <a
              href="#generate"
              onClick={e => {
                e.preventDefault()
                document.dispatchEvent(new CustomEvent('open-generate-modal'))
              }}
              className="text-xs font-medium text-slate-400 hover:text-white border border-[#2a2d3a] hover:border-[#3a3d4a] px-3 py-1.5 rounded-md transition-colors"
            >
              Generate Excel Report
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-5 py-6">
        <Outlet />
      </main>
    </div>
  )
}
