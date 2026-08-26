import React, { useMemo, useState } from "react";
import { Badge, Btn, Confirm, Icon, PageHead, TInput, TSelect, useToast } from "../components/ui";
import { useStore, withActivity } from "../lib/store";
import { WEEKDAYS, WEEKDAYS_S, fmtDate, monthKeyOf, naturalCompare, pad2, periodLabel, shiftPeriod, timeLabel, todayISO, uid, weekdayIdx } from "../lib/utils";
import type { HolidayScope } from "../types";

export default function CalendarPage() {
  const { state, patch } = useStore();
  const toast = useToast();
  const df = state.settings.dateFormat;
  const today = todayISO();
  const [month, setMonth] = useState(monthKeyOf(today));
  const [selected, setSelected] = useState(today);

  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState<HolidayScope>("all");
  const [className, setClassName] = useState("");
  const [err, setErr] = useState("");
  const [delAsk, setDelAsk] = useState<string | null>(null);

  const classes = useMemo(() => Array.from(new Set(state.students.map((s) => s.grade))).sort(naturalCompare), [state.students]);

  const cells = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const dim = new Date(y, m, 0).getDate();
    const out: { date: string; day: number }[] = [];
    for (let i = 0; i < first.getDay(); i++) out.push({ date: "", day: 0 });
    for (let d = 1; d <= dim; d++) out.push({ date: `${month}-${pad2(d)}`, day: d });
    return out;
  }, [month]);

  const holidaysOn = (date: string) => state.holidays.filter((h) => h.date === date);

  const addHoliday = () => {
    if (!title.trim()) { setErr("Give the holiday a name — e.g. Eid, Personal work."); return; }
    if (scope === "class" && !className) { setErr("Pick which class this holiday applies to."); return; }
    setErr("");
    const h = { id: uid("hol"), date: selected, scope, className: scope === "class" ? className : undefined, title: title.trim(), reason: reason.trim() || undefined };
    const holidays = [...state.holidays, h];
    patch({ holidays, activity: withActivity({ ...state, holidays }, `Holiday added — ${h.title} on ${fmtDate(selected, df)}${scope === "class" ? ` (${className} only)` : " (whole tuition)"}.`, "settings") });
    setTitle(""); setReason("");
    toast.push("Holiday added — attendance is protected on this day");
  };

  const removeHoliday = (id: string) => {
    const h = state.holidays.find((x) => x.id === id);
    const holidays = state.holidays.filter((x) => x.id !== id);
    patch({ holidays, activity: withActivity({ ...state, holidays }, `Holiday removed — ${h?.title} (${fmtDate(h?.date ?? "", df)}).`, "settings") });
    toast.push("Holiday removed");
  };

  const toggleOff = (d: number) => {
    const weeklyOffs = state.settings.weeklyOffs.includes(d)
      ? state.settings.weeklyOffs.filter((x) => x !== d)
      : [...state.settings.weeklyOffs, d].sort();
    const settings = { ...state.settings, weeklyOffs };
    patch({ settings, activity: withActivity({ ...state, settings }, `Weekly off updated: ${weeklyOffs.map((x) => WEEKDAYS[x]).join(", ") || "none"}.`, "settings") });
    toast.push("Weekly off days updated");
  };

  const selHols = holidaysOn(selected);
  const selOff = state.settings.weeklyOffs.includes(weekdayIdx(selected));

  return (
    <div>
      <PageHead title="Calendar & Holidays" sub="Tap any day to add a holiday — attendance marking is automatically blocked on those days" />

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5">
        {/* calendar */}
        <div className="card p-5 anim-fade-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setMonth(shiftPeriod(month, -1))} className="w-8 h-8 rounded-[8px] border border-ink-200 bg-white flex items-center justify-center text-ink-600 hover:border-ink-400" aria-label="Previous month"><Icon name="chevL" size={15} /></button>
              <h2 className="font-display font-bold text-[17px] text-ink-900 w-44 text-center">{periodLabel(month)}</h2>
              <button onClick={() => setMonth(shiftPeriod(month, 1))} className="w-8 h-8 rounded-[8px] border border-ink-200 bg-white flex items-center justify-center text-ink-600 hover:border-ink-400" aria-label="Next month"><Icon name="chevR" size={15} /></button>
            </div>
            <button onClick={() => { setMonth(monthKeyOf(today)); setSelected(today); }} className="text-[12px] font-bold text-ink-500 hover:text-ink-900">Today</button>
          </div>

          {/* weekly offs */}
          <div className="mb-4 rounded-[10px] bg-ink-50/70 border border-ink-100 px-3.5 py-2.5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mr-1">Weekly off:</span>
            {WEEKDAYS_S.map((d, i) => {
              const on = state.settings.weeklyOffs.includes(i);
              return (
                <button key={d} onClick={() => toggleOff(i)} className={`h-7 px-2.5 rounded-[7px] text-[11.5px] font-bold transition-colors ${on ? "bg-ink-900 text-gold-300" : "bg-white border border-ink-200 text-ink-400 hover:border-ink-400"}`}>{d}</button>
              );
            })}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS_S.map((d) => <div key={d} className="text-center text-[10.5px] font-bold uppercase tracking-wider text-ink-400 py-1">{d}</div>)}
            {cells.map((c, i) => {
              if (c.day === 0) return <div key={`e${i}`} />;
              const hols = holidaysOn(c.date);
              const off = state.settings.weeklyOffs.includes(weekdayIdx(c.date));
              const isSel = c.date === selected;
              const isToday = c.date === today;
              return (
                <button key={c.date} onClick={() => setSelected(c.date)}
                  className={`relative h-14 sm:h-16 rounded-[9px] border flex flex-col items-center justify-center gap-0.5 transition-all duration-150 press
                    ${isSel ? "border-gold-500 ring-2 ring-gold-500/30 shadow" : "hover:border-ink-300"}
                    ${hols.length ? "border-[#0e7490]/50 bg-[#ecf6f8]" : off ? "border-ink-100 bg-ink-50/70" : "border-ink-100 bg-white"}
                    ${isToday ? "border-ink-900" : ""}`}>
                  <span className={`text-[13px] font-bold tnum ${hols.length ? "text-[#0e6b7c]" : isToday ? "text-white" : "text-ink-700"}`}>
                    {isToday ? <span className="inline-flex w-6 h-6 rounded-full bg-ink-900 items-center justify-center">{c.day}</span> : c.day}
                  </span>
                  {hols.length > 0 && <span className="text-[8px] font-extrabold tracking-wide text-[#0e6b7c] uppercase truncate max-w-full px-1">{hols[0].title}</span>}
                  {hols.length === 0 && off && <span className="text-[8px] font-bold text-ink-300">OFF</span>}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-[11px] font-semibold text-ink-500 flex-wrap">
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] bg-[#ecf6f8] border border-[#0e7490]/50" /> Holiday</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] bg-ink-100 border border-ink-100" /> Weekly off</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] border-2 border-ink-900" /> Today</span>
          </div>
        </div>

        {/* day panel */}
        <div className="space-y-4 self-start">
          <div className="card p-5 anim-fade-up" style={{ animationDelay: "70ms" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-[16px] text-ink-900">{fmtDate(selected, df)}</h2>
              {selOff && <Badge tone="slate">Weekly off</Badge>}
            </div>

            {selHols.length > 0 && (
              <div className="space-y-2 mb-4">
                {selHols.map((h) => (
                  <div key={h.id} className="rounded-[10px] border border-[#0e7490]/30 bg-[#ecf6f8] px-3.5 py-2.5 flex items-start gap-2.5 anim-fade-in">
                    <Icon name="calendar" size={15} className="text-[#0e6b7c] mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[#0e6b7c]">{h.title} <Badge tone={h.scope === "all" ? "teal" : "gold"} className="ml-1">{h.scope === "all" ? "Whole tuition" : h.className}</Badge></p>
                      {h.reason && <p className="text-[11.5px] text-ink-500 mt-0.5">{h.reason}</p>}
                    </div>
                    <button onClick={() => setDelAsk(h.id)} className="text-ink-400 hover:text-flame-600" aria-label="Remove holiday"><Icon name="trash" size={15} /></button>
                  </div>
                ))}
              </div>
            )}

            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400 mb-2.5">Add a holiday on this day</h3>
            <div className="space-y-3">
              <TInput placeholder="Title — e.g. Eid, Sick leave, Personal work" value={title} onChange={(e) => setTitle(e.target.value)} />
              <TInput placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="grid grid-cols-2 gap-2.5">
                <TSelect value={scope} onChange={(e) => setScope(e.target.value as HolidayScope)}>
                  <option value="all">Whole tuition</option>
                  <option value="class">One class only</option>
                </TSelect>
                {scope === "class" ? (
                  <TSelect value={className} onChange={(e) => setClassName(e.target.value)}>
                    <option value="">Pick class…</option>
                    {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                  </TSelect>
                ) : (
                  <div className="h-9.5 px-3 rounded-[9px] border border-dashed border-ink-200 flex items-center text-[12px] text-ink-400">Everyone stays home</div>
                )}
              </div>
              {err && <p className="text-[12px] font-semibold text-flame-600 anim-fade-in">{err}</p>}
              <Btn variant="gold" icon="plus" className="w-full" onClick={addHoliday}>Add Holiday</Btn>
              {selected < today && <p className="text-[11px] text-warn-700 font-semibold flex items-center gap-1.5"><Icon name="alert" size={12} /> Past date — useful for correcting old records.</p>}
            </div>
          </div>

          <div className="card p-5 anim-fade-up" style={{ animationDelay: "120ms" }}>
            <h3 className="font-display font-bold text-[14.5px] text-ink-900 mb-2.5">Upcoming holidays</h3>
            {state.holidays.filter((h) => h.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5).map((h) => (
              <div key={h.id} className="flex items-center gap-2.5 py-1.5">
                <span className="font-mono text-[11.5px] font-bold text-ink-900 w-20 tnum">{fmtDate(h.date, df).slice(0, 6)}</span>
                <span className="text-[12.5px] font-semibold text-ink-700 flex-1 truncate">{h.title}</span>
                <Badge tone={h.scope === "all" ? "teal" : "gold"}>{h.scope === "all" ? "All" : h.className}</Badge>
              </div>
            ))}
            {state.holidays.filter((h) => h.date >= today).length === 0 && <p className="text-[12.5px] text-ink-400">Nothing planned.</p>}
            <p className="text-[11px] text-ink-400 mt-3 pt-3 border-t border-ink-100">Regular timing: <b className="text-ink-700 tnum">{timeLabel(state.settings.startTime)} – {timeLabel(state.settings.endTime)}</b></p>
          </div>
        </div>
      </div>

      <Confirm open={!!delAsk} onClose={() => setDelAsk(null)} onConfirm={() => delAsk && removeHoliday(delAsk)} title="Remove this holiday?" confirmLabel="Remove Holiday"
        message="Attendance can again be marked for this day. If it is a past date, students may need to be marked manually." />
    </div>
  );
}
