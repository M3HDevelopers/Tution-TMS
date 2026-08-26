import React, { useEffect, useMemo, useState } from "react";
import { useNav } from "../components/Shell";
import { Avatar, Badge, Btn, Icon, PageHead, ProgressBar, TSelect, useToast } from "../components/ui";
import { absentMessage, whatsappGuardians } from "../lib/notify";
import { useStore, withActivity } from "../lib/store";
import { fmtDate, monthKeyOf, monthTitle, naturalCompare, periodLabel, timeLabel, todayISO, uid, waLink, weekdayIdx } from "../lib/utils";
import type { AttendanceStatus } from "../types";

const STATUSES: { key: AttendanceStatus; label: string; short: string; cls: string; active: string }[] = [
  { key: "present", label: "Present", short: "P", cls: "text-mint-700 border-mint-600/30", active: "bg-mint-600 text-white border-mint-600" },
  { key: "late", label: "Late", short: "L", cls: "text-warn-700 border-warn-600/30", active: "bg-warn-600 text-white border-warn-600" },
  { key: "absent", label: "Absent", short: "A", cls: "text-flame-700 border-flame-600/30", active: "bg-flame-600 text-white border-flame-600" },
  { key: "leave", label: "Leave", short: "Lv", cls: "text-ink-500 border-ink-200", active: "bg-ink-700 text-white border-ink-700" },
];

