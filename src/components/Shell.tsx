import React, { createContext, useContext, useState } from "react";
import { overdueStudents } from "../lib/fee";
import { useStore } from "../lib/store";
import { fmtDate, todayISO } from "../lib/utils";
import { Icon } from "./ui";

export type PageKey =
  | "dashboard" | "students" | "student" | "batches" | "attendance"
  | "fees" | "slips" | "calendar" | "reports" | "settings";

export interface Route { page: PageKey; params?: Record<string, string>; n: number }

const NavCtx = createContext<{ route: Route; nav: (page: PageKey, params?: Record<string, string>) => void } | null>(null);
export function useNav() {
  const v = useContext(NavCtx);
  if (!v) throw new Error("NavCtx missing");
  return v;
}

const NAV: { key: PageKey; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard" },
  { key: "students", label: "Students", icon: "students" },
  { key: "batches", label: "Classes & Batches", icon: "batch" },
  { key: "attendance", label: "Attendance", icon: "attendance" },
  { key: "fees", label: "Fees & Payments", icon: "fees" },
  { key: "slips", label: "Fee Slips", icon: "slips" },
  { key: "calendar", label: "Calendar & Holidays", icon: "calendar" },
  { key: "reports", label: "Reports", icon: "reports" },
  { key: "settings", label: "Settings", icon: "settings" },
];

const TITLES: Record<PageKey, string> = {
  dashboard: "Dashboard", students: "Students", student: "Student Profile", batches: "Classes & Batches",
  attendance: "Attendance", fees: "Fees & Payments", slips: "Fee Slips", calendar: "Calendar & Holidays",
  reports: "Reports", settings: "Settings",
};

