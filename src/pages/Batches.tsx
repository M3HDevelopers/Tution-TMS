import React, { useState } from "react";
import { useNav } from "../components/Shell";
import { Badge, Btn, Confirm, EmptyState, Field, Icon, IconBtn, Modal, PageHead, TInput, TSelect, useToast } from "../components/ui";
import { useStore, withActivity } from "../lib/store";
import { fmtMoney, num, timeLabel, todayISO, uid, weekdayIdx } from "../lib/utils";
import { CLASS_LEVELS, WEEKDAYS } from "../types";
import type { Batch } from "../types";

const COLORS = ["#0e7490", "#b45309", "#4d7c0f", "#9d174d", "#33415c", "#7c2d12", "#1d4ed8"];

const blank = (): Batch => ({ id: "", name: "", level: "Primary", grade: "", subjects: [], days: [1, 2, 3, 4, 5], startTime: "16:00", endTime: "17:00", defaultFee: undefined, capacity: undefined, color: COLORS[0], status: "active" });

export default function Batches() {
  const { state, patch } = useStore();
  const { nav } = useNav();
  const toast = useToast();
  const cur = state.settings.feePolicy.currency;
  const today = weekdayIdx(todayISO());

  const [form, setForm] = useState<Batch | null>(null);
  const [isNew, setIsNew] = useState(true);
  const [subjectsText, setSubjectsText] = useState("");
  const [confirmArchive, setConfirmArchive] = useState<Batch | null>(null);
  const [err, setErr] = useState("");

  const openNew = () => { setIsNew(true); setForm(blank()); setSubjectsText(""); setErr(""); };
  const openEdit = (b: Batch) => { setIsNew(false); setForm({ ...b }); setSubjectsText(b.subjects.join(", ")); setErr(""); };

  const save = () => {
    if (!form) return;
    if (!form.name.trim()) return setErr("Batch name is required.");
    if (!form.grade.trim()) return setErr("Class / grade is required.");
    if (form.days.length === 0) return setErr("Pick at least one teaching day.");
    if (form.startTime >= form.endTime) return setErr("End time must be after start time.");
    const b: Batch = { ...form, name: form.name.trim(), grade: form.grade.trim(), subjects: subjectsText.split(",").map((s) => s.trim()).filter(Boolean) };
    let batches: Batch[];
    if (isNew) {
      b.id = uid("bat");
      b.color = COLORS[state.batches.length % COLORS.length];
      batches = [...state.batches, b];
    } else {
      batches = state.batches.map((x) => (x.id === b.id ? b : x));
    }
    const activity = withActivity({ ...state, batches }, `${isNew ? "Created batch" : "Updated batch"} — ${b.name}.`, "system");
    patch({ batches, activity });
    toast.push(isNew ? "Batch created" : "Batch updated");
    setForm(null);
  };

  const toggleStatus = (b: Batch) => {
    const batches = state.batches.map((x) => (x.id === b.id ? { ...x, status: x.status === "active" ? ("inactive" as const) : ("active" as const) } : x));
    patch({ batches, activity: withActivity({ ...state, batches }, `Batch ${b.name} marked ${b.status === "active" ? "inactive" : "active"}.`, "system") });
    toast.push(b.status === "active" ? "Batch deactivated" : "Batch activated");
  };

  const memberCount = (id: string) => state.students.filter((s) => s.status === "active" && s.batchIds.includes(id)).length;

  return (
    <div>
      <PageHead title="Classes & Batches" sub="Time-slot groups that drive attendance lists and default fees" actions={<Btn variant="gold" icon="plus" onClick={openNew}>New Batch</Btn>} />

      {state.batches.length === 0 ? (
        <div className="card"><EmptyState icon="batch" title="No batches yet" message="Create your first time-slot group — e.g. 'Primary · 5 PM' — then enrol students into it." action={<Btn variant="gold" icon="plus" onClick={openNew}>New Batch</Btn>} /></div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
          {state.batches.map((b) => {
            const members = memberCount(b.id);
            const isToday = b.days.includes(today) && b.status === "active";
            return (
              <div key={b.id} className={`card card-hover overflow-hidden flex flex-col ${b.status === "inactive" ? "opacity-60" : ""}`}>
                <div className="h-1.5" style={{ background: b.color }} />
                <div className="p-4.5 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display font-bold text-[15.5px] text-ink-900 leading-tight">{b.name}</h3>
                      <p className="text-[11.5px] text-ink-400 mt-0.5">{b.level} · {b.grade}</p>
                    </div>
                    {isToday ? <Badge tone="gold" dot>Today</Badge> : <Badge tone="slate">{b.status === "active" ? "Active" : "Inactive"}</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-[12px] font-semibold text-ink-700 tnum">
                    <Icon name="clock" size={14} className="text-ink-400" /> {timeLabel(b.startTime)} – {timeLabel(b.endTime)}
                    <span className="text-ink-200">|</span>
                    <Icon name="students" size={14} className="text-ink-400" /> {members}{b.capacity ? `/${b.capacity}` : ""}
                  </div>
                  <div className="flex gap-1 mt-2.5 flex-wrap">
                    {b.days.map((d) => (
                      <span key={d} className={`w-7 h-6 rounded-md text-[10px] font-bold flex items-center justify-center ${d === today ? "bg-gold-500 text-ink-950" : b.days.includes(d) ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-300"}`}>{WEEKDAYS[d][0]}</span>
                    ))}
                    <span className="text-[10.5px] text-ink-300 self-center ml-1">S M T W T F S</span>
                  </div>
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {b.subjects.slice(0, 4).map((s) => <span key={s} className="text-[10.5px] font-semibold text-ink-500 bg-ink-50 border border-ink-100 rounded px-1.5 py-0.5">{s}</span>)}
                    {b.subjects.length > 4 && <span className="text-[10.5px] text-ink-300">+{b.subjects.length - 4}</span>}
                  </div>
                  <div className="mt-3.5 pt-3 border-t border-dashed border-ink-100 flex items-center justify-between">
                    <span className="text-[11.5px] text-ink-400">Default fee</span>
                    <span className="font-mono font-bold text-[13px] text-ink-900 tnum">{b.defaultFee ? fmtMoney(b.defaultFee, cur) : "—"}</span>
                  </div>
                </div>
                <div className="px-4.5 pb-4 flex gap-1.5 flex-wrap">
                  <Btn size="sm" variant="outline" icon="attendance" onClick={() => nav("attendance", { batch: b.id })}>Mark Attendance</Btn>
                  <Btn size="sm" variant="ghost" icon="students" onClick={() => nav("students")}>Students</Btn>
                  <div className="flex-1" />
                  <IconBtn name="edit" label="Edit batch" onClick={() => openEdit(b)} />
                  <IconBtn name={b.status === "active" ? "archive" : "restore"} label={b.status === "active" ? "Deactivate" : "Activate"} onClick={() => (b.status === "active" ? setConfirmArchive(b) : toggleStatus(b))} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={isNew ? "New Batch" : "Edit Batch"} sub="A batch is a recurring time slot with its own schedule and default fee" wide
        footer={<>
          <Btn variant="outline" onClick={() => setForm(null)}>Cancel</Btn>
          <Btn variant="gold" icon="save" onClick={save}>Save Changes</Btn>
        </>}>
        {form && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Batch Name" required className="sm:col-span-2" error={err && !form.name.trim() ? err : undefined}>
              <TInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Matric Science · 7 PM" autoFocus />
            </Field>
            <Field label="Academic Level">
              <TSelect value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as Batch["level"] })}>{CLASS_LEVELS.map((l) => <option key={l}>{l}</option>)}</TSelect>
            </Field>
            <Field label="Class / Grade" required><TInput value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="e.g. Class 9–10" /></Field>
            <Field label="Start Time" required error={err && form.startTime >= form.endTime ? err : undefined}><TInput type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></Field>
            <Field label="End Time" required><TInput type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></Field>
            <Field label="Subjects" hint="Comma separated"><TInput value={subjectsText} onChange={(e) => setSubjectsText(e.target.value)} placeholder="Math, Science, English" /></Field>
            <Field label="Default Monthly Fee" hint="Prefilled into new students joining this batch"><TInput type="number" min={0} value={form.defaultFee ?? ""} onChange={(e) => setForm({ ...form, defaultFee: e.target.value === "" ? undefined : num(e.target.value) })} placeholder="2000" /></Field>
            <Field label="Capacity (optional)"><TInput type="number" min={1} value={form.capacity ?? ""} onChange={(e) => setForm({ ...form, capacity: e.target.value === "" ? undefined : num(e.target.value) })} placeholder="15" /></Field>
            <div className="sm:col-span-2">
              <span className="block text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1.5">Teaching Days</span>
              <div className="flex gap-1.5 flex-wrap">
                {WEEKDAYS.map((d, i) => {
                  const on = form.days.includes(i);
                  return (
                    <button key={d} type="button" onClick={() => setForm({ ...form, days: on ? form.days.filter((x) => x !== i) : [...form.days, i].sort() })}
                      className={`w-12 h-9 rounded-[8px] border text-[11.5px] font-bold transition-all ${on ? "bg-ink-900 text-white border-ink-900" : "bg-white text-ink-400 border-ink-200 hover:border-ink-400"}`}>{d}</button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Confirm open={!!confirmArchive} onClose={() => setConfirmArchive(null)} onConfirm={() => confirmArchive && toggleStatus(confirmArchive)} title="Deactivate batch?" confirmLabel="Deactivate"
        message="Students stay enrolled, but the batch disappears from attendance lists and the dashboard until activated again." />
    </div>
  );
}
