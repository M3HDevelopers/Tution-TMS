import React, { useEffect, useMemo, useState } from "react";
import PaymentModal from "../components/PaymentModal";
import { useNav } from "../components/Shell";
import { Avatar, Badge, Btn, Confirm, EmptyState, FeeStatusBadge, Icon, IconBtn, Modal, PageHead, SearchBox, Stat, TInput, TSelect, useToast } from "../components/ui";
import { balanceOf, chargeOf, currentPeriod, ensureFeeRecords, paidOf, periodStats, previousBalance, statusOf } from "../lib/fee";
import { useStore, withActivity } from "../lib/store";
import { fmtDate, fmtMoney, lastNPeriods, num, periodLabel } from "../lib/utils";
import type { FeeRecord, FeeStatus } from "../types";

export default function Fees() {
  const { state, patch } = useStore();
  const { nav, route } = useNav();
  const toast = useToast();
  const df = state.settings.dateFormat;
  const cur = state.settings.feePolicy.currency;
  const grace = state.settings.feePolicy.graceDays;

  const [period, setPeriod] = useState(currentPeriod());
  const [fStatus, setFStatus] = useState<"all" | FeeStatus>(route.params?.filter === "partial" ? "partial" : "all");
  const [fBatch, setFBatch] = useState("all");
  const [q, setQ] = useState("");
  const [payOpen, setPayOpen] = useState(route.params?.pay === "1");
  const [payStudent, setPayStudent] = useState<string | undefined>(route.params?.student);
  const [detail, setDetail] = useState<FeeRecord | null>(null);
  const [adjust, setAdjust] = useState("");
  const [voidAsk, setVoidAsk] = useState<string | null>(null);
  const [waiveAsk, setWaiveAsk] = useState(false);
  const [editingPayment, setEditingPayment] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (route.params?.student) setQ(state.students.find((s) => s.id === route.params!.student)?.name ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = (silent = false) => {
    const res = ensureFeeRecords(state);
    if (res.added > 0 || res.late > 0) {
      const activity = withActivity({ ...state, feeRecords: res.records }, `Fee cycle refreshed — ${res.added} new record(s), ${res.late} late fee(s) applied.`, "fee");
      patch({ feeRecords: res.records, activity });
      if (!silent) toast.push(`${res.added} fee record(s) generated`);
    } else if (!silent) {
      toast.push("Fee records already up to date");
    }
  };
  useEffect(() => { refresh(true); /* ensure current cycle on visit */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.feeRecords
      .filter((r) => r.period === period)
      .filter((r) => {
        const s = state.students.find((x) => x.id === r.studentId);
        if (!s) return false;
        if (s.status === "archived") return false;
        if (fBatch !== "all" && !s.batchIds.includes(fBatch)) return false;
        if (fStatus !== "all" && statusOf(r, state.payments, grace) !== fStatus) return false;
        if (needle && !s.name.toLowerCase().includes(needle) && !s.grade.toLowerCase().includes(needle)) return false;
        return true;
      })
      .sort((a, b) => {
        const rank = (r: FeeRecord) => {
          const st = statusOf(r, state.payments, grace);
          return st === "overdue" ? 0 : st === "partial" ? 1 : st === "due" ? 2 : 3;
        };
        return rank(a) - rank(b) || balanceOf(b, state.payments) - balanceOf(a, state.payments);
      });
  }, [state, period, fStatus, fBatch, q, grace]);

  const stats = periodStats(state, period);
  const nameOf = (id: string) => state.students.find((s) => s.id === id);

  /* detail modal helpers */
  const detailRec = detail ? state.feeRecords.find((r) => r.id === detail.id) ?? null : null;
  const detailStudent = detailRec ? nameOf(detailRec.studentId) : null;
  const detailPayments = detailRec ? state.payments.filter((p) => p.feeRecordId === detailRec.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
  useEffect(() => {
    if (detailRec) setAdjust(String(detailRec.adjustment));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id]);

  const saveAdjust = () => {
    if (!detailRec) return;
    const v = num(adjust);
    const feeRecords = state.feeRecords.map((r) => (r.id === detailRec.id ? { ...r, adjustment: v } : r));
    patch({ feeRecords, activity: withActivity({ ...state, feeRecords }, `Adjustment set to ${fmtMoney(v, cur)} for ${detailStudent?.name} (${periodLabel(detailRec.period, true)}).`, "fee") });
    toast.push("Adjustment saved");
  };

  const toggleWaive = () => {
    if (!detailRec) return;
    const feeRecords = state.feeRecords.map((r) => (r.id === detailRec.id ? { ...r, waived: !r.waived } : r));
    patch({ feeRecords, activity: withActivity({ ...state, feeRecords }, `Fee ${detailRec.waived ? "restored" : "waived"} for ${detailStudent?.name} (${periodLabel(detailRec.period, true)}).`, "fee") });
    toast.push(detailRec.waived ? "Waiver removed" : "Fee waived");
    setWaiveAsk(false);
  };

  const voidPayment = (pid: string) => {
    const p = state.payments.find((x) => x.id === pid);
    if (!p) return;
    const payments = state.payments.map((x) => (x.id === pid ? { ...x, state: "voided" as const } : x));
    patch({ payments, activity: withActivity({ ...state, payments }, `Payment ${p.receiptNo} voided — ${fmtMoney(p.amount, cur)}.`, "payment") });
    toast.push("Payment voided", "warn");
  };

  const chips: { key: "all" | FeeStatus; label: string; n: number }[] = [
    { key: "all", label: "All", n: state.feeRecords.filter((r) => r.period === period).length },
    { key: "overdue", label: "Overdue", n: stats.counts.overdue },
    { key: "due", label: "Due", n: stats.counts.due },
    { key: "partial", label: "Partially Paid", n: stats.counts.partial },
    { key: "paid", label: "Paid", n: stats.counts.paid },
    { key: "waived", label: "Waived", n: stats.counts.waived },
  ];

  return (
    <div>
      <PageHead title="Fees & Payments" sub={`Cycle starts day ${state.settings.feePolicy.cycleStartDay} · due day ${state.settings.feePolicy.dueDay} · ${grace}-day grace · late fee ${fmtMoney(state.settings.feePolicy.lateFee, cur)}`}
        actions={<>
          <Btn variant="outline" icon="refresh" onClick={() => refresh()}>Refresh Cycle</Btn>
          <Btn variant="gold" icon="plus" onClick={() => { setPayStudent(undefined); setEditingPayment(undefined); setPayOpen(true); }}>Record Payment</Btn>
        </>} />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5 stagger mb-5">
        <Stat label={`Charged · ${periodLabel(period, true)}`} value={fmtMoney(stats.charged, cur)} sub={`${chips[0].n} fee records`} icon="fees" tone="navy" />
        <Stat label="Collected for Period" value={fmtMoney(stats.collected, cur)} sub={stats.charged > 0 ? `${Math.min(100, Math.round((stats.collected / stats.charged) * 100))}% of charges` : "—"} icon="wallet" tone="gold" />
        <Stat label="Outstanding" value={fmtMoney(stats.outstanding, cur)} sub={`${stats.counts.overdue} overdue · ${stats.counts.due + stats.counts.partial} pending`} icon="alert" tone="red" />
        <Stat label="Fully Paid" value={stats.counts.paid} sub={`${stats.counts.waived} waived`} icon="check" tone="green" />
      </div>

      {/* filters */}
      <div className="card p-3.5 mb-4 anim-fade-up">
        <div className="flex flex-wrap items-center gap-2.5">
          <TSelect value={period} onChange={(e) => setPeriod(e.target.value)} className="!w-auto min-w-40">
            {lastNPeriods(8).map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </TSelect>
          <SearchBox value={q} onChange={setQ} placeholder="Search student…" className="w-full sm:w-52" />
          <TSelect value={fBatch} onChange={(e) => setFBatch(e.target.value)} className="!w-auto min-w-36">
            <option value="all">All batches</option>
            {state.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </TSelect>
          <div className="flex-1" />
          <div className="flex gap-1.5 flex-wrap">
            {chips.map((c) => (
              <button key={c.key} onClick={() => setFStatus(c.key)}
                className={`h-8 px-3 rounded-[8px] border text-[11.5px] font-bold transition-all tnum ${fStatus === c.key ? "bg-ink-900 text-white border-ink-900" : "bg-white text-ink-500 border-ink-200 hover:border-ink-400"}`}>
                {c.label} <span className={fStatus === c.key ? "text-gold-400" : "text-ink-300"}>{c.n}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* records table */}
      <div className="card overflow-hidden anim-fade-up" style={{ animationDelay: "60ms" }}>
        {recs.length === 0 ? (
          <EmptyState icon="fees" title={`No ${fStatus === "all" ? "" : fStatus + " "}records for ${periodLabel(period)}`} message="Adjust the filters, or press Refresh Cycle to generate monthly charges for active students." action={<Btn variant="outline" icon="refresh" onClick={() => refresh()}>Refresh Cycle</Btn>} />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-left min-w-[820px]">
              <thead><tr className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400 border-b border-ink-100 bg-ink-50/60">
                <th className="pl-5 py-2.5 font-bold">Student</th><th className="py-2.5 font-bold text-right">Charge</th><th className="py-2.5 font-bold text-right">Prev. Balance</th><th className="py-2.5 font-bold text-right">Paid</th><th className="py-2.5 font-bold text-right">Balance</th><th className="py-2.5 font-bold">Due Date</th><th className="py-2.5 font-bold">Status</th><th className="py-2.5 pr-5 font-bold text-right">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-ink-100">
                {recs.map((r) => {
                  const s = nameOf(r.studentId);
                  const bal = balanceOf(r, state.payments);
                  const paid = paidOf(state.payments, r.id);
                  const prev = previousBalance(state, r.studentId, r.period);
                  const st = statusOf(r, state.payments, grace);
                  return (
                    <tr key={r.id} className="group hover:bg-gold-50/40 transition-colors">
                      <td className="pl-5 py-3 cursor-pointer" onClick={() => nav("student", { id: r.studentId })}>
                        <div className="flex items-center gap-3">
                          <Avatar name={s?.name ?? "?"} size={32} />
                          <div><div className="text-[13px] font-semibold text-ink-900">{s?.name}</div><div className="text-[11px] text-ink-400">{s?.grade}</div></div>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono text-[12.5px] font-semibold tnum">{fmtMoney(chargeOf(r), cur)}{r.lateFee > 0 && <span className="block text-[10px] text-warn-600 font-sans font-semibold">incl. late fee</span>}</td>
                      <td className="py-3 text-right font-mono text-[12px] tnum text-ink-500">{prev > 0 ? fmtMoney(prev, cur) : "—"}</td>
                      <td className="py-3 text-right font-mono text-[12.5px] text-mint-600 tnum">{fmtMoney(paid, cur)}</td>
                      <td className={`py-3 text-right font-mono text-[13px] font-bold tnum ${bal > 0 ? (st === "overdue" ? "text-flame-600" : "text-warn-600") : "text-ink-300"}`}>{fmtMoney(bal, cur)}</td>
                      <td className="py-3 text-[12px] text-ink-500 tnum">{fmtDate(r.dueDate, df)}</td>
                      <td className="py-3"><FeeStatusBadge status={st} pulse /></td>
                      <td className="py-3 pr-5">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <IconBtn name="wallet" label="Record payment" onClick={() => { setPayStudent(r.studentId); setEditingPayment(undefined); setPayOpen(true); }} />
                          <IconBtn name="slips" label="Send fee slip" onClick={() => nav("slips", { studentId: r.studentId, feeRecordId: r.id })} />
                          <IconBtn name="file" label="Record details" onClick={() => setDetail(r)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* record detail modal */}
      <Modal open={!!detailRec} onClose={() => setDetail(null)} wide title={detailStudent ? `${detailStudent.name} — ${detailRec ? periodLabel(detailRec.period) : ""}` : ""} sub="Fee record breakdown, adjustments and payment trail"
        footer={detailRec ? <>
          <Btn variant="outline" icon="slips" onClick={() => nav("slips", { studentId: detailRec.studentId, feeRecordId: detailRec.id })}>Send Fee Slip</Btn>
          <Btn variant="success" icon="wallet" onClick={() => { setPayStudent(detailRec.studentId); setEditingPayment(undefined); setDetail(null); setPayOpen(true); }}>Record Payment</Btn>
        </> : undefined}>
        {detailRec && detailStudent && (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-3 gap-2.5">
              {[
                { l: "Base Fee", v: fmtMoney(detailRec.waived ? 0 : detailRec.baseFee, cur) },
                { l: "Late Fee", v: fmtMoney(detailRec.lateFee, cur) },
                { l: "Adjustment", v: fmtMoney(detailRec.adjustment, cur) },
                { l: "Previous Balance", v: fmtMoney(previousBalance(state, detailRec.studentId, detailRec.period), cur) },
                { l: "Total Charge", v: fmtMoney(chargeOf(detailRec), cur), strong: true },
                { l: "Paid", v: fmtMoney(paidOf(state.payments, detailRec.id), cur) },
              ].map((x) => (
                <div key={x.l} className="rounded-[10px] bg-ink-50 border border-ink-100 px-3.5 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-ink-400">{x.l}</div>
                  <div className={`font-mono font-bold text-[15px] mt-1 tnum ${x.strong ? "text-ink-900" : "text-ink-700"}`}>{x.v}</div>
                </div>
              ))}
            </div>
            <div className="flex items-end justify-between gap-3 p-3.5 rounded-[10px] border border-ink-900 bg-ink-900 text-white">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-300">Remaining Balance</div>
                <div className={`font-mono font-extrabold text-[22px] tnum ${balanceOf(detailRec, state.payments) > 0 ? "text-gold-400" : "text-mint-500"}`}>{fmtMoney(balanceOf(detailRec, state.payments), cur)}</div>
              </div>
              <div className="text-right">
                <FeeStatusBadge status={statusOf(detailRec, state.payments, grace)} />
                <div className="text-[11px] text-ink-300 mt-1 tnum">Due {fmtDate(detailRec.dueDate, df)}</div>
              </div>
            </div>

            <div className="grid sm:grid-cols-[1fr_auto] gap-2.5 items-end">
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-500 mb-1.5">Adjustment (− for discount) — applies to this cycle only</span>
                <TInput type="number" value={adjust} onChange={(e) => setAdjust(e.target.value)} className="!w-44" />
              </div>
              <div className="flex gap-2">
                <Btn variant="outline" icon="save" onClick={saveAdjust}>Save Adjustment</Btn>
                <Btn variant={detailRec.waived ? "outline" : "danger"} icon={detailRec.waived ? "restore" : "x"} onClick={() => (detailRec.waived ? toggleWaive() : setWaiveAsk(true))}>
                  {detailRec.waived ? "Remove Waiver" : "Waive Fee"}
                </Btn>
              </div>
            </div>

            <div>
              <h3 className="font-display font-bold text-[14.5px] text-ink-900 mb-2.5">Payment History</h3>
              {detailPayments.length === 0 ? (
                <p className="text-[12.5px] text-ink-400">No payments against this record yet.</p>
              ) : (
                <div className="space-y-2">
                  {detailPayments.map((p) => (
                    <div key={p.id} className={`flex items-center gap-3 rounded-[10px] border px-3.5 py-2.5 ${p.state === "voided" ? "border-flame-100 bg-flame-50/50 opacity-70" : "border-ink-100"}`}>
                      <span className={`w-8 h-8 rounded-[8px] flex items-center justify-center ${p.state === "voided" ? "bg-flame-100 text-flame-600" : "bg-mint-50 text-mint-600"}`}><Icon name="wallet" size={15} /></span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-ink-900 tnum">{p.receiptNo} · {fmtMoney(p.amount, cur)} <Badge tone={p.state === "voided" ? "red" : p.state === "edited" ? "amber" : "green"}>{p.state === "voided" ? "Voided" : p.state === "edited" ? "Edited" : "Recorded"}</Badge></div>
                        <div className="text-[11px] text-ink-400 tnum">{fmtDate(p.date, df)} · {p.method}{p.reference ? ` · ref ${p.reference}` : ""}{p.note ? ` · ${p.note}` : ""}</div>
                      </div>
                      {p.state !== "voided" && <>
                        <IconBtn name="edit" label="Edit payment" onClick={() => { setEditingPayment(p.id); setDetail(null); setPayOpen(true); }} />
                        <IconBtn name="trash" label="Void payment" onClick={() => setVoidAsk(p.id)} />
                      </>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <PaymentModal open={payOpen} onClose={() => { setPayOpen(false); setEditingPayment(undefined); }} studentId={payStudent} paymentId={editingPayment} />

      <Confirm open={!!voidAsk} onClose={() => setVoidAsk(null)} onConfirm={() => voidAsk && voidPayment(voidAsk)} title="Void this payment?" confirmLabel="Void Payment"
        message="Voiding keeps the record traceable but removes it from all balances and reports. This cannot be undone." />
      <Confirm open={waiveAsk} onClose={() => setWaiveAsk(false)} onConfirm={toggleWaive} title="Waive this month's fee?" confirmLabel="Waive Fee" tone="gold"
        message="The charge will be set aside and the record marked Waived. Payments already received remain in history. You can remove the waiver later." />
    </div>
  );
}
