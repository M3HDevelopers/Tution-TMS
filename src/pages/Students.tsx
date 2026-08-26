import React, { useMemo, useState } from "react";
import { useNav, useUi } from "../components/Shell";
import { Avatar, Badge, Btn, EmptyState, FeeStatusBadge, Icon, IconBtn, PageHead, SearchBox, TSelect, useToast } from "../components/ui";
import { balanceOf, paidOf, statusOf } from "../lib/fee";
import { useStore } from "../lib/store";
import { currentPeriod, fmtDate, fmtMoney, naturalCompare, num, periodLabel } from "../lib/utils";

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

  const period = currentPeriod();
  const grace = state.settings.feePolicy.graceDays;

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
      const rec = state.feeRecords.find((r) => r.studentId === s.id && r.period === period);
      const paid = rec ? paidOf(state.payments, rec.id) : 0;
      const due = rec ? balanceOf(rec, state.payments) : 0;
      const st = rec ? statusOf(rec, state.payments, grace) : null;
      return { s, rec, paid, due, st };
    });
    if (feeFilter === "clear") return enriched.filter((r) => r.due <= 0);
    if (feeFilter === "dues") return enriched.filter((r) => r.due > 0);
    enriched.sort((a, b) => {
      if (sort === "name") return a.s.name.localeCompare(b.s.name);
      if (sort === "fee") return b.s.monthlyFee - a.s.monthlyFee;
      if (sort === "due") return b.due - a.due;
      return (b.s.joiningDate ?? "").localeCompare(a.s.joiningDate ?? "");
    });
    return enriched;
  }, [state, q, cls, status, feeFilter, sort, period, grace]);

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
    const head = ["ID", "Name", "Class", "Level", "School", "Guardian", "Phone", "Monthly Fee", "Fee Due Day", "Paid (month)", "Due (month)", "Due Date", "Joining", "Status", "Guardians"];
    const body = rows.map(({ s, rec, paid, due }) => {
      const g0 = state.guardians.find((g) => g.studentId === s.id && g.primary) ?? state.guardians.find((g) => g.studentId === s.id);
      return [
        s.id, s.name, s.grade, s.level, s.school ?? "", g0?.name ?? "", g0?.phone ?? "", s.monthlyFee, s.feeDueDay,
        paid, due, rec?.dueDate ?? "", s.joiningDate ?? "", s.status,
        state.guardians.filter((g) => g.studentId === s.id).map((g) => `${g.name} ${g.phone}`).join("; "),
      ];
    });
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
            {/* Fixed column architecture — every header and every row shares these exact column tracks */}
            <table className="w-full table-fixed border-collapse text-left align-middle min-w-[1200px]">
              <colgroup>
                <col className="w-[48px]" />   {/* checkbox */}
                <col />                        {/* student (flex) */}
                <col className="w-[126px]" />  {/* class */}
                <col className="w-[198px]" />  {/* guardian */}
                <col className="w-[120px]" />  {/* monthly fee */}
                <col className="w-[120px]" />  {/* paid amount */}
                <col className="w-[120px]" />  {/* due amount */}
                <col className="w-[132px]" />  {/* due date */}
                <col className="w-[126px]" />  {/* status */}
                <col className="w-[158px]" />  {/* actions */}
              </colgroup>
              <thead className="bg-ink-50">
                <tr className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400 border-b border-ink-100">
                  <th className="pl-4 pr-1 py-3">
                    <input type="checkbox" className="accent-[#0e1830] w-3.5 h-3.5 cursor-pointer" checked={selected.length === rows.length && rows.length > 0} onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.s.id) : [])} aria-label="Select all" />
                  </th>
                  <th className="px-3 py-3">Student</th>
                  <th className="px-3 py-3">Class</th>
                  <th className="px-3 py-3">Guardian</th>
                  <th className="px-3 py-3 text-right">Monthly Fee</th>
                  <th className="px-3 py-3 text-right">Paid Amount</th>
                  <th className="px-3 py-3 text-right">Due Amount</th>
                  <th className="px-3 py-3">Due Date</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map(({ s, rec, paid, due, st }, i) => {
                  const guards = state.guardians.filter((g) => g.studentId === s.id).sort((a, b) => Number(b.primary) - Number(a.primary));
                  const g0 = guards[0];
                  return (
                    <tr key={s.id} className="hover:bg-gold-50/40 transition-colors anim-fade-up" style={{ animationDelay: `${Math.min(i * 22, 260)}ms` }}>
                      <td className="pl-4 pr-1 py-3">
                        <input type="checkbox" className="accent-[#0e1830] w-3.5 h-3.5 cursor-pointer" checked={selected.includes(s.id)} onChange={() => toggleSel(s.id)} aria-label={`Select ${s.name}`} />
                      </td>
                      <td className="px-3 py-3 min-w-0">
                        <button onClick={() => nav("student", { id: s.id })} className="flex items-center gap-3 text-left group w-full min-w-0">
                          {s.photo ? <img src={s.photo} alt="" className="w-10 h-10 rounded-[10px] object-cover shrink-0" /> : <Avatar name={s.name} size={40} />}
                          <span className="min-w-0">
                            <span className="block text-[15px] font-bold leading-snug text-ink-900 group-hover:text-gold-700 transition-colors truncate">{s.name}</span>
                            <span className="block text-[12px] text-ink-400 truncate mt-0.5">{s.grade} · fee day {s.feeDueDay === 1 ? "1st" : `${s.feeDueDay}th`}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-3"><Badge tone="teal" className="max-w-full truncate">{s.grade}</Badge></td>
                      <td className="px-3 py-3 min-w-0">
                        {!g0 ? <span className="text-[12px] text-flame-600 font-bold">No number!</span> : (
                          <span className="block min-w-0">
                            <span className="block text-[12.5px] font-semibold text-ink-700 truncate">{g0.name}{guards.length > 1 && <span className="text-ink-400 font-normal"> +{guards.length - 1}</span>}</span>
                            <span className="block font-mono text-[11.5px] text-ink-400 tnum truncate mt-0.5">{g0.phone}{g0.whatsapp ? "" : " · no WA"}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[13.5px] font-semibold text-ink-900 tnum whitespace-nowrap">{fmtMoney(s.monthlyFee, cur)}</td>
                      <td className="px-3 py-3 text-right font-mono text-[13.5px] font-bold tnum whitespace-nowrap">
                        {rec ? <span className="text-mint-600">{fmtMoney(paid, cur)}</span> : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[13.5px] font-bold tnum whitespace-nowrap">
                        {rec ? (due > 0 ? <span className="text-flame-600">{fmtMoney(due, cur)}</span> : <span className="text-mint-600">{fmtMoney(0, cur)}</span>) : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-[12.5px] font-semibold text-ink-600 tnum whitespace-nowrap">{rec ? fmtDate(rec.dueDate, df) : "—"}</td>
                      <td className="px-3 py-3">{st ? <FeeStatusBadge status={st} /> : <Badge tone="slate">New</Badge>}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <IconBtn name="wallet" label="Record payment (opens here)" onClick={() => ui.openPayment(s.id)} />
                          <IconBtn name="slips" label={due > 0 ? "Send challan" : "Challan not needed (paid)"} onClick={() => {
                            if (due <= 0) { toast.push(`${s.name} is fully paid — no challan needed.`, "warn"); return; }
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
          <div className="px-4 py-2.5 bg-ink-50/60 border-t border-ink-100 flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-ink-400 tnum">{rows.length} student{rows.length === 1 ? "" : "s"} · {periodLabel(period)} figures</span>
            <span className="text-[11.5px] font-semibold text-ink-400">Scroll sideways on small screens →</span>
          </div>
        </div>
      )}
      {num(0) === 0 && null}
    </div>
  );
}
