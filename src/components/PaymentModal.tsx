import React, { useEffect, useMemo, useState } from "react";
import type { PaymentMethod } from "../types";
import { PAYMENT_METHODS } from "../types";
import { balanceOf, chargeOf, receiptNo } from "../lib/fee";
import { useStore, withActivity } from "../lib/store";
import { fmtMoney, num, periodLabel, todayISO, uid } from "../lib/utils";
import { Btn, Field, Icon, Modal, TInput, TSelect, TArea, useToast } from "./ui";

export default function PaymentModal({ open, onClose, studentId, feeRecordId, paymentId }: { open: boolean; onClose: () => void; studentId?: string; feeRecordId?: string; paymentId?: string }) {
  const { state, patch } = useStore();
  const toast = useToast();
  const cur = state.settings.feePolicy.currency;
  const editing = paymentId ? state.payments.find((p) => p.id === paymentId) : undefined;

  const eligible = state.students.filter((s) => s.status === "active" && state.feeRecords.some((r) => r.studentId === s.id));
  const [sid, setSid] = useState("");
  const [recId, setRecId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [allowOver, setAllowOver] = useState(false);
  const [err, setErr] = useState("");
  const [key, setKey] = useState("");

  const openKey = open ? `${studentId}|${feeRecordId}|${paymentId}` : "closed";
  useEffect(() => {
    if (!open) return;
    if (key === openKey) return;
    setKey(openKey);
    setErr("");
    setAllowOver(false);
    if (editing) {
      setSid(editing.studentId);
      setRecId(editing.feeRecordId);
      setAmount(String(editing.amount));
      setDate(editing.date);
      setMethod(editing.method);
      setReference(editing.reference ?? "");
      setNote(editing.note ?? "");
      return;
    }
    const s = studentId ?? eligible[0]?.id ?? "";
    setSid(s);
    const recs = state.feeRecords.filter((r) => r.studentId === s).sort((a, b) => b.period.localeCompare(a.period));
    const withDue = recs.find((r) => balanceOf(r, state.payments) > 0) ?? recs[0];
    setRecId(feeRecordId ?? withDue?.id ?? "");
    setAmount(withDue && !feeRecordId ? String(balanceOf(withDue, state.payments)) : feeRecordId ? String(balanceOf(recs.find((r) => r.id === feeRecordId) ?? withDue, state.payments)) : "");
    setDate(todayISO());
    setMethod("Cash");
    setReference("");
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey, open]);

  const recs = useMemo(() => state.feeRecords.filter((r) => r.studentId === sid).sort((a, b) => b.period.localeCompare(a.period)), [state.feeRecords, sid]);
  const rec = recs.find((r) => r.id === recId);
  const balance = rec ? balanceOf(rec, state.payments) : 0;
  const charge = rec ? chargeOf(rec) : 0;
  const amt = num(amount);
  const overpay = !editing && rec ? amt > balance : false;

  const pickStudent = (id: string) => {
    setSid(id);
    const rs = state.feeRecords.filter((r) => r.studentId === id).sort((a, b) => b.period.localeCompare(a.period));
    const withDue = rs.find((r) => balanceOf(r, state.payments) > 0) ?? rs[0];
    setRecId(withDue?.id ?? "");
    setAmount(withDue ? String(balanceOf(withDue, state.payments)) : "");
  };

  const pickRec = (id: string) => {
    setRecId(id);
    const r = state.feeRecords.find((x) => x.id === id);
    if (r) setAmount(String(balanceOf(r, state.payments)));
  };

  const save = () => {
    if (!sid) return setErr("Select a student.");
    if (!rec) return setErr("Select the fee period this payment belongs to.");
    if (amt <= 0) return setErr("Amount must be greater than zero.");
    if (overpay && !allowOver) return setErr(`Amount exceeds the remaining ${fmtMoney(balance, cur)}. Tick the advance option below to accept it anyway.`);
    const payments = editing
      ? state.payments.map((p) => (p.id === editing.id ? { ...p, amount: amt, date, method, reference: reference || undefined, note: note || undefined, state: "edited" as const, editedAt: new Date().toISOString() } : p))
      : [...state.payments, {
          id: uid("pay"), receiptNo: receiptNo(state.payments), feeRecordId: rec.id, studentId: sid, amount: amt, date, method,
          reference: reference || undefined, note: note || undefined, state: "recorded" as const, createdAt: new Date().toISOString(),
        }];
    const sName = state.students.find((s) => s.id === sid)?.name ?? "student";
    const activity = withActivity(
      { ...state, payments },
      editing ? `Payment ${editing.receiptNo} edited — ${fmtMoney(amt, cur)} for ${sName}.` : `Payment ${receiptNo(state.payments)} recorded — ${fmtMoney(amt, cur)} from ${sName} (${periodLabel(rec.period, true)}).`,
      "payment"
    );
    patch({ payments, activity });
    toast.push(editing ? "Payment updated" : `Payment saved · ${receiptNo(state.payments)}`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit Payment · ${editing.receiptNo}` : "Record Payment"} sub={editing ? "The linked fee record recalculates automatically" : "A human-readable receipt number is assigned on save"}
      footer={<>
        <Btn variant="outline" onClick={onClose}>Cancel</Btn>
        <Btn variant="success" icon="wallet" onClick={save}>{editing ? "Save Changes" : "Record Payment"}</Btn>
      </>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Student" required>
          <TSelect value={sid} onChange={(e) => pickStudent(e.target.value)} disabled={!!editing}>
            <option value="">Select…</option>
            {eligible.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </TSelect>
        </Field>
        <Field label="Fee Period" required>
          <TSelect value={recId} onChange={(e) => pickRec(e.target.value)} disabled={!!editing || !sid}>
            <option value="">Select…</option>
            {recs.map((r) => {
              const bal = balanceOf(r, state.payments);
              return <option key={r.id} value={r.id}>{periodLabel(r.period)} — {bal > 0 ? `due ${fmtMoney(bal, cur)}` : "settled"}</option>;
            })}
          </TSelect>
        </Field>

        {rec && (
          <div className="sm:col-span-2 grid grid-cols-3 gap-2 rounded-[10px] bg-ink-50 border border-ink-100 px-3.5 py-3">
            <div><div className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Charge</div><div className="font-mono font-semibold text-[13.5px] text-ink-900 tnum">{fmtMoney(charge, cur)}</div></div>
            <div><div className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Paid</div><div className="font-mono font-semibold text-[13.5px] text-mint-600 tnum">{fmtMoney(charge - balance, cur)}</div></div>
            <div><div className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Remaining</div><div className={`font-mono font-bold text-[13.5px] tnum ${balance > 0 ? "text-flame-600" : "text-mint-600"}`}>{fmtMoney(balance, cur)}</div></div>
          </div>
        )}

        <Field label={`Amount (${cur})`} required error={err && amt <= 0 ? err : undefined}>
          <TInput type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Payment Date" required><TInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Method">
          <TSelect value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</TSelect>
        </Field>
        <Field label="Reference (TID / cheque)"><TInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" /></Field>
        <Field label="Note" className="sm:col-span-2"><TArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></Field>
      </div>

      {overpay && (
        <div className="mt-4 rounded-[10px] border border-warn-600/30 bg-warn-50 px-3.5 py-3 anim-fade-in">
          <div className="flex items-start gap-2.5">
            <Icon name="alert" size={16} className="text-warn-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[12.5px] font-semibold text-warn-700">This is {fmtMoney(amt - balance, cur)} more than the remaining due.</p>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={allowOver} onChange={(e) => setAllowOver(e.target.checked)} className="accent-[#e8a020] w-3.5 h-3.5" />
                <span className="text-[12px] font-semibold text-ink-700">Accept as advance (MVP keeps it on this record; balance will not go negative)</span>
              </label>
            </div>
          </div>
        </div>
      )}
      {err && !(overpay && !allowOver) && amt > 0 && <p className="mt-3 text-[12px] font-semibold text-flame-600">{err}</p>}
    </Modal>
  );
}