export default function Attendance() {
  const { state, patch } = useStore();
  const { route } = useNav();
  const toast = useToast();
  const df = state.settings.dateFormat;

  const [date, setDate] = useState(route.params?.date ?? todayISO());
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [summaryMonth, setSummaryMonth] = useState(monthKeyOf(todayISO()));
  const [summaryClass, setSummaryClass] = useState("all");
  const [sentAbs, setSentAbs] = useState<Record<string, boolean>>({});

  const wd = weekdayIdx(date);
  const allHoliday = state.holidays.find((h) => h.date === date && h.scope === "all");
  const weeklyOff = state.settings.weeklyOffs.includes(wd);
  const classHolidays = state.holidays.filter((h) => h.date === date && h.scope === "class");
  const blocked = !!allHoliday;

  const stacks = useMemo(() => {
    const active = state.students.filter((s) => s.status === "active");
    const map = new Map<string, typeof active>();
    for (const s of active) {
      const k = s.grade || "Unassigned";
      map.set(k, [...(map.get(k) ?? []), s].sort((a, b) => a.name.localeCompare(b.name)));
    }
    return [...map.entries()].sort((a, b) => naturalCompare(a[0], b[0]));
  }, [state.students]);

  const allStudents = useMemo(() => stacks.flatMap(([, xs]) => xs), [stacks]);

  useEffect(() => {
    const d: Record<string, AttendanceStatus> = {};
    state.attendance.filter((a) => a.date === date).forEach((a) => (d[a.studentId] = a.status));
    setDraft(d);
    setSentAbs({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const markAll = (ids?: string[]) => {
    setDraft((d) => {
      const next = { ...d };
      (ids ?? allStudents.map((s) => s.id)).forEach((id) => (next[id] = "present"));
      return next;
    });
  };

  const toggle = (sid: string, st: AttendanceStatus) => {
    setDraft((d) => {
      const next = { ...d };
      if (next[sid] === st) delete next[sid];
      else next[sid] = st;
      return next;
    });
  };

  const markedCount = allStudents.filter((s) => draft[s.id]).length;
  const dirty = useMemo(() => {
    const map: Record<string, AttendanceStatus> = {};
    state.attendance.filter((a) => a.date === date).forEach((a) => (map[a.studentId] = a.status));
    if (Object.keys(map).length !== markedCount) return true;
    return Object.entries(draft).some(([k, v]) => map[k] !== v);
  }, [draft, markedCount, state.attendance, date]);

  const save = () => {
    if (blocked) return;
    const kept = state.attendance.filter((a) => a.date !== date);
    const now = new Date().toISOString();
    const added = allStudents
      .filter((s) => draft[s.id])
      .map((s) => ({ id: uid("att"), date, studentId: s.id, className: s.grade, status: draft[s.id], markedAt: now }));
    const attendance = [...kept, ...added];
    const presentN = added.filter((a) => a.status === "present" || a.status === "late").length;
    const next = { ...state, attendance };
    patch({ attendance, activity: withActivity(next, `Attendance saved for ${fmtDate(date, df)} — ${presentN}/${added.length} present.`, "attendance") });
    toast.push(`Saved · ${presentN} present, ${added.length - presentN} exceptions`);
  };

  const absentNow = allStudents.filter((s) => draft[s.id] === "absent");

  /* monthly summary */
  const classes = useMemo(() => Array.from(new Set(state.students.map((s) => s.grade))).sort(naturalCompare), [state.students]);
  const summaryRows = useMemo(() => {
    return state.students
      .filter((s) => s.status === "active" && (summaryClass === "all" || s.grade === summaryClass))
      .map((s) => {
        const recs = state.attendance.filter((a) => a.studentId === s.id && monthKeyOf(a.date) === summaryMonth);
        const p = recs.filter((r) => r.status === "present" || r.status === "late").length;
        const a = recs.filter((r) => r.status === "absent").length;
        const l = recs.filter((r) => r.status === "leave").length;
        const pct = recs.length > 0 ? Math.round((p / recs.length) * 100) : null;
        return { s, p, a, l, pct, total: recs.length };
      })
      .sort((x, y) => naturalCompare(x.s.grade, y.s.grade) || x.s.name.localeCompare(y.s.name));
  }, [state, summaryMonth, summaryClass]);

  return (
    <div>
      <PageHead title="Attendance" sub={`Tuition timing ${timeLabel(state.settings.startTime)} – ${timeLabel(state.settings.endTime)} · mark the whole room in two taps`} />

      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3 anim-fade-up">
        <label className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Date</span>
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className="h-9.5 px-3 rounded-[9px] border border-ink-200 text-[13px] font-semibold" />
        </label>
        <span className="text-[12px] text-ink-400 tnum">{fmtDate(date, df)} · {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][wd]}</span>
        <div className="flex-1" />
        {/* buttons — mobile: [Mark All | Clear] / [Save full-width], desktop: ek line */}
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center sm:gap-2.5">
          <Btn variant="outline" icon="check" onClick={() => markAll()} disabled={blocked || allStudents.length === 0}>Mark All Present</Btn>
          <Btn variant="outline" icon="x" onClick={() => setDraft({})} disabled={blocked || markedCount === 0}>Clear</Btn>
          <Btn variant="gold" icon="save" onClick={save} disabled={blocked || allStudents.length === 0 || !dirty} className="col-span-2 sm:col-span-1">Save Attendance</Btn>
        </div>
      </div>

      {blocked && (
        <div className="mb-5 rounded-[12px] border border-[#0e7490]/30 bg-[#ecf6f8] px-4 py-3.5 flex items-center gap-3 anim-fade-in">
          <Icon name="calendar" size={18} className="text-[#0e7490]" />
          <div className="flex-1">
            <p className="text-[13px] font-bold text-[#0e6b7c]">Holiday — {allHoliday!.title}</p>
            <p className="text-[12px] text-ink-500">The whole tuition is closed; nobody can be counted absent today. Remove the holiday from the Calendar page if the class met anyway.</p>
          </div>
        </div>
      )}
      {!blocked && weeklyOff && (
        <div className="mb-5 rounded-[12px] border border-warn-600/25 bg-warn-50 px-4 py-3 flex items-center gap-3 anim-fade-in">
          <Icon name="alert" size={16} className="text-warn-600" />
          <p className="text-[12.5px] text-warn-700 font-semibold">This weekday is a weekly off. You can still record attendance if a special class was held.</p>
        </div>
      )}
      {!blocked && classHolidays.length > 0 && (
        <div className="mb-5 rounded-[12px] border border-[#0e7490]/30 bg-[#ecf6f8] px-4 py-3 anim-fade-in">
          {classHolidays.map((h) => (
            <p key={h.id} className="text-[12.5px] text-[#0e6b7c] font-semibold flex items-center gap-2"><Icon name="calendar" size={14} /> {h.className}: {h.title}</p>
          ))}
        </div>
      )}

      {/* class stacks */}
      {allStudents.length === 0 ? (
        <div className="card"><p className="text-[13px] text-ink-400 px-5 py-10 text-center">No active students. Add students first — their classes stack automatically.</p></div>
      ) : (
        <div className="space-y-4">
          {stacks.map(([cls, students], gi) => {
            const classHol = classHolidays.find((h) => h.className === cls);
            const presentIn = students.filter((s) => draft[s.id] === "present" || draft[s.id] === "late").length;
            return (
              <div key={cls} className="card overflow-hidden anim-fade-up" style={{ animationDelay: `${gi * 50}ms` }}>
                <div className="px-4 sm:px-5 py-3 flex items-center gap-3 bg-ink-50/60 border-b border-ink-100">
                  <Badge tone="teal">{cls}</Badge>
                  <span className="text-[12px] font-semibold text-ink-500 tnum">{presentIn}/{students.length} present</span>
                  {classHol && <Badge tone="gold">Class holiday — {classHol.title}</Badge>}
                  <div className="flex-1" />
                  <Btn size="sm" variant="outline" icon="check" disabled={blocked} onClick={() => markAll(students.map((s) => s.id))}>All Present</Btn>
                </div>
                <div className="divide-y divide-ink-100">
                  {students.map((s) => {
                    const st = draft[s.id];
                    return (
                      <div key={s.id} className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
                        <Avatar name={s.name} size={34} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13.5px] font-semibold text-ink-900 truncate">{s.name}</div>
                          <div className="text-[11px] text-ink-400">{s.subjects && s.subjects.length ? s.subjects.join(", ") : "All subjects"}</div>
                        </div>
                        <div className="flex gap-1.5">
                          {STATUSES.map((x) => (
                            <button key={x.key} onClick={() => !blocked && toggle(s.id, x.key)} disabled={blocked} title={x.label}
                              className={`h-8 min-w-9 px-2 rounded-[8px] border text-[11.5px] font-bold transition-all duration-150 press ${st === x.key ? x.active + " shadow" : `bg-white ${x.cls} hover:border-ink-400`}`}>
                              <span className="sm:hidden">{x.short}</span><span className="hidden sm:inline">{x.label}</span>
                            </button>
                          ))}
                        </div>
                        <span className="hidden md:block w-20 text-right text-[11px] font-semibold">{st ? <span className={st === "present" ? "text-mint-600" : st === "absent" ? "text-flame-600" : st === "late" ? "text-warn-600" : "text-ink-400"}>{STATUSES.find((x) => x.key === st)?.label}</span> : <span className="text-ink-300">Not marked</span>}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="card px-5 py-3 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-ink-500 tnum">{markedCount}/{allStudents.length} marked · {Object.values(draft).filter((v) => v === "present" || v === "late").length} present</span>
            <span className={`text-[11.5px] font-bold ${dirty ? "text-gold-600" : "text-mint-600"}`}>{dirty ? "● Unsaved changes" : "✓ Up to date"}</span>
          </div>
        </div>
      )}

      {/* absent notify panel */}
      {!blocked && absentNow.length > 0 && (
        <section className="card mt-5 overflow-hidden anim-fade-up">
          <div className="px-4 py-3 bg-warn-50 border-b border-warn-600/20 flex items-center gap-3">
            <span className="w-9 h-9 rounded-[10px] bg-warn-600 text-white flex items-center justify-center shrink-0"><Icon name="bell" size={17} /></span>
            <div className="flex-1">
              <h2 className="font-display font-bold text-[15px] text-ink-900 leading-tight">Aaj absent — parents ko inform karein?</h2>
              <p className="text-[11.5px] text-ink-500 mt-0.5">{absentNow.length} student{absentNow.length > 1 ? "s" : ""} nahi aaye · bhejna aapki marzi hai · WhatsApp khulte hi "Sent" mark ho jayega</p>
            </div>
          </div>
          <div className="divide-y divide-ink-100">
            {absentNow.map((s) => {
              const wg = whatsappGuardians(state, s.id);
              return (
                <div key={s.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-bold text-ink-900 truncate">{s.name}</p>
                      <p className="text-[11px] text-ink-400 mt-0.5">{s.grade} · absent {fmtDate(date, df)}</p>
                    </div>
                    {wg.length === 0 && <span className="text-[11px] font-bold text-flame-600 bg-flame-50 border border-flame-100 rounded-[8px] px-2 py-1">No WhatsApp number</span>}
                  </div>
                  {wg.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5 pl-[48px]">
                      {wg.map((g) => {
                        const key = `${s.id}:${g.id}`;
                        const sent = !!sentAbs[key];
                        return (
                          <button key={g.id}
                            onClick={() => {
                              const w = window.open(waLink(g.phone, absentMessage(state, s)), "_blank", "noopener");
                              if (w) { setSentAbs((m) => ({ ...m, [key]: true })); toast.push(`${g.name} ko message bhej diya ✓`); }
                              else toast.push("Pop-up blocked — allow pop-ups.", "warn");
                            }}
                            disabled={sent}
                            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[11.5px] font-bold transition-all press ${sent ? "bg-mint-50 text-mint-700 border border-mint-600/30 cursor-default" : "bg-[#128c5e] text-white hover:bg-[#0e7a50]"}`}>
                            <Icon name={sent ? "check" : "whatsapp"} size={13} /> {sent ? "Sent ✓" : g.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* monthly summary */}
      <section className="card p-5 mt-8 anim-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-display font-bold text-[16.5px] text-ink-900">Monthly Summary</h2>
          <div className="flex gap-2">
            <input type="month" value={summaryMonth} onChange={(e) => setSummaryMonth(e.target.value)} className="h-9 px-3 rounded-[9px] border border-ink-200 text-[13px] font-semibold" />
            <TSelect value={summaryClass} onChange={(e) => setSummaryClass(e.target.value)} className="!w-auto min-w-40">
              <option value="all">All classes</option>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </TSelect>
          </div>
        </div>
        {summaryRows.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-ink-400">Nothing to summarise for {monthTitle(summaryMonth)}.</p>
        ) : (
          <div className="space-y-2.5">
            {summaryRows.map(({ s, p, a, l, pct, total }) => (
              <div key={s.id} className="rounded-[11px] border border-ink-100 bg-white px-3.5 py-3 hover:border-ink-200 transition-colors">
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-bold text-ink-900 truncate">{s.name} <span className="text-[11px] font-semibold text-ink-400">· {s.grade}</span></p>
                    <p className="text-[11px] text-ink-400 tnum mt-0.5">
                      <span className="text-mint-600 font-bold">{p} present</span> · <span className="text-flame-600 font-bold">{a} absent</span> · {l} leave
                      {total === 0 && <Badge tone="slate" className="ml-1.5">No records</Badge>}
                    </p>
                  </div>
                  <span className="font-mono text-[15px] font-bold text-ink-900 tnum">{pct === null ? "—" : `${pct}%`}</span>
                </div>
                <div className="mt-2.5 pl-[44px]"><ProgressBar value={pct ?? 0} max={100} tone={pct === null ? "gold" : pct >= 80 ? "green" : pct >= 60 ? "gold" : "red"} /></div>
              </div>
            ))}
          </div>
        )}
      </section>
      <span className="hidden">{periodLabel(summaryMonth)}</span>
    </div>
  );
}
