import React, { useMemo } from "react";
import { useNav, useUi } from "../components/Shell";
import { Avatar, Btn, EmptyState, FeeStatusBadge, Icon, ProgressBar, Stat, useToast } from "../components/ui";
import { balanceOf, dueSoonList, overdueStudents, periodStats, statusOf, studentOutstanding } from "../lib/fee";
import { useStore } from "../lib/store";
import { currentPeriod, fmtDate, fmtMoney, monthKeyOf, naturalCompare, periodLabel, timeLabel, todayISO, weekdayIdx } from "../lib/utils";

export default function Dashboard() {
  const { state } = useStore();
  const { nav } = useNav();
  const ui = useUi();
  const toast = useToast();
  const df = state.settings.dateFormat;
  const cur = state.settings.feePolicy.currency;
  const today = todayISO();
  const period = currentPeriod();
  const grace = state.settings.feePolicy.graceDays;

  const active = state.students.filter((s) => s.status === "active");
  const stats = periodStats(state, period);
  const overdue = overdueStudents(state);
  const dueSoon = dueSoonList(state);
  const partials = state.feeRecords.filter((r) => r.period === period && statusOf(r, state.payments, grace) === "partial");
  const partialRemaining = partials.reduce((s, r) => s + balanceOf(r, state.payments), 0);

  const attToday = state.attendance.filter((a) => a.date === today);
  const present = attToday.filter((a) => a.status === "present" || a.status === "late").length;
  const absent = attToday.filter((a) => a.status === "absent").length;
  const notMarked = Math.max(0, active.length - attToday.length);

  const isHoliday = state.holidays.some((h) => h.date === today && h.scope === "all");
  const weeklyOff = state.settings.weeklyOffs.includes(weekdayIdx(today));

  const recent = [...state.payments].filter((p) => p.state !== "voided").sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 7);
  const nameOf = (id: string) => state.students.find((s) => s.id === id)?.name ?? "Unknown";

  const classes = useMemo(() => {
    const map = new Map<string, number>();
    active.forEach((s) => map.set(s.grade, (map.get(s.grade) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => naturalCompare(a[0], b[0]));
  }, [active]);

  const totalExpected = active.reduce((s, x) => s + x.monthlyFee, 0);

  return (
    <div>
      {/* greeting strip */}
      <div className="card overflow-hidden mb-5 anim-fade-up">
        <div className="bg-inkweave px-5 sm:px-7 py-6 flex flex-wrap items-center gap-5">
          <div className="flex-1 min-w-[240px]">
            <p className="text-[11px] font-bold tracking-[0.22em] text-gold-400">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}</p>
            <h1 className="font-display font-extrabold text-[26px] sm:text-[30px] text-white leading-tight mt-1.5">Assalam-o-Alaikum, {state.settings.tutorName.split(" ")[0]}!</h1>
            <p className="text-[13px] text-ink-300 mt-1.5">
              {isHoliday ? "Today is a holiday — the centre is closed." : weeklyOff ? "Today is your weekly off day." : <>Tuition runs <b className="text-gold-300">{timeLabel(state.settings.startTime)} – {timeLabel(state.settings.endTime)}</b> · {active.length} students · {classes.length} classes.</>}
            </p>
          </div>
          <div className="flex flex-col w-full gap-2 [&>*]:w-full sm:flex-row sm:items-center sm:justify-end sm:[&>*]:w-auto">
            <Btn variant="gold" icon="plus" onClick={() => ui.openStudentForm()}>Add Student</Btn>
            <Btn variant="outline" icon="attendance" className="!bg-ink-800 !text-white !border-ink-700 hover:!bg-ink-700" onClick={() => nav("attendance", { date: today })}>Mark Attendance</Btn>
            <Btn variant="outline" icon="wallet" className="!bg-ink-800 !text-white !border-ink-700 hover:!bg-ink-700" onClick={() => ui.openPayment()}>Record Payment</Btn>
          </div>
        </div>
        {/* collection progress */}
        <div className="px-5 sm:px-7 py-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-[12px] font-semibold mb-1.5">
              <span className="text-ink-500">{periodLabel(period)} collection</span>
              <span className="text-ink-900 tnum font-mono">{fmtMoney(stats.collected, cur)} <span className="text-ink-400">/ {fmtMoney(totalExpected + stats.outstanding - stats.collected > totalExpected ? totalExpected : totalExpected, cur)}</span></span>
            </div>
            <ProgressBar value={stats.collected} max={Math.max(1, totalExpected)} tone={stats.collected >= totalExpected ? "green" : "gold"} />
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${stats.outstanding > 0 ? "text-warn-700 bg-warn-50 border-warn-600/25" : "text-mint-700 bg-mint-50 border-mint-600/25"}`}>
            {stats.outstanding > 0 ? `${fmtMoney(stats.outstanding, cur)} pending` : "All collected"}
          </span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5 stagger">
        <Stat label="Active Students" value={active.length} sub={`${classes.length} classes`} icon="students" tone="navy" onClick={() => nav("students")} />
        <Stat label="Today's Attendance" value={attToday.length ? `${present}/${active.length}` : "—"} sub={attToday.length ? `${absent} absent · ${notMarked} not marked` : "Not marked yet"} icon="attendance" tone={absent > 0 ? "red" : "green"} onClick={() => nav("attendance", { date: today })} />
        <Stat label="This Month Collected" value={fmtMoney(stats.collected, cur)} sub={`${state.payments.filter((p) => monthKeyOf(p.date) === period && p.state !== "voided").length} receipts`} icon="wallet" tone="gold" onClick={() => nav("fees", { period })} />
        <Stat label="Outstanding Dues" value={fmtMoney(stats.outstanding, cur)} sub={`${overdue.length} overdue student${overdue.length === 1 ? "" : "s"}`} icon="alert" tone={overdue.length ? "red" : "green"} onClick={() => nav("reports")} />
      </div>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5">
        <div className="space-y-5">
          {/* alerts */}
          {(overdue.length > 0 || dueSoon.length > 0 || absent > 0) && (
            <div className="card p-4 anim-fade-up">
              <h2 className="font-display font-bold text-[15.5px] text-ink-900 mb-3 flex items-center gap-2">
                <Icon name="bell" size={16} className="text-gold-600" /> Needs your attention
              </h2>
              <div className="space-y-2">
                {overdue.slice(0, 4).map((o) => (
                  <div key={o.student.id} className="flex items-center gap-3 rounded-[10px] border border-flame-100 bg-flame-50/70 px-3.5 py-2.5">
                    <Icon name="alert" size={15} className="text-flame-600 shrink-0" />
                    <span className="flex-1 text-[12.5px] font-semibold text-ink-800">{o.student.name} — overdue <span className="font-mono tnum text-flame-700">{fmtMoney(o.balance, cur)}</span></span>
                    <span className="text-[11px] text-ink-400 tnum">since {fmtDate(o.oldestDue, df)}</span>
                    <Btn size="sm" variant="outline" onClick={() => ui.openSlip({ kind: "challan", recordId: state.feeRecords.find((r) => r.studentId === o.student.id && balanceOf(r, state.payments) > 0 && r.period <= period)!.id })}>Send Challan</Btn>
                  </div>
                ))}
                {absent > 0 && (
                  <div className="flex items-center gap-3 rounded-[10px] border border-warn-600/25 bg-warn-50 px-3.5 py-2.5">
                    <Icon name="x" size={15} className="text-warn-600 shrink-0" />
                    <span className="flex-1 text-[12.5px] font-semibold text-ink-800">{absent} student{absent > 1 ? "s" : ""} absent today</span>
                    <Btn size="sm" variant="outline" onClick={() => nav("attendance", { date: today })}>View</Btn>
                  </div>
                )}
                {dueSoon.filter((d) => !overdue.some((o) => o.student.id === d.student.id)).slice(0, 3).map((d) => (
                  <div key={d.student.id + d.dueDate} className="flex items-center gap-3 rounded-[10px] border border-gold-600/25 bg-gold-50/70 px-3.5 py-2.5">
                    <Icon name="clock" size={15} className="text-gold-600 shrink-0" />
                    <span className="flex-1 text-[12.5px] font-semibold text-ink-800">{d.student.name} — due on {fmtDate(d.dueDate, df)}</span>
                    <span className="font-mono text-[11.5px] font-bold text-ink-700 tnum">{fmtMoney(d.balance, cur)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* recent payments */}
          <div className="card overflow-hidden anim-fade-up" style={{ animationDelay: "60ms" }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <h2 className="font-display font-bold text-[15.5px] text-ink-900">Recent Payments</h2>
              <button onClick={() => nav("fees")} className="text-[12px] font-bold text-ink-500 hover:text-ink-900 inline-flex items-center gap-1">All fees <Icon name="arrowR" size={13} /></button>
            </div>
            {recent.length === 0 ? (
              <EmptyState icon="wallet" title="No payments yet" message="Record the first payment and a receipt will be ready instantly." action={<Btn variant="gold" icon="wallet" onClick={() => ui.openPayment()}>Record Payment</Btn>} />
            ) : (
              <div className="divide-y divide-ink-100">
                {recent.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gold-50/40 transition-colors">
                    <Avatar name={nameOf(p.studentId)} size={32} />
                    <div className="flex-1 min-w-0">
                      <span className="block text-[13px] font-semibold text-ink-900 truncate">{nameOf(p.studentId)}</span>
                      <span className="block text-[11px] text-ink-400">{p.method} · <span className="tnum">{fmtDate(p.date, df)}</span> · {p.receiptNo}</span>
                    </div>
                    <span className="font-mono text-[13px] font-bold text-mint-600 tnum">{fmtMoney(p.amount, cur)}</span>
                    <button onClick={() => ui.openSlip({ kind: "receipt", paymentId: p.id })} title="View receipt" className="w-8 h-8 rounded-[8px] border border-ink-200 bg-white text-ink-500 hover:text-mint-700 hover:border-mint-600/40 flex items-center justify-center press">
                      <Icon name="receipt" size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {/* today's classes */}
          <div className="card p-5 anim-fade-up" style={{ animationDelay: "90ms" }}>
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="font-display font-bold text-[15.5px] text-ink-900">Today at the Tuition</h2>
              <button onClick={() => nav("classes")} className="text-[12px] font-bold text-ink-500 hover:text-ink-900">Classes →</button>
            </div>
            <div className="rounded-[10px] bg-ink-900 px-4 py-3 flex items-center gap-3 mb-3">
              <Icon name="clock" size={17} className="text-gold-400" />
              <div className="flex-1">
                <span className="block text-[13.5px] font-bold text-white tnum">{timeLabel(state.settings.startTime)} – {timeLabel(state.settings.endTime)}</span>
                <span className="block text-[10.5px] text-ink-400 font-semibold tracking-wide uppercase">Single timing · all classes</span>
              </div>
              {isHoliday && <span className="text-[11px] font-bold text-[#7fd4e5] bg-[#0e7490]/25 border border-[#0e7490]/40 rounded-md px-2 py-0.5">Holiday</span>}
            </div>
            <div className="space-y-1.5">
              {classes.map(([cls, n]) => (
                <button key={cls} onClick={() => nav("classes")} className="w-full flex items-center justify-between rounded-[9px] px-3 py-2 hover:bg-gold-50 transition-colors text-left">
                  <span className="text-[13px] font-semibold text-ink-800">{cls}</span>
                  <span className="text-[11.5px] font-bold text-ink-400 tnum">{n} student{n > 1 ? "s" : ""}</span>
                </button>
              ))}
              {classes.length === 0 && <p className="text-[12.5px] text-ink-400 text-center py-4">Add students to form your first class.</p>}
            </div>
          </div>

          {/* current period snapshot */}
          <div className="card p-5 anim-fade-up" style={{ animationDelay: "120ms" }}>
            <h2 className="font-display font-bold text-[15.5px] text-ink-900 mb-3.5">{periodLabel(period)} · Fee Status</h2>
            <div className="space-y-2.5">
              {(["paid", "partial", "due", "overdue"] as const).map((k) => {
                const n = stats.counts[k];
                const label = k === "paid" ? "Paid" : k === "partial" ? "Partially paid" : k === "due" ? "Due" : "Overdue";
                return (
                  <button key={k} onClick={() => nav("fees", { period, filter: k })} className="w-full flex items-center gap-3 group">
                    <span className="text-[12.5px] font-semibold text-ink-600 w-28 text-left group-hover:text-ink-900">{label}</span>
                    <div className="flex-1"><ProgressBar value={n} max={Math.max(1, active.length)} tone={k === "paid" ? "green" : k === "overdue" ? "red" : "gold"} /></div>
                    <span className="font-mono text-[12.5px] font-bold text-ink-900 w-8 text-right tnum">{n}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 pt-3.5 border-t border-ink-100 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-ink-500">Partials remaining</span>
              <span className="font-mono text-[13px] font-bold text-warn-700 tnum">{fmtMoney(partialRemaining, cur)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-ink-500">Total outstanding</span>
              <span className="font-mono text-[13px] font-bold text-flame-600 tnum">{fmtMoney(studentOutstandingTotal(state), cur)}</span>
            </div>
          </div>

          {/* upcoming due dates */}
          <div className="card p-5 anim-fade-up" style={{ animationDelay: "150ms" }}>
            <h2 className="font-display font-bold text-[15.5px] text-ink-900 mb-3">Upcoming Due Dates</h2>
            {dueSoon.length === 0 ? (
              <p className="text-[12.5px] text-ink-400">Nothing due in the next 5 days. Nicely settled!</p>
            ) : (
              <div className="space-y-2">
                {dueSoon.slice(0, 5).map((d) => (
                  <div key={d.student.id + d.dueDate} className="flex items-center gap-2.5">
                    <Avatar name={d.student.name} size={26} />
                    <span className="flex-1 text-[12.5px] font-semibold text-ink-800 truncate">{d.student.name}</span>
                    <span className="text-[11.5px] text-ink-400 tnum">{fmtDate(d.dueDate, df)}</span>
                    <span className="font-mono text-[11.5px] font-bold text-ink-900 tnum">{fmtMoney(d.balance, cur)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* activity trail */}
      <div className="card p-5 mt-5 anim-fade-up">
        <h2 className="font-display font-bold text-[15.5px] text-ink-900 mb-3.5">Activity Trail</h2>
        {state.activity.length === 0 ? (
          <p className="text-[12.5px] text-ink-400">Every save, payment and share will appear here.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-8">
            {state.activity.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-start gap-3 py-2 border-b border-ink-100/70">
                <span className={`w-6 h-6 rounded-[7px] flex items-center justify-center shrink-0 mt-0.5 ${a.kind === "fee" ? "bg-gold-50 text-gold-600" : a.kind === "attendance" ? "bg-mint-50 text-mint-600" : a.kind === "share" ? "bg-[#ecf6f8] text-[#0e6b7c]" : "bg-ink-50 text-ink-500"}`}>
                  <Icon name={a.kind === "fee" ? "wallet" : a.kind === "attendance" ? "attendance" : a.kind === "share" ? "send" : "note"} size={12} />
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] text-ink-700 leading-snug">{a.text}</p>
                  <p className="text-[10.5px] text-ink-400 mt-0.5 tnum">{new Date(a.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* hidden helper to keep FeeStatusBadge referenced for tree-shaking symmetry */}
      <span className="hidden"><FeeStatusBadge status="paid" /></span>
      <span className="hidden" onClick={() => toast.push("")} />
    </div>
  );
}

function studentOutstandingTotal(state: ReturnType<typeof useStore>["state"]): number {
  return state.students.reduce((s, x) => s + studentOutstanding(state, x.id), 0);
}
