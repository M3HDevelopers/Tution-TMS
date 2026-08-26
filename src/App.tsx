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
import { StoreProvider, useStore } from "./lib/store";

function Router() {
  const { route } = useNav();
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
  const { session, state } = useStore();
  const [gateDone, setGateDone] = React.useState(false);
  if (!session) {
    if (state.students.length === 0 && !gateDone) {
      return <FirstRunGate onSkip={() => setGateDone(true)} />;
    }
    return <Login />;
  }
  return (
    <Shell>
      <Router />
    </Shell>
  );
}

/** Brand-new install: choose demo data or start empty — before the login screen. */
function FirstRunGate({ onSkip }: { onSkip: () => void }) {
  const { loadDemo } = useStore();
  return <Login onFirstRun={loadDemo} onSkip={onSkip} />;
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
