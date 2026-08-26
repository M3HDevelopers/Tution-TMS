import React, { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type { ActivityItem, DataState } from "../types";
import { DEFAULT_SETTINGS } from "../types";
import { buildDemoData, emptyData } from "./seed";
import { uid } from "./utils";

export const SCHEMA_VERSION = 2;

const KEYS: Record<keyof DataState | "version", string> = {
  students: "tms_students", guardians: "tms_guardians", batches: "tms_batches",
  attendance: "tms_attendance", holidays: "tms_holidays", feeRecords: "tms_fee_records",
  payments: "tms_payments", slips: "tms_fee_slips", notifications: "tms_notices",
  activity: "tms_activity_log", settings: "tms_settings", version: "tms_app_version",
};
const SESSION_KEY = "tms_auth_session";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    window.dispatchEvent(new Event("tms-storage-error"));
  }
}

function loadState(): DataState {
  const version = read<number>(KEYS.version, 0);
  const fresh = emptyData();
  if (version < SCHEMA_VERSION) {
    // v1 → v2: batches removed, auth moved into settings, students simplified.
    const legacyStudents = read<Record<string, unknown>[]>(KEYS.students, []);
    const students = legacyStudents
      .filter((s) => s && typeof s.name === "string" && s.status !== "archived")
      .map((s) => ({
        id: String(s.id ?? uid("stu")), name: String(s.name),
        level: (s.level as DataState["students"][number]["level"]) ?? "Primary",
        grade: String(s.grade ?? String(s.level ?? "Class")),
        school: typeof s.school === "string" ? s.school : undefined,
        subjects: Array.isArray(s.subjects) ? (s.subjects as string[]) : undefined,
        feeDueDay: typeof (s as { dueDay?: unknown }).dueDay === "number" ? ((s as { dueDay?: number }).dueDay as number) : 1,
        monthlyFee: typeof s.monthlyFee === "number" ? s.monthlyFee : DEFAULT_SETTINGS.feePolicy.defaultFee,
        joiningDate: typeof s.joiningDate === "string" ? s.joiningDate : undefined,
        status: s.status === "inactive" ? ("inactive" as const) : ("active" as const),
        address: typeof s.address === "string" ? s.address : undefined,
        notes: typeof s.notes === "string" ? s.notes : undefined,
        photo: null,
      }));
    const legacySettings = read<Record<string, unknown>>(KEYS.settings, {});
    const oldAuth = (legacySettings.auth ?? {}) as { username?: string; password?: string };
    const oldPolicy = (legacySettings.feePolicy ?? {}) as DataState["settings"]["feePolicy"];
    const settings: DataState["settings"] = {
      ...DEFAULT_SETTINGS,
      tuitionName: typeof legacySettings.tuitionName === "string" ? legacySettings.tuitionName : DEFAULT_SETTINGS.tuitionName,
      tutorName: typeof legacySettings.tutorName === "string" ? legacySettings.tutorName : DEFAULT_SETTINGS.tutorName,
      username: oldAuth.username || "tutor",
      password: oldAuth.password || "tutor123",
      feePolicy: { ...DEFAULT_SETTINGS.feePolicy, ...oldPolicy },
    };
    const migrated: DataState = {
      ...fresh,
      students,
      guardians: read<Record<string, unknown>[]>(KEYS.guardians, []).map((g) => {
        const rest = { ...g };
        delete rest.batchId;
        return rest;
      }) as unknown as DataState["guardians"],
      attendance: read<DataState["attendance"]>(KEYS.attendance, []).map((a) => ({ ...a, className: (a as { className?: string }).className ?? null })),
      holidays: read<DataState["holidays"]>(KEYS.holidays, []).filter((h) => h.scope !== ("batch" as string)),
      feeRecords: read(KEYS.feeRecords, []),
      payments: read(KEYS.payments, []),
      slips: [],
      settings,
    };
    persistAll(migrated);
    return migrated;
  }
  const s: DataState = {
    students: read(KEYS.students, fresh.students),
    guardians: read(KEYS.guardians, fresh.guardians),
    batches: read(KEYS.batches, []),
    attendance: read(KEYS.attendance, fresh.attendance),
    holidays: read(KEYS.holidays, fresh.holidays),
    feeRecords: read(KEYS.feeRecords, fresh.feeRecords),
    payments: read(KEYS.payments, fresh.payments),
    slips: read(KEYS.slips, fresh.slips),
    notifications: read(KEYS.notifications, fresh.notifications),
    activity: read(KEYS.activity, fresh.activity),
    settings: { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {} as Partial<DataState["settings"]>) },
  };
  s.settings.feePolicy = { ...DEFAULT_SETTINGS.feePolicy, ...s.settings.feePolicy };
  return s;
}

