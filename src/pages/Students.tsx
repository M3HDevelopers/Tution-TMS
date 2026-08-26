import React, { useMemo, useState } from "react";
import { useNav, useUi } from "../components/Shell";
import { Avatar, Badge, Btn, EmptyState, FeeStatusBadge, Icon, IconBtn, PageHead, SearchBox, TSelect, useToast } from "../components/ui";
import { balanceOf, nextDue, studentOutstanding } from "../lib/fee";
import { useStore } from "../lib/store";
import { fmtDate, fmtMoney, naturalCompare, num } from "../lib/utils";

type SortKey = "name" | "joining" | "due" | "fee";

export default function Students() {
  const { state } = useStore();
  const { nav, route } = useNav();
  const ui = useUi();
  const toast = useToast();
  const df = state.settings.dateFormat;
  const cur = state.settings.feePolicy.currency;

  const [q, setQ] = useState("");
  const [cls, setCls] = useState("all");
  const [status, setStatus] = useState("active");
  const [feeFilter, setFeeFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [selected, setSelected] = useState<string[]>([]);

  const classes = useMemo(
    () => Array.from(new Set(state.students.map((s) => s.grade).filter(Boolean))).sort(naturalCompare),
    [state.students]
  );

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = state.students.filter((s) => (status === "all" ? true : s.status === status));
    if (cls !== "all") list = list.filter((s) => s.grade === cls);
    if (query) {
      list = list.filter((s) => {
        const phones = state.guardians.filter((g) => g.studentId === s.id).map((g) => g.phone.replace(/\D/g, "")).join(" ");
        return `${s.name} ${s.id} ${s.grade} ${s.school ?? ""} ${phones}`.toLowerCase().includes(query);
      });
    }
    const enriched = list.map((s) => {
      const out = studentOutstanding(state, s.id);
      const nd = nextDue(state, s.id);
      return { s, out, nd };
    });
    if (feeFilter === "clear") return enriched.filter((r) => r.out <= 0);
    if (feeFilter === "dues") return enriched.filter((r) => r.out > 0);
    enriched.sort((a, b) => {
      if (sort === "name") return a.s.name.localeCompare(b.s.name);
      if (sort === "fee") return b.s.monthlyFee - a.s.monthlyFee;
      if (sort === "due") return b.out - a.out;
      return (b.s.joiningDate ?? "").localeCompare(a.s.joiningDate ?? "");
    });
    return enriched;
  }, [state, q, cls, status, feeFilter, sort]);

  const toggleSel = (id: string) => setSelected((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  const setManyStatus = (st: "active" | "inactive") => {
    const students = state.students.map((s) => (selected.includes(s.id) ? { ...s, status: st } : s));
    patchAll(students);
    toast.push(`${selected.length} student${selected.length > 1 ? "s" : ""} marked ${st}`);
    setSelected([]);
  };

  const { patch } = useStore();
  const patchAll = (students: typeof state.students) => patch({ students });

  const exportCSV = () => {
    const head = ["ID", "Name", "Class", "Level", "School", "Monthly Fee", "Fee Due Day", "Joining", "Status", "Outstanding", "Guardians"];
    const body = rows.map(({ s, out }) => [
      s.id, s.name, s.grade, s.level, s.school ?? "", s.monthlyFee, s.feeDueDay, s.joiningDate ?? "", s.status, out,
      state.guardians.filter((g) => g.studentId === s.id).map((g) => `${g.name} ${g.phone}`).join("; "),
    ]);
    const csv = [head, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "students.csv";
    a.click();
    toast.push("Student list exported as CSV");
  };

  return (
    <div>
      <PageHead title="Students" sub={`${rows.length} record${rows.length === 1 ? "" : "s"} · same-class students are stacked automatically`}
        actions={<>
          <Btn variant="outline" icon="download" onClick={exportCSV}>Export</Btn>
          <Btn variant="gold" icon="plus" onClick={() => ui.openStudentForm()}>Add Student</Btn>
        </>} />

      {/* toolbar */}
      <div className="card p-3.5 mb-4 flex flex-wrap items-center gap-2.5 anim-fade-up">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, ID, phone, school…" className="flex-1 min-w-[220px]" />
        <TSelect value={cls} onChange={(e) => setCls(e.target.value)} className="!w-auto min-w-36">
          <option value="all">All classes</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </TSelect>
        <TSelect value={status} onChange={(e) => setStatus(e.target.value)} className="!w-auto min-w-30">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </TSelect>
        <TSelect value={feeFilter} onChange={(e) => setFeeFilter(e.target.value)} className="!w-auto min-w-34">
          <option value="all">Any fee status</option>
          <option value="dues">Has dues</option>
          <option value="clear">Fully clear</option>
        </TSelect>
        <TSelect value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="!w-auto min-w-36">
          <option value="name">Sort: Name</option>
          <option value="joining">Sort: Joining date</option>
          <option value="due">Sort: Due amount</option>
          <option value="fee">Sort: Monthly fee</option>
        </TSelect>
        {selected.length > 0 && (
          <span className="flex items-center gap-2 anim-fade-in">
            <Badge tone="navy">{selected.length} selected</Badge>
            <Btn size="sm" variant="outline" onClick={() => setManyStatus("inactive")}>Mark Inactive</Btn>
            <Btn size="sm" variant="outline" onClick={() => setManyStatus("active")}>Mark Active</Btn>
          </span>
        )}
      </div>

      {/* list */}
      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="students" title={state.students.length === 0 ? "No students yet" : "No students match"}
            message={state.students.length === 0 ? "Admit your first student — their class, fee date and parent numbers go in once, and everything else reuses them." : "Try clearing the search or filters."}
            action={state.students.length === 0 ? <Btn variant="gold" icon="plus" onClick={() => ui.openStudentForm()}>Add Student</Btn> : <Btn variant="outline" onClick={() => { setQ(""); setCls("all"); setStatus("all"); setFeeFilter("all"); }}>Clear Filters</Btn>} />
        </div>
      ) : (
        <div className="card overflow-hidden anim-fade-up" style={{ animationDelay: "60ms" }}>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-left min-w-[900px]">
              <thead className="sticky top-0 bg-ink-50 z-10">
                <tr className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400 border-b border-ink-100">
                  <th className="pl-4 py-3 w-10"><input type="checkbox" className="accent-[#0e1830]" checked={selected.length === rows.length && rows.length > 0} onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.s.id) : [])} aria-label="Select all" /></th>
                  <th className="py-3 font-bold">Student</th>
                  <th className="py-3 font-bold">Class</th>
                  <th className="py-3 font-bold">Guardians</th>
                  <th className="py-3 font-bold text-right">Monthly Fee</th>
                  <th className="py-3 font-bold">Fee Due</th>
                  <th className="py-3 font-bold text-right">Outstanding</th>
                  <th className="py-3 font-bold">Status</th>
                  <th className="py-3 pr-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map(({ s, out, nd }, i) => {
                  const guards = state.guardians.filter((g) => g.studentId === s.id);
                  return (
                    <tr key={s.id} className="hover:bg-gold-50/40 transition-colors anim-fade-up" style={{ animationDelay: `${Math.min(i * 22, 260)}ms` }}>
                      <td className="pl-4 py-2.5"><input type="checkbox" className="accent-[#0e1830]" checked={selected.includes(s.id)} onChange={() => toggleSel(s.id)} aria-label={`Select ${s.name}`} /></td>
                      <td className="py-2.5">
                        <button onClick={() => nav("student", { id: s.id })} className="flex items-center gap-3 text-left group">
                          {s.photo ? <img src={s.photo} alt="" className="w-9 h-9 rounded-[10px] object-cover" /> : <Avatar name={s.name} size={36} />}
                          <span>
                            <span className="block text-[13.5px] font-bold text-ink-900 group-hover:text-gold-700 transition-colors">{s.name}</span>
                            <span className="block text-[11px] text-ink-400">{s.school || s.level}{s.joiningDate ? ` · joined ${fmtDate(s.joiningDate, df)}` : ""}</span>
                          </span>
                        </button>
                      </td>
                      <td className="py-2.5"><Badge tone="teal">{s.grade}</Badge></td>
                      <td className="py-2.5">
                        {guards.length === 0 ? <span className="text-[11.5px] text-flame-600 font-semibold">No number!</span> : (
                          <span className="text-[12px] text-ink-600 tnum">{guards[0].name} <span className="text-ink-400 font-mono text-[11px]">{guards[0].phone}</span>{guards.length > 1 && <span className="text-ink-400"> +{guards.length - 1}</span>}</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-mono text-[12.5px] font-semibold text-ink-900 tnum">{fmtMoney(s.monthlyFee, cur)}</td>
                      <td className="py-2.5">
                        {nd && nd.balance > 0 ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-[12px] font-bold text-ink-900 tnum">{fmtMoney(nd.balance, cur)}</span>
                            <span className="text-[10.5px] text-ink-400 tnum">by {fmtDate(nd.dueDate, df)}</span>
                          </div>
                        ) : <Badge tone="green">Clear</Badge>}
                      </td>
                      <td className="py-2.5 text-right font-mono text-[12.5px] font-bold tnum">
                        {out > 0 ? <span className="text-flame-600">{fmtMoney(out, cur)}</span> : <span className="text-mint-600">0</span>}
                      </td>
                      <td className="py-2.5">{nd ? <FeeStatusBadge status={nd.status} /> : <Badge tone="slate">New</Badge>}</td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center justify-end gap-0.5">
                          <IconBtn name="wallet" label="Record payment (opens here)" onClick={() => ui.openPayment(s.id)} />
                          <IconBtn name="slips" label={out > 0 ? "Send challan" : "Challan not needed (paid)"} onClick={() => {
                            if (out <= 0) { toast.push(`${s.name} is fully paid — no challan needed.`, "warn"); return; }
                            const open = state.feeRecords.filter((r) => r.studentId === s.id).sort((a, b) => a.period.localeCompare(b.period)).find((r) => balanceOf(r, state.payments) > 0);
                            if (open) ui.openSlip({ kind: "challan", recordId: open.id });
                          }} />
                          <IconBtn name="edit" label="Edit student" onClick={() => ui.openStudentForm({ editId: s.id })} />
                          <IconBtn name="eye" label="Open profile" onClick={() => nav("student", { id: s.id })} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {num(0) === 0 && null}
    </div>
  );
}
