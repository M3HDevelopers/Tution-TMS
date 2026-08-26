import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ActivityItem, AttendanceRecord, DataState, FeeRecord, FeeSlipLog, Guardian, Holiday, Payment, Settings, Student, TimingNotice } from "../types";
import { DEFAULT_SETTINGS } from "../types";
import { buildDemoData, emptyData } from "./seed";
import { clampDay, num, uid } from "./utils";

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

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";
const str = (v: unknown, fb = ""): string => (typeof v === "string" ? v : fb);

/**
 * Bullet-proof sanitizer — no matter what shape old/corrupt localStorage data has,
 * the app always receives a fully-valid DataState. This is the single gate
 * between browser storage and the UI.
 */
function sanitizeState(raw: Partial<Record<keyof DataState, unknown>> & { settings?: unknown }): DataState {
  const fresh = emptyData();

  const students: Student[] = asArray<Record<string, unknown>>(raw.students)
    .filter((s) => isObj(s) && typeof s.name === "string" && s.name.trim())
    .map((s) => ({
      id: str(s.id, uid("stu")),
      name: s.name as string,
      level: (["Pre-school", "Nursery", "Prep", "Primary", "Middle", "Matric", "Intermediate", "College"].includes(str(s.level)) ? s.level : "Primary") as Student["level"],
      grade: str(s.grade, str(s.level, "Class")),
      school: typeof s.school === "string" ? s.school : undefined,
      subjects: Array.isArray(s.subjects) ? (s.subjects as string[]) : undefined,
      monthlyFee: Math.max(0, num(s.monthlyFee) || fresh.settings.feePolicy.defaultFee),
      feeDueDay: (() => {
        const d = num(s.feeDueDay ?? s.dueDay); // legacy "dueDay" support
        return Number.isInteger(d) && d >= 1 && d <= 28 ? d : 1;
      })(),
      joiningDate: typeof s.joiningDate === "string" ? s.joiningDate : undefined,
      status: s.status === "inactive" ? ("inactive" as const) : ("active" as const),
      address: typeof s.address === "string" ? s.address : undefined,
      notes: typeof s.notes === "string" ? s.notes : undefined,
      photo: typeof s.photo === "string" ? s.photo : null,
    }));

  const guardians: Guardian[] = asArray<Record<string, unknown>>(raw.guardians)
    .filter((g) => isObj(g) && typeof g.name === "string" && typeof g.phone === "string")
    .map((g, i) => ({
      id: str(g.id, uid("grd")),
      studentId: str(g.studentId, ""),
      name: g.name as string,
      relation: str(g.relation, "Guardian"),
      phone: g.phone as string,
      whatsapp: g.whatsapp !== false,
      primary: g.primary === true || (i === 0 && g.primary !== false),
      notes: typeof g.notes === "string" ? g.notes : undefined,
    }));

  const attendance: AttendanceRecord[] = asArray<Record<string, unknown>>(raw.attendance)
    .filter((a) => isObj(a) && typeof a.date === "string" && typeof a.studentId === "string" && typeof a.status === "string")
    .map((a) => ({
      id: str(a.id, uid("att")),
      date: a.date as string,
      studentId: a.studentId as string,
      className: typeof a.className === "string" ? a.className : null,
      status: (["present", "absent", "late", "leave"].includes(a.status as string) ? a.status : "present") as AttendanceRecord["status"],
      markedAt: str(a.markedAt, new Date().toISOString()),
    }));

  const holidays: Holiday[] = asArray<Record<string, unknown>>(raw.holidays)
    .filter((h) => isObj(h) && typeof h.date === "string" && typeof h.title === "string")
    .map((h) => ({
      id: str(h.id, uid("hol")),
      date: h.date as string,
      scope: h.scope === "class" ? ("class" as const) : ("all" as const),
      className: typeof h.className === "string" ? h.className : undefined,
      title: h.title as string,
      reason: typeof h.reason === "string" ? h.reason : undefined,
    }));

  const feeRecords: FeeRecord[] = asArray<Record<string, unknown>>(raw.feeRecords)
    .filter((r) => isObj(r) && typeof r.studentId === "string" && typeof r.period === "string" && /^\d{4}-\d{2}$/.test(r.period as string))
    .map((r) => {
      const period = r.period as string;
      const dueDay = num(r.feeDueDay ?? r.dueDay) || 1;
      return {
        id: str(r.id, uid("fee")),
        studentId: r.studentId as string,
        period,
        dueDate: typeof r.dueDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(r.dueDate) ? (r.dueDate as string) : clampDay(period, dueDay),
        baseFee: Math.max(0, num(r.baseFee)),
        lateFee: Math.max(0, num(r.lateFee)),
        adjustment: num(r.adjustment),
        waived: r.waived === true,
        waiveReason: typeof r.waiveReason === "string" ? r.waiveReason : undefined,
        lateFeeApplied: r.lateFeeApplied === true,
        createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
      };
    });

  const payments: Payment[] = asArray<Record<string, unknown>>(raw.payments)
    .filter((p) => isObj(p) && typeof p.studentId === "string" && num(p.amount) > 0)
    .map((p, i) => ({
      id: str(p.id, uid("pay")),
      receiptNo: str(p.receiptNo, `RCP-${1001 + i}`),
      feeRecordId: str(p.feeRecordId, ""),
      studentId: p.studentId as string,
      amount: num(p.amount),
      date: typeof p.date === "string" ? p.date : new Date().toISOString().slice(0, 10),
      method: (["Cash", "Bank Transfer", "Mobile Wallet", "Other"].includes(str(p.method)) ? p.method : "Cash") as Payment["method"],
      reference: typeof p.reference === "string" ? p.reference : undefined,
      note: typeof p.note === "string" ? p.note : undefined,
      state: (["recorded", "edited", "voided"].includes(str(p.state)) ? p.state : "recorded") as Payment["state"],
      createdAt: typeof p.createdAt === "string" ? p.createdAt : new Date().toISOString(),
    }));

  const slips: FeeSlipLog[] = asArray<Record<string, unknown>>(raw.slips)
    .filter((s) => isObj(s) && typeof s.refId === "string" && typeof s.no === "string")
    .map((s) => ({
      id: str(s.id, uid("slp")),
      kind: s.kind === "receipt" ? ("receipt" as const) : ("challan" as const),
      refId: s.refId as string,
      no: s.no as string,
      generatedAt: typeof s.generatedAt === "string" ? s.generatedAt : new Date().toISOString(),
      sentTo: asArray<string>(s.sentTo).filter((x) => typeof x === "string"),
      sent: s.sent === true,
    }));

  const notifications: TimingNotice[] = asArray<Record<string, unknown>>(raw.notifications)
    .filter((n) => isObj(n) && typeof n.title === "string")
    .map((n) => ({
      id: str(n.id, uid("ntf")),
      title: n.title as string,
      message: str(n.message),
      startDate: typeof n.startDate === "string" ? n.startDate : new Date().toISOString().slice(0, 10),
      days: Math.max(1, num(n.days) || 1),
      startTime: typeof n.startTime === "string" && n.startTime.includes(":") ? n.startTime : fresh.settings.startTime,
      endTime: typeof n.endTime === "string" && n.endTime.includes(":") ? n.endTime : fresh.settings.endTime,
      note: typeof n.note === "string" ? n.note : undefined,
      createdAt: typeof n.createdAt === "string" ? n.createdAt : new Date().toISOString(),
      sentTo: asArray<string>(n.sentTo).filter((x) => typeof x === "string"),
    }));

  const activity: ActivityItem[] = asArray<Record<string, unknown>>(raw.activity)
    .filter((a) => isObj(a) && typeof a.text === "string")
    .map((a) => ({
      id: str(a.id, uid("act")),
      at: typeof a.at === "string" ? a.at : new Date().toISOString(),
      text: a.text as string,
      kind: (["student", "fee", "attendance", "settings", "backup", "share", "notice"].includes(str(a.kind)) ? a.kind : "settings") as ActivityItem["kind"],
    }));

  /* settings — merge over defaults, legacy auth object supported */
  const rs = isObj(raw.settings) ? raw.settings : {};
  const legacyAuth = isObj(rs.auth) ? rs.auth : {};
  const legacyPolicy = isObj(rs.feePolicy) ? rs.feePolicy : {};
  const settings: Settings = {
    ...fresh.settings,
    tuitionName: str(rs.tuitionName, fresh.settings.tuitionName),
    tutorName: str(rs.tutorName, fresh.settings.tutorName),
    phone: str(rs.phone, fresh.settings.phone),
    email: str(rs.email, fresh.settings.email),
    address: str(rs.address, fresh.settings.address),
    footerNote: str(rs.footerNote, fresh.settings.footerNote),
    tutorPhoto: typeof rs.tutorPhoto === "string" ? rs.tutorPhoto : null,
    username: str(rs.username, str(legacyAuth.username, "tutor")) || "tutor",
    password: str(rs.password, str(legacyAuth.password, "tutor123")) || "tutor123",
    startTime: typeof rs.startTime === "string" && rs.startTime.includes(":") ? rs.startTime : fresh.settings.startTime,
    endTime: typeof rs.endTime === "string" && rs.endTime.includes(":") ? rs.endTime : fresh.settings.endTime,
    weeklyOffs: asArray<number>(rs.weeklyOffs).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
    feePolicy: {
      dueDay: (() => { const d = num(legacyPolicy.dueDay ?? fresh.settings.feePolicy.dueDay); return Number.isInteger(d) && d >= 1 && d <= 28 ? d : 1; })(),
      graceDays: Math.min(15, Math.max(0, num(legacyPolicy.graceDays ?? fresh.settings.feePolicy.graceDays))),
      lateFee: Math.max(0, num(legacyPolicy.lateFee ?? fresh.settings.feePolicy.lateFee)),
      currency: str(legacyPolicy.currency, fresh.settings.feePolicy.currency) || "Rs",
      defaultFee: Math.max(0, num(legacyPolicy.defaultFee ?? fresh.settings.feePolicy.defaultFee)),
    },
    templatePreset: (["roman", "english", "short"].includes(str(rs.templatePreset)) ? rs.templatePreset : "roman") as Settings["templatePreset"],
    challanTemplate: str(rs.challanTemplate, fresh.settings.challanTemplate),
    dateFormat: (["dmy", "mdy", "iso"].includes(str(rs.dateFormat)) ? rs.dateFormat : "dmy") as Settings["dateFormat"],
  };
  if (settings.weeklyOffs.length === 0 && Array.isArray(rs.weeklyOffs) === false) settings.weeklyOffs = [0];

  return {
    students, guardians, batches: [], attendance, holidays,
    feeRecords, payments, slips, notifications, activity, settings,
  };
}

