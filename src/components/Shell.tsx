import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { PageKey, Route } from "../types";
import { useStore, withActivity } from "../lib/store";
import { balanceOf, challanNo, ensureFeeRecords, periodStats } from "../lib/fee";
import { absentMessage, buildTimingNotice, deriveNotices, whatsappGuardians } from "../lib/notify";
import { currentPeriod, fmtMoney, naturalCompare, periodLabel, timeLabel, todayISO, waLink } from "../lib/utils";
import { Badge, Btn, Icon, Modal, TInput, TutorAvatar, useToast } from "./ui";
import SlipModal, { type SlipTarget } from "./SlipModal";
import PaymentModal from "./PaymentModal";
import StudentForm from "./StudentForm";

/* ---------- routing + global UI context ---------- */

const NavCtx = createContext<{ route: Route; nav: (p: PageKey, params?: Record<string, string>) => void } | null>(null);
export function useNav() {
  const v = useContext(NavCtx);
  if (!v) throw new Error("NavCtx missing");
  return v;
}

interface UiCtx {
  openSlip: (t: SlipTarget) => void;
  openPayment: (studentId?: string, paymentId?: string) => void;
  openStudentForm: (opts?: { editId?: string; presetClass?: string }) => void;
}
const Ui = createContext<UiCtx | null>(null);
export function useUi() {
  const v = useContext(Ui);
  if (!v) throw new Error("UiCtx missing");
  return v;
}

