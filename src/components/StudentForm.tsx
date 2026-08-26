import React, { useMemo, useState } from "react";
import { CLASS_LEVELS, RELATIONS } from "../types";
import type { Guardian, Student } from "../types";
import { useStore, withActivity } from "../lib/store";
import { isValidPhone, normalizePhone, num, todayISO, uid } from "../lib/utils";
import { Btn, Field, Icon, Modal, Switch, TInput, TArea, TSelect, useToast } from "./ui";

interface GDraft { id: string; name: string; relation: string; phone: string; whatsapp: boolean; primary: boolean; notes: string }

export default function StudentForm({ open, onClose, studentId }: { open: boolean; onClose: () => void; studentId?: string }) {
  const { state, patch } = useStore();
  const toast = useToast();
  const editing = studentId ? state.students.find((s) => s.id === studentId) : undefined;

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [level, setLevel] = useState<Student["level"]>("Primary");
  const [grade, setGrade] = useState("");
  const [school, setSchool] = useState("");
  const [subjects, setSubjects] = useState("");
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [fee, setFee] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [joining, setJoining] = useState(todayISO());
  const [status, setStatus] = useState<Student["status"]>("active");
  const [notes, setNotes] = useState("");
  const [gs, setGs] = useState<GDraft[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hydratedFor, setHydratedFor] = useState<string | undefined>(undefined);

  // hydrate when opening / switching student
  const openKey = open ? studentId ?? "new" : "closed";
  if (open && hydratedFor !== openKey) {
    setHydratedFor(openKey);
    setErrors({});
    if (editing) {
      setName(editing.name); setDob(editing.dob ?? ""); setGender(editing.gender ?? "");
      setLevel(editing.level); setGrade(editing.grade); setSchool(editing.school ?? "");
      setSubjects(editing.subjects.join(", ")); setBatchIds(editing.batchIds);
      setFee(String(editing.monthlyFee)); setDueDay(editing.dueDay ? String(editing.dueDay) : "");
      setJoining(editing.joiningDate); setStatus(editing.status); setNotes(editing.notes ?? "");
      setGs(state.guardians.filter((g) => g.studentId === editing.id).map((g) => ({ ...g, notes: g.notes ?? "" })));
    } else {
      setName(""); setDob(""); setGender(""); setLevel("Primary"); setGrade(""); setSchool("");
      setSubjects(""); setBatchIds([]); setFee(String(state.settings.feePolicy.defaultFee || "")); setDueDay("");
      setJoining(todayISO()); setStatus("active"); setNotes("");
      setGs([{ id: uid("gd"), name: "", relation: "Father", phone: "", whatsapp: true, primary: true, notes: "" }]);
    }
  }

  const activeBatches = state.batches.filter((b) => b.status === "active");
  const batchDefaultFee = useMemo(() => activeBatches.find((b) => batchIds.includes(b.id))?.defaultFee, [batchIds, activeBatches]);

  const setG = (id: string, p: Partial<GDraft>) => setGs((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const save = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Student name is required.";
    if (!grade.trim()) errs.grade = "Class / grade is required.";
    const feeNum = num(fee);
    if (fee.trim() === "" || feeNum < 0) errs.fee = "Monthly fee must be zero or a positive amount.";
    const phones = gs.map((g) => normalizePhone(g.phone)).filter(Boolean);
    if (gs.length === 0) errs.guardians = "Add at least one parent/guardian contact (recommended).";
    gs.forEach((g) => {
      if (!g.name.trim() || !isValidPhone(g.phone)) errs.guardians = "Every guardian needs a name and a valid phone number.";
    });
    if (new Set(phones).size !== phones.length) errs.guardians = "Duplicate phone numbers are not allowed for one student.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const sid = editing?.id ?? uid("st");
    const finalGs: Guardian[] = gs.map((g, i) => ({
      id: g.id, studentId: sid, name: g.name.trim(), relation: g.relation, phone: g.phone.trim(),
      whatsapp: g.whatsapp, primary: gs.some((x) => x.primary) ? g.primary : i === 0, notes: g.notes.trim() || undefined,
    }));
    const student: Student = {
      id: sid, name: name.trim(), dob: dob || undefined, gender: gender || undefined, level, grade: grade.trim(),
      school: school.trim() || undefined, subjects: subjects.split(",").map((s) => s.trim()).filter(Boolean),
      batchIds, monthlyFee: feeNum, dueDay: dueDay ? Math.min(31, Math.max(1, num(dueDay))) : undefined,
      joiningDate: joining || todayISO(), status, notes: notes.trim() || undefined,
    };

    const students = editing ? state.students.map((s) => (s.id === sid ? student : s)) : [...state.students, student];
    const guardians = [...state.guardians.filter((g) => g.studentId !== sid), ...finalGs];
    const activity = withActivity(
      { ...state, students, guardians },
      editing ? `Student record updated — ${student.name}.` : `New student admitted — ${student.name} (${student.level}, ${student.grade}).`,
      "student"
    );
    patch({ students, guardians, activity });
    toast.push(editing ? "Student updated" : `${student.name} admitted`);
    onClose();
  };

  const toggleBatch = (id: string) => {
    const next = batchIds.includes(id) ? batchIds.filter((x) => x !== id) : [...batchIds, id];
    setBatchIds(next);
    if (!editing) {
      const b = state.batches.find((x) => x.id === id);
      if (b?.defaultFee && !batchIds.includes(id)) setFee(String(b.defaultFee));
    }
  };

  return (
    <Modal open={open} onClose={onClose} wide title={editing ? "Edit Student" : "Add Student"} sub={editing ? `Editing ${editing.name}'s master record` : "One entry powers attendance, fees, slips and reports"}
      footer={<>
        <Btn variant="outline" onClick={onClose}>Cancel</Btn>
        <Btn variant="gold" icon="save" onClick={save}>Save Changes</Btn>
      </>}>
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-4">
        <Field label="Full Name" required error={errors.name} className="sm:col-span-2">
          <TInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ayaan Khalid" autoFocus />
        </Field>
        <Field label="Academic Level" required>
          <TSelect value={level} onChange={(e) => setLevel(e.target.value as Student["level"])}>
            {CLASS_LEVELS.map((l) => <option key={l}>{l}</option>)}
          </TSelect>
        </Field>
        <Field label="Class / Grade" required error={errors.grade}>
          <TInput value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. Class 8 / Nursery / First Year" />
        </Field>
        <Field label="Date of Birth"><TInput type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></Field>
        <Field label="Gender">
          <TSelect value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">—</option><option>Male</option><option>Female</option><option>Other</option><option>Prefer not to say</option>
          </TSelect>
        </Field>
        <Field label="School / College"><TInput value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Optional" /></Field>
        <Field label="Subjects" hint="Comma separated"><TInput value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="Math, Science, English" /></Field>

        <div className="sm:col-span-2">
          <span className="block text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1.5">Batches</span>
          {activeBatches.length === 0 ? (
            <p className="text-[12px] text-ink-400 bg-ink-50 border border-dashed border-ink-200 rounded-[9px] px-3 py-2.5">No active batches yet — create them under Classes & Batches, then enrol students.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeBatches.map((b) => {
                const on = batchIds.includes(b.id);
                return (
                  <button key={b.id} type="button" onClick={() => toggleBatch(b.id)}
                    className={`inline-flex items-center gap-2 h-8.5 px-3 rounded-[9px] border text-[12.5px] font-semibold transition-all ${on ? "bg-ink-900 text-white border-ink-900" : "bg-white text-ink-600 border-ink-200 hover:border-ink-400"}`}>
                    <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                    {b.name}
                    {on && <Icon name="check" size={13} strokeWidth={2.6} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Field label="Monthly Fee (Rs)" required error={errors.fee} hint={batchDefaultFee ? `Batch default: Rs ${batchDefaultFee.toLocaleString()}` : undefined}>
          <TInput type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} placeholder="2000" />
        </Field>
        <Field label="Fee Due Day" hint="1–31, or inherits the fee-policy due day">
          <TInput type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder={String(state.settings.feePolicy.dueDay)} />
        </Field>
        <Field label="Admission / Joining Date"><TInput type="date" value={joining} onChange={(e) => setJoining(e.target.value)} /></Field>
        <Field label="Status">
          <TSelect value={status} onChange={(e) => setStatus(e.target.value as Student["status"])}>
            <option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option>
          </TSelect>
        </Field>

        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-500">Parent / Guardian Contacts <span className="text-flame-600">*</span></span>
            <Btn size="sm" variant="outline" icon="plus" onClick={() => setGs((xs) => [...xs, { id: uid("gd"), name: "", relation: "Mother", phone: "", whatsapp: true, primary: xs.length === 0, notes: "" }])}>Add Contact</Btn>
          </div>
          {errors.guardians && <p className="text-[11.5px] font-semibold text-flame-600 mb-2">{errors.guardians}</p>}
          <div className="space-y-2.5">
            {gs.map((g, i) => (
              <div key={g.id} className="rounded-[10px] border border-ink-150 bg-ink-50/50 p-3 grid sm:grid-cols-[1.2fr_0.9fr_1fr_auto] gap-2.5 items-end anim-fade-up">
                <Field label={`Name ${i + 1}`}><TInput value={g.name} onChange={(e) => setG(g.id, { name: e.target.value })} placeholder="Parent name" /></Field>
                <Field label="Relation">
                  <TSelect value={g.relation} onChange={(e) => setG(g.id, { relation: e.target.value })}>{RELATIONS.map((r) => <option key={r}>{r}</option>)}</TSelect>
                </Field>
                <Field label="Phone"><TInput value={g.phone} onChange={(e) => setG(g.id, { phone: e.target.value })} placeholder="03xx-xxxxxxx" /></Field>
                <div className="flex items-center gap-3 pb-1">
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-500 cursor-pointer whitespace-nowrap">
                    <Switch checked={g.whatsapp} onChange={(v) => setG(g.id, { whatsapp: v })} label="WhatsApp" /><Icon name="whatsapp" size={14} className={g.whatsapp ? "text-mint-600" : "text-ink-300"} />
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-500 cursor-pointer whitespace-nowrap">
                    <Switch checked={g.primary} onChange={(v) => setG(g.id, { primary: v })} label="Primary" />Primary
                  </label>
                  <button onClick={() => setGs((xs) => xs.filter((x) => x.id !== g.id))} className="w-7 h-7 rounded-[7px] flex items-center justify-center text-ink-400 hover:text-flame-600 hover:bg-flame-50 transition-colors" title="Remove contact">
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-400 mt-2">Multiple numbers are supported — e.g. both parents. One can be marked primary; slips can be sent to any of them.</p>
        </div>

        <Field label="Notes" className="sm:col-span-2">
          <TArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering about this learner…" />
        </Field>
      </div>
    </Modal>
  );
}