function loadState(): DataState {
  try {
    const version = read<number>(KEYS.version, 0);
    const raw = {
      students: read(KEYS.students, []),
      guardians: read(KEYS.guardians, []),
      attendance: read(KEYS.attendance, []),
      holidays: read(KEYS.holidays, []),
      feeRecords: read(KEYS.feeRecords, []),
      payments: read(KEYS.payments, []),
      slips: read(KEYS.slips, []),
      notifications: read(KEYS.notifications, []),
      activity: read(KEYS.activity, []),
      settings: read(KEYS.settings, {}),
    };
    const clean = sanitizeState(raw as Partial<Record<keyof DataState, unknown>>);
    if (version < SCHEMA_VERSION) persistAll(clean); // persist migrated shape once
    return clean;
  } catch {
    return emptyData();
  }
}

function persistAll(s: DataState) {
  (Object.keys(KEYS) as (keyof typeof KEYS)[]).forEach((k) => {
    if (k === "version") write(KEYS.version, SCHEMA_VERSION);
    else write(KEYS[k], s[k as keyof DataState]);
  });
}

export function withActivity(s: DataState, text: string, kind: ActivityItem["kind"]): ActivityItem[] {
  return [{ id: uid("act"), at: new Date().toISOString(), text, kind }, ...(s.activity ?? [])].slice(0, 200);
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
  const [session, setSession] = useState<boolean>(() => {
    try {
      return read<boolean>(SESSION_KEY, false) || sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => persistAll(state), [state]);

  const patch = (p: Partial<DataState>) => setState((s) => ({ ...s, ...p }));

  const login = (u: string, p: string, remember: boolean) => {
    const ok = u.trim() === state.settings.username && p === state.settings.password;
    if (ok) {
      setSession(true);
      try {
        if (remember) write(SESSION_KEY, true);
        else sessionStorage.setItem(SESSION_KEY, "1");
      } catch { /* private mode */ }
    }
    return ok;
  };

  const logout = () => {
    setSession(false);
    try {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    } catch { /* ignore */ }
  };

  /* Demo load = data + auto-login + activity trail, so the user lands on the dashboard */
  const loadDemo = () => {
    const demo = buildDemoData();
    demo.activity = withActivity(demo, "Demo data loaded — 12 students, 4 months of fees, attendance and receipts.", "backup");
    setState(demo);
    setSession(true);
    try {
      write(SESSION_KEY, true);
    } catch { /* ignore */ }
  };
  const resetDemo = () => {
    const demo = buildDemoData();
    demo.activity = withActivity({ ...demo, activity: state.activity }, "Demo data reset to a fresh sample set.", "backup");
    setState(demo);
  };
  const importAll = (data: DataState) => setState(sanitizeState(data as unknown as Partial<Record<keyof DataState, unknown>>));

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
  for (const k of need) if (!Array.isArray(o[k]) && !isObj(o[k])) return { ok: false, error: `Missing or invalid "${k}" collection.` };
  for (const k of ["students", "guardians", "attendance", "holidays", "feeRecords", "payments"] as const) {
    if (!Array.isArray(o[k])) return { ok: false, error: `"${k}" must be a list.` };
  }
  const students = asArray<Record<string, unknown>>(o.students);
  if (students.some((s) => typeof s?.id !== "string" || typeof s?.name !== "string")) return { ok: false, error: "Student records look corrupt (missing id/name)." };
  const data = sanitizeState(o as unknown as Partial<Record<keyof DataState, unknown>>);
  return {
    ok: true,
    data,
    counts: { students: data.students.length, payments: data.payments.length, attendance: data.attendance.length, feeRecords: data.feeRecords.length },
  };
}
