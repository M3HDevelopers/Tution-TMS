import React, { useRef, useState } from "react";
import { Btn, Confirm, Field, Icon, PageHead, Switch, TInput, TSelect, TutorAvatar, useToast } from "../components/ui";
import { validateImport, useStore, withActivity } from "../lib/store";
import { CHALLAN_TEMPLATES, type TemplatePreset } from "../types";
import { WEEKDAYS, downloadText, fmtMoney, num, readFileText, todayISO } from "../lib/utils";

export default function Settings() {
  const { state, patch, logout, resetDemo, importAll } = useStore();
  const toast = useToast();
  const s = state.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(s.username);
  const [password, setPassword] = useState(s.password);
  const [showPw, setShowPw] = useState(false);
  const [askSecurity, setAskSecurity] = useState(false);
  const [askReset, setAskReset] = useState(false);
  const [importPreview, setImportPreview] = useState<{ data: Parameters<typeof importAll>[0]; counts: { students: number; payments: number; attendance: number; feeRecords: number } } | null>(null);

  const save = (p: Partial<typeof s>, msg: string) => {
    const settings = { ...s, ...p };
    patch({ settings, activity: withActivity({ ...state, settings }, msg, "settings") });
    toast.push("Saved");
  };

  const onBackupFile = async (f: File | undefined) => {
    if (!f) return;
    const text = await readFileText(f);
    const res = validateImport(text);
    if (!res.ok) { toast.push(`Import rejected: ${res.error}`, "err"); return; }
    setImportPreview({ data: res.data, counts: res.counts });
  };

  const doImport = () => {
    if (!importPreview) return;
    importAll(importPreview.data);
    setImportPreview(null);
    toast.push("Backup restored — all data replaced");
  };

  const exportBackup = () => {
    const payload = { schemaVersion: 2, exportedAt: new Date().toISOString(), ...state };
    downloadText(`tuition-backup-${todayISO()}.json`, JSON.stringify(payload, null, 2), "application/json");
    toast.push("Backup downloaded — keep it somewhere safe");
  };

  const onPhoto = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 500_000) { toast.push("Photo too large — keep it under 500 KB", "warn"); return; }
    const r = new FileReader();
    r.onload = () => save({ tutorPhoto: String(r.result) }, "Profile photo updated.");
    r.readAsDataURL(f);
  };

  return (
    <div>
      <PageHead title="Settings" sub="Profile, timing, fees, WhatsApp messages and your data — everything stays on this device" />

      <div className="grid lg:grid-cols-2 gap-5">
        {/* profile */}
        <section className="card p-5 anim-fade-up">
          <h2 className="font-display font-bold text-[16px] text-ink-900 mb-4 flex items-center gap-2"><Icon name="user" size={17} className="text-gold-600" /> Tuition Profile</h2>
          <div className="flex items-center gap-4 mb-4">
            <TutorAvatar size={64} photo={s.tutorPhoto} />
            <div>
              <Btn size="sm" variant="outline" icon="upload" onClick={() => photoRef.current?.click()}>{s.tutorPhoto ? "Change Photo" : "Upload Your Photo"}</Btn>
              {s.tutorPhoto && <button onClick={() => save({ tutorPhoto: null }, "Profile photo reset to default avatar.")} className="ml-3 text-[12px] font-bold text-flame-600 hover:underline">Remove</button>}
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
              <p className="text-[11px] text-ink-400 mt-1.5">Shown in the sidebar and on the login screen.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Tuition Name"><TInput defaultValue={s.tuitionName} onBlur={(e) => e.target.value !== s.tuitionName && save({ tuitionName: e.target.value }, "Tuition name updated.")} /></Field>
            <Field label="Your Name"><TInput defaultValue={s.tutorName} onBlur={(e) => e.target.value !== s.tutorName && save({ tutorName: e.target.value }, "Tutor name updated.")} /></Field>
            <Field label="Phone"><TInput defaultValue={s.phone} onBlur={(e) => e.target.value !== s.phone && save({ phone: e.target.value }, "Phone updated.")} /></Field>
            <Field label="Email"><TInput defaultValue={s.email} onBlur={(e) => e.target.value !== s.email && save({ email: e.target.value }, "Email updated.")} /></Field>
            <Field label="Address" className="sm:col-span-2"><TInput defaultValue={s.address} onBlur={(e) => e.target.value !== s.address && save({ address: e.target.value }, "Address updated.")} /></Field>
            <Field label="Challan Footer Note" className="sm:col-span-2" hint="Printed at the bottom of every challan.">
              <TInput defaultValue={s.footerNote} onBlur={(e) => e.target.value !== s.footerNote && save({ footerNote: e.target.value }, "Footer note updated.")} />
            </Field>
          </div>
        </section>

        {/* timing */}
        <section className="card p-5 anim-fade-up" style={{ animationDelay: "50ms" }}>
          <h2 className="font-display font-bold text-[16px] text-ink-900 mb-1.5 flex items-center gap-2"><Icon name="clock" size={17} className="text-gold-600" /> Tuition Timing</h2>
          <p className="text-[12px] text-ink-400 mb-4">One timing for every class. Need a temporary change? Use the bell → <b>Timing Change</b> notice instead.</p>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <Field label="Start Time"><TInput type="time" defaultValue={s.startTime} onBlur={(e) => e.target.value !== s.startTime && save({ startTime: e.target.value }, `Tuition start time changed to ${e.target.value}.`)} /></Field>
            <Field label="End Time"><TInput type="time" defaultValue={s.endTime} onBlur={(e) => e.target.value !== s.endTime && save({ endTime: e.target.value }, `Tuition end time changed to ${e.target.value}.`)} /></Field>
          </div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400 mb-2.5">Weekly Off Days</h3>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d, i) => {
              const on = s.weeklyOffs.includes(i);
              return (
                <button key={d} onClick={() => {
                  const weeklyOffs = on ? s.weeklyOffs.filter((x) => x !== i) : [...s.weeklyOffs, i].sort();
                  save({ weeklyOffs }, `Weekly offs: ${weeklyOffs.map((x) => WEEKDAYS[x]).join(", ") || "none"}.`);
                }} className={`h-9 px-3.5 rounded-[9px] text-[12.5px] font-bold transition-all press ${on ? "bg-ink-900 text-gold-300 border border-ink-900" : "bg-white border border-ink-200 text-ink-500 hover:border-ink-400"}`}>
                  {d.slice(0, 3)}
                </button>
              );
            })}
          </div>
          <p className="text-[11.5px] text-ink-400 mt-3">Attendance is never blocked on weekly offs — only flagged. Holidays block marking.</p>
        </section>

        {/* fees */}
        <section className="card p-5 anim-fade-up" style={{ animationDelay: "90ms" }}>
          <h2 className="font-display font-bold text-[16px] text-ink-900 mb-4 flex items-center gap-2"><Icon name="fees" size={17} className="text-gold-600" /> Fee Rules</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="Default Due Day" hint="Students can pick their own day while admission.">
              <TInput type="number" min={1} max={28} defaultValue={s.feePolicy.dueDay} onBlur={(e) => { const v = Math.min(28, Math.max(1, num(e.target.value) || 1)); if (v !== s.feePolicy.dueDay) save({ feePolicy: { ...s.feePolicy, dueDay: v } }, `Default due day set to ${v}.`); }} />
            </Field>
            <Field label="Grace Days"><TInput type="number" min={0} max={15} defaultValue={s.feePolicy.graceDays} onBlur={(e) => { const v = Math.min(15, Math.max(0, num(e.target.value) || 0)); if (v !== s.feePolicy.graceDays) save({ feePolicy: { ...s.feePolicy, graceDays: v } }, `Grace period set to ${v} day(s).`); }} /></Field>
            <Field label={`Late Fee (${s.feePolicy.currency})`} hint="0 disables late fee.">
              <TInput type="number" min={0} defaultValue={s.feePolicy.lateFee} onBlur={(e) => { const v = Math.max(0, num(e.target.value)); if (v !== s.feePolicy.lateFee) save({ feePolicy: { ...s.feePolicy, lateFee: v } }, v > 0 ? `Late fee set to ${fmtMoney(v, s.feePolicy.currency)}.` : "Late fee disabled."); }} />
            </Field>
            <Field label={`Default Fee (${s.feePolicy.currency})`}><TInput type="number" min={0} defaultValue={s.feePolicy.defaultFee} onBlur={(e) => { const v = Math.max(0, num(e.target.value)); if (v !== s.feePolicy.defaultFee) save({ feePolicy: { ...s.feePolicy, defaultFee: v } }, "Default fee updated."); }} /></Field>
            <Field label="Currency Symbol"><TInput defaultValue={s.feePolicy.currency} onBlur={(e) => e.target.value.trim() && e.target.value !== s.feePolicy.currency && save({ feePolicy: { ...s.feePolicy, currency: e.target.value.trim() } }, "Currency updated.")} /></Field>
            <Field label="Date Format">
              <TSelect defaultValue={s.dateFormat} onChange={(e) => save({ dateFormat: e.target.value as typeof s.dateFormat }, "Date format updated.")}>
                <option value="dmy">14 Aug 2026</option>
                <option value="mdy">Aug 14, 2026</option>
                <option value="iso">2026-08-14</option>
              </TSelect>
            </Field>
          </div>
          <p className="text-[11.5px] text-ink-400 mt-4">Challans auto-generate on the 1st of each month for active students. Changing rules here never rewrites past months.</p>
        </section>

        {/* whatsapp */}
        <section className="card p-5 anim-fade-up" style={{ animationDelay: "130ms" }}>
          <h2 className="font-display font-bold text-[16px] text-ink-900 mb-1.5 flex items-center gap-2"><Icon name="whatsapp" size={17} className="text-[#128c5e]" /> WhatsApp Challan Message</h2>
          <p className="text-[12px] text-ink-400 mb-4">Pick a ready-made style — the app fills in name, month, amount and due date automatically. No editing needed.</p>
          <div className="space-y-2.5">
            {(Object.keys(CHALLAN_TEMPLATES) as TemplatePreset[]).map((k) => {
              const on = s.templatePreset === k;
              const preview = CHALLAN_TEMPLATES[k]
                .replace("{student}", "Ayaan").replace("{period}", "this month").replace("{total}", `${s.feePolicy.currency} 1,500`)
                .replace("{due}", "1st").replace("{balance}", `${s.feePolicy.currency} 1,500`).replace("{tuition}", s.tuitionName);
              return (
                <button key={k} onClick={() => save({ templatePreset: k, challanTemplate: CHALLAN_TEMPLATES[k] }, `WhatsApp message style changed to "${k}".`)}
                  className={`w-full text-left rounded-[11px] border px-4 py-3 transition-all press ${on ? "border-[#128c5e]/50 bg-[#e9f5ef] shadow-sm" : "border-ink-150 bg-white hover:border-ink-300"}`}>
                  <span className="flex items-center gap-2 mb-1">
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${on ? "border-[#128c5e] bg-[#128c5e]" : "border-ink-300"}`}>{on && <Icon name="check" size={10} strokeWidth={3.4} className="text-white" />}</span>
                    <span className="text-[13px] font-bold text-ink-900">{k === "roman" ? "Roman Urdu (Friendly)" : k === "english" ? "English (Formal)" : "Short Reminder"}</span>
                  </span>
                  <span className="block text-[11.5px] text-ink-500 leading-relaxed">“{preview}”</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-ink-400 mt-3.5">Receipt, absent and timing-change messages are built-in and always shown before sending.</p>
        </section>

        {/* security */}
        <section className="card p-5 anim-fade-up" style={{ animationDelay: "160ms" }}>
          <h2 className="font-display font-bold text-[16px] text-ink-900 mb-4 flex items-center gap-2"><Icon name="settings" size={17} className="text-gold-600" /> Login & Security</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Username"><TInput value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
            <Field label="Password">
              <div className="relative">
                <TInput type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-800" aria-label="Toggle password visibility"><Icon name={showPw ? "eyeoff" : "eye"} size={16} /></button>
              </div>
            </Field>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <Btn variant="primary" icon="save" disabled={!username.trim() || !password} onClick={() => setAskSecurity(true)}>Save Credentials</Btn>
            <Btn variant="outline" icon="logout" onClick={logout}>Log out now</Btn>
          </div>
          <p className="text-[11.5px] text-ink-400 mt-3.5">Stored locally on this device only. Demo defaults: tutor / tutor123.</p>
        </section>

        {/* data */}
        <section className="card p-5 anim-fade-up" style={{ animationDelay: "190ms" }}>
          <h2 className="font-display font-bold text-[16px] text-ink-900 mb-1.5 flex items-center gap-2"><Icon name="save" size={17} className="text-gold-600" /> Your Data</h2>
          <p className="text-[12px] text-ink-400 mb-4">Everything lives in this browser's storage. Export a backup regularly — it takes one click.</p>
          <div className="flex flex-wrap gap-2.5">
            <Btn variant="gold" icon="download" onClick={exportBackup}>Export Backup</Btn>
            <Btn variant="outline" icon="upload" onClick={() => importRef.current?.click()}>Import Backup</Btn>
            <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { onBackupFile(e.target.files?.[0]); e.target.value = ""; }} />
            <Btn variant="outline" icon="refresh" onClick={() => setAskReset(true)}>Reset Demo Data</Btn>
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            {[["Students", state.students.length], ["Payments", state.payments.length], ["Challans", state.feeRecords.length], ["Attendance", state.attendance.length]].map(([k, v]) => (
              <div key={k as string} className="rounded-[9px] bg-ink-50 border border-ink-100 py-2">
                <p className="font-mono font-bold text-[15px] text-ink-900 tnum">{v as number}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">{k}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-400 mt-3.5">Wrong entry somewhere? Edit or delete it right on the student's own page — no need to wipe everything.</p>
        </section>
      </div>

      <Confirm open={askSecurity} onClose={() => setAskSecurity(false)} tone="gold" title="Save new login credentials?" confirmLabel="Yes, Save"
        onConfirm={() => { save({ username: username.trim(), password }, "Login credentials changed."); }}
        message={<>Use <b>{username.trim()}</b> from the next login. Make sure you will remember it — there is no email recovery in this local app.</>} />
      <Confirm open={askReset} onClose={() => setAskReset(false)} title="Reset to demo data?" confirmLabel="Reset Everything"
        onConfirm={() => { resetDemo(); toast.push("Demo data loaded"); }}
        message="All current students, fees, payments and attendance will be replaced with the demo dataset. Export a backup first if anything matters." />

      {/* import preview */}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-ink-950/55 anim-fade-in" onClick={() => setImportPreview(null)} />
          <div className="relative card p-6 max-w-md w-full anim-pop">
            <h2 className="font-display font-bold text-[18px] text-ink-900">Replace all data?</h2>
            <p className="text-[13px] text-ink-500 mt-1.5">The backup file is valid. It contains:</p>
            <div className="grid grid-cols-2 gap-2 my-4 text-center">
              {[["Students", importPreview.counts.students], ["Payments", importPreview.counts.payments], ["Fee records", importPreview.counts.feeRecords], ["Attendance", importPreview.counts.attendance]].map(([k, v]) => (
                <div key={k as string} className="rounded-[9px] bg-ink-50 border border-ink-100 py-2">
                  <p className="font-mono font-bold text-[15px] tnum">{v as number}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">{k}</p>
                </div>
              ))}
            </div>
            <p className="text-[12px] font-semibold text-flame-600 mb-4">Your current data will be overwritten. This cannot be undone.</p>
            <div className="flex justify-end gap-2.5">
              <Btn variant="outline" onClick={() => setImportPreview(null)}>Cancel</Btn>
              <Btn variant="danger" icon="upload" onClick={doImport}>Replace All Data</Btn>
            </div>
          </div>
        </div>
      )}
      <span className="hidden" ref={fileRef} />
    </div>
  );
}
