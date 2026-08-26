import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { AttendanceStatus, StudentStatus } from "../types";
import type { FeeStatus } from "../lib/fee";
import { FEE_STATUS_LABEL } from "../lib/fee";
import { initials, nameHue } from "../lib/utils";

/* ================= icons (hand-drawn strokes) ================= */

const PATHS: Record<string, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="8" height="10" rx="1.5" /><rect x="13" y="3" width="8" height="6" rx="1.5" /><rect x="13" y="11" width="8" height="10" rx="1.5" /><rect x="3" y="15" width="8" height="6" rx="1.5" /></>,
  students: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c.6-3.4 2.8-5.2 5.5-5.2s4.9 1.8 5.5 5.2" /><circle cx="16.8" cy="9.4" r="2.4" /><path d="M15.4 14.6c2.7-.4 4.6 1.2 5.1 4.2" /></>,
  classes: <><path d="M4 7.5 12 4l8 3.5-8 3.5z" /><path d="M6.5 9.6V15c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8V9.6" /><path d="M20 8.5v5" /></>,
  attendance: <><rect x="4" y="4" width="16" height="17" rx="2" /><path d="M4 9h16" /><path d="M8.5 14.5l2.2 2.2 4.8-4.8" /><path d="M9 2v4M15 2v4" /></>,
  fees: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6.2 9.2v.01M17.8 14.8v.01" /></>,
  slips: <><path d="M6 3h12v18l-2.4-1.6L13.2 21l-2.4-1.6L8.4 21 6 19.4z" /><path d="M9 8h6M9 12h6M9 16h3.5" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="M7.5 14h3M13.5 14h3M7.5 17.5h3" /></>,
  reports: <><path d="M4 20V10M10 20V4M16 20v-7M21 20H3.5" /></>,
  settings: <><circle cx="12" cy="12" r="3.1" /><path d="M12 2.6v2.7M12 18.7v2.7M2.6 12h2.7M18.7 12h2.7M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9" /></>,
  logout: <><path d="M14 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H14" /><path d="M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" /></>,
  edit: <><path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17z" /><path d="M14.5 7l3 3" /></>,
  trash: <><path d="M4.5 6.5h15M9.5 6V4.5h5V6M6.5 6.5l.8 13h9.4l.8-13" /><path d="M10 10.5v5.5M14 10.5v5.5" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="M4.5 12.5l5 5L19.5 7" />,
  chevL: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  chevR: <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  chevD: <path d="M5.5 9.5 12 16l6.5-6.5" />,
  download: <><path d="M12 3.5V15M7.5 10.5 12 15l4.5-4.5" /><path d="M4 20h16" /></>,
  upload: <><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8" /><path d="M4 20h16" /></>,
  whatsapp: <><path d="M12 3.6a8.3 8.3 0 0 0-7.2 12.5L3.6 20.4l4.5-1.2A8.4 8.4 0 1 0 12 3.6z" /><path d="M9.2 8.4c-.4 1.9 2.5 6 5.9 6.3.9.1 1.7-.5 1.7-1.2 0-.6-1-1.2-1.6-1.4-.5-.2-.9.6-1.4.5-.9-.2-2.3-1.6-2.4-2.4 0-.4.7-.7.6-1.3-.1-.5-.5-1.6-1.1-1.6-.5 0-.6.6-1.7 1.1z" fill="currentColor" stroke="none" /></>,
  share: <><circle cx="6" cy="12" r="2.6" /><circle cx="17.5" cy="5.5" r="2.6" /><circle cx="17.5" cy="18.5" r="2.6" /><path d="M8.4 10.8l6.8-4M8.4 13.2l6.8 4" /></>,
  phone: <path d="M5.5 4h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L16 14l4 1.5v3a1.5 1.5 0 0 1-1.6 1.5C10.8 19.5 4.5 13.2 4 6.1A1.5 1.5 0 0 1 5.5 4z" />,
  alert: <><path d="M12 3.5 2.8 19.5h18.4z" /><path d="M12 9.5v4.5M12 16.8v.01" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.2l3.4 2" /></>,
  wallet: <><path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h12A1.5 1.5 0 0 1 19 7.5V9" /><rect x="4" y="8.5" width="16" height="11" rx="1.5" /><path d="M15.5 14h.01" /></>,
  eye: <><path d="M3 12s3.5-6.5 9-6.5S21 12 21 12s-3.5 6.5-9 6.5S3 12 3 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  eyeoff: <><path d="M5 5l14 14" /><path d="M10.6 6c.5-.1.9-.1 1.4-.1 5.5 0 9 6.1 9 6.1a17 17 0 0 1-3 3.5M6.4 8A16 16 0 0 0 3 12s3.5 6.1 9 6.1c1 0 2-.2 2.9-.5" /></>,
  menu: <path d="M4 6.5h16M4 12h16M4 17.5h10" />,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 3.5V8h-4.5" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.8 3.4-5.7 7-5.7s6.2 1.9 7 5.7" /></>,
  note: <><path d="M5 4h14v13l-4 4H5z" /><path d="M15 21v-4h4M9 9h6M9 13h4" /></>,
  arrowR: <path d="M4 12h15M13.5 6 19.5 12l-6 6" />,
  save: <><path d="M5 4h11l3.5 3.5V20H5z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></>,
  filter: <path d="M4 5.5h16L14 13v6l-4-2v-4z" />,
  bell: <><path d="M6 16v-5.5a6 6 0 0 1 12 0V16l1.8 2.5H4.2z" /><path d="M10 21a2.2 2.2 0 0 0 4 0" /></>,
  receipt: <><path d="M6 3h12v18l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3z" /><path d="M9 7.5h6M9 11h6M9 14.5h3.5" /></>,
  send: <><path d="M21 3.5 3.5 10.4l6.6 2.5 2.5 6.6z" /><path d="M21 3.5 10.1 12.9" /></>,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="M4.5 17.5 10 13l3.5 3 2.5-2 3.5 3" /></>,
};

