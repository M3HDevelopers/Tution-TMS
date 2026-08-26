import React, { useMemo, useState } from "react";
import { useNav, useUi } from "../components/Shell";
import { Avatar, Badge, Btn, Confirm, EmptyState, FeeStatusBadge, Icon, Stat, StudentStatusBadge, Tabs, useToast } from "../components/ui";
import { balanceOf, challanNo, chargeOf, paidOf, recordsFor, statusOf, studentOutstanding, studentPaidToDate } from "../lib/fee";
import { absentMessage, whatsappGuardians } from "../lib/notify";
import { useStore, withActivity } from "../lib/store";
import { currentPeriod, fmtDate, fmtMoney, monthKeyOf, pad2, periodLabel, shiftPeriod, todayISO, waLink, weekdayIdx } from "../lib/utils";
import type { AttendanceStatus } from "../types";

const ATT_COLORS: Record<AttendanceStatus, { bg: string; label: string }> = {
  present: { bg: "bg-mint-600 text-white", label: "Present" },
  absent: { bg: "bg-flame-600 text-white", label: "Absent" },
  late: { bg: "warn-600", label: "Late" },
  leave: { bg: "bg-ink-400 text-white", label: "Leave" },
};

export default function StudentProfile() {
  const { state, patch } = useStore();
  const { route, nav } = useNav();
  const ui = useUi();
  const toast = useToast();
  const df = state.settings.dateFormat;
  const cur = state.settings.feePolicy.currency;
  const grace = state.settings.feePolicy.graceDays;
  const today = todayISO();
  const period = currentPeriod();

  const student = state.students.find((s) => s.id === route.params?.id);
  const [tab, setTab] = useState("overview");
  const [calMonth, setCalMonth] = useState(monthKeyOf(today));
  const [askDelete, setAskDelete] = useState(false);
  const [askInactive, setAskInactive] = useState(false);

  const records = useMemo(() => (student ? recordsFor(state, student.id) : []), [state, student]);
  const outstanding = student ? studentOutstanding(state, student.id) : 0;
  const guardians = student ? state.guardians.filter((g) => g.studentId === student.id) : [];
  const payments = student
    ? state.payments.filter((p) => p.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    : [];
  const slips = student
    ? state.slips.filter((sl) => (sl.kind === "challan" ? state.feeRecords.some((r) => r.id === sl.refId && r.studentId === student.id) : state.payments.some((p) => p.id === sl.refId && p.studentId === student.id)))
    : [];

  if (!student) {
    return <div className="card"><EmptyState icon="students" title="Student not found" message="This record may have been removed." action={<Btn variant="primary" onClick={() => nav("students")}>Back to Students</Btn>} /></div>;
  }

  const currentRec = records.find((r) => r.period === period);
  const paidTotal = studentPaidToDate(state, student.id, period);

  const setStatus = (st: "active" | "inactive") => {
    const students = state.students.map((s) => (s.id === student.id ? { ...s, status: st } : s));
    patch({ students, activity: withActivity({ ...state, students }, `${student.name} marked ${st}.`, "student") });
    toast.push(`Student marked ${st}`);
  };

  const deleteStudent = () => {
    const students = state.students.filter((s) => s.id !== student.id);
    const guardians2 = state.guardians.filter((g) => g.studentId !== student.id);
    const attendance = state.attendance.filter((a) => a.studentId !== student.id);
    patch({ students, guardians: guardians2, attendance, activity: withActivity({ ...state, students, guardians: guardians2, attendance }, `Student "${student.name}" deleted. Fee/payment ledger entries were kept for the accounts record.`, "student") });
    toast.push("Student deleted — ledger history preserved");
    nav("students");
  };

  /* attendance calendar for month */
  const calCells = useMemo(() => {
    const [y, m] = calMonth.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const dim = new Date(y, m, 0).getDate();
    const cells: { date: string; day: number; status?: AttendanceStatus; holiday?: string; off?: boolean; future: boolean }[] = [];
    for (let i = 0; i < first.getDay(); i++) cells.push({ date: "", day: 0, future: false });
    for (let d = 1; d <= dim; d++) {
      const iso = `${calMonth}-${pad2(d)}`;
      const rec = state.attendance.find((a) => a.date === iso && a.studentId === student.id);
      const hol = state.holidays.find((h) => h.date === iso && (h.scope === "all" || (h.scope === "class" && h.className === student.grade)));
      cells.push({
        date: iso, day: d,
        status: rec?.status,
        holiday: hol?.title,
        off: state.settings.weeklyOffs.includes(weekdayIdx(iso)),
        future: iso > today,
      });
    }
    return cells;
  }, [calMonth, state.attendance, state.holidays, state.settings.weeklyOffs, student.id, student.grade, today]);

  const attMonthRecs = state.attendance.filter((a) => a.studentId === student.id && monthKeyOf(a.date) === calMonth);
  const attP = attMonthRecs.filter((a) => a.status === "present" || a.status === "late").length;
  const attPct = attMonthRecs.length ? Math.round((attP / attMonthRecs.length) * 100) : null;

  return (
    <div>
      {/* header */}
      <div className="card overflow-hidden mb-5 anim-fade-up">
        <div className="bg-inkweave px-5 sm:px-7 py-6 flex flex-wrap items-center gap-5">
          {student.photo ? <img src={student.photo} alt="" className="w-16 h-16 rounded-2xl object-cover border-2 border-gold-500/50" /> : <Avatar name={student.name} size={64} className="!rounded-2xl" />}
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-display font-extrabold text-[24px] text-white leading-tight">{student.name}</h1>
              <StudentStatusBadge status={student.status} />
              <Badge tone="gold">{student.grade}</Badge>
            </div>
            <p className="text-[12.5px] text-ink-300 mt-1.5">
              {student.level} · {student.subjects && student.subjects.length ? student.subjects.join(", ") : "All subjects"} · ID <span className="font-mono">{student.id}</span>
            </p>
            <p className="text-[12px] text-ink-400 mt-0.5 tnum">
              Fee: <b className="text-gold-300 font-mono">{fmtMoney(student.monthlyFee, cur)}</b> · due on the <b className="text-gold-300">{student.feeDueDay === 1 ? "1st" : `${student.feeDueDay}th`}</b>{student.joiningDate ? ` · joined ${fmtDate(student.joiningDate, df)}` : " · joining date not recorded"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 [&>*]:grow [&>*]:min-w-0 [&>*]:basis-32 sm:[&>*]:grow-0 sm:[&>*]:basis-auto">
            <Btn variant="gold" icon="wallet" onClick={() => ui.openPayment(student.id)}>Record Payment</Btn>
            <Btn variant="outline" className="!bg-ink-800 !text-white !border-ink-700" icon="slips" onClick={() => {
              if (outstanding <= 0) { toast.push("Fully paid — no challan needed for this student.", "warn"); return; }
              const open = [...records].sort((a, b) => a.period.localeCompare(b.period)).find((r) => balanceOf(r, state.payments) > 0);
              if (open) ui.openSlip({ kind: "challan", recordId: open.id });
            }}>Send Challan</Btn>
            {payments[0] && <Btn variant="outline" className="!bg-ink-800 !text-white !border-ink-700" icon="receipt" onClick={() => ui.openSlip({ kind: "receipt", paymentId: payments[0].id })}>Last Receipt</Btn>}
            <Btn variant="outline" className="!bg-ink-800 !text-white !border-ink-700" icon="edit" onClick={() => ui.openStudentForm({ editId: student.id })}>Edit</Btn>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-ink-100">
          <div className="px-5 py-3"><p className="text-[10px] font-bold tracking-[0.12em] text-ink-400 uppercase">Outstanding</p><p className={`font-mono font-bold text-[17px] tnum ${outstanding > 0 ? "text-flame-600" : "text-mint-600"}`}>{fmtMoney(outstanding, cur)}</p></div>
          <div className="px-5 py-3"><p className="text-[10px] font-bold tracking-[0.12em] text-ink-400 uppercase">Paid till date</p><p className="font-mono font-bold text-[17px] text-ink-900 tnum">{fmtMoney(paidTotal, cur)}</p></div>
          <div className="px-5 py-3"><p className="text-[10px] font-bold tracking-[0.12em] text-ink-400 uppercase">This month</p><p className="font-mono font-bold text-[17px] text-ink-900 tnum">{currentRec ? fmtMoney(balanceOf(currentRec, state.payments), cur) : "—"}</p></div>
          <div className="px-5 py-3"><p className="text-[10px] font-bold tracking-[0.12em] text-ink-400 uppercase">Attendance ({periodLabel(calMonth, true)})</p><p className="font-mono font-bold text-[17px] text-ink-900 tnum">{attPct === null ? "—" : `${attPct}%`}</p></div>
        </div>
      </div>

      <div className="mb-5"><Tabs value={tab} onChange={setTab} tabs={[
        { key: "overview", label: "Overview", icon: "user" },
        { key: "attendance", label: "Attendance", icon: "attendance" },
        { key: "fees", label: "Fees & Receipts", icon: "fees" },
        { key: "slips", label: "Challans & Slips", icon: "slips" },
      ]} /></div>

      {/* ---------- overview ---------- */}
      {tab === "overview" && (
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 anim-fade-up">
          <div className="space-y-5">
            <div className="card p-5">
              <h2 className="font-display font-bold text-[15.5px] text-ink-900 mb-3.5">Student Details</h2>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
                <InfoRow k="Class" v={student.grade} />
                <InfoRow k="Academic level" v={student.level} />
                <InfoRow k="School / College" v={student.school || "—"} />
                <InfoRow k="Joining date" v={student.joiningDate ? fmtDate(student.joiningDate, df) : "Not recorded"} />
                <InfoRow k="Subjects" v={student.subjects && student.subjects.length ? student.subjects.join(", ") : "All subjects of the class"} />
                <InfoRow k="Fee due day" v={student.feeDueDay === 1 ? "1st of every month" : `${student.feeDueDay}th of every month`} />
                <InfoRow k="Address" v={student.address || "—"} />
                <InfoRow k="Status" v={student.status === "active" ? "Active" : "Inactive"} />
              </div>
              {student.notes && <p className="mt-3.5 text-[12.5px] text-ink-600 bg-gold-50 border border-gold-600/25 rounded-[9px] px-3.5 py-2.5"><b>Notes:</b> {student.notes}</p>}
            </div>

            {/* status + danger */}
            <div className="card p-5 flex flex-wrap items-center gap-3">
              <div className="flex-1">
                <h3 className="font-display font-bold text-[14.5px] text-ink-900">Manage Record</h3>
                <p className="text-[12px] text-ink-400 mt-0.5">Inactive students are skipped by monthly challan generation; their history stays intact.</p>
              </div>
              {student.status === "active"
                ? <Btn variant="outline" icon="minus" onClick={() => setAskInactive(true)}>Mark Inactive</Btn>
                : <Btn variant="success" icon="check" onClick={() => setStatus("active")}>Mark Active</Btn>}
              <Btn variant="danger" icon="trash" onClick={() => setAskDelete(true)}>Delete Student</Btn>
            </div>
          </div>

          {/* guardians */}
          <div className="card p-5 self-start">
            <h2 className="font-display font-bold text-[15.5px] text-ink-900 mb-3.5">Parent / Guardian Contacts</h2>
            {guardians.length === 0 ? (
              <p className="text-[12.5px] text-flame-600 font-semibold">No contact numbers saved — add one to send slips and receipts.</p>
            ) : (
              <div className="space-y-3">
                {guardians.map((g) => (
                  <div key={g.id} className="rounded-[11px] border border-ink-150 px-3.5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-[9px] bg-ink-900 text-gold-300 flex items-center justify-center shrink-0"><Icon name="user" size={14} /></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-ink-900 truncate">{g.name} <span className="text-ink-400 font-semibold text-[11.5px]">· {g.relation}</span></p>
                        <p className="font-mono text-[11.5px] text-ink-500 tnum">{g.phone}{g.primary && <Badge tone="navy" className="ml-2">Primary</Badge>}</p>
                      </div>
                      {!g.whatsapp && <Badge tone="slate">No WhatsApp</Badge>}
                    </div>
                    {g.whatsapp && (
                      <div className="flex gap-2 mt-2.5">
                        <Btn size="sm" variant="wa" icon="whatsapp" onClick={() => window.open(waLink(g.phone, absentMessage(state, student)), "_blank", "noopener")}>Absent Msg</Btn>
                        <Btn size="sm" variant="outline" icon="phone" onClick={() => window.open(`tel:${g.phone.replace(/[^0-9+]/g, "")}`, "_self")}>Call</Btn>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-ink-400 mt-3.5">Multiple numbers are supported — pick any of them while sending a challan or receipt.</p>
          </div>
        </div>
      )}

      {/* ---------- attendance calendar ---------- */}
      {tab === "attendance" && (
        <div className="card p-5 anim-fade-up">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setCalMonth(shiftPeriod(calMonth, -1))} className="w-8 h-8 rounded-[8px] border border-ink-200 bg-white flex items-center justify-center text-ink-600 hover:border-ink-400" aria-label="Previous month"><Icon name="chevL" size={15} /></button>
              <h2 className="font-display font-bold text-[16px] text-ink-900 w-40 text-center">{periodLabel(calMonth)}</h2>
              <button onClick={() => setCalMonth(shiftPeriod(calMonth, 1))} className="w-8 h-8 rounded-[8px] border border-ink-200 bg-white flex items-center justify-center text-ink-600 hover:border-ink-400" aria-label="Next month"><Icon name="chevR" size={15} /></button>
            </div>
            <div className="flex items-center gap-3 flex-wrap text-[11px] font-semibold text-ink-500">
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] bg-mint-600" /> Present</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] bg-flame-600" /> Absent</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] bg-warn-600" /> Late</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] bg-ink-400" /> Leave</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] border-2 border-[#0e7490] bg-[#ecf6f8]" /> Holiday</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] bg-ink-100" /> Off / not marked</span>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="text-center text-[10.5px] font-bold uppercase tracking-wider text-ink-400 py-1">{d}</div>)}
            {calCells.map((c, i) =>
              c.day === 0 ? <div key={`e${i}`} /> : (
                <div key={c.date} title={c.holiday ? `Holiday: ${c.holiday}` : c.status ? ATT_COLORS[c.status].label : c.off ? "Weekly off / not marked" : "Not marked"}
                  className={`aspect-square sm:aspect-[1.4] rounded-[9px] border flex flex-col items-center justify-center gap-0.5 transition-transform hover:scale-[1.04] ${c.future ? "border-ink-100 bg-white text-ink-300" : c.holiday ? "border-[#0e7490]/50 bg-[#ecf6f8] text-[#0e6b7c]" : c.status === "present" ? "border-mint-600/40 bg-mint-50 text-mint-700" : c.status === "absent" ? "border-flame-600/40 bg-flame-50 text-flame-700" : c.status === "late" ? "border-warn-600/40 bg-warn-50 text-warn-700" : c.status === "leave" ? "border-ink-200 bg-ink-50 text-ink-500" : "border-ink-100 bg-white text-ink-400"}`}>
                  <span className="text-[12px] font-bold tnum">{c.day}</span>
                  {!c.future && (
                    <span className={`text-[8.5px] font-extrabold tracking-wide ${c.holiday ? "text-[#0e6b7c]" : c.status === "present" ? "text-mint-600" : c.status === "absent" ? "text-flame-600" : c.status === "late" ? "text-warn-600" : "text-ink-300"}`}>
                      {c.holiday ? "HOL" : c.status === "present" ? "P" : c.status === "absent" ? "A" : c.status === "late" ? "L" : c.status === "leave" ? "LV" : c.off ? "OFF" : "·"}
                    </span>
                  )}
                </div>
              )
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Present" value={attMonthRecs.filter((a) => a.status === "present").length} icon="check" tone="green" />
            <Stat label="Late" value={attMonthRecs.filter((a) => a.status === "late").length} icon="clock" tone="amber" />
            <Stat label="Absent" value={attMonthRecs.filter((a) => a.status === "absent").length} icon="x" tone="red" />
            <Stat label="Rate" value={attPct === null ? "—" : `${attPct}%`} icon="reports" tone="navy" />
          </div>
        </div>
      )}

      {/* ---------- fees ---------- */}
      {tab === "fees" && (
        <div className="space-y-4 anim-fade-up">
          {records.length === 0 && <div className="card"><EmptyState icon="fees" title="No fee records yet" message="Challans generate automatically at the start of every month for active students." /></div>}
          {records.map((r) => {
            const bal = balanceOf(r, state.payments);
            const paid = paidOf(state.payments, r.id);
            const st = statusOf(r, state.payments, grace);
            const pays = state.payments.filter((p) => p.feeRecordId === r.id && p.state !== "voided").sort((a, b) => b.date.localeCompare(a.date));
            return (
              <div key={r.id} className="card overflow-hidden">
                <div className="px-5 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="w-32"><p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Period</p><p className="font-display font-bold text-[15px] text-ink-900">{periodLabel(r.period)}</p></div>
                  <div className="w-28"><p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Charge</p><p className="font-mono font-bold text-[14px] text-ink-900 tnum">{fmtMoney(chargeOf(r), cur)}</p></div>
                  <div className="w-28"><p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Paid</p><p className="font-mono font-bold text-[14px] text-mint-600 tnum">{fmtMoney(paid, cur)}</p></div>
                  <div className="w-32"><p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Balance</p><p className={`font-mono font-bold text-[14px] tnum ${bal > 0 ? "text-flame-600" : "text-mint-600"}`}>{fmtMoney(bal, cur)}</p></div>
                  <div className="w-32"><p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Due date</p><p className="text-[12.5px] font-semibold text-ink-700 tnum mt-0.5">{fmtDate(r.dueDate, df)}</p></div>
                  <div className="flex-1" />
                  <FeeStatusBadge status={st} />
                  <div className="flex gap-2">
                    <Btn size="sm" variant="outline" icon="wallet" onClick={() => ui.openPayment(student.id)}>Payment</Btn>
                    <Btn size="sm" variant={bal > 0 ? "gold" : "outline"} icon="slips" onClick={() => {
                      if (bal <= 0) { toast.push("This month is fully paid — challan not needed.", "warn"); return; }
                      ui.openSlip({ kind: "challan", recordId: r.id });
                    }}>{bal > 0 ? "Challan" : "Paid"}</Btn>
                  </div>
                </div>
                {pays.length > 0 && (
                  <div className="border-t border-ink-100 bg-ink-50/50 px-5 py-2.5 flex flex-wrap gap-2 items-center">
                    <span className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400 mr-1">Receipts:</span>
                    {pays.map((p) => (
                      <button key={p.id} onClick={() => ui.openSlip({ kind: "receipt", paymentId: p.id })}
                        className="inline-flex items-center gap-2 h-8 px-2.5 rounded-[8px] border border-mint-600/25 bg-white hover:bg-mint-50 transition-colors press">
                        <Icon name="receipt" size={13} className="text-mint-600" />
                        <span className="font-mono text-[11px] font-bold text-ink-800 tnum">{p.receiptNo}</span>
                        <span className="text-[11px] text-ink-400 tnum">{fmtDate(p.date, df)}</span>
                        <span className="font-mono text-[11px] font-bold text-mint-700 tnum">{fmtMoney(p.amount, cur)}</span>
                        <Icon name="send" size={11} className="text-ink-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ---------- slips ---------- */}
      {tab === "slips" && (
        <div className="card overflow-hidden anim-fade-up">
          {slips.length === 0 ? (
            <EmptyState icon="slips" title="Nothing shared yet" message="Challans and receipts you send will be logged here with their unique numbers." />
          ) : (
            <div className="divide-y divide-ink-100">
              {[...slips].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)).map((sl) => {
                const isCh = sl.kind === "challan";
                const periodOf = isCh ? state.feeRecords.find((r) => r.id === sl.refId)?.period : undefined;
                return (
                  <div key={sl.id} className="flex items-center gap-3 px-5 py-3">
                    <span className={`w-8 h-8 rounded-[9px] flex items-center justify-center ${isCh ? "bg-gold-50 text-gold-600" : "bg-mint-50 text-mint-600"}`}><Icon name={isCh ? "slips" : "receipt"} size={15} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-ink-900 font-mono">{sl.no} <span className="font-sans text-ink-400 font-semibold text-[11.5px]">· {isCh ? "Fee challan" : "Payment receipt"}{periodOf ? ` · ${periodLabel(periodOf)}` : ""}</span></p>
                      <p className="text-[11px] text-ink-400 tnum">{fmtDate(sl.generatedAt.slice(0, 10), df)} · sent to {sl.sentTo.length || "—"} contact{sl.sentTo.length === 1 ? "" : "s"}</p>
                    </div>
                    <Badge tone={sl.sent ? "green" : "slate"}>{sl.sent ? "Shared" : "Draft"}</Badge>
                    <Btn size="sm" variant="outline" icon="eye" onClick={() => ui.openSlip(isCh ? { kind: "challan", recordId: sl.refId } : { kind: "receipt", paymentId: sl.refId })}>Open</Btn>
                  </div>
                );
              })}
            </div>
          )}
          <p className="px-5 py-3 bg-ink-50/60 border-t border-ink-100 text-[11px] text-ink-400">Every challan carries a unique CHL number and every receipt a unique RCP number — both searchable from the top bar. Challan for this student: <b className="font-mono text-ink-600">{currentRec ? challanNo(state.feeRecords, currentRec.id) : "—"}</b></p>
        </div>
      )}

      <Confirm open={askDelete} onClose={() => setAskDelete(false)} onConfirm={deleteStudent} title="Delete this student?" confirmLabel="Yes, Delete"
        message={<>This will permanently remove <b>{student.name}</b>, their contacts and attendance. Fee & payment ledger entries will be kept for accounts. This cannot be undone.</>} />
      <Confirm open={askInactive} onClose={() => setAskInactive(false)} onConfirm={() => setStatus("inactive")} tone="gold" title="Mark student inactive?" confirmLabel="Mark Inactive"
        message={<>No new monthly challans will be generated for <b>{student.name}</b>. You can mark them active again anytime.</>} />
      <span className="hidden">{whatsappGuardians(state, student.id).length}</span>
    </div>
  );
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-ink-100/70 pb-2">
      <span className="w-32 shrink-0 text-[11px] font-bold uppercase tracking-wide text-ink-400">{k}</span>
      <span className="text-[13px] font-semibold text-ink-800">{v}</span>
    </div>
  );
}
