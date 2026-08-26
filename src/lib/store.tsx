import React, { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type { DataState } from "../types";
import { buildDemoState, emptyState, validateImport } from "./seed";

const KEYS: Record<keyof DataState | "version", string> = {
  students: "tms_students",
  guardians: "tms_guardians",
  batches: "tms_batches",
  attendance: "tms_attendance",
  holidays: "tms_holidays",
  feeRecords: "tms_fee_records",
  payments: "tms_payments",
  slips: "tms_fee_slips",
  activity: "tms_activity_log",
  settings: "tms_settings",
  version: "tms_app_version",
};
const SESSION_KEY = "tms_auth";
export const SCHEMA_VERSION = 1;

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const DATA_KEYS: (keyof DataState)[] = [
  "students", "guardians", "batches", "attendance", "holidays",
  "feeRecords", "payments", "slips", "activity", "settings",
];

function loadState(): DataState {
  const base = emptyState();
  const data = { ...base } as unknown as Record<string, unknown>;
  DATA_KEYS.forEach((k) => {
    const v = safeRead(KEYS[k], undefined);
    if (v !== undefined) data[k] = v;
  });
  // lightweight migration hook for future schema versions
  safeRead(KEYS.version, SCHEMA_VERSION);
  return data as unknown as DataState;
}

function persist(state: DataState) {
  try {
    DATA_KEYS.forEach((k) => localStorage.setItem(KEYS[k], JSON.stringify(state[k])));
    localStorage.setItem(KEYS.version, String(SCHEMA_VERSION));
  } catch {
    window.dispatchEvent(new CustomEvent("tms-storage-error"));
  }
}

type Action =
  | { type: "patch"; patch: Partial<DataState> }
  | { type: "import"; data: DataState }
  | { type: "demo" }
  | { type: "wipe" };

function reducer(state: DataState, action: Action): DataState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "import":
      return action.data;
    case "demo":
      return buildDemoState();
    case "wipe":
      return emptyState();
    default:
      return state;
  }
}

export interface Session {
  user: string;
  at: string;
}

interface StoreCtx {
  state: DataState;
  patch: (p: Partial<DataState>) => void;
  importAll: (data: DataState) => void;
  loadDemo: () => void;
  wipeAll: () => void;
  session: Session | null;
  login: (username: string, password: string, remember: boolean) => boolean;
  logout: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);

function readSession(): Session | null {
  const s = safeRead<Session | null>(SESSION_KEY, null);
  if (s) return s;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const [session, setSession] = useState<Session | null>(readSession);

  useEffect(() => {
    persist(state);
  }, [state]);

  const value = useMemo<StoreCtx>(
    () => ({
      state,
      patch: (p) => dispatch({ type: "patch", patch: p }),
      importAll: (data) => dispatch({ type: "import", data: validateImport(data) ?? emptyState() }),
      loadDemo: () => dispatch({ type: "demo" }),
      wipeAll: () => {
        dispatch({ type: "wipe" });
      },
      session,
      login: (username, password, remember) => {
        const ok =
          username.trim().toLowerCase() === state.settings.auth.username.toLowerCase() &&
          password === state.settings.auth.password;
        if (!ok) return false;
        const s: Session = { user: state.settings.auth.username, at: new Date().toISOString() };
        if (remember) {
          localStorage.setItem(SESSION_KEY, JSON.stringify(s));
          sessionStorage.removeItem(SESSION_KEY);
        } else {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
          localStorage.removeItem(SESSION_KEY);
        }
        setSession(s);
        return true;
      },
      logout: () => {
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        setSession(null);
      },
    }),
    [state, session]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside provider");
  return v;
}

/* ---------- activity helper (immutable) ---------- */
export function withActivity(state: DataState, text: string, kind: DataState["activity"][number]["kind"]): DataState["activity"] {
  return [{ id: `act_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, at: new Date().toISOString(), text, kind }, ...state.activity].slice(0, 120);
}