export function Icon({ name, size = 18, className = "", strokeWidth = 1.9 }: { name: string; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

/* ================= buttons ================= */

type BtnVariant = "primary" | "dark" | "gold" | "outline" | "ghost" | "danger" | "success" | "wa";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-ink-900 text-white hover:bg-ink-700 border border-ink-900 hover:border-ink-700",
  dark: "bg-ink-950 text-gold-300 border border-ink-950 hover:bg-ink-800",
  gold: "bg-gold-500 text-ink-950 border border-gold-600/40 hover:bg-gold-400 shadow-[0_2px_10px_-3px_rgba(232,160,32,0.55)]",
  outline: "bg-white text-ink-800 border border-ink-200 hover:border-ink-400 hover:bg-ink-50",
  ghost: "bg-transparent text-ink-600 border border-transparent hover:bg-ink-100/70 hover:text-ink-900",
  danger: "bg-flame-600 text-white border border-flame-700 hover:bg-flame-700",
  success: "bg-mint-600 text-white border border-mint-700 hover:bg-mint-700",
  wa: "bg-[#128c5e] text-white border border-[#0e7a50] hover:bg-[#0e7a50]",
};

export function Btn({
  variant = "primary", size = "md", icon, children, className = "", ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg"; icon?: string }) {
  const sz = size === "sm" ? "h-8 px-3 text-[12.5px] gap-1.5" : size === "lg" ? "h-11 px-5 text-[14px] gap-2" : "h-9.5 px-4 text-[13px] gap-2";
  return (
    <button
      className={`inline-flex items-center justify-center font-semibold rounded-[9px] transition-all duration-150 press select-none disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap ${BTN[variant]} ${sz} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 16} />}
      {children}
    </button>
  );
}

export function IconBtn({ name, label, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { name: string; label: string }) {
  return (
    <button aria-label={label} title={label} className={`inline-flex items-center justify-center w-8 h-8 rounded-[8px] text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition-colors press ${className}`} {...rest}>
      <Icon name={name} size={16} />
    </button>
  );
}

/* ================= badges ================= */

type Tone = "green" | "amber" | "red" | "slate" | "navy" | "gold" | "teal";
const TONES: Record<Tone, string> = {
  green: "bg-mint-50 text-mint-700 border-mint-600/25",
  amber: "bg-warn-50 text-warn-700 border-warn-600/25",
  red: "bg-flame-50 text-flame-700 border-flame-600/25",
  slate: "bg-ink-50 text-ink-500 border-ink-200",
  navy: "bg-ink-900 text-ink-100 border-ink-900",
  gold: "bg-gold-50 text-gold-700 border-gold-600/30",
  teal: "bg-[#ecf6f8] text-[#0e6b7c] border-[#0e7490]/25",
};

export function Badge({ tone = "slate", children, className = "" }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold tracking-wide ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function FeeStatusBadge({ status }: { status: FeeStatus }) {
  const tone: Tone = status === "paid" ? "green" : status === "overdue" ? "red" : status === "partial" ? "amber" : status === "waived" ? "slate" : status === "upcoming" ? "navy" : "gold";
  return <Badge tone={tone}>{FEE_STATUS_LABEL[status]}</Badge>;
}

export function StudentStatusBadge({ status }: { status: StudentStatus }) {
  return <Badge tone={status === "active" ? "green" : "amber"}>{status === "active" ? "Active" : "Inactive"}</Badge>;
}

export function AttBadge({ status }: { status: AttendanceStatus | "notmarked" | "holiday" }) {
  const map: Record<string, [Tone, string]> = {
    present: ["green", "Present"], absent: ["red", "Absent"], late: ["amber", "Late"],
    leave: ["slate", "Leave"], notmarked: ["slate", "Not Marked"], holiday: ["teal", "Holiday"],
  };
  const [tone, label] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function Avatar({ name, size = 36, className = "" }: { name: string; size?: number; className?: string }) {
  const hue = nameHue(name);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[10px] font-display font-bold text-white shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(135deg, hsl(${hue} 42% 38%), hsl(${hue} 48% 26%))` }}
    >
      {initials(name)}
    </span>
  );
}

/* default tutor avatar — friendly cartoon girl, drawn inline so it always works offline */
export function TutorAvatar({ size = 40, photo, className = "" }: { size?: number; photo?: string | null; className?: string }) {
  if (photo) return <img src={photo} alt="Tutor" width={size} height={size} className={`rounded-[10px] object-cover shrink-0 ${className}`} />;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={`rounded-[10px] shrink-0 ${className}`} role="img" aria-label="Tutor avatar">
      <rect width="64" height="64" rx="12" fill="#131f3a" />
      <circle cx="32" cy="26" r="13" fill="#f2c9a0" />
      <path d="M19 24c0-9 6-14 13-14s13 5 13 14c0 2-.3 3.6-.8 5-.6-6-3-9.5-4.7-10.5-2.4 3-7 4.5-12.5 4.5-3.4 0-6-.6-7.6-1.6C19.3 22 19 23 19 24z" fill="#2c2233" />
      <circle cx="27" cy="27" r="1.5" fill="#2c2233" />
      <circle cx="37" cy="27" r="1.5" fill="#2c2233" />
      <path d="M29 33c1.5 1.4 4.5 1.4 6 0" stroke="#b3765a" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M14 54c2-9 9-13 18-13s16 4 18 13v4H14z" fill="#0e7a50" />
      <path d="M27 41h10l-2 6h-6z" fill="#f2c9a0" />
      <circle cx="21" cy="25" r="1.4" fill="#e8a020" />
      <circle cx="43" cy="25" r="1.4" fill="#e8a020" />
    </svg>
  );
}

