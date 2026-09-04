import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { LibraryBig, PlusCircle, Settings, Gamepad2, Boxes, Inbox, LogOut, ShieldCheck, KeyRound } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const [pending, setPending] = useState(0);
  const role = localStorage.getItem("role") || "admin";
  const isAff = role === "affiliate";
  const principalName = localStorage.getItem("principal_name") || "";

  useEffect(() => {
    if (isAff) { if (location.pathname !== "/keys") navigate("/keys"); return; }
    const load = () => api.get("/purchases/count").then(({ data }) => setPending(data.pending)).catch(() => {});
    load();
    const iv = setInterval(load, 12000);
    return () => clearInterval(iv);
  }, [isAff, location.pathname, navigate]);

  const navItems = isAff
    ? [{ to: "/keys", label: t("nav.keys"), icon: KeyRound, testid: "nav-keys", end: true }]
    : [
    { to: "/", label: t("nav.library"), icon: LibraryBig, testid: "nav-library", end: true },
    { to: "/games/new", label: t("nav.addGame"), icon: PlusCircle, testid: "nav-add-game" },
    { to: "/bypass", label: t("nav.bypass"), icon: ShieldCheck, testid: "nav-bypass" },
    { to: "/dependencies", label: t("nav.dependencies"), icon: Boxes, testid: "nav-dependencies" },
    { to: "/orders", label: t("nav.orders"), icon: Inbox, testid: "nav-orders", badge: true },
    { to: "/keys", label: t("nav.keys"), icon: KeyRound, testid: "nav-keys" },
    { to: "/settings", label: t("nav.settings"), icon: Settings, testid: "nav-settings" },
  ];

  return (
    <div className="min-h-screen flex bg-[#08090E] text-slate-100">
      <aside className="w-64 shrink-0 border-r border-white/10 glass flex flex-col fixed h-screen z-20">
        <div className="px-5 h-16 flex items-center gap-3 border-b border-white/10">
          <img src="/logo.png" alt="Rayzer" className="w-9 h-9 rounded-lg border border-cyan-500/30" />
          <div className="leading-tight">
            <div className="font-display font-extrabold tracking-tight text-[14px]">RAYZER STARK</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{t("app.tag")}</div>
          </div>
        </div>

        <nav className="p-3 flex flex-col gap-1 flex-1">
          {navItems.map(({ to, label, icon: Icon, testid, end, badge }) => (
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
              {badge && pending > 0 && (
                <span data-testid="orders-badge" className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-500 text-black">
                  {pending}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3">
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 mb-2">
            <p className="text-xs text-slate-400 leading-relaxed">{isAff ? `${t("nav.affArea")} · ${principalName}` : t("nav.clientNote")}</p>
          </div>
          <button
            data-testid="logout-btn"
            onClick={() => { localStorage.removeItem("admin_token"); localStorage.removeItem("role"); localStorage.removeItem("principal_name"); navigate("/login"); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-300 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 transition-colors"
          >
            <LogOut className="w-4 h-4" /> {t("nav.logout")}
          </button>
        </div>
      </aside>

      <div className="flex-1 ml-64 min-h-screen bg-grid">
        <header className="h-16 border-b border-white/10 glass flex items-center gap-3 px-8 sticky top-0 z-10">
          <Gamepad2 className="w-5 h-5 text-cyan-400" />
          <span className="font-display font-semibold">{t("app.name")}</span>
        </header>
        <main className="p-8 max-w-[1400px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
