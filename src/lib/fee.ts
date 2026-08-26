import type { DataState, FeeRecord, Payment, Student } from "../types";
import { clampDay, daysBetween, monthKeyOf, periodLabel, todayISO, uid } from "./utils";

export type FeeStatus = "upcoming" | "due" | "partial" | "paid" | "overdue" | "waived";

export const chargeOf = (r: FeeRecord) => (r.waived ? 0 : r.baseFee + r.lateFee + r.adjustment);

export function paidOf(payments: Payment[], feeRecordId: string): number {
  return payments.filter((p) => p.feeRecordId === feeRecordId && p.state !== "voided").reduce((s, p) => s + p.amount, 0);
}

/** Balance floored at 0 — overpayments never create negative dues. */
export function balanceOf(r: FeeRecord, payments: Payment[]): number {
  return Math.max(0, chargeOf(r) - paidOf(payments, r.id));
}

export function statusOf(r: FeeRecord, payments: Payment[], graceDays: number, today = todayISO()): FeeStatus {
  if (r.waived) return "waived";
  const bal = balanceOf(r, payments);
  const paid = paidOf(payments, r.id);
  if (bal <= 0) return "paid";
  if (daysBetween(r.dueDate, today) > graceDays) return "overdue";
  if (paid > 0) return "partial";
  if (monthKeyOf(today) < r.period) return "upcoming";
  return "due";
}

export const FEE_STATUS_LABEL: Record<FeeStatus, string> = {
  upcoming: "Upcoming", due: "Due", partial: "Partially Paid", paid: "Paid", overdue: "Overdue", waived: "Waived",
};

export function studentOutstanding(state: DataState, studentId: string): number {
  return state.feeRecords.filter((r) => r.studentId === studentId).reduce((s, r) => s + balanceOf(r, state.payments), 0);
}

export function previousBalance(state: DataState, studentId: string, period: string): number {
  return state.feeRecords
    .filter((r) => r.studentId === studentId && r.period < period)
    .reduce((s, r) => s + balanceOf(r, state.payments), 0);
}

export function recordsFor(state: DataState, studentId: string): FeeRecord[] {
  return state.feeRecords.filter((r) => r.studentId === studentId).sort((a, b) => b.period.localeCompare(a.period));
}

export function studentPaidToDate(state: DataState, studentId: string, upToPeriod: string): number {
  return state.payments
    .filter((p) => {
      if (p.studentId !== studentId || p.state === "voided") return false;
      const rec = state.feeRecords.find((r) => r.id === p.feeRecordId);
      return rec ? rec.period <= upToPeriod : false;
    })
    .reduce((s, p) => s + p.amount, 0);
}

export function nextDue(state: DataState, studentId: string): { period: string; dueDate: string; balance: number; status: FeeStatus } | null {
  const recs = state.feeRecords.filter((r) => r.studentId === studentId).sort((a, b) => a.period.localeCompare(b.period));
  for (const r of recs) {
    const bal = balanceOf(r, state.payments);
    if (bal > 0) return { period: r.period, dueDate: r.dueDate, balance: bal, status: statusOf(r, state.payments, state.settings.feePolicy.graceDays) };
  }
  const last = recs[recs.length - 1];
  if (!last) return null;
  return { period: last.period, dueDate: last.dueDate, balance: 0, status: statusOf(last, state.payments, state.settings.feePolicy.graceDays) };
}

/** Idempotent monthly generation + one-time late-fee application. */
export function ensureFeeRecords(state: DataState, today = todayISO()): { records: FeeRecord[]; added: number; late: number } {
  const period = monthKeyOf(today);
  const policy = state.settings.feePolicy;
  let records = state.feeRecords;
  let added = 0;
  let late = 0;

  const missing: FeeRecord[] = [];
  for (const s of state.students) {
    if (s.status !== "active") continue;
    if (records.some((r) => r.studentId === s.id && r.period === period)) continue;
    const dueDay = s.feeDueDay || policy.dueDay || 1;
    missing.push({
      id: uid("fee"),
      studentId: s.id,
      period,
      dueDate: clampDay(period, dueDay),
      baseFee: Math.max(0, s.monthlyFee),
      lateFee: 0,
      adjustment: 0,
      waived: false,
      lateFeeApplied: false,
      createdAt: new Date().toISOString(),
    });
    added++;
  }
  if (added) records = [...records, ...missing];

  if (policy.lateFee > 0) {
    records = records.map((r) => {
      if (r.lateFeeApplied || r.waived) return r;
      const bal = balanceOf(r, state.payments);
      if (bal > 0 && daysBetween(r.dueDate, today) > policy.graceDays) {
        late++;
        return { ...r, lateFee: policy.lateFee, lateFeeApplied: true };
      }
      return r;
    });
  }
  return { records, added, late };
}

