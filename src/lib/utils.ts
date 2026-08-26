export type DateFormat = "dmy" | "mdy" | "iso";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAYS_S = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const RELATIONS = ["Father", "Mother", "Guardian", "Brother", "Sister", "Uncle", "Aunt", "Other"];

let seq = 0;
export function uid(prefix: string): string {
  seq = (seq + 1) % 1296;
  const t = Date.now().toString(36).slice(-6);
  const r = Math.floor(Math.random() * 1296).toString(36).padStart(2, "0");
  return `${prefix}_${t}${r}${seq.toString(36).padStart(2, "0")}`;
}

export const pad2 = (n: number) => String(n).padStart(2, "0");

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function todayISO(): string {
  return toISO(new Date());
}
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}
export function weekdayIdx(iso: string): number {
  return parseISO(iso).getDay();
}
export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}
export function currentPeriod(): string {
  return monthKeyOf(todayISO());
}
export function lastNPeriods(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}
export function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_S = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function periodLabel(period: string, short = false): string {
  const [y, m] = period.split("-").map(Number);
  return `${(short ? MONTHS_S : MONTHS)[(m || 1) - 1]} ${y}`;
}
export function monthTitle(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
}
export function daysInPeriod(period: string): number {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function fmtDate(iso: string | undefined, format: DateFormat = "dmy"): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "—";
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return "—";
  if (format === "iso") return iso;
  if (format === "mdy") return `${MONTHS_S[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS_S[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtMoney(n: number, currency = "Rs"): string {
  const v = Math.round(n);
  const neg = v < 0;
  return `${neg ? "−" : ""}${currency} ${Math.abs(v).toLocaleString("en-US")}`;
}

export function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

export function clampDay(period: string, day: number): string {
  const dim = daysInPeriod(period);
  return `${period}-${pad2(Math.min(Math.max(1, day), dim))}`;
}

export function timeLabel(t: string): string {
  if (!t || typeof t !== "string" || !t.includes(":")) return "";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${pad2(m || 0)} ${ap}`;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

const AV_HUES = [158, 205, 28, 340, 96, 262, 190, 44];
export function nameHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AV_HUES[h % AV_HUES.length];
}

/** Natural sort for class names: "Class 2" < "Class 10", letters first. */
export function naturalCompare(a: string, b: string): number {
  const an = a.match(/(\d+)\s*$/);
  const bn = b.match(/(\d+)\s*$/);
  const aBase = a.replace(/[\s\d]+$/, "").trim().toLowerCase();
  const bBase = b.replace(/[\s\d]+$/, "").trim().toLowerCase();
  if (aBase !== bBase) return aBase.localeCompare(bBase);
  if (an && bn) return parseInt(an[1], 10) - parseInt(bn[1], 10);
  return a.localeCompare(b);
}

export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}

/* ---------- files ---------- */
export function downloadText(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function toCSV(rows: (string | number)[][]): string {
  return rows
    .map((r) => r.map((c) => {
      const s = String(c ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","))
    .join("\r\n");
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsText(file);
  });
}

export function normalizePhone(p: string): string {
  return p.replace(/[^0-9+]/g, "");
}
export function isValidPhone(p: string): boolean {
  const n = normalizePhone(p);
  return n.length >= 7 && n.length <= 15;
}
export function waLink(phone: string, text: string): string {
  let n = normalizePhone(phone);
  if (n.startsWith("0")) n = "92" + n.slice(1);
  return `https://wa.me/${n.replace("+", "")}?text=${encodeURIComponent(text)}`;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(meta)?.[1] ?? "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
