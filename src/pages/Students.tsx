import React, { useMemo, useState } from "react";
import { useNav, useUi } from "../components/Shell";
import { Avatar, Badge, Btn, EmptyState, FeeStatusBadge, Icon, IconBtn, PageHead, SearchBox, TSelect, useToast } from "../components/ui";
import { balanceOf, paidOf, statusOf, studentOutstanding } from "../lib/fee";
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
      const out = studentOutstanding(state, s.id);
      return { s, rec, paid, due, st, out };
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
  }, [state, q, cls, status, feeFilter, sort, period, grace]);

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
        {/* filters — mobile par 2×2 barabar grid, desktop par ek line */}
        <div className="grid grid-cols-2 gap-2 w-full lg:w-auto lg:flex lg:items-center lg:gap-2.5">
          <TSelect value={cls} onChange={(e) => setCls(e.target.value)} className="!w-full lg:!w-auto">
            <option value="all">All classes</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </TSelect>
          <TSelect value={status} onChange={(e) => setStatus(e.target.value)} className="!w-full lg:!w-auto">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </TSelect>
          <TSelect value={feeFilter} onChange={(e) => setFeeFilter(e.target.value)} className="!w-full lg:!w-auto">
            <option value="all">Any fee status</option>
            <option value="dues">Has dues</option>
            <option value="clear">Fully clear</option>
          </TSelect>
          <TSelect value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="!w-full lg:!w-auto">
            <option value="name">Sort: Name</option>
            <option value="joining">Sort: Joining date</option>
            <option value="due">Sort: Due amount</option>
            <option value="fee">Sort: Monthly fee</option>
          </TSelect>
        </div>
      </div>

      {/* list */}
      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="students" title={state.students.length === 0 ? "No students yet" : "No students match"}
            message={state.students.length === 0 ? "Admit your first student — their class, fee date and parent numbers go in once, and everything else reuses them." : "Try clearing the search or filters."}
            action={state.students.length === 0 ? <Btn variant="gold" icon="plus" onClick={() => ui.openStudentForm()}>Add Student</Btn> : <Btn variant="outline" onClick={() => { setQ(""); setCls("all"); setStatus("all"); setFeeFilter("all"); }}>Clear Filters</Btn>} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 stagger">
            {rows.map(({ s, rec, paid, due, st, out }) => {
              const guards = state.guardians.filter((g) => g.studentId === s.id).sort((a, b) => Number(b.primary) - Number(a.primary));
              const g0 = guards[0];
              return (
                <div key={s.id} className="card overflow-hidden card-hover">
                  {/* head — tap to open profile */}
                  <div onClick={() => nav("student", { id: s.id })} className="flex items-center gap-3 px-4 pt-3.5 pb-3 cursor-pointer">
                    {s.photo ? <img src={s.photo} alt="" className="w-11 h-11 rounded-[11px] object-cover shrink-0" /> : <Avatar name={s.name} size={44} />}
                    <div className="flex-1 min-w-0">
                      <p className="text-[15.5px] font-bold leading-tight text-ink-900 truncate">{s.name}</p>
                      <p className="text-[11.5px] text-ink-400 mt-0.5 truncate">
                        <Badge tone="teal" className="mr-1.5">{s.grade}</Badge> fee day {s.feeDueDay === 1 ? "1st" : `${s.feeDueDay}th`}
                      </p>
                    </div>
                    {st ? <FeeStatusBadge status={st} /> : <Badge tone="slate">New</Badge>}
                  </div>

                  {/* mini ledger — all amounts at a glance */}
                  <div className="mx-4 rounded-[10px] border border-ink-100 bg-ink-50/60 grid grid-cols-4 divide-x divide-ink-100">
                    <div className="px-2.5 py-2">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.08em] text-ink-400">Monthly</span>
                      <span className="block font-mono text-[12.5px] font-bold text-ink-900 tnum mt-0.5 truncate">{fmtMoney(s.monthlyFee, cur)}</span>
                    </div>
                    <div className="px-2.5 py-2">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.08em] text-ink-400">Paid</span>
                      <span className="block font-mono text-[12.5px] font-bold text-mint-600 tnum mt-0.5 truncate">{rec ? fmtMoney(paid, cur) : "—"}</span>
                    </div>
                    <div className="px-2.5 py-2">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.08em] text-ink-400">Due</span>
                      <span className={`block font-mono text-[12.5px] font-bold tnum mt-0.5 truncate ${rec && due > 0 ? "text-flame-600" : "text-mint-600"}`}>{rec ? fmtMoney(due, cur) : "—"}</span>
                    </div>
                    <div className="px-2.5 py-2">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.08em] text-ink-400">Due Date</span>
                      <span className="block text-[12px] font-bold text-ink-700 tnum mt-0.5 truncate">{rec ? fmtDate(rec.dueDate, df) : "—"}</span>
                    </div>
                  </div>

                  {out > due && (
                    <p className="mx-4 mt-2 text-[11px] font-bold text-flame-700 bg-flame-50 border border-flame-100 rounded-[8px] px-2.5 py-1.5 tnum anim-fade-in">
                      Previous months' balance: {fmtMoney(out - due, cur)} · Total due {fmtMoney(out, cur)}
                    </p>
                  )}

                  {/* guardian */}
                  <div className="flex items-center gap-2.5 px-4 py-2.5 mt-3 bg-ink-50/40 border-y border-ink-100">
                    <Icon name={g0?.whatsapp ? "whatsapp" : "phone"} size={15} className={g0 ? (g0.whatsapp ? "text-[#128c5e]" : "text-ink-400") : "text-flame-500"} />
                    {!g0 ? (
                      <span className="text-[12px] font-bold text-flame-600">No parent number saved — add one to send slips</span>
                    ) : (
                      <span className="flex-1 min-w-0 flex items-baseline gap-2">
                        <span className="text-[12.5px] font-semibold text-ink-700 truncate">{g0.name}</span>
                        <span className="font-mono text-[11.5px] text-ink-400 tnum whitespace-nowrap">{g0.phone}</span>
                        {guards.length > 1 && <Badge tone="slate">+{guards.length - 1}</Badge>}
                      </span>
                    )}
                  </div>

                  {/* actions */}
                  <div className="grid grid-cols-4 gap-1.5 px-3 py-2.5">
                    <MiniAction icon="wallet" label={out > 0 ? "Pay" : "Clear"} muted={out <= 0} onClick={() => {
                      if (out <= 0) { toast.push(`${s.name} has no pending dues — nothing to collect.`, "warn"); return; }
                      ui.openPayment(s.id);
                    }} />
                    <MiniAction icon="slips" label={out > 0 ? "Challan" : "Paid"} muted={out <= 0} onClick={() => {
                      if (out <= 0) { toast.push(`${s.name} is fully paid — no challan needed.`, "warn"); return; }
                      const open = state.feeRecords.filter((r) => r.studentId === s.id).sort((a, b) => a.period.localeCompare(b.period)).find((r) => balanceOf(r, state.payments) > 0 && !r.waived);
                      if (open) ui.openSlip({ kind: "challan", recordId: open.id });
                    }} />
                    <MiniAction icon="edit" label="Edit" onClick={() => ui.openStudentForm({ editId: s.id })} />
                    <MiniAction icon="eye" label="Profile" onClick={() => nav("student", { id: s.id })} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-center text-[11.5px] font-semibold text-ink-400 mt-4 tnum">{rows.length} student{rows.length === 1 ? "" : "s"} · figures for {periodLabel(period)}</p>
        </>
      )}
      {num(0) === 0 && null}
    </div>
  );
}

function MiniAction({ icon, label, onClick, muted }: { icon: string; label: string; onClick: () => void; muted?: boolean }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 h-[54px] rounded-[10px] border transition-all duration-150 press ${muted ? "border-ink-100 bg-ink-50/60 text-ink-300" : "border-ink-150 bg-white text-ink-600 hover:border-gold-500/60 hover:text-gold-700 hover:bg-gold-50/60"}`}>
      <Icon name={icon} size={16} />
      <span className="text-[10px] font-bold tracking-wide">{label}</span>
    </button>
  );
}
