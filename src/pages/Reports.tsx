import React, { useMemo, useState } from "react";
import { Avatar, Badge, Btn, EmptyState, Icon, PageHead, ProgressBar, Stat, Tabs, TSelect } from "../components/ui";
import { agingBuckets, balanceOf, monthCollected, periodStats, studentOutstanding } from "../lib/fee";
import { useStore } from "../lib/store";
import { currentPeriod, daysBetween, downloadText, fmtDate, fmtMoney, lastNPeriods, monthKeyOf, naturalCompare, periodLabel, toCSV, todayISO } from "../lib/utils";

type Tab = "collection" | "dues" | "attendance" | "register" | "holidays";

export default function Reports() {
  const { state } = useStore();
  const df = state.settings.dateFormat;
  const cur = state.settings.feePolicy.currency;
  const today = todayISO();

  const [tab, setTab] = useState<Tab>("collection");
  const [period, setPeriod] = useState(currentPeriod());
  const [attMonth, setAttMonth] = useState(monthKeyOf(today));
  const [attClass, setAttClass] = useState("all");

  const nameOf = (id: string) => state.students.find((s) => s.id === id)?.name ?? "Removed student";
  const classes = useMemo(() => Array.from(new Set(state.students.map((s) => s.grade))).sort(naturalCompare), [state.students]);

  const paymentsInPeriod = useMemo(
    () => state.payments.filter((p) => p.state !== "voided" && monthKeyOf(p.date) === period).sort((a, b) => b.date.localeCompare(a.date)),
    [state.payments, period]
  );
  const collected = paymentsInPeriod.reduce((s, p) => s + p.amount, 0);
  const byMethod = ["Cash", "Bank Transfer", "Mobile Wallet", "Other"].map((m) => ({ m, v: paymentsInPeriod.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0) }));
  const pStats = periodStats(state, period);

  const duesRows = useMemo(() => {
    return state.students.filter((s) => s.status === "active").map((s) => {
      const out = studentOutstanding(state, s.id);
      const recs = state.feeRecords.filter((r) => r.studentId === s.id && balanceOf(r, state.payments) > 0);
      const oldest = recs.length ? recs.map((r) => r.dueDate).sort()[0] : "";
      return { s, out, oldest, days: oldest ? daysBetween(oldest, today) : 0 };
    }).filter((r) => r.out > 0).sort((a, b) => b.days - a.days);
  }, [state, today]);
  const buckets = agingBuckets(state);

  const attRows = useMemo(() => {
    return state.students
      .filter((s) => s.status === "active" && (attClass === "all" || s.grade === attClass))
      .map((s) => {
        const recs = state.attendance.filter((a) => a.studentId === s.id && monthKeyOf(a.date) === attMonth);
        const p = recs.filter((r) => r.status === "present" || r.status === "late").length;
        const a = recs.filter((r) => r.status === "absent").length;
        const l = recs.filter((r) => r.status === "leave").length;
        const pct = recs.length > 0 ? Math.round((p / recs.length) * 100) : null;
        return { s, p, a, l, total: recs.length, pct };
      })
      .sort((x, y) => naturalCompare(x.s.grade, y.s.grade) || x.s.name.localeCompare(y.s.name));
  }, [state, attMonth, attClass]);

  const exportCSV = (name: string, rows: (string | number)[][]) => downloadText(`${name}-${today}.csv`, toCSV(rows), "text/csv");

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

      {tab === "collection" && (
        <div className="space-y-5 anim-fade-up">
          <div className="flex flex-wrap items-center gap-2.5 [&>*]:grow [&>*]:min-w-0 [&>*]:basis-32 sm:[&>*]:grow-0 sm:[&>*]:basis-auto">
            <TSelect value={period} onChange={(e) => setPeriod(e.target.value)} className="!w-auto min-w-44">
              {lastNPeriods(12).map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
            </TSelect>
            <Btn variant="outline" icon="download" onClick={() => exportCSV(`collection-${period}`, [["Receipt", "Student", "Date", "Method", "Reference", "Amount"], ...paymentsInPeriod.map((p) => [p.receiptNo, nameOf(p.studentId), p.date, p.method, p.reference ?? "", p.amount])])}>Export CSV</Btn>
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5 stagger">
            <Stat label="Collected" value={fmtMoney(collected, cur)} sub={`${paymentsInPeriod.length} receipts`} icon="wallet" tone="gold" />
            <Stat label="Charged" value={fmtMoney(pStats.charged, cur)} sub={periodLabel(period)} icon="slips" tone="navy" />
            <Stat label="Outstanding" value={fmtMoney(pStats.outstanding, cur)} sub={`${pStats.counts.overdue} overdue`} icon="alert" tone="red" />
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
              <div className="mt-5 pt-4 border-t border-ink-100">
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-2.5">Earnings snapshot</h4>
                <div className="space-y-1.5 text-[12.5px]">
                  <div className="flex justify-between"><span className="text-ink-500 font-semibold">Collected (all time)</span><span className="font-mono font-bold text-mint-600 tnum">{fmtMoney(state.payments.filter((p) => p.state !== "voided").reduce((s, p) => s + p.amount, 0), cur)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-500 font-semibold">Net outstanding</span><span className="font-mono font-bold text-flame-600 tnum">{fmtMoney(state.feeRecords.reduce((s, r) => s + balanceOf(r, state.payments), 0), cur)}</span></div>
                </div>
              </div>
            </div>
            <div className="card overflow-hidden">
              <div className="px-4 py-2.5 bg-ink-50/60 border-b border-ink-100 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400">Payment Log</div>
              {paymentsInPeriod.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-ink-400">No collections recorded in {periodLabel(period)}.</p>
              ) : (
                <div className="divide-y divide-ink-100 max-h-[440px] overflow-y-auto scroll-thin">
                  {paymentsInPeriod.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gold-50/40 transition-colors">
                      <span className="w-8 h-8 rounded-[8px] bg-gold-50 border border-gold-600/20 text-gold-600 flex items-center justify-center shrink-0"><Icon name="wallet" size={14} /></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-bold text-ink-900 truncate">{nameOf(p.studentId)}</p>
                        <p className="text-[11px] text-ink-400 tnum truncate mt-0.5"><span className="font-mono font-bold text-ink-600">{p.receiptNo}</span> · {fmtDate(p.date, df)} · {p.method}</p>
                      </div>
                      <span className="font-mono text-[13.5px] font-bold text-mint-600 tnum whitespace-nowrap">{fmtMoney(p.amount, cur)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "dues" && (
        <div className="space-y-5 anim-fade-up">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 stagger">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {duesRows.map((r) => (
                  <div key={r.s.id} className="card p-4 card-hover">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.s.name} size={38} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14.5px] font-bold text-ink-900 truncate">{r.s.name}</p>
                        <p className="text-[11.5px] text-ink-400 mt-0.5"><Badge tone="teal" className="mr-1.5">{r.s.grade}</Badge> oldest due {fmtDate(r.oldest, df)}</p>
                      </div>
                      <Badge tone={r.days > 15 ? "red" : r.days > 7 ? "amber" : r.days > 0 ? "gold" : "slate"}>{r.days > 15 ? "16+ days" : r.days > 7 ? "8–15 days" : r.days > 0 ? "1–7 days" : "Current"}</Badge>
                    </div>
                    <div className="mt-3 rounded-[10px] bg-flame-50/70 border border-flame-100 px-3.5 py-2.5 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-flame-700">Outstanding</span>
                      <span className="font-mono text-[16px] font-bold text-flame-600 tnum">{fmtMoney(r.out, cur)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "attendance" && (
        <div className="space-y-4 anim-fade-up">
          <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:flex-wrap sm:items-center sm:w-auto sm:gap-2.5">
            <input type="month" value={attMonth} onChange={(e) => setAttMonth(e.target.value)} className="h-9.5 px-3 rounded-[9px] border border-ink-200 text-[13px] font-semibold w-full" />
            <TSelect value={attClass} onChange={(e) => setAttClass(e.target.value)} className="!w-full sm:!w-auto sm:min-w-44">
              <option value="all">All classes</option>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </TSelect>
            <Btn variant="outline" icon="download" className="col-span-2 sm:col-span-1 w-full sm:w-auto" onClick={() => exportCSV(`attendance-${attMonth}`, [["Student", "Class", "Present", "Absent", "Leave", "Days", "Percent"], ...attRows.map((r) => [r.s.name, r.s.grade, r.p, r.a, r.l, r.total, r.pct ?? ""])])}>Export CSV</Btn>
          </div>
          <div className="card divide-y divide-ink-100">
            {attRows.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-ink-400">No students in this selection.</p>
            ) : attRows.map((r) => (
              <div key={r.s.id} className="px-4 py-3 hover:bg-gold-50/40 transition-colors">
                <div className="flex items-center gap-3">
                  <Avatar name={r.s.name} size={34} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-bold text-ink-900 truncate">{r.s.name} <span className="text-[11px] font-semibold text-ink-400">· {r.s.grade}</span></p>
                    <p className="text-[11px] text-ink-400 tnum mt-0.5">
                      <span className="text-mint-600 font-bold">{r.p} present</span> · <span className="text-flame-600 font-bold">{r.a} absent</span> · {r.l} leave
                    </p>
                  </div>
                  <span className="font-mono text-[14px] font-bold text-ink-900 tnum">{r.pct === null ? "—" : `${r.pct}%`}</span>
                </div>
                <div className="mt-2 pl-[46px]"><ProgressBar value={r.pct ?? 0} max={100} tone={r.pct === null ? "gold" : r.pct >= 80 ? "green" : r.pct >= 60 ? "gold" : "red"} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "register" && (
        <div className="card overflow-hidden anim-fade-up">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <h3 className="font-display font-bold text-[15px] text-ink-900">Student Register · {state.students.length} records</h3>
            <Btn size="sm" variant="outline" icon="download" onClick={() => exportCSV("student-register", [["ID", "Name", "Level", "Class", "School", "Monthly Fee", "Fee Day", "Joining", "Status", "Guardians"], ...state.students.map((s) => [s.id, s.name, s.level, s.grade, s.school ?? "", s.monthlyFee, s.feeDueDay, s.joiningDate ?? "", s.status, state.guardians.filter((g) => g.studentId === s.id).map((g) => `${g.name} ${g.phone}`).join("; ")])])}>Export CSV</Btn>
          </div>
          <div className="divide-y divide-ink-100 max-h-[520px] overflow-y-auto scroll-thin">
            {state.students.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gold-50/40 transition-colors">
                <Avatar name={s.name} size={34} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-bold text-ink-900 truncate">{s.name}</p>
                  <p className="text-[11px] text-ink-400 tnum truncate mt-0.5">{s.level} · fee day {s.feeDueDay === 1 ? "1st" : `${s.feeDueDay}th`}{s.joiningDate ? ` · joined ${fmtDate(s.joiningDate, df)}` : ""}</p>
                </div>
                <Badge tone="teal">{s.grade}</Badge>
                <span className="font-mono text-[12.5px] font-bold text-ink-900 tnum whitespace-nowrap">{fmtMoney(s.monthlyFee, cur)}</span>
                <Badge tone={s.status === "active" ? "green" : "amber"}>{s.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  <Badge tone={h.scope === "all" ? "teal" : "gold"}>{h.scope === "all" ? "Whole tuition" : h.className}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
