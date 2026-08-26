import type { DataState, Guardian, Payment, Student, TimingNotice } from "../types";
import { balanceOf, challanNo, currentPeriod, statusOf } from "./fee";
import type { ChallanModel } from "./slip";
import { addDays, daysBetween, fillTemplate, fmtDate, fmtMoney, periodLabel, timeLabel, todayISO } from "./utils";
import { timingMessage } from "./seed";

export interface NoticeItem {
  key: string;
  kind: "challan" | "overdue" | "due-soon" | "absent" | "timing" | "info";
  title: string;
  body: string;
  recordId?: string;
  studentId?: string;
  noticeId?: string;
}

export function deriveNotices(state: DataState): NoticeItem[] {
  const out: NoticeItem[] = [];
  const period = currentPeriod();
  const grace = state.settings.feePolicy.graceDays;
  const cur = state.settings.feePolicy.currency;
  const today = todayISO();
  const nameOf = (id: string) => state.students.find((s) => s.id === id)?.name ?? "Student";

  // active timing notices (still running or upcoming)
  for (const n of state.notifications) {
    const end = addDays(n.startDate, n.days - 1);
    if (end >= today) {
      out.push({
        key: `ntf-${n.id}`, kind: "timing", noticeId: n.id,
        title: n.title || "Timing change notice",
        body: `${timeLabel(n.startTime)} – ${timeLabel(n.endTime)} · ${fmtDate(n.startDate, state.settings.dateFormat)} for ${n.days} day${n.days > 1 ? "s" : ""}${n.sentTo.length ? ` · sent to ${n.sentTo.length} contact(s)` : " · not sent yet"}`,
      });
    }
  }

  // absent today (or last working day with records)
  const absentToday = state.attendance.filter((a) => a.date === today && a.status === "absent");
  for (const a of absentToday) {
    out.push({
      key: `abs-${a.id}`, kind: "absent", studentId: a.studentId,
      title: `${nameOf(a.studentId)} was absent today`,
      body: "Notify the parent on WhatsApp (if a number is saved).",
    });
  }

  /*
   * Real, actionable alerts only:
   *  1. OVERDUE — due date crossed the grace period and money is still pending.
   *  2. DUE SOON — due date is within the next 5 days (or inside grace period) with balance left.
   * Fresh challans of students whose due date is still far away are NOT spammed here —
   * they are visible on the Fees page when actually needed.
   */
  for (const r of state.feeRecords.filter((x) => x.period === period)) {
    const student = state.students.find((s) => s.id === r.studentId);
    if (!student || student.status !== "active") continue;
    const bal = balanceOf(r, state.payments);
    if (bal <= 0) continue;
    const st = statusOf(r, state.payments, grace);
    const lateBy = daysBetween(r.dueDate, today);
    if (st === "overdue") {
      out.push({
        key: `ovd-${r.id}`, kind: "overdue", recordId: r.id, studentId: r.studentId,
        title: `${student.name} — fee overdue`,
        body: `${fmtMoney(bal, cur)} outstanding · due ${fmtDate(r.dueDate, state.settings.dateFormat)} (${lateBy} days late)`,
      });
    } else if (lateBy >= -grace && lateBy <= 5) {
      out.push({
        key: `chl-${r.id}`, kind: "challan", recordId: r.id, studentId: r.studentId,
        title: `${student.name} — ${periodLabel(period)} fee ${st === "partial" ? "partially paid" : "due"} soon`,
        body: st === "partial"
          ? `Remaining ${fmtMoney(bal, cur)} · due date ${fmtDate(r.dueDate, state.settings.dateFormat)}. Send challan for the rest.`
          : `${fmtMoney(bal, cur)} payable · due date ${fmtDate(r.dueDate, state.settings.dateFormat)}. Challan ready to send.`,
      });
    }
  }

  const order: Record<NoticeItem["kind"], number> = { timing: 0, overdue: 1, absent: 2, challan: 3, "due-soon": 4, info: 5 };
  return out.sort((a, b) => order[a.kind] - order[b.kind]);
}

/* ---------- message builders ---------- */

export function challanMessage(state: DataState, m: ChallanModel): string {
  return fillTemplate(state.settings.challanTemplate, {
    student: m.studentName,
    period: m.periodLabel,
    total: fmtMoney(m.totalCharge, m.currency),
    due: m.dueDate,
    balance: fmtMoney(m.remaining, m.currency),
    tuition: state.settings.tuitionName,
  });
}

export function receiptMessage(state: DataState, p: Payment): string {
  const s = state.settings;
  const student = state.students.find((x) => x.id === p.studentId);
  const rec = state.feeRecords.find((r) => r.id === p.feeRecordId);
  const bal = rec ? balanceOf(rec, state.payments) : 0;
  return `Assalam-o-Alaikum! Payment receipt ${p.receiptNo} — ${fmtMoney(p.amount, s.feePolicy.currency)} received for ${student?.name ?? "student"}${rec ? ` (${periodLabel(rec.period)})` : ""} via ${p.method}. ${bal <= 0 ? "Fee is fully paid. JazakAllah!" : `Remaining balance: ${fmtMoney(bal, s.feePolicy.currency)}.`} Thank you! — ${s.tutorName}, ${s.tuitionName}`;
}

export function absentMessage(state: DataState, student: Student): string {
  const s = state.settings;
  return `Assalam-o-Alaikum. ${student.name} (${student.grade}) was marked ABSENT today, ${fmtDate(todayISO(), s.dateFormat)}, at ${s.tuitionName}. Kindly confirm the reason. JazakAllah! — ${s.tutorName}`;
}

export function whatsappGuardians(state: DataState, studentId: string): Guardian[] {
  return state.guardians.filter((g) => g.studentId === studentId && g.whatsapp && g.phone.trim());
}

export function buildTimingNotice(p: { startDate: string; days: number; startTime: string; endTime: string; note?: string }, state: DataState): TimingNotice {
  const message = timingMessage(state.settings, p);
  return {
    id: `ntf_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    title: `Tuition timing change — ${timeLabel(p.startTime)} to ${timeLabel(p.endTime)}`,
    message, startDate: p.startDate, days: p.days, startTime: p.startTime, endTime: p.endTime,
    note: p.note, createdAt: new Date().toISOString(), sentTo: [],
  };
}

export { challanNo };
