import React, { useMemo, useState } from "react";
import { Badge, Btn, Confirm, Field, Icon, IconBtn, Modal, PageHead, TInput, TSelect, useToast } from "../components/ui";
import { useStore, withActivity } from "../lib/store";
import { fmtDate, pad2, parseISO, todayISO, toISO, uid, weekdayIdx } from "../lib/utils";
import { WEEKDAYS } from "../types";
import type { Holiday } from "../types";

export default function CalendarPage() {
  const { state, patch } = useStore();
  const toast = useToast();
  const df = state.settings.dateFormat;
  const today = todayISO();

  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [dayModal, setDayModal] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState<"all" | "batch">("all");
  const [batchId, setBatchId] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [removeAsk, setRemoveAsk] = useState<Holiday | null>(null);

  const firstDay = new Date(cursor.y, cursor.m, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const monthName = firstDay.toLocaleString("en", { month: "long" });

  const cells = useMemo(() => {
    const arr: (string | null)[] = [];
    for (let i = 0; i < startOffset; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(`${cursor.y}-${pad2(cursor.m + 1)}-${pad2(d)}`);
    return arr;
  }, [startOffset, daysInMonth, cursor]);

  const holidaysFor = (date: string) => state.holidays.filter((h) => h.date === date);

  const openDay = (date: string) => {
    setDayModal(date); setTitle(""); setScope("all"); setBatchId(state.batches[0]?.id ?? ""); setReason(""); setErr("");
  };

  const addHoliday = () => {
    if (!dayModal) return;
    if (!title.trim()) return setErr("Give the holiday a name — e.g. Eid, illness, personal work.");
    const h: Holiday = { id: uid("hol"), date: dayModal, scope, batchId: scope === "batch" ? batchId : undefined, title: title.trim(), reason: reason.trim() || undefined };
    const holidays = [...state.holidays, h];
    const past = dayModal < today;
    patch({ holidays, activity: withActivity({ ...state, holidays }, `Holiday added — ${h.title} on ${fmtDate(dayModal, df)} (${h.scope === "all" ? "whole centre" : "batch"}).`, "system") });
    toast.push(past ? "Holiday added to a past date — absences on that day will not count" : "Holiday added");
    setDayModal(null);
  };

  const removeHoliday = (h: Holiday) => {
    const holidays = state.holidays.filter((x) => x.id !== h.id);
    patch({ holidays, activity: withActivity({ ...state, holidays }, `Holiday removed — ${h.title} on ${fmtDate(h.date, df)}.`, "system") });
    toast.push("Holiday removed", "warn");
  };

  const setWeeklyOff = (day: number) => {
    const offs = state.settings.weeklyOffs.includes(day)
      ? state.settings.weeklyOffs.filter((d) => d !== day)
      : [...state.settings.weeklyOffs, day].sort();
    const settings = { ...state.settings, weeklyOffs: offs };
    patch({ settings, activity: withActivity({ ...state, settings }, `Weekly off updated: ${offs.map((d) => WEEKDAYS[d]).join(", ") || "none"}.`, "system") });
    toast.push("Weekly off days saved");
  };

  const upcoming = [...state.holidays].sort((a, b) => a.date.localeCompare(b.date)).filter((h) => h.date >= today).slice(0, 6);

  return (
    <div>
      <PageHead title="Calendar & Holidays" sub="Weekly offs and one-off holidays are excluded from attendance automatically" />

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-5 items-start">
        {/* calendar */}
        <section className="card p-5 anim-fade-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-extrabold text-[20px] text-ink-900">{monthName} {cursor.y}</h2>
            <div className="flex gap-1.5">
              <IconBtn name="chevL" label="Previous month" onClick={() => setCursor((c) => { const d = new Date(c.y, c.m - 1, 1); return { y: d.getFullYear(), m: d.getMonth() }; })} className="border border-ink-100" />
              <Btn size="sm" variant="outline" onClick={() => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }); }}>Today</Btn>
              <IconBtn name="chevR" label="Next month" onClick={() => setCursor((c) => { const d = new Date(c.y, c.m + 1, 1); return { y: d.getFullYear(), m: d.getMonth() }; })} className="border border-ink-100" />
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {WEEKDAYS.map((d, i) => (
              <button key={d} onClick={() => setWeeklyOff(i)} title={`Toggle weekly off: ${d}`}
                className={`h-7 rounded-md text-[10.5px] font-bold tracking-wide transition-colors ${state.settings.weeklyOffs.includes(i) ? "bg-ink-900 text-gold-400" : "text-ink-400 hover:bg-ink-100"}`}>
                {d}{state.settings.weeklyOffs.includes(i) ? " · off" : ""}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((date, i) => {
              if (!date) return <div key={`x${i}`} />;
              const wd = weekdayIdx(date);
              const weekly = state.settings.weeklyOffs.includes(wd);
              const hols = holidaysFor(date);
              const isToday = date === today;
              const isPast = date < today;
              return (
                <button key={date} onClick={() => openDay(date)}
                  className={`relative min-h-[74px] rounded-[9px] border p-1.5 text-left transition-all hover:border-gold-500 hover:shadow-sm group ${isToday ? "border-gold-500 ring-2 ring-gold-500/25 bg-gold-50/50" : weekly ? "border-ink-100 bg-ink-50/80" : "border-ink-100 bg-white hover:bg-gold-50/30"} ${isPast ? "opacity-75" : ""}`}>
                  <span className={`text-[12px] font-bold tnum ${isToday ? "text-gold-600" : weekly ? "text-ink-300" : "text-ink-700"}`}>{parseISO(date).getDate()}</span>
                  <span className="block mt-1 space-y-0.5">
                    {weekly && <span className="block text-[9px] font-bold uppercase tracking-wide text-ink-300">Weekly off</span>}
                    {hols.slice(0, 2).map((h) => (
                      <span key={h.id} className={`block truncate text-[9.5px] font-bold rounded px-1 py-0.5 ${h.scope === "all" ? "bg-[#0e7490]/12 text-[#0e6b7c]" : "bg-gold-100 text-gold-700"}`}>{h.title}</span>
                    ))}
                  </span>
                  <span className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 text-gold-600 transition-opacity"><Icon name="plus" size={12} /></span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 mt-4 text-[11px] font-semibold text-ink-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-ink-50 border border-ink-200" /> Weekly off (click weekday header to toggle)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#0e7490]/20" /> Centre holiday</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gold-100" /> Batch holiday</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-gold-500" /> Today</span>
          </div>
        </section>

        {/* side lists */}
        <div className="space-y-5">
          <section className="card p-5 anim-fade-up" style={{ animationDelay: "80ms" }}>
            <h2 className="font-display font-bold text-[16px] text-ink-900 mb-3">Upcoming Holidays</h2>
            {upcoming.length === 0 ? (
              <p className="text-[12.5px] text-ink-400">No one-off holidays scheduled. Click any date on the calendar to add one.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 rounded-[10px] border border-ink-100 px-3.5 py-2.5">
                    <div className="w-10 text-center shrink-0">
                      <div className="font-mono font-bold text-[16px] text-ink-900 tnum leading-none">{parseISO(h.date).getDate()}</div>
                      <div className="text-[9px] font-bold uppercase text-ink-400 mt-0.5">{parseISO(h.date).toLocaleString("en", { month: "short" })}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-ink-900 truncate">{h.title}</div>
                      <div className="text-[11px] text-ink-400">{h.scope === "all" ? "Whole centre" : `Batch: ${state.batches.find((b) => b.id === h.batchId)?.name ?? ""}`}{h.reason ? ` · ${h.reason}` : ""}</div>
                    </div>
                    <IconBtn name="trash" label="Remove holiday" onClick={() => setRemoveAsk(h)} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5 anim-fade-up" style={{ animationDelay: "140ms" }}>
            <h2 className="font-display font-bold text-[16px] text-ink-900 mb-3">Weekly Off Days</h2>
            <div className="flex gap-1.5 flex-wrap">
              {WEEKDAYS.map((d, i) => {
                const on = state.settings.weeklyOffs.includes(i);
                return (
                  <button key={d} onClick={() => setWeeklyOff(i)} className={`w-12 h-9 rounded-[8px] border text-[11.5px] font-bold transition-all ${on ? "bg-ink-900 text-gold-400 border-ink-900" : "bg-white text-ink-400 border-ink-200 hover:border-ink-400"}`}>{d}</button>
                );
              })}
            </div>
            <p className="text-[11.5px] text-ink-400 mt-3 leading-relaxed">Attendance is blocked on centre-wide holidays, so absent counts are never polluted by closed days.</p>
          </section>

          <section className="card p-5 anim-fade-up" style={{ animationDelay: "200ms" }}>
            <h2 className="font-display font-bold text-[16px] text-ink-900 mb-3">All Recorded Holidays</h2>
            <div className="space-y-1.5 max-h-64 overflow-y-auto scroll-thin">
              {[...state.holidays].sort((a, b) => b.date.localeCompare(a.date)).map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-2 text-[12px] py-1 border-b border-dashed border-ink-100 last:border-0">
                  <span className="font-semibold text-ink-700">{h.title}</span>
                  <span className="text-ink-400 tnum shrink-0">{fmtDate(h.date, df)} · {h.scope === "all" ? "centre" : "batch"}</span>
                </div>
              ))}
              {state.holidays.length === 0 && <p className="text-[12.5px] text-ink-400">None yet.</p>}
            </div>
          </section>
        </div>
      </div>

      {/* add holiday modal */}
      <Modal open={!!dayModal} onClose={() => setDayModal(null)} title={dayModal ? `Holiday on ${fmtDate(dayModal, df)}` : ""} sub={dayModal && dayModal < today ? "This date is in the past — attendance on it will be excluded retroactively." : "Attendance marking will be blocked for this day."}
        footer={<>
          <Btn variant="outline" onClick={() => setDayModal(null)}>Cancel</Btn>
          <Btn variant="gold" icon="calendar" onClick={addHoliday}>Add Holiday</Btn>
        </>}>
        <div className="space-y-4">
          {dayModal && holidaysFor(dayModal).length > 0 && (
            <div className="rounded-[10px] bg-ink-50 border border-ink-100 px-3.5 py-2.5 space-y-1.5">
              {holidaysFor(dayModal).map((h) => (
                <div key={h.id} className="flex items-center justify-between text-[12.5px]">
                  <span className="font-semibold text-ink-800">{h.title} <Badge tone={h.scope === "all" ? "teal" : "gold"}>{h.scope === "all" ? "Centre" : "Batch"}</Badge></span>
                  <IconBtn name="trash" label="Remove" onClick={() => setRemoveAsk(h)} />
                </div>
              ))}
            </div>
          )}
          <Field label="Title" required error={err}>
            <TInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Eid, fever at home, family function" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Applies To">
              <TSelect value={scope} onChange={(e) => setScope(e.target.value as "all" | "batch")}>
                <option value="all">Whole tuition centre</option>
                <option value="batch">One batch only</option>
              </TSelect>
            </Field>
            {scope === "batch" && (
              <Field label="Batch">
                <TSelect value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                  {state.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </TSelect>
              </Field>
            )}
          </div>
          <Field label="Reason (optional)"><TInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Shown on the calendar" /></Field>
        </div>
      </Modal>

      <Confirm open={!!removeAsk} onClose={() => setRemoveAsk(null)} onConfirm={() => removeAsk && removeHoliday(removeAsk)} title="Remove holiday?" confirmLabel="Remove"
        message={removeAsk ? `“${removeAsk.title}” on ${fmtDate(removeAsk.date, df)} will be removed. If the class actually met, you can mark attendance for that date afterwards.` : ""} />
    </div>
  );
}
