import React, { useRef, useState } from "react";
import { Btn, Confirm, Field, Icon, Modal, PageHead, Switch, TArea, TInput, TSelect, useToast } from "../components/ui";
import { SCHEMA_VERSION, useStore, withActivity } from "../lib/store";
import { downloadText, num, readFileText, todayISO } from "../lib/utils";
import { validateImport } from "../lib/seed";
import { WEEKDAYS } from "../types";
import type { DataState, DateFormat } from "../types";

function Section({ title, sub, children, footer }: { title: string; sub?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section className="card p-5 anim-fade-up">
      <h2 className="font-display font-bold text-[16px] text-ink-900">{title}</h2>
      {sub && <p className="text-[12px] text-ink-400 mt-0.5">{sub}</p>}
      <div className="mt-4">{children}</div>
      {footer && <div className="mt-4 pt-3.5 border-t border-dashed border-ink-100 flex justify-end gap-2.5">{footer}</div>}
    </section>
  );
}

export default function Settings() {
  const { state, patch, importAll, loadDemo, wipeAll } = useStore();
  const toast = useToast();
  const s = state.settings;

  const [profile, setProfile] = useState({ tuitionName: s.tuitionName, tutorName: s.tutorName, phone: s.phone, email: s.email, address: s.address, footerNote: s.footerNote, dateFormat: s.dateFormat });
  const [policy, setPolicy] = useState({ ...s.feePolicy });
  const [auth, setAuth] = useState({ username: s.auth.username, password: "", confirm: "" });
  const [template, setTemplate] = useState(s.whatsappTemplate);
  const [authAsk, setAuthAsk] = useState(false);
  const [demoAsk, setDemoAsk] = useState(false);
  const [wipeAsk, setWipeAsk] = useState(false);
  const [importPreview, setImportPreview] = useState<DataState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveProfile = () => {
    const settings = { ...state.settings, ...profile };
    patch({ settings, activity: withActivity({ ...state, settings }, "Tuition profile updated.", "system") });
    toast.push("Profile saved");
  };

  const savePolicy = () => {
    if (policy.dueDay < 1 || policy.dueDay > 31 || policy.cycleStartDay < 1 || policy.cycleStartDay > 31) {
      toast.push("Cycle start and due day must be between 1 and 31", "err");
      return;
    }
    const settings = { ...state.settings, feePolicy: { ...policy, cycleStartDay: num(policy.cycleStartDay), dueDay: num(policy.dueDay), graceDays: Math.max(0, num(policy.graceDays)), defaultFee: Math.max(0, num(policy.defaultFee)), lateFee: Math.max(0, num(policy.lateFee)) } };
    patch({ settings, activity: withActivity({ ...state, settings }, `Fee policy updated — due day ${settings.feePolicy.dueDay}, grace ${settings.feePolicy.graceDays} day(s).`, "fee") });
    toast.push("Fee policy saved — applies to future cycles");
  };

  const saveAuth = () => {
    if (!auth.username.trim()) { toast.push("Username cannot be empty", "err"); return; }
    if (auth.password && auth.password !== auth.confirm) { toast.push("New passwords do not match", "err"); return; }
    const settings = { ...state.settings, auth: { username: auth.username.trim(), password: auth.password || state.settings.auth.password } };
    patch({ settings, activity: withActivity({ ...state, settings }, "Login credentials changed.", "system") });
    setAuth({ username: settings.auth.username, password: "", confirm: "" });
    toast.push("Credentials updated");
  };

  const saveTemplate = () => {
    const settings = { ...state.settings, whatsappTemplate: template };
    patch({ settings });
    toast.push("WhatsApp template saved");
  };

  const exportBackup = () => {
    const payload = { schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), app: "tuition-management-system", ...state };
    downloadText(`tuition-desk-backup-${todayISO()}.json`, JSON.stringify(payload, null, 2), "application/json");
    toast.push("Backup exported");
  };

  const onImportFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const raw = JSON.parse(await readFileText(f)) as Record<string, unknown>;
      const candidate = (raw.data as DataState) ?? (raw as unknown as DataState);
      const valid = validateImport(candidate);
      if (!valid) throw new Error("invalid");
      setImportPreview(valid);
    } catch {
      toast.push("Import rejected — file is not a valid Tuition Desk backup", "err");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const confirmImport = () => {
    if (!importPreview) return;
    importAll(importPreview);
    toast.push("Backup imported — all local data replaced");
    setImportPreview(null);
  };

  const resetDemo = () => {
    loadDemo();
    toast.push("Demo data loaded");
  };

  const clearAll = () => {
    wipeAll();
    toast.push("All local data cleared", "warn");
  };

  const counts = (d: DataState) => [
    ["Students", d.students.length], ["Guardians", d.guardians.length], ["Batches", d.batches.length],
    ["Fee records", d.feeRecords.length], ["Payments", d.payments.length], ["Attendance", d.attendance.length], ["Holidays", d.holidays.length],
  ] as const;

  return (
    <div>
      <PageHead title="Settings" sub="Profile, fee rules, credentials, WhatsApp template and data safety" />
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <div className="space-y-5">
          <Section title="Tuition Profile" sub="Printed on every fee slip and message" footer={<Btn variant="gold" icon="save" onClick={saveProfile}>Save Changes</Btn>}>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Tuition Name" required><TInput value={profile.tuitionName} onChange={(e) => setProfile({ ...profile, tuitionName: e.target.value })} /></Field>
              <Field label="Tutor Name"><TInput value={profile.tutorName} onChange={(e) => setProfile({ ...profile, tutorName: e.target.value })} /></Field>
              <Field label="Phone"><TInput value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
              <Field label="Email"><TInput value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></Field>
              <Field label="Address" className="sm:col-span-2"><TInput value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} /></Field>
              <Field label="Slip Footer Note" className="sm:col-span-2"><TArea rows={2} value={profile.footerNote} onChange={(e) => setProfile({ ...profile, footerNote: e.target.value })} /></Field>
              <Field label="Date Format">
                <TSelect value={profile.dateFormat} onChange={(e) => setProfile({ ...profile, dateFormat: e.target.value as DateFormat })}>
                  <option value="dmy">26 Aug 2026</option><option value="mdy">Aug 26, 2026</option><option value="iso">2026-08-26</option>
                </TSelect>
              </Field>
            </div>
          </Section>

          <Section title="Fee Policy" sub="Changes apply to future cycles — historical records are never rewritten" footer={<Btn variant="gold" icon="save" onClick={savePolicy}>Save Changes</Btn>}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Cycle Start Day"><TInput type="number" min={1} max={31} value={policy.cycleStartDay} onChange={(e) => setPolicy({ ...policy, cycleStartDay: num(e.target.value) })} /></Field>
              <Field label="Due Day"><TInput type="number" min={1} max={31} value={policy.dueDay} onChange={(e) => setPolicy({ ...policy, dueDay: num(e.target.value) })} /></Field>
              <Field label="Grace (days)"><TInput type="number" min={0} value={policy.graceDays} onChange={(e) => setPolicy({ ...policy, graceDays: num(e.target.value) })} /></Field>
              <Field label="Default Fee"><TInput type="number" min={0} value={policy.defaultFee} onChange={(e) => setPolicy({ ...policy, defaultFee: num(e.target.value) })} /></Field>
              <Field label="Late Fee"><TInput type="number" min={0} value={policy.lateFee} onChange={(e) => setPolicy({ ...policy, lateFee: num(e.target.value) })} /></Field>
              <Field label="Currency"><TInput value={policy.currency} onChange={(e) => setPolicy({ ...policy, currency: e.target.value })} /></Field>
            </div>
          </Section>

          <Section title="Security" sub="Local-only credentials — move to hashed server auth when cloud mode arrives" footer={<Btn variant="primary" icon="save" onClick={() => setAuthAsk(true)}>Save Changes</Btn>}>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Username"><TInput value={auth.username} onChange={(e) => setAuth({ ...auth, username: e.target.value })} /></Field>
              <Field label="New Password" hint="Blank = keep current"><TInput type="password" value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value })} /></Field>
              <Field label="Confirm"><TInput type="password" value={auth.confirm} onChange={(e) => setAuth({ ...auth, confirm: e.target.value })} /></Field>
            </div>
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="WhatsApp Message Template" sub="Placeholders: {student} {month} {total} {due} {remaining} {tuition}" footer={<Btn variant="wa" icon="whatsapp" onClick={saveTemplate}>Save Changes</Btn>}>
            <TArea rows={5} value={template} onChange={(e) => setTemplate(e.target.value)} className="font-mono !text-[12.5px]" />
            <div className="flex gap-1.5 mt-2.5 flex-wrap">
              {["{student}", "{month}", "{total}", "{due}", "{remaining}", "{tuition}"].map((p) => (
                <button key={p} onClick={() => setTemplate((t) => t + " " + p)} className="font-mono text-[11px] font-semibold text-gold-700 bg-gold-50 border border-gold-600/30 rounded px-1.5 py-0.5 hover:bg-gold-100 transition-colors">{p}</button>
              ))}
            </div>
          </Section>

          <Section title="Calendar Defaults" sub="Weekly off days — one-off holidays live on the Calendar page">
            <div className="flex gap-1.5 flex-wrap">
              {WEEKDAYS.map((d, i) => {
                const on = state.settings.weeklyOffs.includes(i);
                return (
                  <button key={d} onClick={() => {
                    const offs = on ? state.settings.weeklyOffs.filter((x) => x !== i) : [...state.settings.weeklyOffs, i].sort();
                    patch({ settings: { ...state.settings, weeklyOffs: offs } });
                    toast.push(`${d} ${on ? "is now a teaching day" : "marked as weekly off"}`);
                  }} className={`w-12 h-9 rounded-[8px] border text-[11.5px] font-bold transition-all ${on ? "bg-ink-900 text-gold-400 border-ink-900" : "bg-white text-ink-400 border-ink-200 hover:border-ink-400"}`}>{d}</button>
                );
              })}
            </div>
          </Section>

          <Section title="Data Management" sub="Everything lives in this browser's localStorage — export regularly">
            <div className="grid sm:grid-cols-2 gap-2.5">
              <Btn variant="primary" icon="download" onClick={exportBackup}>Export Backup</Btn>
              <Btn variant="outline" icon="upload" onClick={() => fileRef.current?.click()}>Import Backup</Btn>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onImportFile(e.target.files?.[0])} />
              <Btn variant="outline" icon="refresh" onClick={() => setDemoAsk(true)}>Reset Demo Data</Btn>
              <Btn variant="danger" icon="trash" onClick={() => setWipeAsk(true)}>Clear All Local Data</Btn>
            </div>
            <div className="mt-4 rounded-[10px] bg-ink-50 border border-ink-100 px-3.5 py-3 grid grid-cols-4 gap-2 text-center">
              {counts(state).slice(0, 4).map(([k, v]) => (
                <div key={k}><div className="font-mono font-bold text-[16px] text-ink-900 tnum">{v}</div><div className="text-[9.5px] font-bold uppercase tracking-wide text-ink-400 mt-0.5">{k}</div></div>
              ))}
            </div>
            <p className="text-[11px] text-ink-400 mt-3 leading-relaxed">
              <Icon name="alert" size={12} className="inline mr-1 text-warn-600" />
              Schema v{SCHEMA_VERSION} · Backups include a schema version and are validated before replacing anything.
            </p>
          </Section>
        </div>
      </div>

      <Confirm open={authAsk} onClose={() => setAuthAsk(false)} onConfirm={saveAuth} title="Change login credentials?" confirmLabel="Save Credentials" tone="gold"
        message="You will use the new username/password the next time you sign in on this device." />
      <Confirm open={demoAsk} onClose={() => setDemoAsk(false)} onConfirm={resetDemo} title="Load demo data?" confirmLabel="Reset Demo Data"
        message="This replaces everything currently stored with the sample workspace (students, batches, fees, attendance). Export a backup first if you need the current data." />
      <Confirm open={wipeAsk} onClose={() => setWipeAsk(false)} onConfirm={clearAll} title="Clear ALL local data?" confirmLabel="Clear Everything"
        message="Students, fees, payments, attendance and settings will be permanently erased from this browser. This cannot be undone." />

      <Modal open={!!importPreview} onClose={() => setImportPreview(null)} title="Import Backup" sub="Review what will replace your current data"
        footer={<>
          <Btn variant="outline" onClick={() => setImportPreview(null)}>Cancel</Btn>
          <Btn variant="danger" icon="upload" onClick={confirmImport}>Replace All Data</Btn>
        </>}>
        {importPreview && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {counts(importPreview).map(([k, v]) => (
                <div key={k} className="rounded-[10px] bg-ink-50 border border-ink-100 px-3 py-2.5 text-center">
                  <div className="font-mono font-bold text-[17px] text-ink-900 tnum">{v}</div>
                  <div className="text-[9.5px] font-bold uppercase tracking-wide text-ink-400 mt-0.5">{k}</div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[12.5px] text-ink-500 leading-relaxed flex gap-2">
              <Icon name="alert" size={15} className="text-warn-600 shrink-0 mt-0.5" />
              Importing replaces <strong>all</strong> current local data with this backup. The file passed schema validation.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