export function receiptNo(payments: Payment[]): string {
  const max = payments.reduce((m, p) => {
    const n = parseInt(p.receiptNo.replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 1000);
  return `RCP-${max + 1}`;
}

/** Stable unique challan number per fee record (CHL-1001 …). */
export function challanNo(records: FeeRecord[], recordId: string): string {
  const sorted = [...(records ?? [])].sort(
    (a, b) => String(a?.createdAt ?? "").localeCompare(String(b?.createdAt ?? "")) || String(a?.id ?? "").localeCompare(String(b?.id ?? ""))
  );
  const i = sorted.findIndex((r) => r.id === recordId);
  return `CHL-${1001 + (i >= 0 ? i : sorted.length)}`;
}

/* ---------- aggregates ---------- */

export function monthCollected(payments: Payment[], period: string): number {
  return payments.filter((p) => p.state !== "voided" && monthKeyOf(p.date) === period).reduce((s, p) => s + p.amount, 0);
}

export interface PeriodStats {
  charged: number;
  collected: number;
  outstanding: number;
  counts: Record<FeeStatus, number>;
}

export function periodStats(state: DataState, period: string): PeriodStats {
  const recs = state.feeRecords.filter((r) => r.period === period);
  const counts: Record<FeeStatus, number> = { upcoming: 0, due: 0, partial: 0, paid: 0, overdue: 0, waived: 0 };
  let charged = 0;
  let outstanding = 0;
  for (const r of recs) {
    counts[statusOf(r, state.payments, state.settings.feePolicy.graceDays)]++;
    charged += chargeOf(r);
    outstanding += balanceOf(r, state.payments);
  }
  const collected = state.payments
    .filter((p) => {
      if (p.state === "voided") return false;
      const rec = state.feeRecords.find((r) => r.id === p.feeRecordId);
      return rec ? rec.period === period : false;
    })
    .reduce((s, p) => s + p.amount, 0);
  return { charged, collected, outstanding, counts };
}

export function overdueStudents(state: DataState): { student: Student; balance: number; oldestDue: string }[] {
  const today = todayISO();
  const grace = state.settings.feePolicy.graceDays;
  const out: { student: Student; balance: number; oldestDue: string }[] = [];
  for (const s of state.students) {
    if (s.status !== "active") continue;
    let bal = 0;
    let oldest = "";
    for (const r of state.feeRecords.filter((x) => x.studentId === s.id)) {
      const b = balanceOf(r, state.payments);
      if (b > 0 && daysBetween(r.dueDate, today) > grace) {
        bal += b;
        if (!oldest || r.dueDate < oldest) oldest = r.dueDate;
      }
    }
    if (bal > 0) out.push({ student: s, balance: bal, oldestDue: oldest });
  }
  return out.sort((a, b) => a.oldestDue.localeCompare(b.oldestDue));
}

export function dueSoonList(state: DataState, withinDays = 5): { student: Student; dueDate: string; balance: number }[] {
  const today = todayISO();
  const grace = state.settings.feePolicy.graceDays;
  const out: { student: Student; dueDate: string; balance: number }[] = [];
  for (const s of state.students) {
    if (s.status !== "active") continue;
    for (const r of state.feeRecords.filter((x) => x.studentId === s.id)) {
      const b = balanceOf(r, state.payments);
      const dd = daysBetween(r.dueDate, today);
      if (b > 0 && dd >= -grace && dd <= withinDays) out.push({ student: s, dueDate: r.dueDate, balance: b });
    }
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function agingBuckets(state: DataState): { label: string; amount: number; count: number }[] {
  const today = todayISO();
  const buckets = [
    { label: "1–7 days overdue", min: 1, max: 7, amount: 0, count: 0 },
    { label: "8–15 days overdue", min: 8, max: 15, amount: 0, count: 0 },
    { label: "16+ days overdue", min: 16, max: 99999, amount: 0, count: 0 },
  ];
  for (const r of state.feeRecords) {
    const b = balanceOf(r, state.payments);
    if (b <= 0) continue;
    const d = daysBetween(r.dueDate, today);
    if (d <= 0) continue;
    const bk = buckets.find((x) => d >= x.min && d <= x.max);
    if (bk) { bk.amount += b; bk.count++; }
  }
  return buckets;
}

export function collectionByPeriod(state: DataState, n = 6): { period: string; label: string; amount: number }[] {
  const periods = Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (n - 1 - i));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  return periods.map((p) => ({ period: p, label: periodLabel(p, true), amount: monthCollected(state.payments, p) }));
}

export function currentPeriod(): string {
  return monthKeyOf(todayISO());
}
