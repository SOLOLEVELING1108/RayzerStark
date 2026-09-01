import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LibraryBig, PlusCircle, Settings, Gamepad2, Download, HardDriveDownload } from "lucide-react";

const navItems = [
  { to: "/", label: "Library", icon: LibraryBig, testid: "nav-library", end: true },
  { to: "/games/new", label: "Add Game", icon: PlusCircle, testid: "nav-add-game" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
];

export default function Layout() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex bg-[#08090E] text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-white/10 glass flex flex-col fixed h-screen z-20">
        <div className="px-5 h-16 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/30 grid place-items-center">
            <HardDriveDownload className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-extrabold tracking-tight text-[15px]">INJECTOR</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Steam Patcher</div>
          </div>
        </div>

        <nav className="p-3 flex flex-col gap-1 flex-1">
          {navItems.map(({ to, label, icon: Icon, testid, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={testid}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                    : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3">
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <div className="flex items-center gap-2 text-cyan-300 text-xs font-mono uppercase tracking-widest mb-2">
              <Download className="w-3.5 h-3.5" /> Desktop Client
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              File injection runs on the Windows desktop app.
            </p>
            <button
              data-testid="download-desktop-btn"
              onClick={() => navigate("/settings")}
              className="w-full text-xs font-semibold py-2 rounded-lg bg-cyan-500 text-black hover:bg-cyan-400 transition-colors"
            >
              Get the App
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 ml-64 min-h-screen bg-grid">
        <header className="h-16 border-b border-white/10 glass flex items-center gap-3 px-8 sticky top-0 z-10">
          <Gamepad2 className="w-5 h-5 text-cyan-400" />
          <span className="font-display font-semibold">Game Config Patcher</span>
          <span className="ml-auto font-mono text-[11px] text-slate-500">
            C:\Program Files (x86)\Steam
          </span>
        </header>
        <main className="p-8 max-w-[1400px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
