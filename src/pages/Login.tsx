import React, { useState } from "react";
import { useStore } from "../lib/store";
import { Btn, Icon, Switch, TutorAvatar } from "../components/ui";

const FEATURES = [
  { icon: "students", text: "One admission form — classes stack themselves" },
  { icon: "attendance", text: "One-tap attendance with holiday protection" },
  { icon: "fees", text: "Monthly challans + instant payment receipts" },
  { icon: "whatsapp", text: "Slips, receipts & timing notices via WhatsApp" },
];

export default function Login({ onFirstRun, onSkip }: { onFirstRun?: () => void; onSkip?: () => void }) {
  const { state, login } = useStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [askDemo, setAskDemo] = useState(false);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setTimeout(() => {
      const ok = login(username, password, remember);
      if (!ok) {
        setError(true);
        setBusy(false);
        setTimeout(() => setError(false), 500);
      }
    }, 350);
  };

  const demo = () => {
    setUsername("tutor");
    setPassword("tutor123");
    setBusy(true);
    setTimeout(() => login("tutor", "tutor123", remember), 300);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      {/* ---------- brand ledger panel ---------- */}
      <div className="bg-inkweave relative overflow-hidden flex flex-col justify-between px-8 sm:px-14 py-10 lg:min-h-screen border-b lg:border-b-0 lg:border-r border-ink-800">
        <div className="pointer-events-none absolute -right-24 -top-24 w-[420px] h-[420px] rounded-full border-[28px] border-gold-500/10" />
        <div className="pointer-events-none absolute -right-10 top-40 w-40 h-40 rounded-full border-[14px] border-mint-500/10" />

        <div className="flex items-center gap-3 anim-fade-up">
          <span className="w-11 h-11 rounded-xl bg-gold-500 text-ink-950 flex items-center justify-center shadow-[0_4px_24px_-4px_rgba(232,160,32,0.65)]">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 25V11L16 6l9 5v14" /><path d="M12 25v-7h8v7" />
            </svg>
          </span>
          <div>
            <div className="font-display font-bold text-[19px] text-white leading-none">Tuition Desk</div>
            <div className="text-[10px] font-bold tracking-[0.28em] text-gold-400 mt-1">TUITION MANAGEMENT SYSTEM</div>
          </div>
        </div>

        <div className="max-w-lg py-10 lg:py-0">
          <p className="text-[11px] font-bold tracking-[0.3em] text-gold-400 anim-fade-up" style={{ animationDelay: "80ms" }}>SINGLE-TUTOR · ONE TIMING · LOCAL-FIRST</p>
          <h1 className="font-display font-extrabold text-[34px] sm:text-[46px] leading-[1.06] text-white mt-4 anim-fade-up" style={{ animationDelay: "140ms" }}>
            The register, the receipts & the reminders — <span className="text-gold-400">one ledger.</span>
          </h1>
          <p className="text-[14px] text-ink-300 leading-relaxed mt-5 max-w-md anim-fade-up" style={{ animationDelay: "200ms" }}>
            Attendance, monthly fee challans, payment receipts and WhatsApp notices for every class from Nursery to First Year. Data never leaves this browser.
          </p>
          <ul className="mt-8 space-y-3 stagger">
            {FEATURES.map((f) => (
              <li key={f.icon} className="flex items-center gap-3 text-[13px] text-ink-200 font-medium">
                <span className="w-8 h-8 rounded-[9px] bg-ink-800 border border-ink-700 text-gold-400 flex items-center justify-center shrink-0"><Icon name={f.icon} size={15} /></span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] text-ink-500 anim-fade-up" style={{ animationDelay: "280ms" }}>
          Local-first MVP · localStorage is the source of truth · export backups anytime
        </p>
      </div>

      {/* ---------- challan-style login ---------- */}
      <div className="bg-ledger flex items-center justify-center px-5 py-12">
        <div className={`w-full max-w-[400px] anim-pop ${error ? "anim-shake" : ""}`}>
          {onFirstRun && !askDemo ? (
            <div className="card overflow-hidden">
              <div className="bg-ink-900 px-6 py-4">
                <div className="font-display font-bold text-[15px] text-white">Welcome to Tuition Desk</div>
                <div className="text-[10px] font-bold tracking-[0.24em] text-gold-400 mt-0.5">FIRST START · CHOOSE YOUR DATA</div>
              </div>
              <div className="p-6 space-y-3">
                <button onClick={() => { setAskDemo(true); }} className="w-full text-left rounded-[12px] border border-gold-600/40 bg-gold-50 hover:bg-gold-100 transition-colors px-4 py-4 press">
                  <span className="flex items-center gap-2 text-[13.5px] font-bold text-ink-900"><Icon name="refresh" size={16} className="text-gold-600" /> Load Demo Data</span>
                  <span className="block text-[12px] text-ink-500 mt-1 leading-relaxed">12 sample students from Nursery to First Year, with fees, receipts and attendance — perfect for trying everything.</span>
                </button>
                <button onClick={() => onSkip?.()} className="w-full text-left rounded-[12px] border border-ink-200 bg-white hover:border-ink-400 transition-colors px-4 py-4 press">
                  <span className="flex items-center gap-2 text-[13.5px] font-bold text-ink-900"><Icon name="plus" size={16} className="text-ink-500" /> Start Fresh & Empty</span>
                  <span className="block text-[12px] text-ink-500 mt-1">Begin with your own students. You can reset the demo later from Settings.</span>
                </button>
              </div>
            </div>
          ) : askDemo ? (
            <div className="card overflow-hidden">
              <div className="bg-ink-900 px-6 py-4">
                <div className="font-display font-bold text-[15px] text-white">Load demo data?</div>
                <div className="text-[10px] font-bold tracking-[0.24em] text-gold-400 mt-0.5">SAMPLE RECORDS · REMOVABLE ANYTIME</div>
              </div>
              <div className="p-6">
                <p className="text-[13px] text-ink-600 leading-relaxed">This fills the app with 12 students, guardians, four months of fees, receipts and attendance. Since the app is empty right now, nothing will be lost. You can wipe it later via Settings → Reset Demo Data.</p>
                <div className="grid grid-cols-2 gap-2.5 mt-5 [&>*]:min-w-0">
                  <Btn variant="outline" className="flex-1" onClick={() => setAskDemo(false)}>Back</Btn>
                  <Btn variant="gold" icon="check" className="flex-1" onClick={() => { onFirstRun?.(); }}>Yes, Load Demo</Btn>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="card overflow-hidden">
              {/* challan header strip */}
              <div className="bg-ink-900 px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="font-display font-bold text-[15px] text-white">{state.settings.tuitionName}</div>
                  <div className="text-[10px] font-bold tracking-[0.24em] text-gold-400 mt-0.5">SESSION CHALLAN · OWNER LOGIN</div>
                </div>
                <TutorAvatar size={36} photo={state.settings.tutorPhoto} />
              </div>

              <div className="px-6 py-6">
                <label className="block mb-4">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-1.5">Username</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="tutor"
                    className="w-full h-10.5 px-3.5 rounded-[9px] border border-ink-200 bg-white text-[14px] focus:border-gold-500 hover:border-ink-300 placeholder:text-ink-300"
                  />
                </label>
                <label className="block mb-4">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-1.5">Password</span>
                  <div className="relative">
                    <input
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="w-full h-10.5 px-3.5 pr-11 rounded-[9px] border border-ink-200 bg-white text-[14px] focus:border-gold-500 hover:border-ink-300 placeholder:text-ink-300"
                    />
                    <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-800">
                      <Icon name={show ? "eyeoff" : "eye"} size={17} />
                    </button>
                  </div>
                </label>

                <div className="flex items-center justify-between mb-5">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <Switch checked={remember} onChange={setRemember} label="Remember session" />
                    <span className="text-[12.5px] font-semibold text-ink-600">Remember on this device</span>
                  </label>
                </div>

                {error && (
                  <p className="mb-4 text-[12.5px] font-semibold text-flame-700 bg-flame-50 border border-flame-100 rounded-[8px] px-3 py-2.5 anim-fade-in">
                    Username or password does not match the saved credentials.
                  </p>
                )}

                <Btn type="submit" variant="gold" size="lg" className="w-full" disabled={busy} icon={busy ? "refresh" : "logout"}>
                  {busy ? "Checking…" : "Open the Ledger"}
                </Btn>

                <div className="mt-5 rounded-[10px] border border-dashed border-gold-600/40 bg-gold-50 px-4 py-3.5">
                  <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-gold-700">
                    <Icon name="alert" size={13} /> DEMO CREDENTIALS
                  </div>
                  <div className="font-mono text-[12.5px] text-ink-800 mt-1.5">tutor / tutor123</div>
                  <div className="flex items-center justify-between gap-2 mt-2.5">
                    <span className="text-[11px] text-ink-500">Change anytime in Settings.</span>
                    <Btn type="button" size="sm" variant="outline" onClick={demo} disabled={busy}>Use demo login</Btn>
                  </div>
                </div>
              </div>

              <div className="relative border-t-2 border-dashed border-ink-150 px-6 py-3 bg-ink-50/50">
                <span className="absolute -left-2 -top-2 w-4 h-4 rounded-full bg-paper border border-ink-100" />
                <span className="absolute -right-2 -top-2 w-4 h-4 rounded-full bg-paper border border-ink-100" />
                <p className="text-center text-[10.5px] text-ink-400 font-medium">Local-only MVP — credentials live in this browser and are not production-secure.</p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
