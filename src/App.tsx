import React from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import StudentProfile from "./pages/StudentProfile";
import Classes from "./pages/Classes";
import Attendance from "./pages/Attendance";
import Fees from "./pages/Fees";
import Slips from "./pages/Slips";
import CalendarPage from "./pages/CalendarPage";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import { Shell, useNav } from "./components/Shell";
import { ToastProvider } from "./components/ui";
import { StoreProvider, useStore, withActivity } from "./lib/store";
import { ensureFeeRecords } from "./lib/fee";

function Router() {
  const { route } = useNav();
  const { state, patch } = useStore();

  /*
   * Fee-cycle auto-refresh: whenever the app is open and the calendar rolls into
   * a new day/month, re-run the generator so fresh challans appear, late fees
   * apply and every dashboard/fee/dues figure stays perfectly in sync.
   */
  React.useEffect(() => {
    const run = () => {
      const res = ensureFeeRecords(state);
      if (res.added > 0 || res.late > 0) {
        patch({
          feeRecords: res.records,
          activity: withActivity(
            { ...state, feeRecords: res.records },
            `Fee cycle refreshed — ${res.added} new challan(s) generated${res.late ? `, ${res.late} late fee(s) applied` : ""}.`,
            "fee"
          ),
        });
      }
    };
    run();
    const t = window.setInterval(run, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") run(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  switch (route.page) {
    case "students": return <Students />;
    case "student": return <StudentProfile />;
    case "classes": return <Classes />;
    case "attendance": return <Attendance />;
    case "fees": return <Fees />;
    case "slips": return <Slips />;
    case "calendar": return <CalendarPage />;
    case "reports": return <Reports />;
    case "settings": return <Settings />;
    default: return <Dashboard />;
  }
}

function Root() {
  const { session, state, loadDemo } = useStore();
  const [skip, setSkip] = React.useState(false);
  if (!session) {
    const firstRun = state.students.length === 0 && !state.activity.length && !skip;
    return <Login onFirstRun={firstRun ? loadDemo : undefined} onSkip={firstRun ? () => setSkip(true) : undefined} />;
  }
  void skip;
  return (
    <Shell>
      <Router />
    </Shell>
  );
}

/** Catches any runtime error so the app never shows a dead white screen. */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  resetData = () => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("tms_"))
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
    window.location.reload();
  };
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-ledger flex items-center justify-center px-5">
        <div className="card max-w-md w-full p-7 text-center anim-pop">
          <span className="inline-flex w-14 h-14 rounded-2xl bg-flame-50 text-flame-600 items-center justify-center mx-auto">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5 2.8 19.5h18.4z" /><path d="M12 9.5v4.5M12 16.8v.01" /></svg>
          </span>
          <h1 className="font-display font-extrabold text-[22px] text-ink-900 mt-4">Something went wrong</h1>
          <p className="text-[13px] text-ink-500 mt-2 leading-relaxed">
            An error occurred while loading the app. This is usually caused by old browser data. Try <b>Reload</b> first — if it still fails, the button below will reset your local data.
          </p>
          <p className="font-mono text-[10.5px] text-ink-300 mt-3 break-all">{String(this.state.error.message ?? this.state.error).slice(0, 160)}</p>
          <div className="flex justify-center gap-2.5 mt-6">
            <button onClick={() => window.location.reload()} className="h-10 px-5 rounded-[9px] bg-ink-900 text-white text-[13px] font-bold press">Reload App</button>
            <button onClick={this.resetData} className="h-10 px-5 rounded-[9px] border border-flame-600/40 bg-flame-50 text-flame-700 text-[13px] font-bold press">Reset Local Data</button>
          </div>
        </div>
      </div>
    );
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <StoreProvider>
          <Root />
        </StoreProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
