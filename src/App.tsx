import React, { useEffect } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import StudentProfile from "./pages/StudentProfile";
import Batches from "./pages/Batches";
import Attendance from "./pages/Attendance";
import Fees from "./pages/Fees";
import Slips from "./pages/Slips";
import CalendarPage from "./pages/CalendarPage";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import { Shell, useNav } from "./components/Shell";
import { ToastProvider, useToast } from "./components/ui";
import { StoreProvider, useStore, withActivity } from "./lib/store";
import { ensureFeeRecords } from "./lib/fee";

function Router() {
  const { route } = useNav();
  const { state, patch } = useStore();

  // ensure the current fee cycle exists whenever the workspace is opened
  useEffect(() => {
    const res = ensureFeeRecords(state);
    if (res.added > 0 || res.late > 0) {
      patch({
        feeRecords: res.records,
        activity: withActivity({ ...state, feeRecords: res.records }, `Fee cycle ensured — ${res.added} new monthly record(s) created.`, "fee"),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  switch (route.page) {
    case "students": return <Students />;
    case "student": return <StudentProfile />;
    case "batches": return <Batches />;
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
  const { session } = useStore();
  const toast = useToast();

  useEffect(() => {
    const onStorageError = () => toast.push("Browser storage is unavailable or full — export a backup!", "err");
    window.addEventListener("tms-storage-error", onStorageError);
    return () => window.removeEventListener("tms-storage-error", onStorageError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session) return <Login />;
  return (
    <Shell>
      <Router />
    </Shell>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <StoreProvider>
        <Root />
      </StoreProvider>
    </ToastProvider>
  );
}