function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-9 h-9 rounded-[10px] bg-gold-500 text-ink-950 flex items-center justify-center shadow-[0_2px_12px_-2px_rgba(232,160,32,0.6)]">
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 25V11L16 6l9 5v14" /><path d="M12 25v-7h8v7" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block font-display font-bold text-[16px] text-white">Tuition Desk</span>
          <span className="block text-[10px] font-semibold tracking-[0.22em] text-gold-400/90 mt-1">LOCAL LEDGER</span>
        </span>
      )}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { state, session, logout } = useStore();
  const [route, setRoute] = useState<Route>({ page: "dashboard", n: 0 });
  const [sheetOpen, setSheetOpen] = useState(false);
  const nav = (page: PageKey, params?: Record<string, string>) => {
    setRoute((r) => ({ page, params, n: r.n + 1 }));
    setSheetOpen(false);
    window.scrollTo({ top: 0 });
  };

  const overdue = overdueStudents(state).length;
  const activeKey: PageKey = route.page === "student" ? "students" : route.page;
  const today = todayISO();
  const primaryNav = NAV.slice(0, 5);
  const moreNav = NAV.slice(5);

  return (
    <NavCtx.Provider value={{ route, nav }}>
      <div className="min-h-screen bg-ledger">
        {/* ---------- sidebar (desktop) ---------- */}
        <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[236px] flex-col bg-inkweave border-r border-ink-800 z-40">
          <div className="px-5 h-16 flex items-center border-b border-ink-800/80">
            <Logo />
          </div>
          <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-4 space-y-0.5">
            {NAV.map((n) => (
              <button
                key={n.key}
                onClick={() => nav(n.key)}
                className={`w-full flex items-center gap-3 h-9.5 px-3 rounded-[9px] text-[13px] font-semibold transition-all duration-150 group ${
                  activeKey === n.key ? "bg-gold-500 text-ink-950 shadow-[0_2px_14px_-4px_rgba(232,160,32,0.7)]" : "text-ink-300 hover:text-white hover:bg-ink-800/70"
                }`}
              >
                <Icon name={n.icon} size={17} />
                <span className="flex-1 text-left">{n.label}</span>
                {n.key === "fees" && overdue > 0 && (
                  <span className={`min-w-5 h-5 px-1 rounded-md text-[10.5px] font-bold flex items-center justify-center tnum ${activeKey === n.key ? "bg-ink-950 text-gold-400" : "bg-flame-600 text-white"}`}>{overdue}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="px-4 py-4 border-t border-ink-800/80">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-[9px] bg-ink-700 text-gold-300 flex items-center justify-center text-[12px] font-bold font-display">
                {state.settings.tutorName.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[12.5px] font-semibold text-white truncate">{state.settings.tutorName}</span>
                <span className="block text-[10.5px] text-ink-400 truncate">{state.settings.tuitionName}</span>
              </span>
              <button onClick={logout} title="Logout" className="w-8 h-8 rounded-[8px] flex items-center justify-center text-ink-400 hover:text-flame-500 hover:bg-ink-800 transition-colors">
                <Icon name="logout" size={16} />
              </button>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-ink-500">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-mint-500 mr-1.5 pulse-dot" />
              All data stored locally in this browser · v1.0
            </p>
          </div>
        </aside>

        {/* ---------- top header ---------- */}
        <header className="sticky top-0 z-30 lg:pl-[236px]">
          <div className="h-14 sm:h-16 px-4 sm:px-7 flex items-center gap-3 bg-paper/85 backdrop-blur border-b border-ink-100">
            <span className="lg:hidden"><Logo compact /></span>
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-bold text-[15.5px] text-ink-900 truncate">{TITLES[route.page]}</h2>
              <p className="hidden sm:block text-[11px] text-ink-400 tnum">{fmtDate(today, state.settings.dateFormat)} · {state.settings.tuitionName}</p>
            </div>
            <span className="hidden md:inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-500 bg-white border border-ink-100 rounded-md px-2.5 h-7">
              <Icon name="user" size={13} /> {session?.user}
            </span>
            <button onClick={logout} className="lg:hidden w-8 h-8 rounded-[8px] flex items-center justify-center text-ink-500 hover:text-flame-600 hover:bg-ink-100" title="Logout">
              <Icon name="logout" size={17} />
            </button>
          </div>
        </header>

        {/* ---------- content ---------- */}
        <main className="lg:pl-[236px] pb-24 lg:pb-10">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-7 pt-6" key={`${route.page}-${route.n}`}>
            {children}
          </div>
        </main>

        {/* ---------- mobile bottom nav ---------- */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-ink-950/97 border-t border-ink-800 backdrop-blur">
          <div className="grid grid-cols-6 h-[62px]">
            {primaryNav.map((n) => (
              <button key={n.key} onClick={() => nav(n.key)} className={`flex flex-col items-center justify-center gap-1 text-[9.5px] font-bold relative ${activeKey === n.key ? "text-gold-400" : "text-ink-400"}`}>
                {activeKey === n.key && <span className="absolute top-0 w-8 h-0.5 rounded-full bg-gold-500" />}
                <Icon name={n.icon} size={19} />
                {n.key === "fees" && overdue > 0 && <span className="absolute top-1.5 right-1/2 translate-x-4 min-w-4 h-4 px-0.5 rounded bg-flame-600 text-white text-[9px] flex items-center justify-center tnum">{overdue}</span>}
                {n.label.split(" ")[0].toUpperCase()}
              </button>
            ))}
            <button onClick={() => setSheetOpen(true)} className={`flex flex-col items-center justify-center gap-1 text-[9.5px] font-bold ${moreNav.some((n) => n.key === activeKey) ? "text-gold-400" : "text-ink-400"}`}>
              {moreNav.some((n) => n.key === activeKey) && <span className="absolute top-0 w-8 h-0.5 rounded-full bg-gold-500" />}
              <Icon name="menu" size={19} />
              MORE
            </button>
          </div>
        </nav>

        {sheetOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-ink-950/60 anim-fade-in" onClick={() => setSheetOpen(false)} />
            <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl border-t border-ink-100 p-4 pb-7 anim-pop">
              <div className="w-10 h-1 rounded-full bg-ink-200 mx-auto mb-4" />
              <div className="grid grid-cols-2 gap-2">
                {moreNav.map((n) => (
                  <button key={n.key} onClick={() => nav(n.key)} className={`flex items-center gap-2.5 h-11 px-3.5 rounded-[10px] text-[13px] font-semibold border ${activeKey === n.key ? "bg-ink-900 text-white border-ink-900" : "bg-white text-ink-700 border-ink-100 hover:border-ink-300"}`}>
                    <Icon name={n.icon} size={16} /> {n.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </NavCtx.Provider>
  );
}
