import React, { useEffect, useMemo, useState } from "react";
import { useNav } from "../components/Shell";
import { AttBadge, Avatar, Badge, Btn, Icon, PageHead, ProgressBar, TSelect, useToast } from "../components/ui";
import { useStore, withActivity } from "../lib/store";
import { fmtDate, monthKeyOf, monthTitle, periodLabel, todayISO, uid, weekdayIdx } from "../lib/utils";
import type { AttendanceStatus } from "../types";

const STATUSES: { key: AttendanceStatus; label: string; short: string; cls: string; active: string }[] = [
  { key: "present", label: "Present", short: "P", cls: "text-mint-700 border-mint-600/30", active: "bg-mint-600 text-white border-mint-600" },
  { key: "late", label: "Late", short: "L", cls: "text-warn-700 border-warn-600/30", active: "bg-warn-600 text-white border-warn-600" },
  { key: "absent", label: "Absent", short: "A", cls: "text-flame-700 border-flame-600/30", active: "bg-flame-600 text-white border-flame-600" },
  { key: "leave", label: "Leave", short: "Lv", cls: "text-ink-500 border-ink-200", active: "bg-ink-700 text-white border-ink-700" },
];

export default function Attendance() {
  const { state, patch } = useStore();
  const { route, nav } = useNav();
  const toast = useToast();
  const df = state.settings.dateFormat;

  const [date, setDate] = useState(route.params?.date ?? todayISO());
  const [batchId, setBatchId] = useState<string>(route.params?.batch ?? state.batches.find((b) => b.status === "active")?.id ?? "all");
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [summaryMonth, setSummaryMonth] = useState(monthKeyOf(todayISO()));
  const [summaryBatch, setSummaryBatch] = useState("all");

  const wd = weekdayIdx(date);
  const allHoliday = state.holidays.find((h) => h.date === date && h.scope === "all");
  const weeklyOff = state.settings.weeklyOffs.includes(wd);
  const batchHoliday = batchId !== "all" ? state.holidays.find((h) => h.date === date && h.scope === "batch" && h.batchId === batchId) : undefined;
  const blocked = !!allHoliday;

  const students = useMemo(() => {
    const list = state.students.filter((s) => s.status === "active" && (batchId === "all" || s.batchIds.includes(batchId)));
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [state.students, batchId]);

  // hydrate draft whenever date/batch changes
  useEffect(() => {
    const d: Record<string, AttendanceStatus> = {};
    state.attendance
      .filter((a) => a.date === date && (batchId === "all" || a.batchId === batchId))
      .forEach((a) => (d[a.studentId] = a.status));
    setDraft(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, batchId]);

  const markAllPresent = () => {
    const d: Record<string, AttendanceStatus> = {};
    students.forEach((s) => (d[s.id] = "present"));
    setDraft(d);
  };

  const toggle = (sid: string, st: AttendanceStatus) => {
    setDraft((d) => {
      const next = { ...d };
      if (next[sid] === st) delete next[sid];
      else next[sid] = st;
      return next;
    });
  };

  const markedCount = Object.keys(draft).length;
  const dirty = useMemo(() => {
    const existing = state.attendance.filter((a) => a.date === date && (batchId === "all" || a.batchId === batchId));
    const map: Record<string, AttendanceStatus> = {};
    existing.forEach((a) => (map[a.studentId] = a.status));
    if (Object.keys(map).length !== markedCount) return true;
    return Object.entries(draft).some(([k, v]) => map[k] !== v);
  }, [draft, markedCount, state.attendance, date, batchId]);

  const save = () => {
    if (blocked) return;
    const kept = state.attendance.filter((a) => !(a.date === date && (batchId === "all" || a.batchId === batchId) && students.some((s) => s.id === a.studentId)));
    const now = new Date().toISOString();
    const added = students
      .filter((s) => draft[s.id])
      .map((s) => ({ id: uid("att"), date, studentId: s.id, batchId: batchId === "all" ? s.batchIds[0] ?? null : batchId, status: draft[s.id], markedAt: now }));
    const attendance = [...kept, ...added];
    const presentN = added.filter((a) => a.status === "present" || a.status === "late").length;
    const activity = withActivity(
      { ...state, attendance },
      `Attendance saved for ${fmtDate(date, df)}${batchId !== "all" ? ` (${state.batches.find((b) => b.id === batchId)?.name ?? ""})` : ""} — ${presentN}/${added.length} present.`,
      "attendance"
    );
    patch({ attendance, activity });
    toast.push(`Attendance saved · ${presentN} present, ${added.length - presentN} exceptions`);
  };

  /* ---------- monthly summary ---------- */
  const summaryStudents = useMemo(() => {
    return state.students
      .filter((s) => s.status === "active" && (summaryBatch === "all" || s.batchIds.includes(summaryBatch)))
      .map((s) => {
        const recs = state.attendance.filter((a) => a.studentId === s.id && monthKeyOf(a.date) === summaryMonth && (summaryBatch === "all" || a.batchId === summaryBatch));
        const p = recs.filter((r) => r.status === "present").length;
        const l = recs.filter((r) => r.status === "late").length;
        const a = recs.filter((r) => r.status === "absent").length;
        const lv = recs.filter((r) => r.status === "leave").length;
        const pct = recs.length > 0 ? Math.round(((p + l) / recs.length) * 100) : null;
        return { s, p, l, a, lv, pct, total: recs.length };
      })
      .sort((x, y) => x.s.name.localeCompare(y.s.name));
  }, [state, summaryMonth, summaryBatch]);

  return (
    <div>
      <PageHead title="Attendance" sub="Select a date, pick the batch, mark all present, then fix the exceptions" />

      {/* day controls */}
      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3 anim-fade-up">
        <label className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Date</span>
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className="h-9.5 px-3 rounded-[9px] border border-ink-200 text-[13px] font-semibold" />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Batch</span>
          <TSelect value={batchId} onChange={(e) => setBatchId(e.target.value)} className="!w-auto min-w-44">
            <option value="all">All students</option>
            {state.batches.filter((b) => b.status === "active").map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </TSelect>
        </label>
        <span className="text-[12px] text-ink-400 tnum">{fmtDate(date, df)} · {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][wd]}</span>
        <div className="flex-1" />
        <Btn variant="outline" size="md" icon="check" onClick={markAllPresent} disabled={blocked || students.length === 0}>Mark All Present</Btn>
        <Btn variant="outline" size="md" icon="x" onClick={() => setDraft({})} disabled={blocked || markedCount === 0}>Clear</Btn>
        <Btn variant="gold" icon="save" onClick={save} disabled={blocked || students.length === 0 || !dirty}>Save Attendance</Btn>
      </div>

      {/* holiday notices */}
      {blocked && (
        <div className="mb-5 rounded-[12px] border border-[#0e7490]/30 bg-[#ecf6f8] px-4 py-3.5 flex items-center gap-3 anim-fade-in">
          <Icon name="calendar" size={18} className="text-[#0e7490]" />
          <div className="flex-1">
            <p className="text-[13px] font-bold text-[#0e6b7c]">Holiday — {allHoliday!.title}</p>
            <p className="text-[12px] text-ink-500">{allHoliday!.reason || "Whole tuition centre is closed."} Attendance marking is blocked so nobody is counted absent. You can remove the holiday from the Calendar page.</p>
          </div>
          <Btn size="sm" variant="outline" onClick={() => nav("calendar")}>Open Calendar</Btn>
        </div>
      )}
      {!blocked && weeklyOff && (
        <div className="mb-5 rounded-[12px] border border-warn-600/25 bg-warn-50 px-4 py-3 flex items-center gap-3 anim-fade-in">
          <Icon name="alert" size={16} className="text-warn-600" />
          <p className="text-[12.5px] text-warn-700 font-semibold">This weekday is a weekly off. You can still record attendance if a special class was held.</p>
        </div>
      )}
      {!blocked && batchHoliday && (
        <div className="mb-5 rounded-[12px] border border-[#0e7490]/30 bg-[#ecf6f8] px-4 py-3 flex items-center gap-3 anim-fade-in">
          <Icon name="calendar" size={16} className="text-[#0e7490]" />
          <p className="text-[12.5px] text-[#0e6b7c] font-semibold">Batch holiday — {batchHoliday.title}. Marking is still available in case the class met anyway.</p>
        </div>
      )}

      {/* marking list */}
      <div className="card overflow-hidden mb-8 anim-fade-up" style={{ animationDelay: "70ms" }}>
        {students.length === 0 ? (
          <p className="text-[13px] text-ink-400 px-5 py-10 text-center">No active students in this selection. Enrol students into a batch first.</p>
        ) : (
          <div className="divide-y divide-ink-100">
            {students.map((s, i) => {
              const st = draft[s.id];
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 sm:px-5 py-2.5 anim-fade-up" style={{ animationDelay: `${Math.min(i * 25, 300)}ms` }}>
                  <Avatar name={s.name} size={34} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold text-ink-900 truncate">{s.name}</div>
                    <div className="text-[11px] text-ink-400">{s.grade}{batchId === "all" && s.batchIds.length > 0 ? ` · ${state.batches.find((b) => b.id === s.batchIds[0])?.name.split("·")[0].trim() ?? ""}` : ""}</div>
                  </div>
                  <div className="flex gap-1.5">
                    {STATUSES.map((x) => (
                      <button key={x.key} onClick={() => !blocked && toggle(s.id, x.key)} disabled={blocked} title={x.label}
                        className={`h-8 min-w-9 px-2 rounded-[8px] border text-[11.5px] font-bold transition-all duration-150 press ${st === x.key ? x.active + " shadow" : `bg-white ${x.cls} hover:border-ink-400`}`}>
                        <span className="sm:hidden">{x.short}</span><span className="hidden sm:inline">{x.label}</span>
                      </button>
                    ))}
                  </div>
                  <span className="hidden md:block w-24 text-right">{st ? <AttBadge status={st} /> : <span className="text-[11px] text-ink-300 font-semibold">Not marked</span>}</span>
                </div>
              );
            })}
          </div>
        )}
        {students.length > 0 && (
          <div className="px-5 py-3 bg-ink-50/70 border-t border-ink-100 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-ink-500 tnum">{markedCount}/{students.length} marked · present {Object.values(draft).filter((v) => v === "present" || v === "late").length}</span>
            <span className={`text-[11.5px] font-bold ${dirty ? "text-gold-600" : "text-mint-600"}`}>{dirty ? "● Unsaved changes" : "✓ Up to date"}</span>
          </div>
        )}
      </div>

      {/* monthly summary */}
      <section className="card p-5 anim-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-display font-bold text-[16.5px] text-ink-900">Monthly Summary</h2>
          <div className="flex gap-2">
            <input type="month" value={summaryMonth} onChange={(e) => setSummaryMonth(e.target.value)} className="h-9 px-3 rounded-[9px] border border-ink-200 text-[13px] font-semibold" />
            <TSelect value={summaryBatch} onChange={(e) => setSummaryBatch(e.target.value)} className="!w-auto min-w-40">
              <option value="all">All batches</option>
              {state.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </TSelect>
          </div>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-left min-w-[640px]">
            <thead><tr className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400 border-b border-ink-100">
              <th className="py-2 font-bold">Student</th><th className="py-2 font-bold text-center">Present</th><th className="py-2 font-bold text-center">Late</th><th className="py-2 font-bold text-center">Absent</th><th className="py-2 font-bold text-center">Leave</th><th className="py-2 font-bold w-56">Attendance</th>
            </tr></thead>
            <tbody className="divide-y divide-ink-100">
              {summaryStudents.map(({ s, p, l, a, lv, pct, total }) => (
                <tr key={s.id} className="hover:bg-gold-50/40 transition-colors">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2.5"><Avatar name={s.name} size={28} /><span className="text-[13px] font-semibold text-ink-900">{s.name}</span>
                      {total === 0 && <Badge tone="slate">No records</Badge>}
                    </div>
                  </td>
                  <td className="py-2.5 text-center font-mono text-[12.5px] font-semibold text-mint-600 tnum">{p}</td>
                  <td className="py-2.5 text-center font-mono text-[12.5px] font-semibold text-warn-600 tnum">{l}</td>
                  <td className="py-2.5 text-center font-mono text-[12.5px] font-semibold text-flame-600 tnum">{a}</td>
                  <td className="py-2.5 text-center font-mono text-[12.5px] text-ink-400 tnum">{lv}</td>
                  <td className="py-2.5 pr-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><ProgressBar value={pct ?? 0} max={100} tone={pct === null ? "gold" : pct >= 80 ? "green" : pct >= 60 ? "gold" : "red"} /></div>
                      <span className="font-mono text-[11.5px] font-bold text-ink-700 w-10 text-right tnum">{pct === null ? "—" : `${pct}%`}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {summaryStudents.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[13px] text-ink-400">Nothing to summarise for {monthTitle(summaryMonth)}.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
