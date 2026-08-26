import React, { useMemo, useState } from "react";
import { useUi } from "../components/Shell";
import { Badge, Btn, EmptyState, Icon, PageHead, Tabs } from "../components/ui";
import { challanNo, statusOf, balanceOf } from "../lib/fee";
import { useStore } from "../lib/store";
import { currentPeriod, fmtDate, fmtMoney, periodLabel } from "../lib/utils";

export default function Slips() {
  const { state } = useStore();
  const ui = useUi();
  const df = state.settings.dateFormat;
  const cur = state.settings.feePolicy.currency;
  const grace = state.settings.feePolicy.graceDays;
  const [tab, setTab] = useState("challans");
  const period = currentPeriod();

  const nameOf = (id: string) => state.students.find((s) => s.id === id)?.name ?? "Removed student";

  const monthRecords = useMemo(
    () => state.feeRecords.filter((r) => r.period === period)
      .map((r) => ({ r, s: state.students.find((s) => s.id === r.studentId), bal: balanceOf(r, state.payments), st: statusOf(r, state.payments, grace) }))
      .filter((x) => x.s)
      .sort((a, b) => (a.bal > 0 ? -1 : 1) - (b.bal > 0 ? -1 : 1) || a.s!.name.localeCompare(b.s!.name)),
    [state, period, grace]
  );

  const sentChallans = state.slips.filter((s) => s.kind === "challan");
  const sentReceipts = state.slips.filter((s) => s.kind === "receipt");

  return (
    <div>
      <PageHead title="Fee Slips" sub={`Monthly challans for ${periodLabel(period)} · every document has a unique number (CHL / RCP)`} />
      <div className="mb-5"><Tabs value={tab} onChange={setTab} tabs={[
        { key: "challans", label: "Monthly Challans", icon: "slips" },
        { key: "history", label: `Shared History (${sentChallans.length + sentReceipts.length})`, icon: "send" },
      ]} /></div>

      {tab === "challans" && (
        <div className="card overflow-hidden anim-fade-up">
          <div className="px-5 py-3.5 bg-ink-50/60 border-b border-ink-100 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-ink-500">{monthRecords.filter((x) => x.bal > 0).length} challan(s) still to send · {monthRecords.filter((x) => x.bal <= 0).length} already settled</span>
            <Badge tone="gold">{periodLabel(period)}</Badge>
          </div>
          {monthRecords.length === 0 ? (
            <EmptyState icon="slips" title="No challans this month" message="Add active students — challans generate automatically at the start of each month." />
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-left min-w-[760px]">
                <thead><tr className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400 border-b border-ink-100">
                  <th className="pl-5 py-3 font-bold">Challan No.</th><th className="py-3 font-bold">Student</th><th className="py-3 font-bold">Class</th><th className="py-3 font-bold text-right">Payable</th><th className="py-3 font-bold">Due Date</th><th className="py-3 font-bold">Status</th><th className="py-3 pr-5 font-bold text-right">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-ink-100">
                  {monthRecords.map(({ r, s, bal, st }) => {
                    const shared = sentChallans.some((x) => x.refId === r.id);
                    return (
                      <tr key={r.id} className="hover:bg-gold-50/40 transition-colors">
                        <td className="pl-5 py-3 font-mono text-[12.5px] font-bold text-ink-900 tnum">{challanNo(state.feeRecords, r.id)}</td>
                        <td className="py-3 text-[13.5px] font-bold text-ink-900">{s!.name}{shared && <Badge tone="green" className="ml-2">Shared</Badge>}</td>
                        <td className="py-3 text-[12px] text-ink-500">{s!.grade}</td>
                        <td className="py-3 text-right font-mono text-[12.5px] font-bold text-ink-900 tnum">{fmtMoney(bal, cur)}</td>
                        <td className="py-3 text-[12px] text-ink-500 tnum">{fmtDate(r.dueDate, df)}</td>
                        <td className="py-3"><Badge tone={st === "paid" ? "green" : st === "overdue" ? "red" : st === "partial" ? "amber" : "gold"}>{st === "paid" ? "Paid" : st === "overdue" ? "Overdue" : st === "partial" ? "Partial" : st === "waived" ? "Waived" : "Due"}</Badge></td>
                        <td className="py-3 pr-5 text-right">
                          {bal > 0 ? (
                            <Btn size="sm" variant="gold" icon="send" onClick={() => ui.openSlip({ kind: "challan", recordId: r.id })}>Send Fee Slip</Btn>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-mint-600"><Icon name="check" size={14} /> Settled — no slip needed</span>
                          )}
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

      {tab === "history" && (
        <div className="card overflow-hidden anim-fade-up">
          {sentChallans.length + sentReceipts.length === 0 ? (
            <EmptyState icon="send" title="Nothing shared yet" message="Challans and receipts you send from anywhere in the app are logged here." />
          ) : (
            <div className="divide-y divide-ink-100">
              {[...state.slips].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)).map((sl) => {
                const isCh = sl.kind === "challan";
                const rec = isCh ? state.feeRecords.find((r) => r.id === sl.refId) : undefined;
                const pay = !isCh ? state.payments.find((p) => p.id === sl.refId) : undefined;
                const sid = rec?.studentId ?? pay?.studentId;
                return (
                  <div key={sl.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gold-50/40 transition-colors">
                    <span className={`w-9 h-9 rounded-[9px] flex items-center justify-center shrink-0 ${isCh ? "bg-gold-50 text-gold-600" : "bg-mint-50 text-mint-600"}`}><Icon name={isCh ? "slips" : "receipt"} size={16} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-ink-900"><span className="font-mono tnum">{sl.no}</span> <span className="text-ink-400 font-semibold text-[11.5px]">· {isCh ? "Fee challan" : "Payment receipt"} · {sid ? nameOf(sid) : "—"}</span></p>
                      <p className="text-[11px] text-ink-400 tnum">{fmtDate(sl.generatedAt.slice(0, 10), df)}{rec ? ` · ${periodLabel(rec.period, true)}` : ""}{pay ? ` · ${fmtMoney(pay.amount, cur)}` : ""} · {sl.sentTo.length ? `sent to ${sl.sentTo.length}` : "not sent"}</p>
                    </div>
                    <Badge tone={sl.sent ? "green" : "slate"}>{sl.sent ? "Shared" : "Generated"}</Badge>
                    <Btn size="sm" variant="outline" icon="eye" onClick={() => ui.openSlip(isCh ? { kind: "challan", recordId: sl.refId } : { kind: "receipt", paymentId: sl.refId })}>Open</Btn>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <p className="text-[11.5px] text-ink-400 mt-4 flex items-center gap-2">
        <Icon name="note" size={13} /> Tip: search any CHL or RCP number from the top search bar to reopen its document.
      </p>
    </div>
  );
}
