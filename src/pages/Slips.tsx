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
          <div className="px-4 py-3 bg-ink-50/60 border-b border-ink-100 flex items-center justify-between gap-2">
            <span className="text-[11.5px] font-semibold text-ink-500 tnum">{monthRecords.filter((x) => x.bal > 0).length} to send · {monthRecords.filter((x) => x.bal <= 0).length} settled</span>
            <Badge tone="gold">{periodLabel(period)}</Badge>
          </div>
          {monthRecords.length === 0 ? (
            <EmptyState icon="slips" title="No challans this month" message="Add active students — challans generate automatically at the start of each month." />
          ) : (
            <div className="divide-y divide-ink-100">
              {monthRecords.map(({ r, s, bal, st }) => {
                const shared = sentChallans.some((x) => x.refId === r.id);
                const settled = bal <= 0;
                return (
                  <div key={r.id} className="px-4 py-3.5 hover:bg-gold-50/40 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-9 h-9 rounded-[9px] flex items-center justify-center shrink-0 ${settled ? "bg-mint-50 text-mint-600" : "bg-gold-50 text-gold-600"}`}>
                        <Icon name={settled ? "check" : "slips"} size={16} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14.5px] font-bold text-ink-900 truncate">{s!.name}
                          {shared && <Badge tone="green" className="ml-2">Shared</Badge>}
                        </p>
                        <p className="text-[11px] text-ink-400 tnum mt-0.5"><span className="font-mono font-bold text-ink-600">{challanNo(state.feeRecords, r.id)}</span> · {s!.grade}</p>
                      </div>
                      <Badge tone={st === "paid" ? "green" : st === "overdue" ? "red" : st === "partial" ? "amber" : "gold"}>{st === "paid" ? "Paid" : st === "overdue" ? "Overdue" : st === "partial" ? "Partial" : st === "waived" ? "Waived" : "Due"}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-2.5 pl-[46px]">
                      <span className="text-[11px] font-semibold text-ink-400">Payable <span className="font-mono text-[13px] font-bold text-ink-900 tnum ml-1">{fmtMoney(bal, cur)}</span></span>
                      <span className="text-[11px] font-semibold text-ink-400 tnum">Due <span className="text-[12px] font-bold text-ink-700 ml-1">{fmtDate(r.dueDate, df)}</span></span>
                      <span className="flex-1" />
                      {settled ? (
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-mint-600">Settled — no slip needed</span>
                      ) : (
                        <Btn size="sm" variant="gold" icon="send" onClick={() => ui.openSlip({ kind: "challan", recordId: r.id })}>Send Fee Slip</Btn>
                      )}
                    </div>
                  </div>
                );
              })}
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
