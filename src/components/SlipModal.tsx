import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStore, withActivity } from "../lib/store";
import { Btn, Icon, Modal, useToast } from "./ui";
import { buildChallanModel, buildReceiptModel, renderSlip } from "../lib/slip";
import { challanMessage, receiptMessage } from "../lib/notify";
import { dataUrlToBlob, uid, waLink } from "../lib/utils";
import type { FeeSlipLog } from "../types";

export type SlipTarget =
  | { kind: "challan"; recordId: string }
  | { kind: "receipt"; paymentId: string };

const navShare = navigator as Navigator & { canShare?: (d: ShareData) => boolean };

/**
 * Slip / receipt sharing hub. On mobile it uses the native share sheet so the
 * image is ATTACHED together with the message straight into WhatsApp.
 * Opening WhatsApp (or completing a share) automatically marks the document
 * as sent — no extra taps needed.
 */
export default function SlipModal({ target, onClose }: { target: SlipTarget | null; onClose: () => void }) {
  const { state, patch } = useStore();
  const toast = useToast();
  const [image, setImage] = useState("");
  const [msg, setMsg] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const loggedRef = useRef(false);

  const targetKey = target ? (target.kind === "challan" ? `c:${target.recordId}` : `r:${target.paymentId}`) : "";

  const model = useMemo(() => {
    if (!target) return null;
    if (target.kind === "challan") {
      const rec = state.feeRecords.find((r) => r.id === target.recordId);
      return rec ? buildChallanModel(state, rec) : null;
    }
    const pay = state.payments.find((p) => p.id === target.paymentId);
    return pay ? buildReceiptModel(state, pay) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  const studentId = target?.kind === "challan"
    ? state.feeRecords.find((r) => r.id === (target as { recordId?: string }).recordId)?.studentId
    : state.payments.find((p) => p.id === (target as { paymentId?: string }).paymentId)?.studentId;

  const guardians = useMemo(
    () => (studentId ? state.guardians.filter((g) => g.studentId === studentId).sort((a, b) => Number(b.primary) - Number(a.primary)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.guardians, targetKey]
  );
  const waGuards = guardians.filter((g) => g.whatsapp && g.phone.trim());

  useEffect(() => {
    if (!targetKey || !model) { setImage(""); setMsg(""); setSel([]); loggedRef.current = false; return; }
    loggedRef.current = false;
    const t1 = setTimeout(() => setImage(renderSlip(model)), 60);
    const t2 = setTimeout(() => setImage(renderSlip(model)), 650);
    setMsg(model.kind === "challan"
      ? challanMessage(state, model)
      : receiptMessage(state, state.payments.find((p) => p.id === (target as { paymentId?: string }).paymentId)!));
    const prim = waGuards.filter((g) => g.primary);
    setSel((prim.length ? prim : waGuards.slice(0, 1)).map((g) => g.id));
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  if (!target || !model) return null;

  const isChallan = model.kind === "challan";
  const no = isChallan ? model.slipNo : model.receiptNo;
  const label = isChallan ? "Challan" : "Receipt";
  const fileName = `${no}-${model.studentName.replace(/\s+/g, "-")}.png`;
  const selected = waGuards.filter((g) => sel.includes(g.id));
  const file = image ? new File([dataUrlToBlob(image)], fileName, { type: "image/png" }) : null;
  const canAttach = !!file && typeof navigator.share === "function" && !!navShare.canShare && navShare.canShare({ files: [file] });

  const markSent = (phones: string[]) => {
    if (loggedRef.current) return;
    loggedRef.current = true;
    const refId = isChallan ? (target as { recordId: string }).recordId : (target as { paymentId: string }).paymentId;
    const log: FeeSlipLog = { id: uid("slp"), kind: model.kind, refId, no, generatedAt: new Date().toISOString(), sentTo: phones, sent: true };
    const next = { ...state, slips: [...state.slips, log] };
    patch({ slips: next.slips, activity: withActivity(next, `${label} ${no} shared on WhatsApp for ${model.studentName} (${phones.length} number${phones.length === 1 ? "" : "s"}).`, "share") });
    toast.push(`${label} ${no} marked as sent ✓`);
  };

  /* primary mobile flow — image + message attach together via native share sheet */
  const shareAttached = async () => {
    if (!file) { toast.push("Image is still generating — one second…", "warn"); return; }
    try {
      await navigator.share({ files: [file], text: msg });
      markSent(selected.length ? selected.map((g) => g.phone) : ["native-share"]);
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") toast.push("Share was blocked by the browser.", "err");
    }
  };

  /* per-number flow — opens that exact WhatsApp chat with the message, image auto-downloads for attaching */
  const openChat = (phone: string) => {
    if (canAttach) { shareAttached(); return; }
    if (file) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = fileName;
      a.click();
    }
    const w = window.open(waLink(phone, msg), "_blank", "noopener");
    if (w) markSent([phone]);
    else toast.push("Pop-up blocked — allow pop-ups to open WhatsApp.", "warn");
  };

  const download = () => {
    if (!file) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    toast.push("Image downloaded");
  };

  return (
    <Modal open onClose={onClose} wide title={isChallan ? "Send Fee Challan" : "Send Payment Receipt"} sub={`${no} · ${model.studentName}`}>
      <div className="grid md:grid-cols-[1fr_290px] gap-5">
        {/* preview */}
        <div>
          <div className="rounded-[12px] border border-ink-150 bg-ink-50 p-2">
            {image ? (
              <img src={image} alt={`${label} preview`} className="w-full h-auto rounded-[8px] shadow-md anim-fade-in" />
            ) : (
              <div className="h-72 flex items-center justify-center text-[12.5px] text-ink-400 font-semibold">
                <span className="flex items-center gap-2"><Icon name="refresh" size={15} className="pulse-dot" /> Generating {label.toLowerCase()}…</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Btn variant="outline" icon="download" onClick={download} disabled={!image}>Download Image</Btn>
            {loggedRef.current && <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-mint-700 anim-tick px-2"><Icon name="check" size={15} /> Sent — saved to history</span>}
          </div>
        </div>

        {/* compose + send */}
        <div className="space-y-4">
          {canAttach ? (
            <button onClick={shareAttached} disabled={!image}
              className="w-full rounded-[12px] bg-[#128c5e] hover:bg-[#0e7a50] disabled:opacity-40 text-white px-4 py-4 text-left transition-all press anim-fade-in">
              <span className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-[10px] bg-white/15 flex items-center justify-center shrink-0"><Icon name="whatsapp" size={19} /></span>
                <span>
                  <span className="block text-[14px] font-bold">Share on WhatsApp</span>
                  <span className="block text-[11px] text-white/80 mt-0.5">Image + message dono ek saath attach honge</span>
                </span>
              </span>
            </button>
          ) : (
            <div className="rounded-[10px] border border-ink-150 bg-ink-50/70 px-3 py-2.5 text-[11.5px] text-ink-500 leading-relaxed">
              Is browser mein direct attach support nahi hai — chat khulte hi image download ho jayegi, use chat mein attach kar dein.
            </div>
          )}

          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-2">Send to ({waGuards.length})</span>
            {waGuards.length === 0 ? (
              <p className="text-[12.5px] text-flame-600 font-semibold bg-flame-50 border border-flame-100 rounded-[9px] px-3 py-2.5">
                No WhatsApp numbers saved for this student. Add a guardian contact first.
              </p>
            ) : (
              <div className="space-y-2">
                {waGuards.map((g) => {
                  const on = sel.includes(g.id);
                  return (
                    <label key={g.id} className={`flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 cursor-pointer transition-colors ${on ? "border-mint-600/40 bg-mint-50/60" : "border-ink-150 hover:border-ink-300"}`}>
                      <input type="checkbox" checked={on} onChange={() => setSel((s) => (on ? s.filter((x) => x !== g.id) : [...s, g.id]))} className="accent-[#12855f]" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-semibold text-ink-900 truncate">{g.name} <span className="text-ink-400 font-normal">· {g.relation}</span></span>
                        <span className="block font-mono text-[11px] text-ink-400 tnum">{g.phone}</span>
                      </span>
                      <button type="button" onClick={(e) => { e.preventDefault(); openChat(g.phone); }} disabled={!on || !image}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-[#128c5e] text-white text-[11.5px] font-bold disabled:opacity-35 press shrink-0">
                        <Icon name="whatsapp" size={13} /> Open
                      </button>
                    </label>
                  );
                })}
                {selected.length > 1 && (
                  <p className="text-[11px] text-ink-400 leading-relaxed px-1">
                    {selected.length} numbers selected — "Share on WhatsApp" se image+message ek saath bhejein, ya har number ka "Open" individually dabayein.
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-2">Message (editable)</span>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={6}
              className="w-full px-3 py-2.5 rounded-[10px] border border-ink-200 bg-white text-[12px] leading-relaxed focus:border-gold-500" />
          </div>
        </div>
      </div>
    </Modal>
  );
}
