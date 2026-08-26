import React, { useEffect, useMemo, useState } from "react";
import { useNav } from "../components/Shell";
import { Badge, Btn, EmptyState, Icon, PageHead, TSelect, useToast } from "../components/ui";
import { balanceOf, recordsFor } from "../lib/fee";
import { buildSlipModel, slipBlob, slipDataUrl } from "../lib/slip";
import { useStore, withActivity } from "../lib/store";
import { fillTemplate, fmtDate, fmtMoney, periodLabel, uid, waLink } from "../lib/utils";
import type { FeeSlipRec } from "../types";

export default function Slips() {
  const { state, patch } = useStore();
  const { route } = useNav();
  const toast = useToast();
  const df = state.settings.dateFormat;
  const cur = state.settings.feePolicy.currency;

  const candidates = state.students.filter((s) => s.status === "active" && state.feeRecords.some((r) => r.studentId === s.id));
  const [studentId, setStudentId] = useState(route.params?.studentId ?? candidates[0]?.id ?? "");
  const [recId, setRecId] = useState(route.params?.feeRecordId ?? "");
  const [preview, setPreview] = useState<string>("");
  const [rendering, setRendering] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [askShared, setAskShared] = useState(false);

  const student = state.students.find((s) => s.id === studentId);
  const recs = useMemo(() => (student ? recordsFor(state, student.id) : []), [state, student]);
  const rec = recs.find((r) => r.id === recId) ?? recs[0];
  const guardians = useMemo(() => state.guardians.filter((g) => g.studentId === studentId), [state.guardians, studentId]);
  const waGuardians = guardians.filter((g) => g.whatsapp);
  const slipRec: FeeSlipRec | undefined = rec ? state.slips.find((s) => s.feeRecordId === rec.id) : undefined;

  // sensible defaults when student changes
  useEffect(() => {
    if (!rec && recs.length > 0) {
      const due = recs.find((r) => balanceOf(r, state.payments) > 0) ?? recs[0];
      setRecId(due.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, recs.length]);

  useEffect(() => {
    const primary = guardians.filter((g) => g.primary).map((g) => g.id);
    setSelected(primary.length > 0 ? primary : guardians.slice(0, 1).map((g) => g.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const model = useMemo(() => (rec ? buildSlipModel(state, rec) : null), [state, rec]);

  useEffect(() => {
    let alive = true;
    if (!model) { setPreview(""); return; }
    setRendering(true);
    slipDataUrl(model).then((url) => {
      if (alive) { setPreview(url); setRendering(false); }
    });
    return () => { alive = false; };
  }, [model]);

  const ensureSlipRecord = (status: FeeSlipRec["shareStatus"]): FeeSlipRec | null => {
    if (!rec || !student) return null;
    const existing = state.slips.find((s) => s.feeRecordId === rec.id);
    if (existing) {
      const slips = state.slips.map((s) => (s.id === existing.id ? { ...s, shareStatus: status, shareTargets: selected } : s));
      patch({ slips });
      return { ...existing, shareStatus: status, shareTargets: selected };
    }
    const fresh: FeeSlipRec = { id: uid("slip"), feeRecordId: rec.id, studentId: student.id, period: rec.period, generatedAt: new Date().toISOString(), shareTargets: selected, shareStatus: status };
    patch({ slips: [...state.slips, fresh] });
    return fresh;
  };

  const download = async () => {
    if (!model) return;
    const blob = await slipBlob(model);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fee-slip-${model.studentName.replace(/\s+/g, "-").toLowerCase()}-${rec?.period}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    ensureSlipRecord(slipRec?.shareStatus === "shared" ? "shared" : "ready");
    toast.push("Slip image downloaded");
  };

  const share = async () => {
    if (!model) return;
    ensureSlipRecord("ready");
    try {
      const blob = await slipBlob(model);
      const file = new File([blob], `fee-slip-${model.studentName.replace(/\s+/g, "-")}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Tuition Fee Slip", text: message });
        setAskShared(true);
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
    toast.push("Direct share unavailable — use Download + WhatsApp below", "warn");
  };

  const openWA = (phone: string) => {
    ensureSlipRecord("ready");
    window.open(waLink(phone, message), "_blank");
    setAskShared(true);
  };

  const markShared = () => {
    ensureSlipRecord("shared");
    if (student) {
      patch({ activity: withActivity(state, `Fee slip marked as shared for ${student.name} (${rec ? periodLabel(rec.period, true) : ""}).`, "slip") });
    }
    toast.push("Marked as shared by user");
    setAskShared(false);
  };

  const message = useMemo(() => {
    if (!model) return "";
    return fillTemplate(state.settings.whatsappTemplate, {
      student: model.studentName,
      month: model.periodLbl,
      total: fmtMoney(model.totalPayable, cur),
      due: fmtDate(rec?.dueDate, df),
      remaining: fmtMoney(model.remaining, cur),
      tuition: state.settings.tuitionName,
    });
  }, [model, state.settings, rec, cur, df]);

  const history = student ? state.slips.filter((s) => s.studentId === student.id).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)) : [];

  if (candidates.length === 0) {
    return (
      <div>
        <PageHead title="Fee Slips" sub="Professional challans rendered as WhatsApp-ready images" />
        <div className="card"><EmptyState icon="slips" title="Nothing to bill yet" message="Fee slips are built from monthly fee records. Admit students and let a fee cycle generate records first." /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHead title="Fee Slips" sub="Preview the challan, pick parent numbers, share the image on WhatsApp" />

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-5 items-start">
        {/* ---------- preview ---------- */}
        <section className="card p-5 anim-fade-up">
          <div className="flex flex-wrap gap-2.5 mb-4">
            <TSelect value={studentId} onChange={(e) => { setStudentId(e.target.value); setRecId(""); }} className="!w-auto min-w-48 flex-1">
              {candidates.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </TSelect>
            <TSelect value={rec?.id ?? ""} onChange={(e) => setRecId(e.target.value)} className="!w-auto min-w-44">
              {recs.map((r) => {
                const bal = balanceOf(r, state.payments);
                return <option key={r.id} value={r.id}>{periodLabel(r.period)}{bal > 0 ? ` · due ${fmtMoney(bal, cur)}` : " · settled"}</option>;
              })}
            </TSelect>
          </div>

          <div className="relative rounded-[12px] border border-ink-150 bg-ink-50 p-3 sm:p-5 flex justify-center overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(20,32,58,0.06)_1px,transparent_1.2px)] bg-[length:16px_16px]" />
            {preview ? (
              <img src={preview} alt="Fee slip preview" className={`relative w-full max-w-[430px] rounded-[6px] shadow-xl transition-opacity duration-300 ${rendering ? "opacity-40" : "opacity-100"}`} />
            ) : (
              <div className="relative py-24 text-center text-[13px] text-ink-400">Rendering slip…</div>
            )}
          </div>

          <div className="flex gap-2 mt-4 flex-wrap">
            <Btn variant="primary" icon="download" onClick={download} disabled={!model}>Download PNG</Btn>
            <Btn variant="gold" icon="share" onClick={share} disabled={!model}>Share Image…</Btn>
            {slipRec?.shareStatus === "shared"
              ? <Badge tone="green" className="self-center">Shared by User</Badge>
              : <Badge tone="slate" className="self-center">{slipRec ? "Share Ready" : "Not Shared"}</Badge>}
          </div>
          <p className="text-[11px] text-ink-400 mt-3 leading-relaxed border-t border-dashed border-ink-100 pt-3">
            Browsers cannot silently attach images to WhatsApp — the flow downloads/opens the share sheet, then you confirm. Delivery is never assumed.
          </p>
        </section>

        {/* ---------- recipients & message ---------- */}
        <div className="space-y-5">
          <section className="card p-5 anim-fade-up" style={{ animationDelay: "80ms" }}>
            <h2 className="font-display font-bold text-[16px] text-ink-900 mb-1">Send Fee Slip to</h2>
            <p className="text-[12px] text-ink-400 mb-3.5">Saved parent/guardian numbers for {student?.name}. Select one or many.</p>
            {guardians.length === 0 ? (
              <p className="text-[12.5px] text-flame-600 bg-flame-50 border border-flame-100 rounded-[9px] px-3 py-2.5 font-semibold">No contact numbers saved — add guardians on the student profile to enable sharing.</p>
            ) : (
              <div className="space-y-2">
                {guardians.map((g) => {
                  const on = selected.includes(g.id);
                  return (
                    <label key={g.id} className={`flex items-center gap-3 rounded-[10px] border px-3.5 py-2.5 cursor-pointer transition-all ${on ? "border-mint-600/40 bg-mint-50/60" : "border-ink-100 hover:border-ink-300"}`}>
                      <input type="checkbox" checked={on} onChange={() => setSelected((xs) => (on ? xs.filter((x) => x !== g.id) : [...xs, g.id]))} className="accent-[#12855f] w-4 h-4" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-semibold text-ink-900">{g.name} {g.primary && <Badge tone="gold" className="ml-1">Primary</Badge>}</span>
                        <span className="block text-[11.5px] text-ink-400 tnum">{g.relation} · {g.phone}</span>
                      </span>
                      {g.whatsapp
                        ? <button onClick={(e) => { e.preventDefault(); openWA(g.phone); }} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[8px] bg-[#128c5e] text-white text-[11.5px] font-bold hover:bg-[#0e7a50] transition-colors press"><Icon name="whatsapp" size={14} />Open WhatsApp</button>
                        : <Badge tone="slate">No WhatsApp</Badge>}
                    </label>
                  );
                })}
              </div>
            )}
            {selected.length > 0 && waGuardians.length > 0 && (
              <div className="mt-3.5">
                <Btn variant="wa" icon="whatsapp" className="w-full" onClick={() => {
                  const targets = guardians.filter((g) => selected.includes(g.id) && g.whatsapp);
                  if (targets.length === 0) { toast.push("Selected contacts have no WhatsApp", "warn"); return; }
                  targets.forEach((t, i) => setTimeout(() => window.open(waLink(t.phone, message), "_blank"), i * 400));
                  ensureSlipRecord("ready");
                  setAskShared(true);
                }}>
                  Open WhatsApp for {guardians.filter((g) => selected.includes(g.id) && g.whatsapp).length} selected
                </Btn>
              </div>
            )}
            {askShared && (
              <div className="mt-3 rounded-[10px] border border-gold-600/35 bg-gold-50 px-3.5 py-3 flex items-center gap-3 anim-pop">
                <Icon name="check" size={16} className="text-gold-600 shrink-0" />
                <p className="flex-1 text-[12px] font-semibold text-ink-700">Did you send the slip & message to the parent?</p>
                <Btn size="sm" variant="gold" onClick={markShared}>Yes, mark shared</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setAskShared(false)}>Not yet</Btn>
              </div>
            )}
          </section>

          <section className="card p-5 anim-fade-up" style={{ animationDelay: "140ms" }}>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="font-display font-bold text-[16px] text-ink-900">Prefilled Message</h2>
              <span className="text-[10.5px] font-bold text-ink-300 uppercase tracking-wider">Editable in Settings</span>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-ink-700 bg-ink-50 border border-ink-100 rounded-[10px] px-3.5 py-3">{message || "Select a fee record to preview the message."}</pre>
            {model && (
              <div className="grid grid-cols-2 gap-2 mt-3 text-[11.5px] tnum">
                <div className="flex justify-between rounded-[8px] bg-ink-50 px-2.5 py-1.5"><span className="text-ink-400 font-semibold">Total payable</span><span className="font-mono font-bold text-ink-900">{fmtMoney(model.totalPayable, cur)}</span></div>
                <div className="flex justify-between rounded-[8px] bg-ink-50 px-2.5 py-1.5"><span className="text-ink-400 font-semibold">Remaining</span><span className={`font-mono font-bold ${model.remaining > 0 ? "text-flame-600" : "text-mint-600"}`}>{fmtMoney(model.remaining, cur)}</span></div>
              </div>
            )}
          </section>

          <section className="card p-5 anim-fade-up" style={{ animationDelay: "200ms" }}>
            <h2 className="font-display font-bold text-[16px] text-ink-900 mb-3">Share History</h2>
            {history.length === 0 ? (
              <p className="text-[12.5px] text-ink-400">No slips generated for {student?.name} yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 text-[12.5px]">
                    <Icon name="slips" size={15} className="text-gold-600 shrink-0" />
                    <span className="flex-1 font-semibold text-ink-800">{periodLabel(h.period)}</span>
                    <span className="text-ink-400 tnum">{fmtDate(h.generatedAt.slice(0, 10), df)}</span>
                    <Badge tone={h.shareStatus === "shared" ? "green" : h.shareStatus === "ready" ? "gold" : "slate"}>
                      {h.shareStatus === "shared" ? "Shared by User" : h.shareStatus === "ready" ? "Share Ready" : "Not Shared"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