/* ================= form primitives ================= */

export function Field({ label, required, hint, error, children, className = "" }: { label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1.5">
        {label} {required && <span className="text-flame-600">*</span>}
      </span>
      {children}
      {hint && !error && <span className="block mt-1 text-[11.5px] text-ink-400">{hint}</span>}
      {error && <span className="block mt-1 text-[11.5px] font-semibold text-flame-600">{error}</span>}
    </label>
  );
}

const INPUT_CLS =
  "w-full h-9.5 px-3 rounded-[9px] border border-ink-200 bg-white text-[13.5px] text-ink-900 placeholder:text-ink-300 transition-colors focus:border-gold-500 hover:border-ink-300";

export function TInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT_CLS} ${props.className ?? ""}`} />;
}
export function TArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full px-3 py-2 rounded-[9px] border border-ink-200 bg-white text-[13.5px] text-ink-900 placeholder:text-ink-300 focus:border-gold-500 hover:border-ink-300 ${props.className ?? ""}`} />;
}
export function TSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${INPUT_CLS} appearance-none bg-no-repeat bg-[right_10px_center] bg-[length:14px] ${props.className ?? ""}`} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234c6086' stroke-width='2.4' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")" }} />;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative inline-flex items-center w-9 h-5 rounded-full transition-colors duration-200 ${checked ? "bg-mint-600" : "bg-ink-200"}`}>
      <span className={`absolute w-3.5 h-3.5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? "translate-x-[19px]" : "translate-x-[3px]"}`} />
    </button>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search…", className = "" }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${INPUT_CLS} pl-9`} />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-800" aria-label="Clear search">
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}

/* ================= modal / confirm (with body scroll lock) ================= */

