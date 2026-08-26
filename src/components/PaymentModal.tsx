import React, { useEffect, useMemo, useState } from "react";
import type { Payment, PaymentMethod } from "../types";
import { PAYMENT_METHODS } from "../types";
import { balanceOf, chargeOf, receiptNo } from "../lib/fee";
import { useStore, withActivity } from "../lib/store";
import { fmtMoney, num, periodLabel, todayISO, uid } from "../lib/utils";
import { Btn, Confirm, Field, Modal, TInput, TSelect, useToast } from "./ui";

export default function PaymentModal({ open, onClose, studentId, paymentId, onSendReceipt }: {
  open: boolean;
  onClose: () => void;
  studentId?: string;
  paymentId?: string;
  onSendReceipt?: (paymentId: string) => void;
}) {
  const { state, patch } = useStore();
  const toast = useToast();
  const editingPayment = paymentId ? state.payments.find((p) => p.id === paymentId) : undefined;
  const cur = state.settings.feePolicy.currency;

  const activeStudents = useMemo(
    () => [...state.students.filter((s) => s.status === "active")].sort((a, b) => a.name.localeCompare(b.name)),
    [state.students]
  );

  const [sId, setSId] = useState("");
  const [recordId, setRecordId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [overAsk, setOverAsk] = useState(false);
  const [editAsk, setEditAsk] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const records = useMemo(
    () => state.feeRecords.filter((r) => r.studentId === sId).sort((a, b) => b.period.localeCompare(a.period)),
    [state.feeRecords, sId]
  );
  const record = records.find((r) => r.id === recordId);
  const balance = record ? balanceOf(record, state.payments) : 0;

  useEffect(() => {
    if (!open) return;
    setError(""); setOverAsk(false); setEditAsk(false); setSavedId(null);
    setMethod("Cash"); setDate(todayISO()); setReference(""); setNote("");
    if (editingPayment) {
      setSId(editingPayment.studentId);
      setRecordId(editingPayment.feeRecordId);
      setAmount(String(editingPayment.amount));
      setDate(editingPayment.date);
      setMethod(editingPayment.method);
      setReference(editingPayment.reference ?? "");
      setNote(editingPayment.note ?? "");
    } else {
      const sid = studentId ?? activeStudents[0]?.id ?? "";
      setSId(sid);
      const recs = state.feeRecords.filter((r) => r.studentId === sid).sort((a, b) => b.period.localeCompare(a.period));
      const openRec = recs.find((r) => balanceOf(r, state.payments) > 0) ?? recs[0];
      setRecordId(openRec?.id ?? "");
      setAmount(openRec ? String(balanceOf(openRec, state.payments) || chargeOf(openRec)) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paymentId, studentId]);

  // keep amount in sync when switching record
  useEffect(() => {
    if (!open || editingPayment || !record) return;
    const bal = balanceOf(record, state.payments);
    if (bal > 0) setAmount(String(bal));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  const amt = num(amount);
  const isOver = !!record && amt > balance && balance > 0;
  const isFull = !!record && amt >= balance && balance > 0;

  const persist = () => {
    if (!record) { setError("Pick the fee month this payment belongs to."); return; }
    if (amt <= 0) { setError("Amount must be greater than zero."); return; }
    if (!date) { setError("Payment date is required."); return; }
    if (isOver && !overAsk) { setOverAsk(true); return; }
    if (editingPayment && !editAsk) { setEditAsk(true); return; }

    if (editingPayment) {
      const payments = state.payments.map((p) => (p.id === editingPayment.id ? { ...p, amount: amt, date, method, reference: reference || undefined, note: note || undefined, state: "edited" as const } : p));
      const next = { ...state, payments };
      patch({ payments, activity: withActivity(next, `Payment ${editingPayment.receiptNo} edited — now ${fmtMoney(amt, cur)} for ${state.students.find((s) => s.id === editingPayment.studentId)?.name ?? ""}.`, "fee") });
      toast.push("Payment updated");
      onClose();
      return;
    }

    const payment: Payment = {
      id: uid("pay"),
      receiptNo: receiptNo(state.payments),
      feeRecordId: record.id,
      studentId: record.studentId,
      amount: amt,
      date, method,
      reference: reference || undefined,
      note: note || undefined,
      state: "recorded",
      createdAt: new Date().toISOString(),
    };
    const payments = [...state.payments, payment];
    const student = state.students.find((s) => s.id === record.studentId);
    const remaining = Math.max(0, balanceOf(record, payments));
    const next = { ...state, payments };
    patch({ payments, activity: withActivity(next, `Payment ${payment.receiptNo} — ${fmtMoney(amt, cur)} from ${student?.name ?? ""} (${periodLabel(record.period)}, ${method}).`, "fee") });
    toast.push(remaining > 0 ? `Payment saved · ${fmtMoney(remaining, cur)} still due` : "Full payment saved — fee settled");
    setSavedId(payment.id);
  };

  const studentName = state.students.find((s) => s.id === sId)?.name ?? "";

  return (
    <>
      <Modal open={open && !savedId} onClose={onClose}
        title={editingPayment ? `Edit Payment ${editingPayment.receiptNo}` : "Record Payment"}
        sub={editingPayment ? "Editing keeps the record traceable" : "A small receipt is generated instantly"}
        footer={<>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="gold" icon="save" onClick={persist}>{editingPayment ? "Save Changes" : "Save Payment"}</Btn>
        </>}>
        <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
          <Field label="Student" required>
            <TSelect value={sId} onChange={(e) => {
              setSId(e.target.value);
              const recs = state.feeRecords.filter((r) => r.studentId === e.target.value).sort((a, b) => b.period.localeCompare(a.period));
              const openRec = recs.find((r) => balanceOf(r, state.payments) > 0) ?? recs[0];
              setRecordId(openRec?.id ?? "");
              setAmount(openRec ? String(balanceOf(openRec, state.payments) || chargeOf(openRec)) : "");
            }} disabled={!!editingPayment}>
              {activeStudents.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
            </TSelect>
          </Field>
          <Field label="Fee Month" required>
            <TSelect value={recordId} onChange={(e) => setRecordId(e.target.value)}>
              {records.length === 0 && <option value="">No challans yet</option>}
              {records.map((r) => {
                const bal = balanceOf(r, state.payments);
                return <option key={r.id} value={r.id}>{periodLabel(r.period)} — {bal > 0 ? `${fmtMoney(bal, cur)} due` : "Paid"}</option>;
              })}
            </TSelect>
          </Field>
          <Field label={`Amount (${cur})`} required error={error || undefined} hint={record && balance > 0 ? `Balance for this month: ${fmtMoney(balance, cur)}` : undefined}>
            <TInput type="number" min={1} value={amount} onChange={(e) => { setAmount(e.target.value); setError(""); }} />
          </Field>
          <Field label="Payment Date" required>
            <TInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Method">
            <TSelect value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
            </TSelect>
          </Field>
          <Field label="Reference / TID">
            <TInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank / wallet reference (optional)" />
          </Field>
          <Field label="Note" className="sm:col-span-2">
            <TInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </Field>
        </div>

        {record && amt > 0 && (
          <div className={`mt-4 rounded-[10px] border px-3.5 py-3 text-[12.5px] font-semibold anim-fade-in ${isOver ? "border-warn-600/30 bg-warn-50 text-warn-700" : isFull ? "border-mint-600/25 bg-mint-50 text-mint-700" : "border-gold-600/30 bg-gold-50 text-gold-700"}`}>
            {isOver
              ? `This is ${fmtMoney(amt - balance, cur)} more than the ${fmtMoney(balance, cur)} balance — the extra stays as advance credit, balance will never go negative.`
              : isFull
                ? `Full payment — ${studentName}'s ${periodLabel(record.period)} fee will be settled.`
                : `Partial payment — ${fmtMoney(Math.max(0, balance - amt), cur)} will remain due for ${periodLabel(record.period)}.`}
          </div>
        )}
      </Modal>

      {/* success — send receipt straight away */}
      {open && savedId && (() => {
        const p = state.payments.find((x) => x.id === savedId);
        if (!p) return null;
        return (
          <Modal open onClose={onClose} title="Payment Saved" sub={`${p.receiptNo} · ${studentName}`}>
            <div className="rounded-[12px] border border-mint-600/25 bg-mint-50 p-4 text-center anim-pop">
              <span className="inline-flex w-12 h-12 rounded-full bg-mint-600 text-white items-center justify-center anim-tick"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.5l5 5L19.5 7" /></svg></span>
              <p className="font-display font-bold text-[19px] text-ink-900 mt-2.5">{fmtMoney(p.amount, cur)} received</p>
              <p className="text-[12.5px] text-ink-500 mt-1">The receipt is ready — send it to the parent right now, or later from Fees & Payments.</p>
            </div>
            <div className="flex justify-center gap-2.5 mt-5">
              <Btn variant="outline" onClick={onClose}>Later</Btn>
              <Btn variant="wa" icon="send" onClick={() => onSendReceipt?.(p.id)}>Send Receipt Now</Btn>
            </div>
          </Modal>
        );
      })()}

      <Confirm open={overAsk} onClose={() => setOverAsk(false)} onConfirm={() => { setOverAsk(false); setTimeout(persist, 0); }} tone="gold" title="Payment is more than the balance"
        confirmLabel="Yes, Take Advance"
        message={<>The extra amount will be kept as advance credit. Balances never go negative. Continue?</>} />
      <Confirm open={editAsk} onClose={() => setEditAsk(false)} onConfirm={() => { setEditAsk(false); setTimeout(persist, 0); }} tone="gold" title="Save changes to this payment?"
        confirmLabel="Yes, Update Payment"
        message={<>The receipt amount and linked balance will be recalculated. The payment keeps its number and stays traceable.</>} />
    </>
  );
}
