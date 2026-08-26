import React, { useMemo } from "react";
import { useNav } from "../components/Shell";
import { Avatar, Badge, Btn, FeeStatusBadge, Icon, ProgressBar, Stat } from "../components/ui";
import {
  agingBuckets, balanceOf, chargeOf, collectionByPeriod, currentPeriod, dueSoonList,
  monthCollected, overdueStudents, periodStats, statusOf, studentOutstanding,
} from "../lib/fee";
import { useStore } from "../lib/store";
import { fmtDate, fmtMoney, periodLabel, timeLabel, todayISO, weekdayIdx } from "../lib/utils";

export default function Dashboard() {
  const { state, loadDemo, patch } = useStore();
  const { nav } = useNav();
  const today = todayISO();
  const cur = state.settings.feePolicy.currency;
  const grace = state.settings.feePolicy.graceDays;
  const df = state.settings.dateFormat;

  const activeStudents = state.students.filter((s) => s.status === "active");
  const todayWd = weekdayIdx(today);
  const oneOff = state.holidays.filter((h) => h.date === today);
  const allHoliday = oneOff.some((h) => h.scope === "all") || state.settings.weeklyOffs.includes(todayWd);

  const todaysAtt = state.attendance.filter((a) => a.date === today);
  const present = todaysAtt.filter((a) => a.status === "present" || a.status === "late").length;
  const absent = todaysAtt.filter((a) => a.status === "absent").length;
  const notMarked = Math.max(0, activeStudents.length - todaysAtt.length);

  const todaysBatches = state.batches.filter((b) => b.status === "active" && b.days.includes(todayWd));
  const unmarkedBatches = todaysBatches.filter((b) => !oneOff.some((h) => h.scope === "batch" && h.batchId === b.id) && !state.attendance.some((a) => a.date === today && a.batchId === b.id));

  const stats = periodStats(state, currentPeriod());
  const collectedMonth = monthCollected(state.payments, currentPeriod());
  const overdue = overdueStudents(state);
  const dueSoon = dueSoonList(state, 5);
  const partials = state.feeRecords.filter((r) => {
    const paid = state.payments.filter((p) => p.feeRecordId === r.id && p.state !== "voided").reduce((s, p) => s + p.amount, 0);
    const bal = balanceOf(r, state.payments);
    return paid > 0 && bal > 0 && !r.waived;
  });
  const partialRemaining = partials.reduce((s, r) => s + balanceOf(r, state.payments), 0);

  const recentPayments = [...state.payments].filter((p) => p.state !== "voided").sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 7);
  const chart = collectionByPeriod(state, 6);
  const maxBar = Math.max(1, ...chart.map((c) => c.amount));
  const buckets = agingBuckets(state);
  const totalOutstanding = state.feeRecords.reduce((s, r) => s + balanceOf(r, state.payments), 0);

  const nameOf = (id: string) => state.students.find((s) => s.id === id)?.name ?? "Unknown";

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }, []);

  /* ---------- first-run onboarding ---------- */
  if (state.students.length === 0) {
    return (
      <div className="anim-fade-up">
        <div className="card overflow-hidden">
          <div className="bg-ink-900 px-7 py-8 relative overflow-hidden">
            <div className="pointer-events-none absolute -right-14 -top-16 w-56 h-56 rounded-full border-[20px] border-gold-500/10" />
            <p className="text-[11px] font-bold tracking-[0.26em] text-gold-400">FRESH WORKSPACE</p>
            <h1 className="font-display font-extrabold text-[26px] sm:text-[32px] text-white mt-2 leading-tight">Your ledger is empty — let's fill the first page.</h1>
            <p className="text-[13.5px] text-ink-300 mt-2 max-w-xl">Start with a realistic demo workspace (11 students, 5 batches, two fee cycles, attendance history), or begin fresh and add your first student.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 p-6">
            <button onClick={() => { loadDemo(); }} className="card-hover card p-5 text-left border-gold-600/30">
              <span className="w-10 h-10 rounded-[10px] bg-gold-500 text-ink-950 flex items-center justify-center"><Icon name="refresh" size={19} /></span>
              <h3 className="font-display font-bold text-[16px] text-ink-900 mt-3">Load Demo Data</h3>
              <p className="text-[12.5px] text-ink-400 mt-1 leading-relaxed">Ayaan to Ali — Nursery through First Year, with dues, partials and slips already in play.</p>
            </button>
            <button onClick={() => nav("students", { add: "1" })} className="card-hover card p-5 text-left">
              <span className="w-10 h-10 rounded-[10px] bg-ink-900 text-gold-400 flex items-center justify-center"><Icon name="plus" size={19} /></span>
              <h3 className="font-display font-bold text-[16px] text-ink-900 mt-3">Add First Student</h3>
              <p className="text-[12.5px] text-ink-400 mt-1 leading-relaxed">Create batches in Classes & Batches first, then enrol students with monthly fees.</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* greeting strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 anim-fade-up">
        <div>
          <h1 className="font-display font-extrabold text-[24px] sm:text-[28px] text-ink-900 leading-tight">{greeting}, {state.settings.tutorName.split(" ")[0]}.</h1>
          <p className="text-[13px] text-ink-400 mt-0.5">
            {allHoliday
              ? <>Today is a <span className="font-semibold text-[#0e6b7c]">holiday</span>{oneOff.find((h) => h.scope === "all")?.title ? ` — ${oneOff.find((h) => h.scope === "all")!.title}` : ""}. No attendance needed.</>
              : <>{todaysBatches.length} batch{todaysBatches.length === 1 ? "" : "es"} scheduled · {unmarkedBatches.length > 0 ? <span className="font-semibold text-warn-600">{unmarkedBatches.length} attendance pending</span> : "attendance complete"} · {fmtDate(today, df)}</>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="outline" size="md" icon="attendance" onClick={() => nav("attendance")}>Mark Attendance</Btn>
          <Btn variant="gold" icon="plus" onClick={() => nav("students", { add: "1" })}>Add Student</Btn>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5 stagger mb-5">
        <Stat label="Active Students" value={activeStudents.length} sub={`${state.students.length - activeStudents.length} archived/inactive`} icon="students" tone="navy" onClick={() => nav("students")} />
        <Stat label="Today's Attendance" value={<span className="text-mint-600">{present}<span className="text-flame-600">/{absent}</span></span>} sub={notMarked > 0 ? `${notMarked} not marked yet` : "All marked"} icon="attendance" tone="green" onClick={() => nav("attendance")} />
        <Stat label="Collection · This Month" value={fmtMoney(collectedMonth, cur)} sub={`${periodLabel(currentPeriod(), true)} · ${stats.counts.paid} fully paid`} icon="wallet" tone="gold" onClick={() => nav("reports")} />
        <Stat label="Outstanding Dues" value={fmtMoney(totalOutstanding, cur)} sub={`${overdue.length} overdue student${overdue.length === 1 ? "" : "s"}`} icon="fees" tone="red" onClick={() => nav("fees")} />
        <Stat label="Partial Payments" value={partials.length} sub={fmtMoney(partialRemaining, cur) + " remaining"} icon="clock" tone="amber" onClick={() => nav("fees", { filter: "partial" })} />
      </div>

      <div className="grid lg:grid-cols-[1.55fr_1fr] gap-5">
        {/* left column */}
        <div className="space-y-5 min-w-0">
          {/* today's batches */}
          <section className="card p-5 anim-fade-up" style={{ animationDelay: "80ms" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-[16.5px] text-ink-900">Today's Classes</h2>
              <Btn size="sm" variant="ghost" icon="arrowR" onClick={() => nav("batches")}>Manage Batches</Btn>
            </div>
            {allHoliday || todaysBatches.length === 0 ? (
              <p className="text-[13px] text-ink-400 py-6 text-center">{allHoliday ? "Tuition is closed today — enjoy the break." : "No batches are scheduled for this weekday."}</p>
            ) : (
              <div className="space-y-2.5">
                {todaysBatches.map((b) => {
                  const members = activeStudents.filter((s) => s.batchIds.includes(b.id)).length;
                  const marked = state.attendance.some((a) => a.date === today && a.batchId === b.id);
                  const batchHoliday = oneOff.some((h) => h.scope === "batch" && h.batchId === b.id);
                  return (
                    <div key={b.id} className="flex items-center gap-3.5 rounded-[10px] border border-ink-100 bg-white px-3.5 py-3 card-hover">
                      <span className="w-1 self-stretch rounded-full" style={{ background: b.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[13.5px] text-ink-900 truncate">{b.name}</div>
                        <div className="text-[11.5px] text-ink-400 tnum">{timeLabel(b.startTime)} – {timeLabel(b.endTime)} · {members} student{members === 1 ? "" : "s"}</div>
                      </div>
                      {batchHoliday ? (
                        <Badge tone="teal">Batch Holiday</Badge>
                      ) : marked ? (
                        <Badge tone="green" dot>Marked</Badge>
                      ) : (
                        <Btn size="sm" variant="outline" onClick={() => nav("attendance", { date: today, batch: b.id })}>Mark now</Btn>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* collections chart */}
          <section className="card p-5 anim-fade-up" style={{ animationDelay: "140ms" }}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display font-bold text-[16.5px] text-ink-900">Collections — last 6 months</h2>
              <Btn size="sm" variant="ghost" icon="arrowR" onClick={() => nav("reports")}>Full reports</Btn>
            </div>
            <div className="flex items-end gap-3 h-[150px] mt-4 px-1">
              {chart.map((c, i) => (
                <div key={c.period} className="flex-1 flex flex-col items-center gap-1.5 min-w-0 group">
                  <span className="text-[10.5px] font-bold text-ink-500 tnum opacity-0 group-hover:opacity-100 transition-opacity">{fmtMoney(c.amount, cur)}</span>
                  <div className="w-full max-w-[46px] rounded-t-[6px] anim-grow-x" style={{ height: `${Math.max(4, (c.amount / maxBar) * 100)}%`, background: i === chart.length - 1 ? "var(--color-gold-500)" : "var(--color-ink-800)", animationDelay: `${i * 70}ms`, transformOrigin: "bottom", animationName: "fade-up" }} />
                  <span className={`text-[10.5px] font-semibold ${i === chart.length - 1 ? "text-gold-600" : "text-ink-400"}`}>{c.label.split(" ")[0]}</span>
                </div>
              ))}
            </div>
          </section>

          {/* recent payments */}
          <section className="card overflow-hidden anim-fade-up" style={{ animationDelay: "200ms" }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <h2 className="font-display font-bold text-[16.5px] text-ink-900">Recent Payments</h2>
              <Btn size="sm" variant="gold" icon="plus" onClick={() => nav("fees", { pay: "1" })}>Record Payment</Btn>
            </div>
            {recentPayments.length === 0 ? (
              <p className="text-[13px] text-ink-400 px-5 pb-6">No payments recorded yet.</p>
            ) : (
              <div className="divide-y divide-ink-100">
                {recentPayments.map((p) => (
                  <button key={p.id} onClick={() => nav("student", { id: p.studentId })} className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-ink-50 transition-colors text-left">
                    <Avatar name={nameOf(p.studentId)} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-ink-900 truncate">{nameOf(p.studentId)}</div>
                      <div className="text-[11px] text-ink-400 tnum">{p.receiptNo} · {p.method} · {fmtDate(p.date, df)}</div>
                    </div>
                    <span className="font-mono font-semibold text-[13.5px] text-mint-600 tnum">+{fmtMoney(p.amount, cur)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* right column */}
        <div className="space-y-5 min-w-0">
          {/* alerts */}
          <section className="card p-5 anim-fade-up" style={{ animationDelay: "110ms" }}>
            <h2 className="font-display font-bold text-[16.5px] text-ink-900 mb-3.5">Needs Attention</h2>
            <div className="space-y-2.5">
              {overdue.slice(0, 4).map((o) => (
                <button key={o.student.id} onClick={() => nav("fees", { student: o.student.id })} className="w-full flex items-center gap-3 rounded-[10px] border border-flame-100 bg-flame-50/60 px-3 py-2.5 text-left hover:border-flame-600/40 transition-colors">
                  <Icon name="alert" size={16} className="text-flame-600 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-semibold text-ink-900 truncate">{o.student.name} · overdue</span>
                    <span className="block text-[11px] text-ink-500 tnum">since {fmtDate(o.oldestDue, df)}</span>
                  </span>
                  <span className="font-mono text-[12.5px] font-bold text-flame-700 tnum">{fmtMoney(o.balance, cur)}</span>
                </button>
              ))}
              {dueSoon.slice(0, 3).filter((d) => !overdue.some((o) => o.student.id === d.student.id)).map((d) => (
                <button key={d.student.id + d.dueDate} onClick={() => nav("fees", { student: d.student.id })} className="w-full flex items-center gap-3 rounded-[10px] border border-warn-100 bg-warn-50/60 px-3 py-2.5 text-left hover:border-warn-600/40 transition-colors">
                  <Icon name="clock" size={16} className="text-warn-600 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-semibold text-ink-900 truncate">{d.student.name} · due soon</span>
                    <span className="block text-[11px] text-ink-500 tnum">due {fmtDate(d.dueDate, df)}</span>
                  </span>
                  <span className="font-mono text-[12.5px] font-bold text-warn-700 tnum">{fmtMoney(d.balance, cur)}</span>
                </button>
              ))}
              {!allHoliday && unmarkedBatches.length > 0 && (
                <button onClick={() => nav("attendance")} className="w-full flex items-center gap-3 rounded-[10px] border border-ink-100 bg-ink-50/60 px-3 py-2.5 text-left hover:border-ink-300 transition-colors">
                  <Icon name="attendance" size={16} className="text-ink-500 shrink-0" />
                  <span className="text-[12.5px] font-semibold text-ink-700">{unmarkedBatches.length} batch{unmarkedBatches.length === 1 ? "" : "es"} unmarked today — {unmarkedBatches.map((b) => b.name.split("·")[0].trim()).join(", ")}</span>
                </button>
              )}
              {overdue.length === 0 && dueSoon.length === 0 && (allHoliday || unmarkedBatches.length === 0) && (
                <p className="text-[12.5px] text-ink-400 flex items-center gap-2"><Icon name="check" size={15} className="text-mint-600" /> All clear — no dues overdue and attendance handled.</p>
              )}
            </div>
          </section>

          {/* aging */}
          <section className="card p-5 anim-fade-up" style={{ animationDelay: "170ms" }}>
            <h2 className="font-display font-bold text-[16.5px] text-ink-900 mb-3.5">Dues Aging</h2>
            {buckets.every((b) => b.amount === 0) ? (
              <p className="text-[12.5px] text-ink-400">Nothing is overdue. Clean ledger.</p>
            ) : (
              <div className="space-y-3.5">
                {buckets.map((b) => (
                  <div key={b.label}>
                    <div className="flex items-center justify-between text-[12px] mb-1.5">
                      <span className="font-semibold text-ink-600">{b.label} <span className="text-ink-300">· {b.count}</span></span>
                      <span className="font-mono font-bold text-ink-900 tnum">{fmtMoney(b.amount, cur)}</span>
                    </div>
                    <ProgressBar value={b.amount} max={Math.max(1, buckets.reduce((s, x) => s + x.amount, 0))} tone={b.label.startsWith("16") ? "red" : "gold"} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* upcoming due dates */}
          <section className="card p-5 anim-fade-up" style={{ animationDelay: "230ms" }}>
            <h2 className="font-display font-bold text-[16.5px] text-ink-900 mb-3.5">Upcoming Due Dates</h2>
            <div className="space-y-2">
              {state.feeRecords
                .filter((r) => balanceOf(r, state.payments) > 0 && statusOf(r, state.payments, grace) !== "overdue")
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                .slice(0, 5)
                .map((r) => (
                  <button key={r.id} onClick={() => nav("fees", { student: r.studentId })} className="w-full flex items-center justify-between gap-2 py-1.5 border-b border-dashed border-ink-100 last:border-0 text-left hover:bg-ink-50 rounded px-1 -mx-1 transition-colors">
                    <span className="text-[12.5px] font-semibold text-ink-800 truncate">{nameOf(r.studentId)} <span className="text-ink-400 font-normal">· {periodLabel(r.period, true)}</span></span>
                    <span className="text-[11.5px] font-mono text-ink-500 tnum shrink-0">{fmtDate(r.dueDate, df)} · {fmtMoney(balanceOf(r, state.payments), cur)}</span>
                  </button>
                ))}
              {state.feeRecords.every((r) => balanceOf(r, state.payments) === 0) && <p className="text-[12.5px] text-ink-400">No unpaid dues — everything is settled.</p>}
            </div>
          </section>

          {/* quick actions */}
          <section className="card p-5 anim-fade-up" style={{ animationDelay: "290ms" }}>
            <h2 className="font-display font-bold text-[16.5px] text-ink-900 mb-3.5">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2.5">
              <Btn variant="outline" icon="plus" onClick={() => nav("students", { add: "1" })}>Add Student</Btn>
              <Btn variant="outline" icon="attendance" onClick={() => nav("attendance")}>Mark Attendance</Btn>
              <Btn variant="outline" icon="wallet" onClick={() => nav("fees", { pay: "1" })}>Record Payment</Btn>
              <Btn variant="outline" icon="slips" onClick={() => nav("slips")}>Generate Fee Slip</Btn>
            </div>
            <p className="mt-3.5 text-[11px] text-ink-400 leading-relaxed border-t border-dashed border-ink-100 pt-3">
              Charges this month: <span className="font-mono font-semibold text-ink-700">{fmtMoney(stats.charged + 0, cur)}</span> · Collected for {periodLabel(currentPeriod(), true)}: <span className="font-mono font-semibold text-mint-600">{fmtMoney(stats.collected, cur)}</span>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
