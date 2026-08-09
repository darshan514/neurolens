import { useState, type ReactNode } from "react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  Bell,
  Brain,
  CalendarClock,
  FileText,
  HeartHandshake,
  Languages,
  LayoutDashboard,
  LogOut,
  MapPin,
  Pill,
  ScanLine,
  Settings,
  Stethoscope,
  User,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useI18n, LANGS } from "../lib/i18n";
import { DisclaimerBanner, cn } from "./ui";

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 shadow-glow">
        <Brain size={18} className="text-white" />
      </span>
      {!small && (
        <span className="font-display text-base font-bold tracking-tight text-white">
          Neuro<span className="text-teal-300">Lens</span>
        </span>
      )}
    </Link>
  );
}

const NAV = [
  { to: "/dashboard", label: "navDashboard", icon: LayoutDashboard },
  { to: "/screen", label: "navScreen", icon: ScanLine },
  { to: "/history", label: "navHistory", icon: FileText },
  { to: "/medication", label: "navMedication", icon: Pill },
  { to: "/family", label: "Family", icon: HeartHandshake },
  { to: "/find-care", label: "Find care", icon: MapPin },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/doctor", label: "navDoctor", icon: Stethoscope },
];

export function Layout() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useI18n();
  const nav = useNavigate();
  const [langOpen, setLangOpen] = useState(false);

  return (
    <div className="min-h-screen bg-ink-950 text-white/90">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(60%_50%_at_50%_-10%,rgba(74,110,240,0.18),transparent)]" />
      <header className="sticky top-0 z-40 border-b border-white/8 bg-ink-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                      isActive
                        ? "bg-brand-500/15 text-brand-200"
                        : "text-white/55 hover:bg-white/5 hover:text-white"
                    )
                  }
                >
                  <n.icon size={14} />
                  {t(n.label)}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* language */}
            <div className="relative">
              <button
                onClick={() => setLangOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-white/60 hover:bg-white/5 hover:text-white"
                aria-label="Language"
              >
                <Languages size={15} />
                <span className="hidden uppercase sm:inline">{lang}</span>
              </button>
              {langOpen && (
                <div className="absolute right-0 top-10 w-44 rounded-xl border border-white/10 bg-ink-800 p-1 shadow-card">
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => {
                        setLang(l.code);
                        setLangOpen(false);
                      }}
                      className={cn(
                        "block w-full rounded-lg px-3 py-1.5 text-left text-[13px] hover:bg-white/5",
                        l.code === lang ? "text-teal-300" : "text-white/70"
                      )}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/settings"
                  className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/5"
                  title={user.name}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-teal-500 text-xs font-bold text-white">
                    {user.name.charAt(0)}
                  </span>
                </Link>
                <Link
                  to="/settings"
                  className="hidden rounded-lg p-1.5 text-white/50 hover:text-white sm:block"
                  title={t("navSettings")}
                >
                  <Settings size={16} />
                </Link>
                <button
                  onClick={() => {
                    logout();
                    nav("/");
                  }}
                  className="rounded-lg p-1.5 text-white/50 hover:text-rose-300"
                  title={t("logout")}
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <Link to="/login" className="hidden sm:block">
                <button className="rounded-lg bg-brand-500/15 px-3 py-1.5 text-[13px] font-medium text-brand-200 hover:bg-brand-500/25">
                  {t("login")}
                </button>
              </Link>
            )}
          </div>
        </div>
        {/* mobile nav */}
        <nav className="flex items-center gap-1 overflow-x-auto px-3 pb-2 md:hidden">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium",
                  isActive ? "bg-brand-500/15 text-brand-200" : "text-white/55"
                )
              }
            >
              <n.icon size={13} />
              {t(n.label)}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 py-6 md:py-8">
        <Outlet />
      </main>

      <footer className="relative border-t border-white/8">
        <div className="mx-auto max-w-7xl space-y-3 px-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/40">
            <div className="flex items-center gap-2">
              <Activity size={13} className="text-teal-400" />
              <span>
                {t("appName")} — {t("tagline")}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><User size={12} /> {t("profile")}</span>
              <span className="flex items-center gap-1"><CalendarClock size={12} /> v0.1.0</span>
            </div>
          </div>
          <DisclaimerBanner compact />
        </div>
      </footer>
    </div>
  );
}

export function MotionPage({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {children}
    </motion.div>
  );
}
