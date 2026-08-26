import React, { useMemo, useState } from "react";
import PaymentModal from "../components/PaymentModal";
import StudentForm from "../components/StudentForm";
import { useNav } from "../components/Shell";
import { AttBadge, Avatar, Badge, Btn, Confirm, EmptyState, FeeStatusBadge, Icon, IconBtn, ProgressBar, Stat, Tabs, useToast } from "../components/ui";
import { balanceOf, chargeOf, paidOf, recordsFor, studentOutstanding, statusOf } from "../lib/fee";
import { useStore, withActivity } from "../lib/store";
import { fmtDate, fmtMoney, monthKeyOf, periodLabel, todayISO, waLink } from "../lib/utils";

export default function StudentProfile() {
  const { state, patch } = useStore();
  const { route, nav } = useNav();
  const toast = useToast();
  const id = route.params?.id ?? "";
  const student = state.students.find((s) => s.id === id);
  const df = state.settings.dateFormat;
  const cur = state.settings.feePolicy.currency;
  const grace = state.settings.feePolicy.graceDays;

  const [tab, setTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [archiveAsk, setArchiveAsk] = useState(false);
  const [month, setMonth] = useState(monthKeyOf(todayISO()));

  const guardians = useMemo(() => state.guardians.filter((g) => g.studentId === id).sort((a, b) => Number(b.primary) - Number(a.primary)), [state.guardians, id]);
  const recs = useMemo(() => recordsFor(state, id), [state, id]);
  const outstanding = studentOutstanding(state, id);

  const monthAtt = useMemo(() => state.attendance.filter((a) => a.studentId === id && monthKeyOf(a.date) === month), [state.attendance, id, month]);
  const pCount = monthAtt.filter((a) => a.status === "present").length;
  const lCount = monthAtt.filter((a) => a.status === "late").length;
  const aCount = monthAtt.filter((a) => a.status === "absent").length;
  const lvCount = monthAtt.filter((a) => a.status === "leave").length;
  const marked = monthAtt.length;
  const pct = marked > 0 ? Math.round(((pCount + lCount) / marked) * 100) : null;

  const slips = state.slips.filter((s) => s.studentId === id).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  const lastPayment = state.payments.filter((p) => p.studentId === id && p.state !== "voided").sort((a, b) => b.date.localeCompare(a.date))[0];

  if (!student) {
    return <EmptyState icon="students" title="Student not found" message="This record may have been removed. Head back to the register." action={<Btn variant="outline" icon="chevL" onClick={() => nav("students")}>Back to Students</Btn>} />;
  }

  const setStudentStatus = (status: "active" | "archived") => {
    const students = state.students.map((s) => (s.id === id ? { ...s, status } : s));
    const activity = withActivity({ ...state, students }, `${student.name} ${status === "archived" ? "archived" : "restored to active"}.`, "student");
    patch({ students, activity });
    toast.push(status === "archived" ? "Student archived" : "Student restored");
  };

  return (
    <div>
      {/* header card */}
      <div className="card overflow-hidden mb-5 anim-fade-up">
        <div className="h-1.5" style={{ background: "linear-gradient(90deg, var(--color-ink-900), var(--color-gold-500))" }} />
        <div className="p-5 sm:p-6 flex flex-wrap gap-5 items-start">
          <Avatar name={student.name} size={64} />
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-display font-extrabold text-[22px] sm:text-[25px] text-ink-900 leading-tight">{student.name}</h1>
              <Badge tone={student.status === "active" ? "green" : "slate"} dot>{student.status === "active" ? "Active" : student.status === "inactive" ? "Inactive" : "Archived"}</Badge>
            </div>
            <p className="text-[13px] text-ink-400 mt-1">
              {student.level} · {student.grade}{student.school ? ` · ${student.school}` : ""} · joined {fmtDate(student.joiningDate, df)}
            </p>
            <div className="flex gap-1.5 mt-2.5 flex-wrap">
              {student.batchIds.map((bid) => {
                const b = state.batches.find((x) => x.id === bid);
                return b ? (
                  <span key={bid} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-600 bg-ink-50 border border-ink-100 rounded-md px-2 py-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />{b.name}
                  </span>
                ) : null;
              })}
              {student.subjects.map((s) => <span key={s} className="text-[11px] font-semibold text-ink-400 bg-white border border-ink-100 rounded-md px-2 py-1">{s}</span>)}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Btn variant="outline" icon="edit" onClick={() => setEditOpen(true)}>Edit Student</Btn>
            <Btn variant="success" icon="wallet" onClick={() => setPayOpen(true)}>Record Payment</Btn>
            <Btn variant="gold" icon="whatsapp" onClick={() => nav("slips", { studentId: student.id })}>Send Fee Slip</Btn>
            <Btn variant="ghost" icon={student.status === "archived" ? "restore" : "archive"} onClick={() => (student.status === "archived" ? setStudentStatus("active") : setArchiveAsk(true))}>
              {student.status === "archived" ? "Restore" : "Archive"}
            </Btn>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-ink-100 border-t border-ink-100">
          {[
            { k: "Monthly Fee", v: fmtMoney(student.monthlyFee, cur), tone: "text-ink-900" },
            { k: "Total Outstanding", v: fmtMoney(outstanding, cur), tone: outstanding > 0 ? "text-flame-600" : "text-mint-600" },
            { k: "Attendance (this month)", v: pct === null ? "—" : `${pct}%`, tone: "text-ink-900" },
            { k: "Last Payment", v: lastPayment ? fmtDate(lastPayment.date, df) : "None yet", tone: "text-ink-900" },
          ].map((x) => (
            <div key={x.k} className="bg-white px-5 py-3.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-400">{x.k}</div>
              <div className={`font-mono font-bold text-[15px] mt-1 tnum ${x.tone}`}>{x.v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4"><Tabs value={tab} onChange={setTab} tabs={[
        { key: "overview", label: "Overview", icon: "user" },
        { key: "attendance", label: "Attendance", icon: "attendance" },
        { key: "fees", label: "Fees & Payments", icon: "fees" },
        { key: "slips", label: "Fee Slips", icon: "slips" },
      ]} /></div>

      {/* ------- overview ------- */}
      {tab === "overview" && (
        <div className="grid lg:grid-cols-2 gap-5 anim-fade-up">
          <section className="card p-5">
            <h2 className="font-display font-bold text-[16px] text-ink-900 mb-3.5">Parent / Guardian Contacts</h2>
            {guardians.length === 0 ? (
              <EmptyState icon="phone" title="No contacts saved" message="Add a parent or guardian number to enable WhatsApp fee slips." action={<Btn size="sm" variant="outline" icon="edit" onClick={() => setEditOpen(true)}>Edit Student</Btn>} />
            ) : (
              <div className="space-y-2.5">
                {guardians.map((g) => (
                  <div key={g.id} className="flex items-center gap-3 rounded-[10px] border border-ink-100 px-3.5 py-3 hover:border-ink-200 transition-colors">
                    <span className="w-9 h-9 rounded-[9px] bg-ink-900 text-gold-300 flex items-center justify-center font-display font-bold text-[13px]">{g.name[0]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-ink-900 flex items-center gap-2">{g.name} {g.primary && <Badge tone="gold">Primary</Badge>}</div>
                      <div className="text-[11.5px] text-ink-400 tnum">{g.relation} · {g.phone}{g.notes ? ` · ${g.notes}` : ""}</div>
                    </div>
                    {g.whatsapp && (
                      <a href={waLink(g.phone, `Assalam-o-Alaikum ${g.name.split(" ")[0]}, ${state.settings.tuitionName} here.`)} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[8px] bg-[#128c5e] text-white text-[11.5px] font-bold hover:bg-[#0e7a50] transition-colors">
                        <Icon name="whatsapp" size={14} /> Chat
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => nav("slips", { studentId: student.id })} disabled={guardians.filter((g) => g.whatsapp).length === 0}
              className="mt-4 w-full h-10 rounded-[9px] border border-dashed border-mint-600/40 text-mint-700 text-[12.5px] font-bold hover:bg-mint-50 transition-colors disabled:opacity-45 disabled:pointer-events-none inline-flex items-center justify-center gap-2">
              <Icon name="slips" size={15} /> Generate & send fee slip via WhatsApp
            </button>
          </section>

          <div className="space-y-5">
            <section className="card p-5">
              <h2 className="font-display font-bold text-[16px] text-ink-900 mb-3.5">Academic Details</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                {[
                  ["Student ID", student.id.toUpperCase().replace("ST_", "TMS-")],
                  ["Level", student.level], ["Class / Grade", student.grade],
                  ["School / College", student.school || "—"], ["Date of Birth", student.dob ? fmtDate(student.dob, df) : "—"],
                  ["Gender", student.gender || "—"], ["Subjects", student.subjects.join(", ") || "—"],
                  ["Fee Due Day", student.dueDay ? String(student.dueDay) : `Inherited (${state.settings.feePolicy.dueDay})`],
                ].map(([k, v]) => (
                  <div key={k}><dt className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400">{k}</dt><dd className="font-semibold text-ink-800 mt-0.5">{v}</dd></div>
                ))}
              </dl>
            </section>
            <section className="card p-5">
              <h2 className="font-display font-bold text-[16px] text-ink-900 mb-2.5">Notes</h2>
              <p className="text-[13px] text-ink-600 leading-relaxed">{student.notes || "No notes recorded for this student yet."}</p>
            </section>
          </div>
        </div>
      )}

      {/* ------- attendance ------- */}
      {tab === "attendance" && (
        <div className="card p-5 anim-fade-up">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-display font-bold text-[16px] text-ink-900">Attendance — {periodLabel(month)}</h2>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 px-3 rounded-[9px] border border-ink-200 text-[13px] font-semibold" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
            {[
              { l: "Present", v: pCount, c: "text-mint-600" }, { l: "Late", v: lCount, c: "text-warn-600" },
              { l: "Absent", v: aCount, c: "text-flame-600" }, { l: "Leave", v: lvCount, c: "text-ink-500" },
              { l: "Attendance %", v: pct === null ? "—" : `${pct}%`, c: "text-ink-900" },
            ].map((x) => (
              <div key={x.l} className="rounded-[10px] bg-ink-50 border border-ink-100 px-3.5 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-ink-400">{x.l}</div>
                <div className={`font-mono font-bold text-[18px] tnum ${x.c}`}>{x.v}</div>
              </div>
            ))}
          </div>
          {pct !== null && <div className="mb-5"><ProgressBar value={pct} max={100} tone={pct >= 80 ? "green" : pct >= 60 ? "gold" : "red"} /></div>}
          {monthAtt.length === 0 ? (
            <p className="text-[13px] text-ink-400">No attendance recorded in {periodLabel(month)}. {student.batchIds.length > 0 ? "Open the Attendance page to mark it." : "This student is not enrolled in any batch yet."}</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[...monthAtt].sort((a, b) => b.date.localeCompare(a.date)).map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-[9px] border border-ink-100 px-3 py-2">
                  <span className="text-[12.5px] font-semibold text-ink-700 tnum">{fmtDate(a.date, df)} <span className="text-ink-300 font-normal">· {state.batches.find((b) => b.id === a.batchId)?.name.split("·")[0].trim() ?? ""}</span></span>
                  <AttBadge status={a.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------- fees ------- */}
      {tab === "fees" && (
        <div className="card overflow-hidden anim-fade-up">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <h2 className="font-display font-bold text-[16px] text-ink-900">Fee Records</h2>
            <Btn size="sm" variant="success" icon="plus" onClick={() => setPayOpen(true)}>Record Payment</Btn>
          </div>
          {recs.length === 0 ? (
            <EmptyState icon="fees" title="No fee records yet" message="Records generate automatically at the start of each fee cycle for active students." />
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-left min-w-[680px]">
                <thead><tr className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400 border-y border-ink-100 bg-ink-50/60">
                  <th className="px-5 py-2.5 font-bold">Period</th><th className="py-2.5 font-bold text-right">Charge</th><th className="py-2.5 font-bold text-right">Paid</th><th className="py-2.5 font-bold text-right">Balance</th><th className="py-2.5 font-bold">Due Date</th><th className="py-2.5 font-bold">Status</th><th className="py-2.5 pr-5 font-bold text-right">Slip</th>
                </tr></thead>
                <tbody className="divide-y divide-ink-100">
                  {recs.map((r) => {
                    const paid = paidOf(state.payments, r.id);
                    const bal = balanceOf(r, state.payments);
                    return (
                      <tr key={r.id} className="hover:bg-gold-50/40 transition-colors">
                        <td className="px-5 py-3 font-semibold text-[13px] text-ink-900">{periodLabel(r.period)}</td>
                        <td className="py-3 text-right font-mono text-[12.5px] font-semibold tnum">{fmtMoney(chargeOf(r), cur)}</td>
                        <td className="py-3 text-right font-mono text-[12.5px] text-mint-600 tnum">{fmtMoney(paid, cur)}</td>
                        <td className={`py-3 text-right font-mono text-[12.5px] font-bold tnum ${bal > 0 ? "text-flame-600" : "text-ink-300"}`}>{fmtMoney(bal, cur)}</td>
                        <td className="py-3 text-[12px] text-ink-500 tnum">{fmtDate(r.dueDate, df)}</td>
                        <td className="py-3"><FeeStatusBadge status={statusOf(r, state.payments, grace)} /></td>
                        <td className="py-3 pr-5 text-right">
                          <IconBtn name="slips" label="Open fee slip" onClick={() => nav("slips", { studentId: student.id, feeRecordId: r.id })} />
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

      {/* ------- slips ------- */}
      {tab === "slips" && (
        <div className="card p-5 anim-fade-up">
          <h2 className="font-display font-bold text-[16px] text-ink-900 mb-3.5">Generated Fee Slips</h2>
          {slips.length === 0 ? (
            <EmptyState icon="slips" title="No slips generated" message="Create a professional challan image for WhatsApp from the Fee Slips page." action={<Btn size="sm" variant="gold" icon="plus" onClick={() => nav("slips", { studentId: student.id })}>Generate Fee Slip</Btn>} />
          ) : (
            <div className="space-y-2">
              {slips.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-[10px] border border-ink-100 px-3.5 py-3">
                  <Icon name="slips" size={17} className="text-gold-600" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-ink-900">{periodLabel(s.period)} · generated {fmtDate(s.generatedAt.slice(0, 10), df)}</div>
                    <div className="text-[11.5px] text-ink-400">{s.shareTargets.length} recipient{s.shareTargets.length === 1 ? "" : "s"} selected</div>
                  </div>
                  <Badge tone={s.shareStatus === "shared" ? "green" : s.shareStatus === "ready" ? "gold" : "slate"}>
                    {s.shareStatus === "shared" ? "Shared by User" : s.shareStatus === "ready" ? "Share Ready" : "Not Shared"}
                  </Badge>
                  <Btn size="sm" variant="outline" onClick={() => nav("slips", { feeRecordId: s.feeRecordId, studentId: student.id })}>Open</Btn>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <StudentForm open={editOpen} onClose={() => setEditOpen(false)} studentId={student.id} />
      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} studentId={student.id} />
      <Confirm open={archiveAsk} onClose={() => setArchiveAsk(false)} onConfirm={() => setStudentStatus("archived")} title="Archive student?" confirmLabel="Archive Student"
        message={`${student.name} will stop appearing in attendance and new fee cycles. History is preserved and the record can be restored anytime.`} />
    </div>
  );
}