const NAV: { key: PageKey; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard" },
  { key: "students", label: "Students", icon: "students" },
  { key: "classes", label: "Classes", icon: "classes" },
  { key: "attendance", label: "Attendance", icon: "attendance" },
  { key: "fees", label: "Fees & Payments", icon: "fees" },
  { key: "slips", label: "Fee Slips", icon: "slips" },
  { key: "calendar", label: "Calendar & Holidays", icon: "calendar" },
  { key: "reports", label: "Reports", icon: "reports" },
  { key: "settings", label: "Settings", icon: "settings" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { state, patch, logout } = useStore();
  const toast = useToast();
  const [route, setRoute] = useState<Route>({ page: "dashboard", n: 0 });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [slipTarget, setSlipTarget] = useState<SlipTarget | null>(null);
  const [payReq, setPayReq] = useState<{ open: boolean; studentId?: string; paymentId?: string }>({ open: false });
  const [formReq, setFormReq] = useState<{ open: boolean; editId?: string; presetClass?: string }>({ open: false });

  const nav = (page: PageKey, params?: Record<string, string>) => {
    setRoute((r) => ({ page, params, n: r.n + 1 }));
    setSheetOpen(false);
    setBellOpen(false);
    setMobileSearch(false);
    window.scrollTo({ top: 0 });
  };

  /* auto-generate fee records when a new month starts (runs while app is open) */
  useEffect(() => {
    const run = () => {
      const res = ensureFeeRecords(state);
      if (res.added > 0 || res.late > 0) {
        patch({
          feeRecords: res.records,
          activity: withActivity({ ...state, feeRecords: res.records }, `New month — ${res.added} fee challan(s) auto-generated.${res.late ? ` Late fee applied to ${res.late} overdue record(s).` : ""}`, "fee"),
        });
        if (res.added > 0) toast.push(`${res.added} challan(s) generated for ${periodLabel(currentPeriod())}`, "ok");
      }
    };
    run();
    const t = setInterval(run, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ui: UiCtx = useMemo(() => ({
    openSlip: (t) => {
      if (t.kind === "challan") {
        const rec = state.feeRecords.find((r) => r.id === t.recordId);
        if (rec && balanceOf(rec, state.payments) <= 0 && !rec.waived) {
          toast.push("Fee is fully paid — no challan needed. Send a receipt instead.", "warn");
          return;
        }
      }
      setSlipTarget(t);
    },
    openPayment: (studentId, paymentId) => setPayReq({ open: true, studentId, paymentId }),
    openStudentForm: (opts) => setFormReq({ open: true, ...opts }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state]);

  const notices = useMemo(() => deriveNotices(state), [state]);

  return (
    <NavCtx.Provider value={{ route, nav }}>
      <Ui.Provider value={ui}>
        <div className="min-h-screen bg-ledger">
          {/* ---------- desktop sidebar ---------- */}
          <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-[236px] bg-ink-900 text-ink-200 z-30">
            <div className="px-5 pt-6 pb-5 border-b border-ink-800">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-[10px] bg-gold-500 text-ink-950 flex items-center justify-center shrink-0">
                  <svg width="22" height="22" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 25V11L16 6l9 5v14" /><path d="M12 25v-7h8v7" /></svg>
                </span>
                <div className="min-w-0">
                  <div className="font-display font-bold text-[15.5px] text-white leading-tight truncate">{state.settings.tuitionName}</div>
                  <div className="text-[9.5px] font-bold tracking-[0.22em] text-gold-400 mt-0.5">TUITION DESK</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-ink-800">
              <TutorAvatar size={38} photo={state.settings.tutorPhoto} />
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-white truncate">{state.settings.tutorName}</div>
                <div className="text-[10.5px] text-ink-400">Owner · Tutor</div>
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scroll-thin">
              {NAV.map((n) => {
                const active = route.page === n.key || (n.key === "students" && route.page === "student");
                return (
                  <button key={n.key} onClick={() => nav(n.key)}
                    className={`w-full flex items-center gap-3 px-3 h-10 rounded-[9px] text-[13.5px] font-semibold transition-all duration-150 ${active ? "bg-ink-800 text-white shadow-inner" : "text-ink-300 hover:bg-ink-850 hover:text-white"}`}>
                    <Icon name={n.icon} size={17} className={active ? "text-gold-400" : ""} />
                    {n.label}
                    {n.key === "fees" && notices.filter((x) => x.kind === "overdue").length > 0 && (
                      <span className="ml-auto text-[10px] font-bold bg-flame-600 text-white rounded-full px-1.5 py-0.5 tnum">{notices.filter((x) => x.kind === "overdue").length}</span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-ink-800">
              <button onClick={logout} className="w-full flex items-center gap-3 px-3 h-10 rounded-[9px] text-[13px] font-semibold text-ink-300 hover:bg-flame-600/15 hover:text-flame-500 transition-colors">
                <Icon name="logout" size={17} /> Log out
              </button>
            </div>
          </aside>

          {/* ---------- header : [ Brand ] —— [ Search ] [ Bell | Profile ] ---------- */}
          <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-ink-100 shadow-[0_1px_3px_rgba(14,24,48,0.05)]">
            <div className="lg:pl-[236px]">
              <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6" style={{ height: 60 }}>
                {/* menu (mobile only) */}
                <button className="lg:hidden w-9 h-9 shrink-0 rounded-[9px] border border-ink-200 bg-white flex items-center justify-center text-ink-700 hover:border-ink-400 transition-colors" onClick={() => setSheetOpen(true)} aria-label="Open menu">
                  <Icon name="menu" size={18} />
                </button>

                {/* brand — left */}
                <button onClick={() => nav("dashboard")} title="Go to dashboard" className="group flex items-center gap-2.5 min-w-0 shrink-0">
                  <span className="w-9 h-9 rounded-[10px] bg-gold-500 text-ink-950 flex items-center justify-center shrink-0 group-hover:bg-gold-400 transition-colors shadow-[0_2px_8px_-2px_rgba(232,160,32,0.6)]">
                    <svg width="19" height="19" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 25V11L16 6l9 5v14" /><path d="M12 25v-7h8v7" /></svg>
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block font-display font-bold text-[15px] leading-tight text-ink-900 truncate max-w-[130px] sm:max-w-[210px]">{state.settings.tuitionName}</span>
                    <span className="hidden sm:block text-[8.5px] font-bold tracking-[0.24em] text-gold-600 mt-0.5">TUITION MANAGEMENT</span>
                  </span>
                </button>

                {/* global search — centered, capped so it never dominates */}
                <div className="flex-1 flex justify-center min-w-0 px-1 sm:px-4">
                  <GlobalSearch className="hidden md:block w-full max-w-[300px] lg:max-w-[430px]" />
                </div>

                {/* actions — right */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                  <button className="md:hidden w-9 h-9 rounded-[9px] border border-ink-200 bg-white flex items-center justify-center text-ink-600 hover:border-ink-400 transition-colors" onClick={() => setMobileSearch(!mobileSearch)} aria-label="Search">
                    <Icon name="search" size={17} />
                  </button>

                  {/* notifications bell */}
                  <div className="relative">
                    <button onClick={() => setBellOpen(!bellOpen)} aria-label="Notifications"
                      className={`relative w-9 h-9 rounded-[9px] border flex items-center justify-center transition-colors ${bellOpen ? "bg-ink-900 text-white border-ink-900" : "bg-white border-ink-200 text-ink-600 hover:border-ink-400"}`}>
                      <Icon name="bell" size={17} />
                      {notices.length > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-flame-600 text-white text-[10px] font-bold flex items-center justify-center tnum anim-tick">{notices.length}</span>
                      )}
                    </button>
                    {bellOpen && <NotificationsPanel notices={notices} onClose={() => setBellOpen(false)} />}
                  </div>

                  <span className="hidden sm:block w-px h-6 bg-ink-150" aria-hidden="true" />

                  {/* profile */}
                  <button onClick={() => nav("settings")} title="Profile & settings" className="group flex items-center gap-2.5 rounded-[10px] pl-1 pr-1 sm:pr-2 py-1 hover:bg-ink-50 transition-colors">
                    <TutorAvatar size={34} photo={state.settings.tutorPhoto} />
                    <span className="hidden sm:block text-left">
                      <span className="block text-[12.5px] font-bold leading-tight text-ink-900 max-w-[130px] truncate">{state.settings.tutorName}</span>
                      <span className="block text-[10px] font-semibold text-ink-400">Owner · Tutor</span>
                    </span>
                    <Icon name="chevD" size={13} className="hidden sm:block text-ink-300 group-hover:text-ink-600 transition-colors" />
                  </button>
                </div>
              </div>
              {mobileSearch && (
                <div className="md:hidden px-4 pb-3 anim-fade-in">
                  <GlobalSearch autoFocus onDone={() => setMobileSearch(false)} />
                </div>
              )}
            </div>
          </header>

          {/* ---------- mobile sheet ---------- */}
          {sheetOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-ink-950/55 anim-fade-in" onClick={() => setSheetOpen(false)} />
              <div className="absolute inset-y-0 left-0 w-[260px] bg-ink-900 text-ink-200 flex flex-col anim-slide-r" style={{ animationName: "fade-up" }}>
                <div className="px-5 py-5 border-b border-ink-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-[8px] bg-gold-500 text-ink-950 flex items-center justify-center"><Icon name="classes" size={16} /></span>
                    <span className="font-display font-bold text-white text-[15px]">Tuition Desk</span>
                  </div>
                  <button onClick={() => setSheetOpen(false)} className="text-ink-400 hover:text-white" aria-label="Close menu"><Icon name="x" size={18} /></button>
                </div>
                <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
                  {NAV.map((n) => {
                    const active = route.page === n.key || (n.key === "students" && route.page === "student");
                    return (
                      <button key={n.key} onClick={() => nav(n.key)}
                        className={`w-full flex items-center gap-3 px-3 h-10.5 rounded-[9px] text-[14px] font-semibold ${active ? "bg-ink-800 text-white" : "text-ink-300 hover:bg-ink-850"}`}>
                        <Icon name={n.icon} size={17} className={active ? "text-gold-400" : ""} /> {n.label}
                      </button>
                    );
                  })}
                </nav>
                <div className="p-3 border-t border-ink-800">
                  <button onClick={logout} className="w-full flex items-center gap-3 px-3 h-10 rounded-[9px] text-[13px] font-semibold text-ink-300 hover:bg-flame-600/15 hover:text-flame-500"><Icon name="logout" size={17} /> Log out</button>
                </div>
              </div>
            </div>
          )}

          <main className="lg:pl-[236px] pb-24 lg:pb-10">
            <div className="max-w-[1200px] mx-auto px-4 sm:px-7 pt-6" key={`${route.page}-${route.n}`}>
              {children}
            </div>
          </main>

          {/* ---------- mobile bottom nav ---------- */}
          <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-ink-100 grid grid-cols-5">
            {[NAV[0], NAV[1], NAV[3], NAV[4], NAV[8]].map((n) => {
              const active = route.page === n.key || (n.key === "students" && route.page === "student");
              return (
                <button key={n.key} onClick={() => nav(n.key)} className={`flex flex-col items-center gap-0.5 py-2 text-[9.5px] font-bold ${active ? "text-ink-900" : "text-ink-400"}`}>
                  <span className={`w-8 h-6 rounded-[7px] flex items-center justify-center ${active ? "bg-gold-100 text-gold-700" : ""}`}><Icon name={n.icon} size={17} /></span>
                  {n.key === "dashboard" ? "Home" : n.key === "settings" ? "Settings" : n.label.split(" ")[0]}
                </button>
              );
            })}
          </nav>

          {/* ---------- global modals (open on top of the current page) ---------- */}
          <PaymentModal
            open={payReq.open}
            studentId={payReq.studentId}
            paymentId={payReq.paymentId}
            onClose={() => setPayReq({ open: false })}
            onSendReceipt={(paymentId) => { setPayReq({ open: false }); setSlipTarget({ kind: "receipt", paymentId }); }}
          />
          <SlipModal target={slipTarget} onClose={() => setSlipTarget(null)} />
          <StudentForm
            open={formReq.open}
            editId={formReq.editId}
            presetClass={formReq.presetClass}
            onClose={() => setFormReq({ open: false })}
          />
        </div>
      </Ui.Provider>
    </NavCtx.Provider>
  );
}

/* ================= global search ================= */

function GlobalSearch({ className = "", autoFocus, onDone }: { className?: string; autoFocus?: boolean; onDone?: () => void }) {
  const { state } = useStore();
  const { nav } = useNav();
  const ui = useUi();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 2) return null;
    const students = state.students.filter((s) => {
      const phones = state.guardians.filter((g) => g.studentId === s.id).map((g) => g.phone.replace(/\D/g, "")).join(" ");
      return `${s.name} ${s.id} ${s.grade} ${s.school ?? ""} ${phones}`.toLowerCase().includes(query);
    }).slice(0, 5);
    const challans = state.feeRecords
      .filter((r) => {
        const s = state.students.find((x) => x.id === r.studentId);
        if (!s) return false;
        const no = challanNo(state.feeRecords, r.id).toLowerCase();
        return no.includes(query) || (query.includes("challan") && s.name.toLowerCase().includes(query.replace("challan", "").trim() || "@"));
      })
      .sort((a, b) => b.period.localeCompare(a.period))
      .slice(0, 5);
    const receipts = state.payments
      .filter((p) => {
        const s = state.students.find((x) => x.id === p.studentId);
        return p.receiptNo.toLowerCase().includes(query) || (query.includes("receipt") && (s?.name.toLowerCase().includes(query.replace("receipt", "").trim() || "@") ?? false));
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
    return { students, challans, receipts };
  }, [q, state]);

  const pick = (fn: () => void) => { fn(); setQ(""); setOpen(false); onDone?.(); };
  const cur = state.settings.feePolicy.currency;

  return (
    <div className={`relative ${className}`} ref={boxRef}>
      <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
      <input
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search students, CHL / RCP numbers…"
        className="w-full h-9.5 pl-9 pr-3 rounded-[9px] border border-ink-200 bg-white text-[13px] placeholder:text-ink-300 focus:border-gold-500"
      />
      {open && results && (
        <div className="absolute top-11 left-0 right-0 card overflow-hidden z-50 anim-pop max-h-[420px] overflow-y-auto scroll-thin">
          {results.students.length === 0 && results.challans.length === 0 && results.receipts.length === 0 && (
            <p className="text-[12.5px] text-ink-400 px-4 py-5 text-center">Nothing matches “{q}”. Try a name, phone, CHL-1001 or RCP-1001.</p>
          )}
          {results.students.length > 0 && (
            <div>
              <p className="px-3.5 pt-2.5 pb-1 text-[10px] font-bold tracking-[0.14em] text-ink-400">STUDENTS</p>
              {results.students.map((s) => (
                <button key={s.id} onClick={() => pick(() => nav("student", { id: s.id }))} className="w-full flex items-center gap-3 px-3.5 py-2 hover:bg-gold-50 text-left">
                  <Icon name="user" size={15} className="text-ink-400" />
                  <span className="flex-1 text-[13px] font-semibold text-ink-900">{s.name}</span>
                  <span className="text-[11px] text-ink-400">{s.grade}</span>
                </button>
              ))}
            </div>
          )}
          {results.challans.length > 0 && (
            <div className="border-t border-ink-100">
              <p className="px-3.5 pt-2.5 pb-1 text-[10px] font-bold tracking-[0.14em] text-ink-400">FEE CHALLANS</p>
              {results.challans.map((r) => {
                const s = state.students.find((x) => x.id === r.studentId);
                const bal = balanceOf(r, state.payments);
                return (
                  <button key={r.id} onClick={() => pick(() => ui.openSlip({ kind: "challan", recordId: r.id }))} className="w-full flex items-center gap-3 px-3.5 py-2 hover:bg-gold-50 text-left">
                    <Icon name="slips" size={15} className="text-gold-600" />
                    <span className="flex-1 text-[13px]"><span className="font-mono font-bold text-[12px]">{challanNo(state.feeRecords, r.id)}</span> <span className="text-ink-500">· {s?.name} · {periodLabel(r.period, true)}</span></span>
                    <span className={`font-mono text-[11.5px] font-bold tnum ${bal > 0 ? "text-flame-600" : "text-mint-600"}`}>{bal > 0 ? fmtMoney(bal, cur) : "Paid"}</span>
                  </button>
                );
              })}
            </div>
          )}
          {results.receipts.length > 0 && (
            <div className="border-t border-ink-100">
              <p className="px-3.5 pt-2.5 pb-1 text-[10px] font-bold tracking-[0.14em] text-ink-400">PAYMENT RECEIPTS</p>
              {results.receipts.map((p) => {
                const s = state.students.find((x) => x.id === p.studentId);
                return (
                  <button key={p.id} onClick={() => pick(() => ui.openSlip({ kind: "receipt", paymentId: p.id }))} className="w-full flex items-center gap-3 px-3.5 py-2 hover:bg-gold-50 text-left">
                    <Icon name="receipt" size={15} className="text-mint-600" />
                    <span className="flex-1 text-[13px]"><span className="font-mono font-bold text-[12px]">{p.receiptNo}</span> <span className="text-ink-500">· {s?.name} · {p.date}</span></span>
                    <span className="font-mono text-[11.5px] font-bold text-mint-600 tnum">{fmtMoney(p.amount, cur)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================= notifications panel ================= */

function NotificationsPanel({ notices, onClose }: { notices: ReturnType<typeof deriveNotices>; onClose: () => void }) {
  const { state, patch } = useStore();
  const ui = useUi();
  const { nav } = useNav();
  const toast = useToast();
  const [composer, setComposer] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const cur = state.settings.feePolicy.currency;
  const df = state.settings.dateFormat;

  const kindMeta: Record<string, { icon: string; cls: string; label: string }> = {
    timing: { icon: "clock", cls: "bg-[#ecf6f8] text-[#0e6b7c]", label: "Timing change" },
    overdue: { icon: "alert", cls: "bg-flame-50 text-flame-600", label: "Overdue" },
    absent: { icon: "x", cls: "bg-warn-50 text-warn-600", label: "Absent today" },
    challan: { icon: "slips", cls: "bg-gold-50 text-gold-600", label: "Challan ready" },
    "due-soon": { icon: "clock", cls: "bg-gold-50 text-gold-600", label: "Due soon" },
    info: { icon: "note", cls: "bg-ink-50 text-ink-500", label: "Info" },
  };

  const deleteNotice = (id: string) => {
    patch({ notifications: state.notifications.filter((n) => n.id !== id) });
    toast.push("Timing notice removed");
  };

  /* Hard lock: body becomes position:fixed (only reliable way on iOS Safari),
     so NOTHING behind can scroll — only the list inside the panel scrolls. */
  useEffect(() => {
    const y = window.scrollY;
    const b = document.body;
    b.style.position = "fixed";
    b.style.top = `-${y}px`;
    b.style.left = "0";
    b.style.right = "0";
    b.style.overflow = "hidden";
    b.style.touchAction = "none";
    return () => {
      b.style.position = "";
      b.style.top = "";
      b.style.left = "";
      b.style.right = "";
      b.style.overflow = "";
      b.style.touchAction = "";
      window.scrollTo(0, y);
    };
  }, []);

  return (
    <>
      {/* backdrop blocks every touch/click outside the panel */}
      <div className="fixed inset-0 z-40 bg-ink-950/50 anim-fade-in" style={{ touchAction: "none" }} onClick={onClose} />
      {/* phone/tablet: dead-centred modal · lg+: anchored neatly under the bell */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:items-start lg:justify-end lg:p-0 lg:pt-[76px] lg:pr-6">
        <div className="w-full max-w-[400px] max-h-[82vh] lg:max-h-[calc(100vh-100px)] card overflow-hidden anim-pop shadow-2xl flex flex-col">
          <div className="px-4 py-3 bg-ink-900 flex items-center justify-between gap-2 shrink-0">
            <span className="font-display font-bold text-[14.5px] text-white flex items-center gap-2">
              <Icon name="bell" size={15} className="text-gold-400" /> Notifications
            </span>
            <Btn size="sm" variant="gold" icon="plus" onClick={() => setComposer(true)}>Timing Change</Btn>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto scroll-thin overscroll-contain">
          {notices.length === 0 && (
            <p className="text-[12.5px] text-ink-400 text-center px-6 py-10">All clear — no challans pending, no overdue fees, no absentees today.</p>
          )}
          {notices.map((n) => {
            const meta = kindMeta[n.kind];
            const notice = n.kind === "timing" ? state.notifications.find((x) => x.id === n.noticeId) : undefined;
            const isOpen = expanded === n.key;
            return (
              <div key={n.key} className="px-4 py-3 border-b border-ink-100 last:border-0 anim-fade-in">
                <div className="flex items-start gap-3">
                  <span className={`w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0 ${meta.cls}`}><Icon name={meta.icon} size={15} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-bold text-ink-900 leading-snug">{n.title}</span>
                      <Badge tone={n.kind === "overdue" ? "red" : n.kind === "absent" ? "amber" : n.kind === "timing" ? "teal" : "gold"}>{meta.label}</Badge>
                    </div>
                    <p className="text-[12px] text-ink-500 mt-0.5 leading-snug">{n.body}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {n.kind === "challan" && n.recordId && <Btn size="sm" variant="gold" icon="send" onClick={() => { ui.openSlip({ kind: "challan", recordId: n.recordId! }); onClose(); }}>Send Challan</Btn>}
                      {n.kind === "overdue" && n.recordId && (
                        <>
                          <Btn size="sm" variant="outline" icon="wallet" onClick={() => { ui.openPayment(n.studentId); onClose(); }}>Record Payment</Btn>
                          <Btn size="sm" variant="ghost" icon="slips" onClick={() => { ui.openSlip({ kind: "challan", recordId: n.recordId! }); onClose(); }}>Challan</Btn>
                        </>
                      )}
                      {n.kind === "absent" && n.studentId && (
                        (() => {
                          const s = state.students.find((x) => x.id === n.studentId);
                          const wg = s ? whatsappGuardians(state, s.id) : [];
                          if (wg.length === 0) return <span className="text-[11.5px] text-ink-400 font-semibold">No WhatsApp number saved — cannot notify.</span>;
                          return wg.map((g) => (
                            <Btn key={g.id} size="sm" variant="wa" icon="whatsapp" onClick={() => window.open(waLink(g.phone, absentMessage(state, s!)), "_blank", "noopener")}>{g.name}</Btn>
                          ));
                        })()
                      )}
                      {n.kind === "timing" && notice && (
                        <Btn size="sm" variant="outline" icon={isOpen ? "chevD" : "chevR"} onClick={() => setExpanded(isOpen ? null : n.key)}>{isOpen ? "Hide" : "View & Send"}</Btn>
                      )}
                    </div>
                    {n.kind === "timing" && notice && isOpen && (
                      <div className="mt-2.5 rounded-[10px] border border-ink-150 bg-ink-50/70 p-3 anim-fade-in">
                        <pre className="whitespace-pre-wrap font-sans text-[11.5px] text-ink-700 leading-relaxed">{notice.message}</pre>
                        <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400 mt-3 mb-1.5">Send to all contacts ({whatsappGuardians(state, "").length >= 0 ? state.guardians.filter((g) => g.whatsapp && g.phone.trim()).length : 0})</p>
                        <div className="flex flex-wrap gap-1.5">
                          {state.guardians.filter((g) => g.whatsapp && g.phone.trim()).slice(0, 40).map((g) => (
                            <button key={g.id} onClick={() => window.open(waLink(g.phone, notice.message), "_blank", "noopener")}
                              className="inline-flex items-center gap-1 h-7 px-2 rounded-[7px] bg-[#128c5e] text-white text-[10.5px] font-bold press hover:bg-[#0e7a50]">
                              <Icon name="whatsapp" size={11} /> {g.name}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Btn size="sm" variant="success" icon="check" onClick={() => {
                            const sentTo = state.guardians.filter((g) => g.whatsapp && g.phone.trim()).map((g) => g.name);
                            patch({
                              notifications: state.notifications.map((x) => (x.id === notice.id ? { ...x, sentTo } : x)),
                              activity: withActivity({ ...state }, `Timing change notice "${notice.title}" marked sent to ${sentTo.length} contacts.`, "notice"),
                            });
                            toast.push(`Notice marked as sent to ${sentTo.length} contacts`);
                          }}>Mark as Sent</Btn>
                          <Btn size="sm" variant="ghost" icon="trash" onClick={() => deleteNotice(notice.id)}>Remove</Btn>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-2.5 bg-ink-50/70 border-t border-ink-100 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-ink-400 font-semibold">Today · {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
          <button onClick={() => { nav("attendance"); onClose(); }} className="text-[11.5px] font-bold text-ink-600 hover:text-ink-900">Mark attendance →</button>
        </div>
        </div>
      </div>
      <TimingComposer open={composer} onClose={() => setComposer(false)} />
    </>
  );
}

/* ================= timing-change composer ================= */

function TimingComposer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, patch } = useStore();
  const toast = useToast();
  const [startDate, setStartDate] = useState(todayISO());
  const [days, setDays] = useState(3);
  const [startTime, setStartTime] = useState(state.settings.startTime);
  const [endTime, setEndTime] = useState(state.settings.endTime);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const preview = useMemo(
    () => buildTimingNotice({ startDate, days, startTime, endTime, note: note || undefined }, state).message,
    [startDate, days, startTime, endTime, note, state]
  );

  const save = () => {
    if (days < 1 || days > 60) { setErr("Days must be between 1 and 60."); return; }
    if (!startTime || !endTime) { setErr("Please set the new start and end time."); return; }
    const n = buildTimingNotice({ startDate, days, startTime, endTime, note: note || undefined }, state);
    patch({
      notifications: [n, ...state.notifications],
      activity: withActivity({ ...state }, `Timing change notice created: ${timeLabel(startTime)}–${timeLabel(endTime)} for ${days} day(s) from ${startDate}.`, "notice"),
    });
    toast.push("Timing change saved — now send it from the notification panel");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Change Tuition Timing (Temporary)" sub="Create a notice, then send it to every parent on WhatsApp" wide
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="gold" icon="bell" onClick={save}>Save Notice</Btn></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1.5">Starts from</span>
          <TInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1.5">For how many days?</span>
          <TInput type="number" min={1} max={60} value={days} onChange={(e) => setDays(parseInt(e.target.value, 10) || 1)} />
        </label>
        <label className="block">
          <span className="block text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1.5">New start time</span>
          <TInput type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1.5">New end time</span>
          <TInput type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className="block text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1.5">Extra note (optional)</span>
          <TInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Because of load-shedding, class will end early." />
        </label>
      </div>
      {err && <p className="text-[12px] font-semibold text-flame-600 mt-3 anim-fade-in">{err}</p>}
      <div className="mt-4">
        <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400 mb-2">Message preview (sent to all parents)</span>
        <pre className="whitespace-pre-wrap font-sans text-[12.5px] text-ink-700 bg-ink-50 border border-ink-150 rounded-[10px] p-3.5 leading-relaxed">{preview}</pre>
      </div>
    </Modal>
  );
}

/* re-export for pages */
export { naturalCompare };
export const monthNow = currentPeriod;
export const statsFor = periodStats;
export { fmtMoney };
