import React, { useEffect, useMemo, useState } from "react";
import type { Payment, PaymentMethod } from "../types";
import { PAYMENT_METHODS } from "../types";
import { balanceOf, chargeOf, paidOf, receiptNo, studentOutstanding } from "../lib/fee";
import { useStore, withActivity } from "../lib/store";
import { fmtMoney, num, periodLabel, todayISO, uid } from "../lib/utils";
import { Btn, Confirm, Field, Icon, Modal, TInput, TSelect, useToast } from "./ui";

/**
 * Central payment engine — every payment in the app goes through here so all
 * balances, receipts, dashboards and reports stay in perfect sync.
 */
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

  /* only students who actually owe something can receive a new payment */
  const debtors = useMemo(
    () =>
      state.students
        .filter((s) => s.status === "active")
        .map((s) => ({ s, out: studentOutstanding(state, s.id) }))
        .filter((x) => x.out > 0)
        .sort((a, b) => b.out - a.out || a.s.name.localeCompare(b.s.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.students, state.payments, state.feeRecords, open]
  );

  const [sId, setSId] = useState("");
  const [sel, setSel] = useState(""); // "ALL" or a feeRecord id
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [overAsk, setOverAsk] = useState(false);
  const [editAsk, setEditAsk] = useState(false);
  const [saved, setSaved] = useState<{ ids: string[]; total: number } | null>(null);

  const records = useMemo(
    () => state.feeRecords.filter((r) => r.studentId === sId).sort((a, b) => a.period.localeCompare(b.period)),
    [state.feeRecords, sId]
  );
  const unpaid = records.filter((r) => balanceOf(r, state.payments) > 0 && !r.waived);
  const allTotal = unpaid.reduce((t, r) => t + balanceOf(r, state.payments), 0);
  const selRec = sel === "ALL" ? undefined : unpaid.find((r) => r.id === sel);
  const selBalance = sel === "ALL" ? allTotal : selRec ? balanceOf(selRec, state.payments) : 0;

  const pickStudent = (sid: string) => {
    setSId(sid);
    const recs = state.feeRecords.filter((r) => r.studentId === sid).sort((a, b) => a.period.localeCompare(b.period));
    const first = recs.find((r) => balanceOf(r, state.payments) > 0 && !r.waived);
    setSel(first ? first.id : "");
    setAmount(first ? String(balanceOf(first, state.payments)) : "");
    setError("");
  };

  useEffect(() => {
    if (!open) return;
    setError(""); setOverAsk(false); setEditAsk(false); setSaved(null);
    setMethod("Cash"); setDate(todayISO()); setReference(""); setNote("");
    if (editingPayment) {
      setSId(editingPayment.studentId);
      setSel(editingPayment.feeRecordId);
      setAmount(String(editingPayment.amount));
      setDate(editingPayment.date);
      setMethod(editingPayment.method);
      setReference(editingPayment.reference ?? "");
      setNote(editingPayment.note ?? "");
    } else {
      const target = studentId ? debtors.find((d) => d.s.id === studentId) : undefined;
      const first = target ?? debtors[0];
      if (first) pickStudent(first.s.id);
      else { setSId(studentId ?? ""); setSel(""); setAmount(""); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paymentId, studentId]);

  useEffect(() => {
    if (!open || editingPayment) return;
    if (sel === "ALL") setAmount(String(allTotal));
    else if (selRec) setAmount(String(balanceOf(selRec, state.payments)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const amt = num(amount);
  const isOver = !!selRec && amt > selBalance && selBalance > 0;
  const isFull = !!selRec && amt >= selBalance && selBalance > 0;
  const nothingOwed = !editingPayment && (debtors.length === 0 || (sId !== "" && unpaid.length === 0 && sel !== "ALL"));

  const persist = () => {
    if (editingPayment) {
      if (amt <= 0) { setError("Amount must be greater than zero."); return; }
      if (!editAsk) { setEditAsk(true); return; }
      const payments = state.payments.map((p) => (p.id === editingPayment.id ? { ...p, amount: amt, date, method, reference: reference || undefined, note: note || undefined, state: "edited" as const } : p));
      const next = { ...state, payments };
      patch({ payments, activity: withActivity(next, `Payment ${editingPayment.receiptNo} edited — now ${fmtMoney(amt, cur)}.`, "fee") });
      toast.push("Payment updated — all balances recalculated");
      onClose();
      return;
    }

    if (sel === "ALL") {
      if (unpaid.length === 0) { setError("Nothing to pay — all months are clear."); return; }
      let payments = [...state.payments];
      const made: Payment[] = [];
      for (const r of unpaid) {
        payments = [...payments];
        const p: Payment = {
          id: uid("pay"), receiptNo: receiptNo(payments), feeRecordId: r.id, studentId: r.studentId,
          amount: balanceOf(r, state.payments), date, method, reference: reference || undefined,
          note: note || `Cleared together (${unpaid.length} months)`, state: "recorded", createdAt: new Date().toISOString(),
        };
        payments.push(p);
        made.push(p);
      }
      const student = state.students.find((s) => s.id === sId);
      const total = made.reduce((t, p) => t + p.amount, 0);
      const next = { ...state, payments };
      patch({
        payments,
        activity: withActivity(next, `${made.length} month(s) cleared for ${student?.name ?? ""} — ${fmtMoney(total, cur)} received (${made.map((m) => m.receiptNo).join(", ")}).`, "fee"),
      });
      setSaved({ ids: made.map((m) => m.id), total });
      return;
    }

    if (!selRec) { setError("Pick a fee month first."); return; }
    if (amt <= 0) { setError("Amount must be greater than zero."); return; }
    if (!date) { setError("Payment date is required."); return; }
    if (isOver && !overAsk) { setOverAsk(true); return; }

    const p: Payment = {
      id: uid("pay"), receiptNo: receiptNo(state.payments), feeRecordId: selRec.id, studentId: selRec.studentId,
      amount: amt, date, method, reference: reference || undefined, note: note || undefined,
      state: "recorded", createdAt: new Date().toISOString(),
    };
    const payments = [...state.payments, p];
    const student = state.students.find((s) => s.id === selRec.studentId);
    const remaining = balanceOf(selRec, payments);
    const next = { ...state, payments };
    patch({ payments, activity: withActivity(next, `Payment ${p.receiptNo} — ${fmtMoney(amt, cur)} from ${student?.name ?? ""} (${periodLabel(selRec.period)}, ${method}).`, "fee") });
    toast.push(remaining > 0 ? `Saved · ${fmtMoney(remaining, cur)} still due for ${periodLabel(selRec.period)}` : `${periodLabel(selRec.period)} fully settled`);
    setSaved({ ids: [p.id], total: amt });
  };

  const savedPayments = saved ? saved.ids.map((id) => state.payments.find((p) => p.id === id)).filter(Boolean) as Payment[] : [];
  const studentName = state.students.find((s) => s.id === sId)?.name ?? "";
  const requestedAllPaid = !editingPayment && studentId && debtors.length > 0 && !debtors.some((d) => d.s.id === studentId);

  return (
    <>
      <Modal open={open && !saved} onClose={onClose}
        title={editingPayment ? `Edit Payment ${editingPayment.receiptNo}` : "Record Payment"}
        sub={editingPayment ? "Editing recalculates every balance instantly" : "Only students with pending dues are listed"}
        footer={nothingOwed ? <Btn variant="outline" onClick={onClose}>Close</Btn> : <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="gold" icon="save" onClick={persist}>{editingPayment ? "Save Changes" : sel === "ALL" ? `Pay All ${fmtMoney(allTotal, cur)}` : "Save Payment"}</Btn>
        </>}>

        {nothingOwed ? (
          <div className="text-center py-6 anim-pop">
            <span className="inline-flex w-14 h-14 rounded-full bg-mint-50 text-mint-600 items-center justify-center"><Icon name="check" size={26} strokeWidth={2.4} /></span>
            <p className="font-display font-bold text-[18px] text-ink-900 mt-3">{requestedAllPaid ? `${studentName} is fully paid` : "Sab fees paid hain!"}</p>
            <p className="text-[12.5px] text-ink-400 mt-1.5 max-w-xs mx-auto leading-relaxed">No pending dues for {requestedAllPaid ? "this student" : "any active student"} right now, so there is nothing to collect. Challans and reports are already up to date.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
              <Field label="Student (pending dues)" required>
                <TSelect value={sId} onChange={(e) => pickStudent(e.target.value)} disabled={!!editingPayment}>
                  {editingPayment
                    ? <option value={editingPayment.studentId}>{studentName}</option>
                    : debtors.map((d) => <option key={d.s.id} value={d.s.id}>{d.s.name} — {fmtMoney(d.out, cur)} due</option>)}
                </TSelect>
              </Field>
              <Field label="Fee Month" required hint={sel === "ALL" ? `${unpaid.length} pending month(s) will be cleared together — one receipt per month.` : undefined}>
                {editingPayment ? (
                  <TSelect value={sel} disabled><option>{periodLabel(state.feeRecords.find((r) => r.id === sel)?.period ?? "", false)}</option></TSelect>
                ) : (
                  <TSelect value={sel} onChange={(e) => { setSel(e.target.value); setError(""); }}>
                    {unpaid.length > 1 && <option value="ALL">⚡ Pay all pending ({unpaid.length} months) — {fmtMoney(allTotal, cur)}</option>}
                    {unpaid.map((r) => {
                      const b = balanceOf(r, state.payments);
                      return <option key={r.id} value={r.id}>{periodLabel(r.period)} — {fmtMoney(b, cur)} due</option>;
                    })}
                    {unpaid.length === 0 && <option value="">All months paid ✓</option>}
                  </TSelect>
                )}
              </Field>
              <Field label={`Amount (${cur})`} required error={error || undefined}>
                <TInput type="number" min={1} value={amount} onChange={(e) => { setAmount(e.target.value); setError(""); }} readOnly={sel === "ALL" && !editingPayment} className={sel === "ALL" && !editingPayment ? "bg-ink-50 font-bold" : ""} />
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
                <TInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank / wallet ref (optional)" />
              </Field>
            </div>

            {/* live calculation strip */}
            {selRec && !editingPayment && (
              <div className="rounded-[10px] border border-ink-150 bg-ink-50/60 px-3.5 py-3 anim-fade-in">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Month charge</p><p className="font-mono text-[13.5px] font-bold text-ink-900 tnum mt-0.5">{fmtMoney(chargeOf(selRec), cur)}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Already paid</p><p className="font-mono text-[13.5px] font-bold text-mint-600 tnum mt-0.5">{fmtMoney(paidOf(state.payments, selRec.id), cur)}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Due Now</p><p className="font-mono text-[13.5px] font-bold text-flame-600 tnum mt-0.5">{fmtMoney(selBalance, cur)}</p></div>
                </div>
              </div>
            )}
            {sel === "ALL" && !editingPayment && (
              <div className="rounded-[10px] border border-gold-600/30 bg-gold-50 px-3.5 py-3 anim-fade-in">
                <p className="text-[12px] font-bold text-gold-700 mb-2">Clearing {unpaid.length} months together for {studentName}:</p>
                <div className="space-y-1">
                  {unpaid.map((r) => (
                    <div key={r.id} className="flex justify-between text-[12px]"><span className="text-ink-600 font-semibold">{periodLabel(r.period)}</span><span className="font-mono font-bold text-ink-900 tnum">{fmtMoney(balanceOf(r, state.payments), cur)}</span></div>
                  ))}
                  <div className="flex justify-between text-[12.5px] border-t border-gold-600/25 pt-1.5 mt-1.5"><span className="font-bold text-ink-900">Total</span><span className="font-mono font-bold text-gold-700 tnum">{fmtMoney(allTotal, cur)}</span></div>
                </div>
              </div>
            )}

            {selRec && amt > 0 && !editingPayment && (
              <p className={`text-[12px] font-semibold rounded-[9px] px-3 py-2.5 anim-fade-in ${isOver ? "bg-warn-50 text-warn-700 border border-warn-600/25" : isFull ? "bg-mint-50 text-mint-700 border border-mint-600/25" : "bg-gold-50 text-gold-700 border border-gold-600/25"}`}>
                {isOver
                  ? `${fmtMoney(amt - selBalance, cur)} extra — will be kept as advance credit. Balance never goes negative.`
                  : isFull
                    ? `Full payment — ${periodLabel(selRec.period)} will be settled and the receipt ready instantly.`
                    : `Partial payment — ${fmtMoney(Math.max(0, selBalance - amt), cur)} will remain due for ${periodLabel(selRec.period)}.`}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* success */}
      {open && saved && (
        <Modal open onClose={onClose} title="Payment Saved" sub={`${savedPayments.map((p) => p.receiptNo).join(" · ")} · ${studentName}`}>
          <div className="rounded-[12px] border border-mint-600/25 bg-mint-50 p-5 text-center anim-pop">
            <span className="inline-flex w-12 h-12 rounded-full bg-mint-600 text-white items-center justify-center anim-tick"><Icon name="check" size={22} strokeWidth={2.6} /></span>
            <p className="font-display font-bold text-[20px] text-ink-900 mt-2.5">{fmtMoney(saved.total, cur)} received</p>
            <p className="text-[12.5px] text-ink-500 mt-1">
              {savedPayments.length > 1 ? `${savedPayments.length} receipts generated — one for each month.` : "The receipt is ready — send it to the parent right now."}
            </p>
            {savedPayments.length > 1 && (
              <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                {savedPayments.map((p) => (
                  <span key={p.id} className="font-mono text-[11px] font-bold bg-white border border-mint-600/30 text-mint-700 rounded-md px-2 py-1 tnum">
                    {p.receiptNo} · {periodLabel(state.feeRecords.find((r) => r.id === p.feeRecordId)?.period ?? "", true)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5 mt-5 sm:flex sm:justify-center [&>*]:min-w-0">
            <Btn variant="outline" onClick={onClose}>Later</Btn>
            <Btn variant="wa" icon="send" onClick={() => onSendReceipt?.(saved.ids[0])}>
              {savedPayments.length > 1 ? "Send First Receipt" : "Send Receipt Now"}
            </Btn>
          </div>
        </Modal>
      )}

      <Confirm open={overAsk} onClose={() => setOverAsk(false)} onConfirm={() => { setOverAsk(false); setTimeout(persist, 0); }} tone="gold" title="Payment is more than the balance"
        confirmLabel="Yes, Take Advance"
        message="The extra amount will be kept as advance credit. Balances never go negative. Continue?" />
      <Confirm open={editAsk} onClose={() => setEditAsk(false)} onConfirm={() => { setEditAsk(false); setTimeout(persist, 0); }} tone="gold" title="Save changes to this payment?"
        confirmLabel="Yes, Update Payment"
        message="The receipt amount and linked balance will be recalculated. The payment keeps its number and stays traceable." />
    </>
  );
}
