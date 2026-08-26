import React, { useEffect, useMemo, useState } from "react";
import { useStore, withActivity } from "../lib/store";
import { Btn, Icon, Modal, useToast } from "./ui";
import { buildChallanModel, buildReceiptModel, renderSlip } from "../lib/slip";
import { challanMessage, receiptMessage, whatsappGuardians } from "../lib/notify";
import { dataUrlToBlob, uid, waLink } from "../lib/utils";
import type { FeeSlipLog } from "../types";

export type SlipTarget =
  | { kind: "challan"; recordId: string }
  | { kind: "receipt"; paymentId: string };

export default function SlipModal({ target, onClose }: { target: SlipTarget | null; onClose: () => void }) {
  const { state, patch } = useStore();
  const toast = useToast();
  const [image, setImage] = useState<string>("");
  const [msg, setMsg] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [opened, setOpened] = useState<string[]>([]);
  const [logged, setLogged] = useState(false);

  const model = useMemo(() => {
    if (!target) return null;
    if (target.kind === "challan") {
      const rec = state.feeRecords.find((r) => r.id === target.recordId);
      return rec ? buildChallanModel(state, rec) : null;
    }
    const pay = state.payments.find((p) => p.id === target.paymentId);
    return pay ? buildReceiptModel(state, pay) : null;
  }, [target, state]);

  const studentId = (() => {
    if (!target) return undefined;
    if (target.kind === "challan") return state.feeRecords.find((r) => r.id === target.recordId)?.studentId;
    return state.payments.find((p) => p.id === target.paymentId)?.studentId;
  })();
  const guardians = useMemo(() => (studentId ? state.guardians.filter((g) => g.studentId === studentId) : []), [state.guardians, studentId]);
  const waGuards = guardians.filter((g) => g.whatsapp && g.phone.trim());

  const targetKey = target ? (target.kind === "challan" ? `c:${target.recordId}` : `r:${target.paymentId}`) : "";
  useEffect(() => {
    if (!target || !model) { setImage(""); setMsg(""); setSel([]); setOpened([]); setLogged(false); return; }
    // render after fonts settle
    const t1 = setTimeout(() => setImage(renderSlip(model)), 60);
    const t2 = setTimeout(() => setImage(renderSlip(model)), 600);
    setMsg(model.kind === "challan" ? challanMessage(state, model) : receiptMessage(state, state.payments.find((p) => p.id === (target as { paymentId?: string }).paymentId)!));
    const primaries = waGuards.filter((g) => g.primary).map((g) => g.id);
    setSel(primaries.length ? primaries : waGuards.slice(0, 1).map((g) => g.id));
    setOpened([]);
    setLogged(false);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  if (!target || !model) return null;

  const isChallan = model.kind === "challan";
  const no = isChallan ? model.slipNo : model.receiptNo;
  const fileName = isChallan ? `${model.slipNo}-${model.studentName.replace(/\s+/g, "-")}.png` : `${model.receiptNo}-${model.studentName.replace(/\s+/g, "-")}.png`;
  const selected = guardians.filter((g) => sel.includes(g.id));

  const openWA = (phone: string) => {
    window.open(waLink(phone, msg), "_blank", "noopener");
    setOpened((o) => (o.includes(phone) ? o : [...o, phone]));
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = image;
    a.download = fileName;
    a.click();
    toast.push("Image downloaded — attach it in the WhatsApp chat");
  };

  const webShare = async () => {
    try {
      const file = new File([dataUrlToBlob(image)], fileName, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: msg });
        markSent();
      } else {
        await navigator.share({ text: msg });
      }
    } catch { /* user cancelled */ }
  };

  const markSent = () => {
    if (logged) return;
    const refId = isChallan ? (target as { recordId: string }).recordId : (target as { paymentId: string }).paymentId;
    const log: FeeSlipLog = { id: uid("slp"), kind: model.kind, refId, no, generatedAt: new Date().toISOString(), sentTo: opened, sent: true };
    const label = isChallan ? `Challan ${no}` : `Receipt ${no}`;
    patch({
      slips: [...state.slips, log],
      activity: withActivity({ ...state, slips: [...state.slips, log] }, `${label} shared for ${model.studentName} (${opened.length} contact${opened.length === 1 ? "" : "s"}).`, "share"),
    });
    setLogged(true);
    toast.push(`${label} marked as shared`);
  };

  return (
    <Modal open onClose={onClose} wide title={isChallan ? "Fee Challan — Send to Parent" : "Payment Receipt — Send to Parent"} sub={`${no} · ${model.studentName}`}>
      <div className="grid md:grid-cols-[1fr_300px] gap-5">
        {/* preview */}
        <div>
          <div className="rounded-[12px] border border-ink-150 bg-ink-50 p-2 overflow-hidden">
            {image ? (
              <img src={image} alt={isChallan ? "Fee challan preview" : "Receipt preview"} className="w-full h-auto rounded-[8px] shadow-md anim-fade-in" />
            ) : (
              <div className="h-72 flex items-center justify-center text-[12.5px] text-ink-400 font-semibold">
                <span className="flex items-center gap-2"><Icon name="refresh" size={15} className="pulse-dot" /> Generating professional {isChallan ? "challan" : "receipt"}…</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Btn variant="outline" icon="download" onClick={download} disabled={!image}>Download Image</Btn>
            {typeof navigator.share === "function" && <Btn variant="outline" icon="share" onClick={webShare} disabled={!image}>Share…</Btn>}
            {opened.length > 0 && !logged && <Btn variant="success" icon="check" onClick={markSent}>Mark as Shared ({opened.length})</Btn>}
            {logged && <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-mint-700 anim-tick"><Icon name="check" size={15} /> Shared & saved to history</span>}
          </div>
          <p className="text-[11.5px] text-ink-400 mt-2.5 leading-relaxed">
            Browsers cannot silently attach images to WhatsApp — the chat opens with the message ready; attach the downloaded (or shared) image in it.
          </p>
        </div>

        {/* compose */}
        <div className="space-y-4">
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-2">WhatsApp message</span>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={7}
              className="w-full px-3 py-2.5 rounded-[10px] border border-ink-200 bg-white text-[12.5px] leading-relaxed focus:border-gold-500" />
          </div>
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-2">Send to ({waGuards.length} WhatsApp number{waGuards.length === 1 ? "" : "s"})</span>
            {waGuards.length === 0 ? (
              <p className="text-[12.5px] text-flame-600 font-semibold bg-flame-50 border border-flame-100 rounded-[9px] px-3 py-2.5">
                No WhatsApp numbers saved for this student. Add a guardian contact first.
              </p>
            ) : (
              <div className="space-y-2">
                {waGuards.map((g) => {
                  const on = sel.includes(g.id);
                  const done = opened.includes(g.phone);
                  return (
                    <label key={g.id} className={`flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 cursor-pointer transition-colors ${on ? "border-mint-600/40 bg-mint-50/60" : "border-ink-150 hover:border-ink-300"}`}>
                      <input type="checkbox" checked={on} onChange={() => setSel((s) => (on ? s.filter((x) => x !== g.id) : [...s, g.id]))} className="accent-[#12855f]" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-semibold text-ink-900 truncate">{g.name} <span className="text-ink-400 font-normal">· {g.relation}</span></span>
                        <span className="block font-mono text-[11px] text-ink-400 tnum">{g.phone}</span>
                      </span>
                      <button type="button" onClick={(e) => { e.preventDefault(); openWA(g.phone); }} disabled={!on}
                        className="inline-flex items-center gap-1.5 h-7.5 px-2.5 rounded-[8px] bg-[#128c5e] text-white text-[11.5px] font-bold disabled:opacity-35 press">
                        <Icon name="whatsapp" size={13} /> {done ? "Opened" : "Open"}
                      </button>
                    </label>
                  );
                })}
                {selected.length > 1 && (
                  <Btn variant="wa" size="sm" icon="whatsapp" className="w-full" onClick={() => selected.forEach((g, i) => setTimeout(() => openWA(g.phone), i * 450))}>
                    Open WhatsApp for all {selected.length} numbers
                  </Btn>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
