import React, { useMemo, useState } from "react";
import { Badge, Btn, EmptyState, Icon, PageHead, ProgressBar, Stat, Tabs, TSelect } from "../components/ui";
import { agingBuckets, balanceOf, periodStats, studentOutstanding } from "../lib/fee";
import { useStore } from "../lib/store";
import { currentPeriod, daysBetween, downloadText, fmtDate, fmtMoney, lastNPeriods, monthKeyOf, periodLabel, toCSV, todayISO } from "../lib/utils";

type Tab = "collection" | "dues" | "attendance" | "register" | "holidays";

export default function Reports() {
  const { state } = useStore();
  const df = state.settings.dateFormat;
  const cur = state.settings.feePolicy.currency;
  const grace = state.settings.feePolicy.graceDays;
  const today = todayISO();

  const [tab, setTab] = useState<Tab>("collection");
  const [period, setPeriod] = useState(currentPeriod());
  const [attMonth, setAttMonth] = useState(monthKeyOf(today));
  const [attBatch, setAttBatch] = useState("all");

  /* collection */
  const paymentsInPeriod = useMemo(
    () => state.payments.filter((p) => p.state !== "voided" && monthKeyOf(p.date) === period).sort((a, b) => b.date.localeCompare(a.date)),
    [state.payments, period]
  );
  const collected = paymentsInPeriod.reduce((s, p) => s + p.amount, 0);
  const byMethod = ["Cash", "Bank Transfer", "Mobile Wallet", "Other"].map((m) => ({ m, v: paymentsInPeriod.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0) }));
  const pStats = periodStats(state, period);
  const nameOf = (id: string) => state.students.find((s) => s.id === id)?.name ?? "Unknown";

  /* dues */
  const duesRows = useMemo(() => {
    return state.students
      .filter((s) => s.status === "active")
      .map((s) => {
        const out = studentOutstanding(state, s.id);
        const recs = state.feeRecords.filter((r) => r.studentId === s.id && balanceOf(r, state.payments) > 0);
        const oldest = recs.length ? recs.map((r) => r.dueDate).sort()[0] : "";
        return { s, out, oldest, days: oldest ? daysBetween(oldest, today) : 0, count: recs.length };
      })
      .filter((r) => r.out > 0)
      .sort((a, b) => b.days - a.days);
  }, [state, today]);
  const buckets = agingBuckets(state);

  /* attendance */
  const attRows = useMemo(() => {
    return state.students
      .filter((s) => s.status === "active" && (attBatch === "all" || s.batchIds.includes(attBatch)))
      .map((s) => {
        const recs = state.attendance.filter((a) => a.studentId === s.id && monthKeyOf(a.date) === attMonth && (attBatch === "all" || a.batchId === attBatch));
        const p = recs.filter((r) => r.status === "present" || r.status === "late").length;
        const a = recs.filter((r) => r.status === "absent").length;
        const l = recs.filter((r) => r.status === "leave").length;
        const pct = recs.length > 0 ? Math.round((p / recs.length) * 100) : null;
        return { s, p, a, l, total: recs.length, pct };
      })
      .sort((x, y) => x.s.name.localeCompare(y.s.name));
  }, [state, attMonth, attBatch]);

  const exportCSV = (name: string, rows: (string | number)[][]) => {
    downloadText(`${name}-${today}.csv`, toCSV(rows), "text/csv");
  };

  return (
    <div>
      <PageHead title="Reports" sub="Deterministic numbers straight from the local ledger — export anything as CSV" />
      <div className="mb-5"><Tabs value={tab} onChange={(k) => setTab(k as Tab)} tabs={[
        { key: "collection", label: "Fee Collection", icon: "wallet" },
        { key: "dues", label: "Outstanding Dues", icon: "alert" },
        { key: "attendance", label: "Attendance", icon: "attendance" },
        { key: "register", label: "Student Register", icon: "students" },
        { key: "holidays", label: "Holidays", icon: "calendar" },
      ]} /></div>

      {/* ---------- collection ---------- */}
      {tab === "collection" && (
        <div className="space-y-5 anim-fade-up">
          <div className="flex flex-wrap items-center gap-3">
            <TSelect value={period} onChange={(e) => setPeriod(e.target.value)} className="!w-auto min-w-44">
              {lastNPeriods(12).map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
            </TSelect>
            <Btn variant="outline" icon="download" onClick={() => exportCSV(`collection-${period}`, [["Receipt", "Student", "Date", "Method", "Reference", "Amount"], ...paymentsInPeriod.map((p) => [p.receiptNo, nameOf(p.studentId), p.date, p.method, p.reference ?? "", p.amount])])}>Export CSV</Btn>
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5 stagger">
            <Stat label="Collected" value={fmtMoney(collected, cur)} sub={`${paymentsInPeriod.length} receipts`} icon="wallet" tone="gold" />
            <Stat label="Charged" value={fmtMoney(pStats.charged, cur)} sub={periodLabel(period)} icon="fees" tone="navy" />
            <Stat label="Outstanding (period)" value={fmtMoney(pStats.outstanding, cur)} sub={`${pStats.counts.overdue} overdue`} icon="alert" tone="red" />
            <Stat label="Settled Students" value={pStats.counts.paid + pStats.counts.waived} sub={`${pStats.counts.partial} partial`} icon="check" tone="green" />
          </div>
          <div className="grid lg:grid-cols-[1fr_1.7fr] gap-5">
            <div className="card p-5">
              <h3 className="font-display font-bold text-[15px] text-ink-900 mb-3.5">By Payment Method</h3>
              <div className="space-y-3.5">
                {byMethod.map((x) => (
                  <div key={x.m}>
                    <div className="flex justify-between text-[12px] mb-1.5"><span className="font-semibold text-ink-600">{x.m}</span><span className="font-mono font-bold text-ink-900 tnum">{fmtMoney(x.v, cur)}</span></div>
                    <ProgressBar value={x.v} max={Math.max(1, collected)} />
                  </div>
                ))}
              </div>
            </div>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto scroll-thin max-h-[420px] overflow-y-auto">
                <table className="w-full text-left min-w-[560px]">
                  <thead className="sticky top-0 bg-ink-50 z-10"><tr className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400 border-b border-ink-100">
                    <th className="pl-4 py-2.5 font-bold">Receipt</th><th className="py-2.5 font-bold">Student</th><th className="py-2.5 font-bold">Date</th><th className="py-2.5 font-bold">Method</th><th className="py-2.5 pr-4 font-bold text-right">Amount</th>
                  </tr></thead>
                  <tbody className="divide-y divide-ink-100">
                    {paymentsInPeriod.map((p) => (
                      <tr key={p.id} className="hover:bg-gold-50/40">
                        <td className="pl-4 py-2.5 font-mono text-[11.5px] font-semibold text-ink-500 tnum">{p.receiptNo}</td>
                        <td className="py-2.5 text-[13px] font-semibold text-ink-900">{nameOf(p.studentId)}</td>
                        <td className="py-2.5 text-[12px] text-ink-500 tnum">{fmtDate(p.date, df)}</td>
                        <td className="py-2.5 text-[12px] text-ink-500">{p.method}</td>
                        <td className="py-2.5 pr-4 text-right font-mono text-[12.5px] font-bold text-mint-600 tnum">{fmtMoney(p.amount, cur)}</td>
                      </tr>
                    ))}
                    {paymentsInPeriod.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-[13px] text-ink-400">No collections recorded in {periodLabel(period)}.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- dues ---------- */}
      {tab === "dues" && (
        <div className="space-y-5 anim-fade-up">
          <div className="grid grid-cols-3 gap-3.5 stagger">
            {buckets.map((b) => (
              <Stat key={b.label} label={b.label} value={fmtMoney(b.amount, cur)} sub={`${b.count} record${b.count === 1 ? "" : "s"}`} icon="clock" tone={b.label.startsWith("16") ? "red" : "gold"} />
            ))}
          </div>
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <h3 className="font-display font-bold text-[15px] text-ink-900">Outstanding by Student</h3>
              <Btn size="sm" variant="outline" icon="download" onClick={() => exportCSV("outstanding-dues", [["Student", "Class", "Outstanding", "Oldest Due", "Days Overdue"], ...duesRows.map((r) => [r.s.name, r.s.grade, r.out, r.oldest, Math.max(0, r.days)])])}>Export CSV</Btn>
            </div>
            {duesRows.length === 0 ? (
              <EmptyState icon="check" title="No dues outstanding" message="Every active student is settled. Enjoy the moment." />
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full text-left min-w-[640px]">
                  <thead><tr className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400 border-y border-ink-100 bg-ink-50/60">
                    <th className="pl-5 py-2.5 font-bold">Student</th><th className="py-2.5 font-bold">Class</th><th className="py-2.5 font-bold text-right">Outstanding</th><th className="py-2.5 font-bold">Oldest Due</th><th className="py-2.5 font-bold">Age</th><th className="py-2.5 pr-5 font-bold">Bucket</th>
                  </tr></thead>
                  <tbody className="divide-y divide-ink-100">
                    {duesRows.map((r) => (
                      <tr key={r.s.id} className="hover:bg-gold-50/40">
                        <td className="pl-5 py-2.5 text-[13px] font-semibold text-ink-900">{r.s.name}</td>
                        <td className="py-2.5 text-[12px] text-ink-500">{r.s.grade}</td>
                        <td className="py-2.5 text-right font-mono font-bold text-[12.5px] text-flame-600 tnum">{fmtMoney(r.out, cur)}</td>
                        <td className="py-2.5 text-[12px] text-ink-500 tnum">{fmtDate(r.oldest, df)}</td>
                        <td className="py-2.5 text-[12px] font-semibold tnum text-ink-700">{r.days > 0 ? `${r.days} days` : "not overdue"}</td>
                        <td className="py-2.5 pr-5"><Badge tone={r.days > 15 ? "red" : r.days > 0 ? "amber" : "slate"}>{r.days > 15 ? "16+" : r.days > 7 ? "8–15" : r.days > 0 ? "1–7" : "Current"}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- attendance ---------- */}
      {tab === "attendance" && (
        <div className="space-y-4 anim-fade-up">
          <div className="flex flex-wrap gap-3 items-center">
            <input type="month" value={attMonth} onChange={(e) => setAttMonth(e.target.value)} className="h-9.5 px-3 rounded-[9px] border border-ink-200 text-[13px] font-semibold" />
            <TSelect value={attBatch} onChange={(e) => setAttBatch(e.target.value)} className="!w-auto min-w-44">
              <option value="all">All batches</option>
              {state.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </TSelect>
            <Btn variant="outline" icon="download" onClick={() => exportCSV(`attendance-${attMonth}`, [["Student", "Class", "Present", "Absent", "Leave", "Days", "Percent"], ...attRows.map((r) => [r.s.name, r.s.grade, r.p, r.a, r.l, r.total, r.pct ?? ""])])}>Export CSV</Btn>
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-left min-w-[620px]">
                <thead><tr className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400 border-b border-ink-100 bg-ink-50/60">
                  <th className="pl-5 py-2.5 font-bold">Student</th><th className="py-2.5 font-bold text-center">Present</th><th className="py-2.5 font-bold text-center">Absent</th><th className="py-2.5 font-bold text-center">Leave</th><th className="py-2.5 font-bold w-52">Rate</th>
                </tr></thead>
                <tbody className="divide-y divide-ink-100">
                  {attRows.map((r) => (
                    <tr key={r.s.id} className="hover:bg-gold-50/40">
                      <td className="pl-5 py-2.5"><span className="text-[13px] font-semibold text-ink-900">{r.s.name}</span> <span className="text-[11px] text-ink-400">{r.s.grade}</span></td>
                      <td className="py-2.5 text-center font-mono text-[12.5px] font-semibold text-mint-600 tnum">{r.p}</td>
                      <td className="py-2.5 text-center font-mono text-[12.5px] font-semibold text-flame-600 tnum">{r.a}</td>
                      <td className="py-2.5 text-center font-mono text-[12px] text-ink-400 tnum">{r.l}</td>
                      <td className="py-2.5 pr-5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1"><ProgressBar value={r.pct ?? 0} max={100} tone={r.pct === null ? "gold" : r.pct >= 80 ? "green" : r.pct >= 60 ? "gold" : "red"} /></div>
                          <span className="font-mono text-[11.5px] font-bold w-10 text-right tnum">{r.pct === null ? "—" : `${r.pct}%`}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------- register ---------- */}
      {tab === "register" && (
        <div className="card overflow-hidden anim-fade-up">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <h3 className="font-display font-bold text-[15px] text-ink-900">Student Register · {state.students.length} records</h3>
            <Btn size="sm" variant="outline" icon="download" onClick={() => exportCSV("student-register", [["ID", "Name", "Level", "Grade", "School", "Monthly Fee", "Joining", "Status", "Guardians"], ...state.students.map((s) => [s.id, s.name, s.level, s.grade, s.school ?? "", s.monthlyFee, s.joiningDate, s.status, state.guardians.filter((g) => g.studentId === s.id).map((g) => `${g.name} ${g.phone}`).join("; ")])])}>Export CSV</Btn>
          </div>
          <div className="overflow-x-auto scroll-thin max-h-[520px] overflow-y-auto">
            <table className="w-full text-left min-w-[720px]">
              <thead className="sticky top-0 bg-ink-50 z-10"><tr className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400 border-b border-ink-100">
                <th className="pl-5 py-2.5 font-bold">Name</th><th className="py-2.5 font-bold">Level</th><th className="py-2.5 font-bold">Grade</th><th className="py-2.5 font-bold">School</th><th className="py-2.5 font-bold text-right">Fee</th><th className="py-2.5 font-bold">Joined</th><th className="py-2.5 pr-5 font-bold">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-ink-100">
                {state.students.map((s) => (
                  <tr key={s.id} className="hover:bg-gold-50/40">
                    <td className="pl-5 py-2.5 text-[13px] font-semibold text-ink-900">{s.name}</td>
                    <td className="py-2.5 text-[12px] text-ink-500">{s.level}</td>
                    <td className="py-2.5 text-[12px] text-ink-500">{s.grade}</td>
                    <td className="py-2.5 text-[12px] text-ink-500">{s.school ?? "—"}</td>
                    <td className="py-2.5 text-right font-mono text-[12px] font-semibold tnum">{fmtMoney(s.monthlyFee, cur)}</td>
                    <td className="py-2.5 text-[12px] text-ink-500 tnum">{fmtDate(s.joiningDate, df)}</td>
                    <td className="py-2.5 pr-5"><Badge tone={s.status === "active" ? "green" : s.status === "inactive" ? "amber" : "slate"}>{s.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- holidays ---------- */}
      {tab === "holidays" && (
        <div className="card p-5 anim-fade-up max-w-2xl">
          <h3 className="font-display font-bold text-[15px] text-ink-900 mb-3.5">Holiday Report</h3>
          <p className="text-[12px] text-ink-400 mb-4">Weekly offs: <span className="font-bold text-ink-700">{state.settings.weeklyOffs.map((d) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d]).join(", ") || "none"}</span></p>
          {state.holidays.length === 0 ? (
            <EmptyState icon="calendar" title="No one-off holidays" message="Add holidays from the Calendar page." />
          ) : (
            <div className="space-y-2">
              {[...state.holidays].sort((a, b) => b.date.localeCompare(a.date)).map((h) => (
                <div key={h.id} className="flex items-center gap-3 rounded-[10px] border border-ink-100 px-3.5 py-2.5">
                  <Icon name="calendar" size={15} className="text-gold-600 shrink-0" />
                  <div className="flex-1">
                    <span className="text-[13px] font-semibold text-ink-900">{h.title}</span>
                    <span className="text-[11.5px] text-ink-400 ml-2 tnum">{fmtDate(h.date, df)}{h.reason ? ` · ${h.reason}` : ""}</span>
                  </div>
                  <Badge tone={h.scope === "all" ? "teal" : "gold"}>{h.scope === "all" ? "Whole centre" : state.batches.find((b) => b.id === h.batchId)?.name ?? "Batch"}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