function persistAll(s: DataState) {
  (Object.keys(KEYS) as (keyof typeof KEYS)[]).forEach((k) => {
    if (k === "version") write(KEYS.version, SCHEMA_VERSION);
    else write(KEYS[k], s[k as keyof DataState]);
  });
}

export function withActivity(s: DataState, text: string, kind: ActivityItem["kind"]): ActivityItem[] {
  return [{ id: uid("act"), at: new Date().toISOString(), text, kind }, ...s.activity].slice(0, 200);
}

interface StoreCtx {
  state: DataState;
  patch: (p: Partial<DataState>) => void;
  session: boolean;
  login: (u: string, p: string, remember: boolean) => boolean;
  logout: () => void;
  loadDemo: () => void;
  resetDemo: () => void;
  importAll: (data: DataState) => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DataState>(loadState);
  const [session, setSession] = useState<boolean>(() => read(SESSION_KEY, false));

  useEffect(() => persistAll(state), [state]);

  const patch = (p: Partial<DataState>) => setState((s) => ({ ...s, ...p }));

  const login = (u: string, p: string, remember: boolean) => {
    const ok = u.trim() === state.settings.username && p === state.settings.password;
    if (ok) {
      setSession(true);
      if (remember) write(SESSION_KEY, true);
      else sessionStorage.setItem(SESSION_KEY, "1");
    }
    return ok;
  };

  const logout = () => {
    setSession(false);
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  };

  const loadDemo = () => setState(buildDemoData());
  const resetDemo = () => setState(buildDemoData());
  const importAll = (data: DataState) => setState(data);

  const value = useMemo(
    () => ({ state, patch, session, login, logout, loadDemo, resetDemo, importAll }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, session]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("StoreProvider missing");
  return v;
}

/* ---------- backup validation ---------- */
export function validateImport(text: string): { ok: true; data: DataState; counts: { students: number; payments: number; attendance: number; feeRecords: number } } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "File is not valid JSON." };
  }
  const o = json as Record<string, unknown>;
  const need: (keyof DataState)[] = ["students", "guardians", "attendance", "holidays", "feeRecords", "payments", "settings"];
  for (const k of need) if (!Array.isArray(o[k]) && typeof o[k] !== "object") return { ok: false, error: `Missing or invalid "${k}" collection.` };
  for (const k of ["students", "guardians", "attendance", "holidays", "feeRecords", "payments"] as const) {
    if (!Array.isArray(o[k])) return { ok: false, error: `"${k}" must be a list.` };
  }
  const students = o.students as DataState["students"];
  if (students.some((s) => typeof s?.id !== "string" || typeof s?.name !== "string")) return { ok: false, error: "Student records look corrupt (missing id/name)." };
  const base = emptyData();
  const data: DataState = {
    students,
    guardians: (o.guardians as DataState["guardians"]) ?? [],
    batches: Array.isArray(o.batches) ? (o.batches as DataState["batches"]) : [],
    attendance: (o.attendance as DataState["attendance"]) ?? [],
    holidays: (o.holidays as DataState["holidays"]) ?? [],
    feeRecords: (o.feeRecords as DataState["feeRecords"]) ?? [],
    payments: (o.payments as DataState["payments"]) ?? [],
    slips: Array.isArray(o.slips) ? (o.slips as DataState["slips"]) : [],
    notifications: Array.isArray(o.notifications) ? (o.notifications as DataState["notifications"]) : [],
    activity: Array.isArray(o.activity) ? (o.activity as DataState["activity"]) : [],
    settings: { ...base.settings, ...(o.settings as Partial<DataState["settings"]>) },
  };
  return {
    ok: true,
    data,
    counts: { students: students.length, payments: data.payments.length, attendance: data.attendance.length, feeRecords: data.feeRecords.length },
  };
}
