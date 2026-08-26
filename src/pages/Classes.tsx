import React, { useMemo } from "react";
import { useNav, useUi } from "../components/Shell";
import { Avatar, Btn, EmptyState, Icon, PageHead, ProgressBar } from "../components/ui";
import { balanceOf, monthCollected, periodStats, statusOf } from "../lib/fee";
import { useStore } from "../lib/store";
import { currentPeriod, fmtMoney, monthKeyOf, naturalCompare, periodLabel, timeLabel, todayISO } from "../lib/utils";

export default function Classes() {
  const { state } = useStore();
  const { nav } = useNav();
  const ui = useUi();
  const cur = state.settings.feePolicy.currency;
  const grace = state.settings.feePolicy.graceDays;
  const period = currentPeriod();
  const today = todayISO();

  const active = state.students.filter((s) => s.status === "active");

  const stacks = useMemo(() => {
    const map = new Map<string, typeof active>();
    for (const s of active) {
      const k = s.grade || "Unassigned";
      map.set(k, [...(map.get(k) ?? []), s].sort((a, b) => a.name.localeCompare(b.name)));
    }
    return [...map.entries()].sort((a, b) => naturalCompare(a[0], b[0]));
  }, [active]);

  const attToday = (id: string) => state.attendance.find((a) => a.date === today && a.studentId === id)?.status;

  return (
    <div>
      <PageHead title="Classes" sub="Stacks build themselves — every student you admit to the same class lands in the same stack. All classes come at one time."
        actions={<Btn variant="gold" icon="plus" onClick={() => ui.openStudentForm()}>Add Student</Btn>} />

      {/* single timing banner */}
      <div className="card overflow-hidden mb-5 anim-fade-up">
        <div className="bg-inkweave px-5 py-4 flex flex-wrap items-center gap-4">
          <span className="w-10 h-10 rounded-[10px] bg-gold-500 text-ink-950 flex items-center justify-center"><Icon name="clock" size={19} /></span>
          <div className="flex-1 min-w-[200px]">
            <p className="text-[14px] font-bold text-white tnum">{timeLabel(state.settings.startTime)} – {timeLabel(state.settings.endTime)} <span className="text-gold-300">· every working day</span></p>
            <p className="text-[11.5px] text-ink-400">One timing for the whole tuition — change it in Settings, or create a temporary timing-change notice from the bell.</p>
          </div>
          <Btn size="sm" variant="outline" className="!bg-ink-800 !text-white !border-ink-700" onClick={() => nav("settings")}>Change Timing</Btn>
        </div>
      </div>

      {stacks.length === 0 ? (
        <div className="card"><EmptyState icon="classes" title="No classes yet" message="Admit students and their classes will stack up here automatically — Nursery to First Year, each in its own group." action={<Btn variant="gold" icon="plus" onClick={() => ui.openStudentForm()}>Add Student</Btn>} /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 stagger">
          {stacks.map(([cls, students]) => {
            const monthly = students.reduce((s, x) => s + x.monthlyFee, 0);
            const paidCount = students.filter((s) => {
              const r = state.feeRecords.find((x) => x.studentId === s.id && x.period === period);
              return r && statusOf(r, state.payments, grace) === "paid";
            }).length;
            const presentNow = students.filter((s) => {
              const st = attToday(s.id);
              return st === "present" || st === "late";
            }).length;
            return (
              <div key={cls} className="card overflow-hidden">
                <div className="px-5 pt-4 pb-3.5 flex items-center gap-3 border-b border-ink-100">
                  <span className="w-10 h-10 rounded-[10px] bg-ink-900 text-gold-300 font-display font-bold text-[15px] flex items-center justify-center">
                    {cls.replace(/^Class\s*/i, "C").replace(/^([A-Za-z])/, (m) => m.toUpperCase()).slice(0, 5)}
                  </span>
                  <div className="flex-1">
                    <h2 className="font-display font-bold text-[17px] text-ink-900 leading-tight">{cls}</h2>
                    <p className="text-[11.5px] text-ink-400 tnum">{students.length} student{students.length > 1 ? "s" : ""} · {fmtMoney(monthly, cur)}/month expected</p>
                  </div>
                  <Btn size="sm" variant="outline" icon="plus" onClick={() => ui.openStudentForm({ presetClass: cls })}>Add</Btn>
                </div>

                <div className="px-5 py-3 flex items-center gap-4 bg-ink-50/50 border-b border-ink-100">
                  <div className="flex-1">
                    <div className="flex justify-between text-[11px] font-semibold text-ink-500 mb-1">
                      <span>{periodLabel(period, true)} fee settled</span><span className="tnum font-mono">{paidCount}/{students.length}</span>
                    </div>
                    <ProgressBar value={paidCount} max={Math.max(1, students.length)} tone={paidCount === students.length ? "green" : "gold"} />
                  </div>
                  <span className="text-[11px] font-bold text-ink-500 tnum">
                    {state.attendance.some((a) => a.date === today) ? `${presentNow} present today` : "attendance pending"}
                  </span>
                </div>

                <div className="divide-y divide-ink-100/70">
                  {students.map((s) => {
                    const r = state.feeRecords.find((x) => x.studentId === s.id && x.period === period);
                    const bal = r ? balanceOf(r, state.payments) : s.monthlyFee;
                    const st = attToday(s.id);
                    return (
                      <div key={s.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gold-50/50 transition-colors group">
                        <Avatar name={s.name} size={32} />
                        <button onClick={() => nav("student", { id: s.id })} className="flex-1 min-w-0 text-left">
                          <span className="block text-[13px] font-bold text-ink-900 group-hover:text-gold-700 truncate">{s.name}</span>
                          <span className="block text-[10.5px] text-ink-400">{s.subjects && s.subjects.length ? s.subjects.join(", ") : "All subjects"} · fee day {s.feeDueDay === 1 ? "1st" : `${s.feeDueDay}th`}</span>
                        </button>
                        {st && (
                          <span className={`w-6 h-6 rounded-[7px] text-[10px] font-bold flex items-center justify-center ${st === "present" ? "bg-mint-100 text-mint-700" : st === "absent" ? "bg-flame-100 text-flame-700" : st === "late" ? "bg-warn-100 text-warn-700" : "bg-ink-100 text-ink-500"}`}>
                            {st === "present" ? "P" : st === "absent" ? "A" : st === "late" ? "L" : "Lv"}
                          </span>
                        )}
                        <span className={`font-mono text-[12px] font-bold tnum ${bal > 0 ? "text-flame-600" : "text-mint-600"}`}>{bal > 0 ? fmtMoney(bal, cur) : "Paid"}</span>
                        <button onClick={() => ui.openPayment(s.id)} title="Record payment" className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-[7px] border border-ink-200 bg-white text-ink-500 hover:text-mint-700 flex items-center justify-center press">
                          <Icon name="wallet" size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11.5px] text-ink-400 mt-5 flex items-center gap-2">
        <Icon name="note" size={13} /> Class stacks are derived from student records — no separate batch maintenance needed. Monthly collection so far: <b className="font-mono tnum text-ink-700">{fmtMoney(monthCollected(state.payments, period), cur)}</b> ({periodStats(state, period).counts.paid} fully paid).
      </p>
    </div>
  );
}
