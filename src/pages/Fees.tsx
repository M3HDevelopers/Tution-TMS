import React, { useMemo, useState } from "react";
import { useNav, useUi } from "../components/Shell";
import { Avatar, Badge, Btn, Confirm, EmptyState, FeeStatusBadge, Icon, IconBtn, PageHead, Stat, Tabs, TSelect, useToast } from "../components/ui";
import { balanceOf, challanNo, chargeOf, monthCollected, paidOf, periodStats, statusOf, type FeeStatus } from "../lib/fee";
import { useStore, withActivity } from "../lib/store";
import { currentPeriod, fmtDate, fmtMoney, lastNPeriods, naturalCompare, periodLabel, todayISO } from "../lib/utils";

export default function Fees() {
  const { state, patch } = useStore();
  const { route, nav } = useNav();
  const ui = useUi();
  const toast = useToast();
  const df = state.settings.dateFormat;
  const cur = state.settings.feePolicy.currency;
  const grace = state.settings.feePolicy.graceDays;

  const [tab, setTab] = useState<"board" | "receipts">((route.params?.tab as "board" | "receipts") ?? "board");
  const [period, setPeriod] = useState(route.params?.period ?? currentPeriod());
  const [filter, setFilter] = useState(route.params?.filter ?? "all");
  const [cls, setCls] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [voidAsk, setVoidAsk] = useState<string | null>(null);
  const [waiveRec, setWaiveRec] = useState<string | null>(null);

  const stats = periodStats(state, period);
  const classes = useMemo(() => Array.from(new Set(state.students.map((s) => s.grade))).sort(naturalCompare), [state.students]);

  const rows = useMemo(() => {
    const list = state.students
      .filter((s) => s.status === "active" && (cls === "all" || s.grade === cls))
      .map((s) => {
        const rec = state.feeRecords.find((r) => r.studentId === s.id && r.period === period);
        const bal = rec ? balanceOf(rec, state.payments) : 0;
        const st: FeeStatus | "none" = rec ? statusOf(rec, state.payments, grace) : "none";
        return { s, rec, bal, st };
      })
      .filter((r) => (filter === "all" ? true : r.st === filter));
    const rank: Record<string, number> = { overdue: 0, due: 1, partial: 2, upcoming: 3, none: 4, paid: 5, waived: 6 };
    return list.sort((a, b) => (rank[a.st] ?? 9) - (rank[b.st] ?? 9) || a.s.name.localeCompare(b.s.name));
  }, [state, period, filter, cls, grace]);

  const receipts = useMemo(
    () => state.payments.filter((p) => p.state !== "voided" && p.date.slice(0, 7) === period).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [state.payments, period]
  );

  const voidPayment = (id: string) => {
    const payments = state.payments.map((p) => (p.id === id ? { ...p, state: "voided" as const } : p));
    const p = state.payments.find((x) => x.id === id);
    patch({ payments, activity: withActivity({ ...state, payments }, `Payment ${p?.receiptNo} voided — balances recalculated.`, "fee") });
    toast.push("Payment voided — balances recalculated");
  };

  const toggleWaive = () => {
    if (!waiveRec) return;
    const rec = state.feeRecords.find((r) => r.id === waiveRec)!;
    const feeRecords = state.feeRecords.map((r) => (r.id === waiveRec ? { ...r, waived: !r.waived, lateFee: 0, lateFeeApplied: false } : r));
    patch({ feeRecords, activity: withActivity({ ...state, feeRecords }, `${rec.waived ? "Waiver removed" : "Fee waived"} for ${state.students.find((s) => s.id === rec.studentId)?.name} (${periodLabel(rec.period)}).`, "fee") });
    toast.push(rec.waived ? "Waiver removed" : "Fee waived");
  };

  const nameOf = (id: string) => state.students.find((s) => s.id === id)?.name ?? "Unknown";

  return (
    <div>
      <PageHead title="Fees & Payments" sub="Big challan once a month for dues — small receipts every time money comes in"
        actions={<>
          <TSelect value={period} onChange={(e) => setPeriod(e.target.value)} className="!w-auto min-w-44">
            {lastNPeriods(12).map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </TSelect>
          <Btn variant="gold" icon="plus" onClick={() => ui.openPayment()}>Record Payment</Btn>
        </>} />

      <div className="mb-5"><Tabs value={tab} onChange={(k) => setTab(k as "board" | "receipts")} tabs={[
        { key: "board", label: "Fee Board", icon: "fees" },
        { key: "receipts", label: `Receipts (${receipts.length})`, icon: "receipt" },
      ]} /></div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5 mb-5 stagger">
        <Stat label="Collected" value={fmtMoney(monthCollected(state.payments, period), cur)} sub={periodLabel(period)} icon="wallet" tone="gold" />
        <Stat label="Charged" value={fmtMoney(stats.charged, cur)} sub={`${stats.counts.paid + stats.counts.partial + stats.counts.due + stats.counts.overdue + stats.counts.waived} challans`} icon="slips" tone="navy" />
        <Stat label="Outstanding" value={fmtMoney(stats.outstanding, cur)} sub={`${stats.counts.overdue} overdue`} icon="alert" tone={stats.outstanding > 0 ? "red" : "green"} />
        <Stat label="Fully Paid" value={stats.counts.paid} sub={`${stats.counts.partial} partial`} icon="check" tone="green" />
      </div>

      {tab === "board" && (
        <>
          <div className="card p-3.5 mb-4 flex flex-wrap items-center gap-2.5 anim-fade-up">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mr-1"><Icon name="filter" size={13} className="inline mr-1" />Filter</span>
            {["all", "overdue", "due", "partial", "paid", "waived"].map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`h-8 px-3 rounded-[8px] text-[12px] font-bold transition-colors ${filter === f ? "bg-ink-900 text-white" : "bg-white border border-ink-200 text-ink-500 hover:border-ink-400"}`}>
                {f === "all" ? "Everyone" : f === "due" ? "Due" : f === "partial" ? "Partially Paid" : f === "paid" ? "Paid" : f === "overdue" ? "Overdue" : "Waived"}
              </button>
            ))}
            <div className="flex-1" />
            <TSelect value={cls} onChange={(e) => setCls(e.target.value)} className="!w-auto min-w-36">
              <option value="all">All classes</option>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </TSelect>
          </div>

          <div className="card overflow-hidden anim-fade-up" style={{ animationDelay: "60ms" }}>
            {rows.length === 0 ? (
              <EmptyState icon="fees" title="Nothing here" message="No students match this filter for the selected month." action={<Btn variant="outline" onClick={() => { setFilter("all"); setCls("all"); }}>Clear Filters</Btn>} />
            ) : (
              <div className="overflow-x-auto scroll-thin">
                {/* Fixed column architecture — Paid and Due each get their own dedicated track */}
                <table className="w-full table-fixed border-collapse text-left align-middle min-w-[1140px]">
                  <colgroup>
                    <col />                        {/* student (flex) */}
                    <col className="w-[130px]" />  {/* class */}
                    <col className="w-[120px]" />  {/* charge */}
                    <col className="w-[120px]" />  {/* paid amount */}
                    <col className="w-[120px]" />  {/* due amount */}
                    <col className="w-[132px]" />  {/* due date */}
                    <col className="w-[126px]" />  {/* status */}
                    <col className="w-[150px]" />  {/* actions */}
                  </colgroup>
                  <thead className="bg-ink-50">
                    <tr className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400 border-b border-ink-100">
                      <th className="pl-4 pr-3 py-3">Student</th>
                      <th className="px-3 py-3">Class</th>
                      <th className="px-3 py-3 text-right">Charge</th>
                      <th className="px-3 py-3 text-right">Paid Amount</th>
                      <th className="px-3 py-3 text-right">Due Amount</th>
                      <th className="px-3 py-3">Due Date</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {rows.map(({ s, rec, bal, st }) => {
                      const isOpen = expanded === s.id;
                      const pays = rec ? state.payments.filter((p) => p.feeRecordId === rec.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
                      return (
                        <React.Fragment key={s.id}>
                          <tr className={`transition-colors ${isOpen ? "bg-gold-50/60" : "hover:bg-gold-50/40"}`}>
                            <td className="pl-4 pr-3 py-3 min-w-0">
                              <button onClick={() => setExpanded(isOpen ? null : s.id)} className="flex items-center gap-3 text-left w-full min-w-0 group">
                                <Avatar name={s.name} size={38} />
                                <span className="min-w-0">
                                  <span className="block text-[15px] font-bold leading-snug text-ink-900 truncate group-hover:text-gold-700 transition-colors">{s.name}</span>
                                  <span className="block text-[12px] text-ink-400 truncate mt-0.5">fee day {s.feeDueDay === 1 ? "1st" : `${s.feeDueDay}th`}</span>
                                </span>
                                <Icon name="chevD" size={13} className={`shrink-0 text-ink-300 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                              </button>
                            </td>
                            <td className="px-3 py-3"><Badge tone="teal" className="max-w-full truncate">{s.grade}</Badge></td>
                            <td className="px-3 py-3 text-right font-mono text-[13.5px] font-semibold text-ink-900 tnum whitespace-nowrap">{rec ? fmtMoney(chargeOf(rec), cur) : "—"}</td>
                            <td className="px-3 py-3 text-right font-mono text-[13.5px] font-bold text-mint-600 tnum whitespace-nowrap">{rec ? fmtMoney(paidOf(state.payments, rec.id), cur) : "—"}</td>
                            <td className="px-3 py-3 text-right font-mono text-[13.5px] font-bold tnum whitespace-nowrap">
                              {rec ? (bal > 0 ? <span className="text-flame-600">{fmtMoney(bal, cur)}</span> : <span className="text-mint-600">{fmtMoney(0, cur)}</span>) : "—"}
                            </td>
                            <td className="px-3 py-3 text-[12.5px] font-semibold text-ink-600 tnum whitespace-nowrap">{rec ? fmtDate(rec.dueDate, df) : "—"}</td>
                            <td className="px-3 py-3">{st === "none" ? <Badge tone="slate">No challan</Badge> : <FeeStatusBadge status={st as FeeStatus} />}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <IconBtn name="wallet" label="Record payment" onClick={() => ui.openPayment(s.id)} />
                                <IconBtn name="slips" label={bal > 0 ? "Send monthly challan" : "Fully paid — no challan"} onClick={() => {
                                  if (!rec) { toast.push("No challan generated for this month yet.", "warn"); return; }
                                  if (bal <= 0) { toast.push(`${s.name} is fully paid — challan not needed.`, "warn"); return; }
                                  ui.openSlip({ kind: "challan", recordId: rec.id });
                                }} />
                                <IconBtn name="eye" label="Open profile" onClick={() => nav("student", { id: s.id })} />
                              </div>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr>
                              <td colSpan={8} className="bg-ink-50/70 px-6 py-4">
                                <div className="grid md:grid-cols-2 gap-5 anim-fade-in">
                                  <div>
                                    <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400 mb-2.5">Challan · {rec ? challanNo(state.feeRecords, rec.id) : "—"}</h3>
                                    {rec ? (
                                      <div className="rounded-[10px] border border-ink-150 bg-white divide-y divide-ink-100 text-[12.5px]">
                                        <Row k="Monthly fee" v={fmtMoney(rec.baseFee, cur)} />
                                        {rec.lateFee > 0 && <Row k="Late fee" v={fmtMoney(rec.lateFee, cur)} />}
                                        {rec.adjustment !== 0 && <Row k="Adjustment" v={`${rec.adjustment > 0 ? "+" : "−"}${fmtMoney(Math.abs(rec.adjustment), cur)}`} />}
                                        <Row k="Paid" v={`− ${fmtMoney(paidOf(state.payments, rec.id), cur)}`} green />
                                        <Row k="Balance" v={fmtMoney(balanceOf(rec, state.payments), cur)} bold red={bal > 0} />
                                        <Row k="Due date" v={fmtDate(rec.dueDate, df)} />
                                      </div>
                                    ) : <p className="text-[12.5px] text-ink-400">No fee record for {periodLabel(period)}.</p>}
                                    <div className="flex gap-2 mt-3">
                                      {rec && bal > 0 && <Btn size="sm" variant="gold" icon="send" onClick={() => ui.openSlip({ kind: "challan", recordId: rec.id })}>Send Challan</Btn>}
                                      {rec && (
                                        <Btn size="sm" variant="outline" icon={rec.waived ? "refresh" : "minus"} onClick={() => setWaiveRec(rec.id)}>{rec.waived ? "Remove Waiver" : "Waive Fee"}</Btn>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400 mb-2.5">Receipts for this month</h3>
                                    {pays.length === 0 ? <p className="text-[12.5px] text-ink-400">No payments recorded for {periodLabel(period)}.</p> : (
                                      <div className="space-y-2">
                                        {pays.map((p) => (
                                          <div key={p.id} className={`flex items-center gap-2.5 rounded-[10px] border bg-white px-3 py-2 ${p.state === "voided" ? "opacity-50 border-ink-150" : "border-ink-150"}`}>
                                            <Icon name="receipt" size={15} className={p.state === "voided" ? "text-ink-300" : "text-mint-600"} />
                                            <span className="font-mono text-[11.5px] font-bold text-ink-800 tnum">{p.receiptNo}</span>
                                            <span className="text-[11.5px] text-ink-400 tnum">{fmtDate(p.date, df)}</span>
                                            <span className="text-[11px] text-ink-400">{p.method}</span>
                                            <span className="flex-1" />
                                            <span className={`font-mono text-[12px] font-bold tnum ${p.state === "voided" ? "text-ink-400 line-through" : "text-mint-700"}`}>{fmtMoney(p.amount, cur)}</span>
                                            {p.state === "voided" ? <Badge tone="slate">Voided</Badge> : (
                                              <>
                                                <IconBtn name="send" label="Send receipt" onClick={() => ui.openSlip({ kind: "receipt", paymentId: p.id })} />
                                                <IconBtn name="edit" label="Edit payment" onClick={() => ui.openPayment(s.id, p.id)} />
                                                <IconBtn name="trash" label="Void payment" onClick={() => setVoidAsk(p.id)} />
                                              </>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "receipts" && (
        <div className="card overflow-hidden anim-fade-up">
          {receipts.length === 0 ? (
            <EmptyState icon="receipt" title="No receipts this month" message="Every payment creates a small receipt you can WhatsApp instantly." action={<Btn variant="gold" icon="plus" onClick={() => ui.openPayment()}>Record Payment</Btn>} />
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full table-fixed border-collapse text-left align-middle min-w-[820px]">
                <colgroup>
                  <col className="w-[110px]" />  {/* receipt no */}
                  <col />                        {/* student (flex) */}
                  <col className="w-[124px]" />  {/* date */}
                  <col className="w-[170px]" />  {/* method */}
                  <col className="w-[120px]" />  {/* amount */}
                  <col className="w-[110px]" />  {/* for month */}
                  <col className="w-[104px]" />  {/* send */}
                </colgroup>
                <thead className="bg-ink-50">
                  <tr className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400 border-b border-ink-100">
                    <th className="pl-4 pr-3 py-3">Receipt</th>
                    <th className="px-3 py-3">Student</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Method</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                    <th className="px-3 py-3">For Month</th>
                    <th className="px-4 py-3 text-right">Send</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {receipts.map((p) => {
                    const rec = state.feeRecords.find((r) => r.id === p.feeRecordId);
                    return (
                      <tr key={p.id} className="hover:bg-gold-50/40 transition-colors">
                        <td className="pl-4 pr-3 py-3"><button onClick={() => ui.openSlip({ kind: "receipt", paymentId: p.id })} className="font-mono text-[12.5px] font-bold text-ink-900 hover:text-mint-700 tnum whitespace-nowrap">{p.receiptNo}</button></td>
                        <td className="px-3 py-3 text-[14px] font-bold text-ink-900 truncate">{nameOf(p.studentId)}</td>
                        <td className="px-3 py-3 text-[12.5px] font-semibold text-ink-600 tnum whitespace-nowrap">{fmtDate(p.date, df)}</td>
                        <td className="px-3 py-3 text-[12.5px] text-ink-500 truncate">{p.method}{p.reference ? ` · ${p.reference}` : ""}</td>
                        <td className="px-3 py-3 text-right font-mono text-[13.5px] font-bold text-mint-600 tnum whitespace-nowrap">{fmtMoney(p.amount, cur)}</td>
                        <td className="px-3 py-3 text-[12.5px] text-ink-500 whitespace-nowrap">{rec ? periodLabel(rec.period, true) : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <Btn size="sm" variant="wa" icon="whatsapp" onClick={() => ui.openSlip({ kind: "receipt", paymentId: p.id })}>Send</Btn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <p className="text-[11.5px] text-ink-400 mt-4 flex items-center gap-2"><Icon name="note" size={13} /> Challans auto-generate on the 1st of every month for active students. Fully-paid students are protected — their challan button simply says “Paid”.</p>

      <Confirm open={!!voidAsk} onClose={() => setVoidAsk(null)} onConfirm={() => voidAsk && voidPayment(voidAsk)} title="Void this payment?" confirmLabel="Void Payment"
        message="Voiding keeps the record traceable but removes it from all balances and reports. This cannot be undone." />
      <Confirm open={!!waiveRec} onClose={() => setWaiveRec(null)} onConfirm={toggleWaive} tone="gold" title={state.feeRecords.find((r) => r.id === waiveRec)?.waived ? "Remove this waiver?" : "Waive this month's fee?"} confirmLabel={state.feeRecords.find((r) => r.id === waiveRec)?.waived ? "Remove Waiver" : "Waive Fee"}
        message="The charge will be set aside and the record marked Waived. Payments already received remain in history." />
      <span className="hidden">{todayISO()}</span>
    </div>
  );
}

function Row({ k, v, bold, red, green }: { k: string; v: string; bold?: boolean; red?: boolean; green?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2">
      <span className="text-ink-500 font-semibold text-[12px]">{k}</span>
      <span className={`font-mono tnum ${bold ? "font-bold text-[13px]" : "font-semibold text-[12px]"} ${red ? "text-flame-600" : green ? "text-mint-600" : "text-ink-900"}`}>{v}</span>
    </div>
  );
}
