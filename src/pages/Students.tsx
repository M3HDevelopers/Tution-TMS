import React, { useEffect, useMemo, useState } from "react";
import StudentForm from "../components/StudentForm";
import { useNav } from "../components/Shell";
import { Avatar, Badge, Btn, Confirm, EmptyState, Icon, IconBtn, PageHead, SearchBox, StudentStatusBadge, TSelect, useToast } from "../components/ui";
import { nextDue, overdueStudents, studentOutstanding } from "../lib/fee";
import { useStore, withActivity } from "../lib/store";
import { fmtDate, fmtMoney } from "../lib/utils";
import type { Student } from "../types";

type SortKey = "name" | "joining" | "due" | "nextDue";

export default function Students() {
  const { state, patch } = useStore();
  const { nav, route } = useNav();
  const toast = useToast();
  const df = state.settings.dateFormat;
  const cur = state.settings.feePolicy.currency;

  const [q, setQ] = useState("");
  const [fLevel, setFLevel] = useState("all");
  const [fBatch, setFBatch] = useState("all");
  const [fStatus, setFStatus] = useState("active");
  const [fDues, setFDues] = useState("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [selected, setSelected] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<string | undefined>();
  const [confirmArchive, setConfirmArchive] = useState<{ ids: string[]; archive: boolean } | null>(null);

  useEffect(() => {
    if (route.params?.add === "1") {
      setEditing(undefined);
      setFormOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.add]);

  const outstandingMap = useMemo(() => {
    const m: Record<string, number> = {};
    state.students.forEach((s) => (m[s.id] = studentOutstanding(state, s.id)));
    return m;
  }, [state]);

  const overdueIds = useMemo(() => new Set(overdueStudents(state).map((o) => o.student.id)), [state]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = state.students.filter((s) => {
      if (fStatus !== "all" && s.status !== fStatus) return false;
      if (fLevel !== "all" && s.level !== fLevel) return false;
      if (fBatch !== "all" && !s.batchIds.includes(fBatch)) return false;
      if (fDues === "overdue" && !overdueIds.has(s.id)) return false;
      if (fDues === "clear" && outstandingMap[s.id] > 0) return false;
      if (fDues === "dues" && outstandingMap[s.id] === 0) return false;
      if (needle) {
        const phoneDigits = state.guardians.filter((g) => g.studentId === s.id).map((g) => g.phone.replace(/\D/g, "")).join(" ");
        const hay = `${s.name} ${s.id} ${s.school ?? ""} ${s.grade}`.toLowerCase();
        const digits = needle.replace(/\D/g, "");
        const phoneHit = digits.length >= 3 && phoneDigits.includes(digits);
        if (!hay.includes(needle) && !phoneHit) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "joining") return b.joiningDate.localeCompare(a.joiningDate);
      if (sort === "due") return (outstandingMap[b.id] || 0) - (outstandingMap[a.id] || 0);
      const na = nextDue(state, a.id)?.dueDate ?? "9999";
      const nb = nextDue(state, b.id)?.dueDate ?? "9999";
      return na.localeCompare(nb);
    });
    return list;
  }, [state, q, fLevel, fBatch, fStatus, fDues, sort, outstandingMap, overdueIds]);

  const batchName = (id: string) => state.batches.find((b) => b.id === id)?.name ?? id;

  const doArchive = (ids: string[], archive: boolean) => {
    const students = state.students.map((s) => (ids.includes(s.id) ? { ...s, status: archive ? ("archived" as const) : ("active" as const) } : s));
    const names = state.students.filter((s) => ids.includes(s.id)).map((s) => s.name).join(", ");
    const activity = withActivity({ ...state, students }, `${archive ? "Archived" : "Restored"}: ${names}.`, "student");
    patch({ students, activity });
    setSelected([]);
    toast.push(archive ? `${ids.length} student${ids.length > 1 ? "s" : ""} archived` : "Students restored");
  };

  const allSel = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  return (
    <div>
      <PageHead
        title="Students"
        sub={`${state.students.filter((s) => s.status === "active").length} active · ${state.students.length} total on register`}
        actions={<Btn variant="gold" icon="plus" onClick={() => { setEditing(undefined); setFormOpen(true); }}>Add Student</Btn>}
      />

      {/* controls */}
      <div className="card p-3.5 mb-4 flex flex-wrap items-center gap-2.5 anim-fade-up">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, ID, phone, school…" className="w-full sm:w-64" />
        <TSelect value={fLevel} onChange={(e) => setFLevel(e.target.value)} className="!w-auto min-w-32">
          <option value="all">All levels</option>
          {["Pre-school", "Nursery", "Prep", "Primary", "Middle", "Matric", "Intermediate", "College"].map((l) => <option key={l}>{l}</option>)}
        </TSelect>
        <TSelect value={fBatch} onChange={(e) => setFBatch(e.target.value)} className="!w-auto min-w-36">
          <option value="all">All batches</option>
          {state.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </TSelect>
        <TSelect value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="!w-auto min-w-28">
          <option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option><option value="all">All statuses</option>
        </TSelect>
        <TSelect value={fDues} onChange={(e) => setFDues(e.target.value)} className="!w-auto min-w-30">
          <option value="all">Any dues</option><option value="dues">Has dues</option><option value="overdue">Overdue only</option><option value="clear">Dues clear</option>
        </TSelect>
        <div className="flex-1" />
        <TSelect value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="!w-auto min-w-36">
          <option value="name">Sort · Name A–Z</option>
          <option value="joining">Sort · Newest joined</option>
          <option value="due">Sort · Highest dues</option>
          <option value="nextDue">Sort · Next due date</option>
        </TSelect>
      </div>

      {/* bulk bar */}
      {selected.length > 0 && (
        <div className="mb-3 flex items-center gap-3 bg-ink-900 text-white rounded-[10px] px-4 py-2.5 anim-pop">
          <span className="text-[12.5px] font-semibold tnum">{selected.length} selected</span>
          <div className="flex-1" />
          <Btn size="sm" variant="dark" icon="restore" onClick={() => doArchive(selected, false)}>Activate</Btn>
          <Btn size="sm" variant="danger" icon="archive" onClick={() => setConfirmArchive({ ids: selected, archive: true })}>Archive Student</Btn>
        </div>
      )}

      {/* table */}
      <div className="card overflow-hidden anim-fade-up" style={{ animationDelay: "60ms" }}>
        {rows.length === 0 ? (
          <EmptyState icon="students" title={state.students.length === 0 ? "No students yet" : "No students match these filters"}
            message={state.students.length === 0 ? "Admit your first student to start tracking attendance and fees." : "Try clearing the search or widening a filter."}
            action={state.students.length === 0 ? <Btn variant="gold" icon="plus" onClick={() => setFormOpen(true)}>Add Student</Btn> : <Btn variant="outline" onClick={() => { setQ(""); setFLevel("all"); setFBatch("all"); setFDues("all"); setFStatus("all"); }}>Clear filters</Btn>} />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-left min-w-[760px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400 border-b border-ink-100 bg-ink-50/60">
                  <th className="pl-4 py-2.5 w-10">
                    <input type="checkbox" checked={allSel} onChange={() => setSelected(allSel ? [] : rows.map((r) => r.id))} className="accent-[#e8a020] w-3.5 h-3.5 cursor-pointer" aria-label="Select all" />
                  </th>
                  <th className="py-2.5 font-bold">Student</th>
                  <th className="py-2.5 font-bold">Class / Batch</th>
                  <th className="py-2.5 font-bold text-right">Monthly Fee</th>
                  <th className="py-2.5 font-bold text-right">Outstanding</th>
                  <th className="py-2.5 font-bold">Next Due</th>
                  <th className="py-2.5 font-bold">Status</th>
                  <th className="py-2.5 pr-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((s) => {
                  const due = outstandingMap[s.id] || 0;
                  const nd = nextDue(state, s.id);
                  return (
                    <tr key={s.id} className={`group hover:bg-gold-50/40 transition-colors ${s.status === "archived" ? "opacity-55" : ""}`}>
                      <td className="pl-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.includes(s.id)} onChange={() => setSelected((xs) => (xs.includes(s.id) ? xs.filter((x) => x !== s.id) : [...xs, s.id]))} className="accent-[#e8a020] w-3.5 h-3.5 cursor-pointer" aria-label={`Select ${s.name}`} />
                      </td>
                      <td className="py-2.5 cursor-pointer" onClick={() => nav("student", { id: s.id })}>
                        <div className="flex items-center gap-3">
                          <Avatar name={s.name} size={34} />
                          <div className="min-w-0">
                            <div className="font-semibold text-[13.5px] text-ink-900 group-hover:text-gold-700 transition-colors truncate">{s.name}</div>
                            <div className="text-[11px] text-ink-400">{s.level} · joined {fmtDate(s.joiningDate, df)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 cursor-pointer" onClick={() => nav("student", { id: s.id })}>
                        <div className="text-[12.5px] font-semibold text-ink-700">{s.grade}</div>
                        <div className="flex gap-1 mt-0.5 flex-wrap max-w-44">
                          {s.batchIds.slice(0, 2).map((bid) => {
                            const b = state.batches.find((x) => x.id === bid);
                            return <span key={bid} className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink-500"><span className="w-1.5 h-1.5 rounded-full" style={{ background: b?.color ?? "#999" }} />{b?.name.split("·")[0].trim() ?? bid}</span>;
                          })}
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-mono text-[12.5px] font-semibold text-ink-800 tnum cursor-pointer" onClick={() => nav("student", { id: s.id })}>{fmtMoney(s.monthlyFee, cur)}</td>
                      <td className="py-2.5 text-right cursor-pointer" onClick={() => nav("fees", { student: s.id })}>
                        {due > 0
                          ? <span className={`font-mono text-[12.5px] font-bold tnum ${overdueIds.has(s.id) ? "text-flame-600" : "text-warn-600"}`}>{fmtMoney(due, cur)}</span>
                          : <Badge tone="green">Clear</Badge>}
                      </td>
                      <td className="py-2.5 text-[12px] text-ink-500 tnum cursor-pointer" onClick={() => nav("student", { id: s.id })}>{nd && nd.balance > 0 ? fmtDate(nd.dueDate, df) : "—"}</td>
                      <td className="py-2.5"><StudentStatusBadge status={s.status} /></td>
                      <td className="py-2.5 pr-4">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <IconBtn name="edit" label="Edit" onClick={() => { setEditing(s.id); setFormOpen(true); }} />
                          <IconBtn name="wallet" label="Record payment" onClick={() => nav("fees", { pay: "1", student: s.id })} />
                          <IconBtn name={s.status === "archived" ? "restore" : "archive"} label={s.status === "archived" ? "Restore" : "Archive"} onClick={() => setConfirmArchive({ ids: [s.id], archive: s.status !== "archived" })} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StudentForm open={formOpen} onClose={() => setFormOpen(false)} studentId={editing} />

      <Confirm
        open={!!confirmArchive}
        onClose={() => setConfirmArchive(null)}
        onConfirm={() => confirmArchive && doArchive(confirmArchive.ids, confirmArchive.archive)}
        title={confirmArchive?.archive ? "Archive student?" : "Restore student?"}
        confirmLabel={confirmArchive?.archive ? "Archive Student" : "Restore"}
        tone={confirmArchive?.archive ? "danger" : "gold"}
        message={confirmArchive?.archive
          ? "Archived students stop appearing in attendance lists and no new monthly fee records are generated for them. All fee and payment history stays intact."
          : "Restored students become active again and will be included in the next fee cycle and attendance lists."}
      />
    </div>
  );
}