export function Modal({ open, onClose, title, sub, children, footer, wide }: { open: boolean; onClose: () => void; title: string; sub?: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // lock page scroll — only the modal scrolls
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-950/55 anim-fade-in" onClick={onClose} />
      <div className={`relative w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} max-h-[92vh] flex flex-col bg-white sm:rounded-2xl rounded-t-2xl border border-ink-100 shadow-2xl anim-pop`}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-ink-100 shrink-0">
          <div>
            <h2 className="font-display font-bold text-[19px] text-ink-900 leading-tight">{title}</h2>
            {sub && <p className="text-[12.5px] text-ink-400 mt-0.5">{sub}</p>}
          </div>
          <IconBtn name="x" label="Close" onClick={onClose} />
        </div>
        <div className="px-6 py-5 overflow-y-auto scroll-thin overscroll-contain">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-ink-100 bg-ink-50/60 rounded-b-2xl flex items-center justify-end gap-2.5 flex-wrap shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ open, onClose, onConfirm, title, message, confirmLabel = "Confirm", tone = "danger" }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: React.ReactNode; confirmLabel?: string; tone?: "danger" | "gold" | "primary" }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex gap-3.5">
        <span className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 ${tone === "danger" ? "bg-flame-50 text-flame-600" : "bg-gold-50 text-gold-600"}`}>
          <Icon name="alert" size={20} />
        </span>
        <div className="text-[13.5px] text-ink-600 leading-relaxed">{message}</div>
      </div>
      <div className="flex justify-end gap-2.5 mt-6">
        <Btn variant="outline" onClick={onClose}>Cancel</Btn>
        <Btn variant={tone === "danger" ? "danger" : tone === "gold" ? "gold" : "primary"} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Btn>
      </div>
    </Modal>
  );
}

/* ================= toasts ================= */

interface ToastItem { id: number; text: string; tone: "ok" | "warn" | "err" }
const ToastCtx = createContext<{ push: (text: string, tone?: ToastItem["tone"]) => void } | null>(null);
export function useToast() {
  const v = useContext(ToastCtx);
  if (!v) throw new Error("ToastProvider missing");
  return v;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(1);
  const push = (text: string, tone: ToastItem["tone"] = "ok") => {
    const id = idRef.current++;
    setItems((xs) => [...xs.slice(-3), { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3400);
  };
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[70] flex flex-col gap-2 items-end pointer-events-none">
        {items.map((t) => (
          <div key={t.id} className={`anim-toast pointer-events-auto flex items-center gap-2.5 pl-3 pr-4 h-11 rounded-[10px] border shadow-lg text-[13px] font-semibold bg-ink-900 text-white max-w-[340px] ${t.tone === "ok" ? "border-ink-700" : t.tone === "warn" ? "border-gold-600/50" : "border-flame-600/50"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${t.tone === "ok" ? "bg-mint-600" : t.tone === "warn" ? "bg-gold-500 text-ink-950" : "bg-flame-600"}`}>
              <Icon name={t.tone === "ok" ? "check" : "alert"} size={12} strokeWidth={2.6} />
            </span>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ================= layout bits ================= */

export function EmptyState({ icon = "file", title, message, action }: { icon?: string; title: string; message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 anim-fade-up">
      <span className="w-14 h-14 rounded-2xl bg-ink-50 border border-dashed border-ink-200 text-ink-400 flex items-center justify-center mb-4">
        <Icon name={icon} size={24} strokeWidth={1.6} />
      </span>
      <h3 className="font-display font-bold text-[17px] text-ink-900">{title}</h3>
      <p className="text-[13px] text-ink-400 mt-1.5 max-w-sm leading-relaxed">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, icon, tone = "navy", onClick, delay }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon: string; tone?: Tone; onClick?: () => void; delay?: number }) {
  const El = onClick ? "button" : "div";
  return (
    <El onClick={onClick} style={delay ? { animationDelay: `${delay}ms` } : undefined} className={`card p-4 text-left anim-fade-up ${onClick ? "card-hover cursor-pointer w-full" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">{label}</span>
        <span className={`w-7 h-7 rounded-[8px] flex items-center justify-center ${TONES[tone]}`}><Icon name={icon} size={14} /></span>
      </div>
      <div className="font-display font-bold text-[26px] leading-tight text-ink-900 mt-2 tnum">{value}</div>
      {sub && <div className="text-[12px] text-ink-400 mt-1 tnum">{sub}</div>}
    </El>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: { key: string; label: string; icon?: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-[10px] bg-ink-100/80 border border-ink-100 flex-wrap">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[8px] text-[12.5px] font-semibold transition-all duration-150 ${value === t.key ? "bg-ink-900 text-white shadow" : "text-ink-500 hover:text-ink-900"}`}>
          {t.icon && <Icon name={t.icon} size={14} />}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="font-display font-bold text-[24px] sm:text-[27px] text-ink-900 leading-tight">{title}</h1>
        {sub && <p className="text-[13px] text-ink-400 mt-1">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5 flex-wrap">{actions}</div>}
    </div>
  );
}

export function ProgressBar({ value, max, tone = "gold" }: { value: number; max: number; tone?: "gold" | "green" | "red" }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  const color = tone === "green" ? "bg-mint-600" : tone === "red" ? "bg-flame-600" : "bg-gold-500";
  return (
    <div className="h-1.5 w-full rounded-full bg-ink-100 overflow-hidden">
      <div className={`h-full rounded-full ${color} anim-grow-x`} style={{ width: `${pct}%` }} />
    </div>
  );
}
