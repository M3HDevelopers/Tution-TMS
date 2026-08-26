import type { DataState, FeeRecord } from "../types";
import { balanceOf, paidOf, previousBalance, statusOf, studentPaidToDate } from "./fee";
import { daysBetween, fmtDate, fmtMoney, periodLabel, todayISO } from "./utils";

export interface SlipModel {
  slipNo: string;
  tuitionName: string;
  tutorName: string;
  phone: string;
  address: string;
  footerNote: string;
  currency: string;
  studentName: string;
  studentId: string;
  gradeLine: string;
  batchLine: string;
  school: string;
  periodLbl: string;
  issueDate: string;
  dueDate: string;
  baseFee: number;
  prevBalance: number;
  lateFee: number;
  adjustment: number;
  totalPayable: number;
  paid: number;
  remaining: number;
  waived: boolean;
  stamp: "PAID" | "DUE" | "PARTIAL" | "OVERDUE" | "WAIVED";
}

export function buildSlipModel(state: DataState, rec: FeeRecord): SlipModel | null {
  const s = state.students.find((x) => x.id === rec.studentId);
  if (!s) return null;
  const settings = state.settings;
  const cur = settings.feePolicy.currency;
  const prev = previousBalance(state, s.id, rec.period);
  const base = rec.waived ? 0 : rec.baseFee;
  const total = base + rec.lateFee + rec.adjustment + prev;
  const paid = studentPaidToDate(state, s.id, rec.period);
  const remaining = rec.waived ? 0 : Math.max(0, total - paid);
  const overdue = daysBetween(rec.dueDate, todayISO()) > settings.feePolicy.graceDays;
  let stamp: SlipModel["stamp"] = "DUE";
  if (rec.waived) stamp = "WAIVED";
  else if (remaining <= 0) stamp = "PAID";
  else if (overdue) stamp = "OVERDUE";
  else if (paid > 0) stamp = "PARTIAL";

  const batchLine = s.batchIds
    .map((id) => state.batches.find((b) => b.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  return {
    slipNo: "FS-" + rec.id.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase(),
    tuitionName: settings.tuitionName,
    tutorName: settings.tutorName,
    phone: settings.phone,
    address: settings.address,
    footerNote: settings.footerNote,
    currency: cur,
    studentName: s.name,
    studentId: s.id.toUpperCase().replace("ST_", "TMS-"),
    gradeLine: `${s.level} · ${s.grade}`,
    batchLine: batchLine || "—",
    school: s.school || "—",
    periodLbl: periodLabel(rec.period),
    issueDate: fmtDate(todayISO(), settings.dateFormat),
    dueDate: fmtDate(rec.dueDate, settings.dateFormat),
    baseFee: base,
    prevBalance: prev,
    lateFee: rec.lateFee,
    adjustment: rec.adjustment,
    totalPayable: total,
    paid,
    remaining,
    waived: rec.waived,
    stamp,
  };
}

/* ================= canvas rendering ================= */

const INK = "#10203c";
const INK_SOFT = "#48597229";
const SLATE = "#5b6b84";
const LABEL = "#8795ab";
const LINE = "#d5dce6";
const GOLD = "#e8a020";
const PAPER = "#fdfcf8";
const GREEN = "#12855f";
const RED = "#c03434";
const AMBER = "#b26e0e";

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const money = (n: number, cur: string) => fmtMoney(n, cur);

export function drawSlip(m: SlipModel): HTMLCanvasElement {
  const W = 1080;
  const H = 1400;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.textBaseline = "alphabetic";

  // paper + frame
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(45, 45, W - 90, H - 90);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 6;
  const tick = 26;
  for (const [cx, cy, dx, dy] of [
    [45, 45, 1, 1],
    [W - 45, 45, -1, 1],
    [45, H - 45, 1, -1],
    [W - 45, H - 45, -1, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * tick, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * tick);
    ctx.stroke();
  }

  // header band
  ctx.fillStyle = INK;
  ctx.fillRect(45, 45, W - 90, 196);
  // monogram
  const mono = m.tuitionName.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "T";
  rr(ctx, 93, 93, 100, 100, 18);
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '800 46px "Bricolage Grotesque", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(mono, 143, 159);
  // names
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = '700 44px "Bricolage Grotesque", sans-serif';
  ctx.fillText(m.tuitionName, 221, 141, 600);
  ctx.fillStyle = "#a9b8d1";
  ctx.font = '400 22px "IBM Plex Sans", sans-serif';
  ctx.fillText(`Tutor: ${m.tutorName}   ·   ${m.phone}`, 222, 178);
  // right block
  ctx.textAlign = "right";
  ctx.fillStyle = GOLD;
  ctx.font = '600 20px "IBM Plex Sans", sans-serif';
  const rt = "T U I T I O N   F E E   S L I P";
  ctx.fillText(rt, W - 93, 122);
  ctx.fillStyle = "#ffffff";
  ctx.font = '600 36px "IBM Plex Sans", sans-serif';
  ctx.fillText(m.periodLbl, W - 93, 172);

  // meta strip
  const metas: [string, string][] = [
    ["SLIP NO.", m.slipNo],
    ["ISSUE DATE", m.issueDate],
    ["DUE DATE", m.dueDate],
    ["FEE PERIOD", m.periodLbl],
  ];
  metas.forEach(([k, v], i) => {
    const x = 93 + i * 232;
    ctx.textAlign = "left";
    ctx.fillStyle = LABEL;
    ctx.font = '600 16px "IBM Plex Sans", sans-serif';
    ctx.fillText(k, x, 300);
    ctx.fillStyle = INK;
    ctx.font = '600 24px "IBM Plex Mono", monospace';
    ctx.fillText(v, x, 332, 220);
  });

  // perforation
  ctx.strokeStyle = "#c3cdd9";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(93, 366);
  ctx.lineTo(W - 93, 366);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const cx of [45, W - 45]) {
    ctx.fillStyle = "#f3f5f9";
    ctx.beginPath();
    ctx.arc(cx, 366, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.stroke();
  }

  // billed to
  ctx.textAlign = "left";
  ctx.fillStyle = LABEL;
  ctx.font = '600 17px "IBM Plex Sans", sans-serif';
  ctx.fillText("B I L L E D   T O", 93, 424);
  ctx.fillStyle = INK;
  ctx.font = '700 46px "Bricolage Grotesque", sans-serif';
  ctx.fillText(m.studentName, 93, 478, 620);

  const grid: [string, string][] = [
    ["STUDENT ID", m.studentId],
    ["CLASS / LEVEL", m.gradeLine],
    ["BATCH", m.batchLine],
    ["SCHOOL / COLLEGE", m.school],
  ];
  grid.forEach(([k, v], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 93 + col * 470;
    const y = 528 + row * 66;
    ctx.fillStyle = LABEL;
    ctx.font = '600 16px "IBM Plex Sans", sans-serif';
    ctx.fillText(k, x, y);
    ctx.fillStyle = INK;
    ctx.font = '600 25px "IBM Plex Sans", sans-serif';
    ctx.fillText(v, x, y + 30, 440);
  });

  // charges table
  let y = 706;
  const rows: [string, string, string][] = [
    [`Monthly tuition fee — ${m.periodLbl}`, money(m.baseFee, m.currency) + (m.waived ? "  (waived)" : ""), INK],
    ["Previous balance brought forward", money(m.prevBalance, m.currency), m.prevBalance > 0 ? RED : INK],
    ["Late fee", money(m.lateFee, m.currency), m.lateFee > 0 ? AMBER : INK],
    ["Adjustment / discount", (m.adjustment < 0 ? "− " : "") + money(Math.abs(m.adjustment), m.currency), m.adjustment < 0 ? GREEN : INK],
  ];
  for (const [k, v, color] of rows) {
    ctx.textAlign = "left";
    ctx.fillStyle = SLATE;
    ctx.font = '400 26px "IBM Plex Sans", sans-serif';
    ctx.fillText(k, 93, y);
    ctx.textAlign = "right";
    ctx.fillStyle = color;
    ctx.font = '600 27px "IBM Plex Mono", monospace';
    ctx.fillText(v, W - 93, y);
    ctx.strokeStyle = "#e6ebf1";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(93, y + 16);
    ctx.lineTo(W - 93, y + 16);
    ctx.stroke();
    y += 58;
  }

  // total payable band
  y += 8;
  rr(ctx, 93, y, W - 186, 74, 10);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = "#e6ecf5";
  ctx.font = '600 26px "IBM Plex Sans", sans-serif';
  ctx.fillText("TOTAL PAYABLE", 121, y + 47);
  ctx.textAlign = "right";
  ctx.fillStyle = GOLD;
  ctx.font = '700 34px "IBM Plex Mono", monospace';
  ctx.fillText(money(m.totalPayable, m.currency), W - 121, y + 49);

  y += 74 + 52;
  ctx.textAlign = "left";
  ctx.fillStyle = SLATE;
  ctx.font = '400 26px "IBM Plex Sans", sans-serif';
  ctx.fillText("Paid to date", 93, y);
  ctx.textAlign = "right";
  ctx.fillStyle = GREEN;
  ctx.font = '600 27px "IBM Plex Mono", monospace';
  ctx.fillText("− " + money(m.paid, m.currency), W - 93, y);

  y += 46;
  ctx.textAlign = "left";
  ctx.fillStyle = LABEL;
  ctx.font = '600 17px "IBM Plex Sans", sans-serif';
  ctx.fillText("R E M A I N I N G   D U E", 93, y + 14);
  ctx.font = '700 62px "IBM Plex Mono", monospace';
  ctx.fillStyle = m.remaining <= 0 ? GREEN : m.stamp === "OVERDUE" ? RED : INK;
  ctx.fillText(money(m.remaining, m.currency), 93, y + 78);
  ctx.strokeStyle = m.remaining <= 0 ? GREEN : "#d5dce6";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(93, y + 96);
  ctx.lineTo(W - 93, y + 96);
  ctx.stroke();

  // stamp
  const stampColor = m.stamp === "PAID" ? GREEN : m.stamp === "OVERDUE" ? RED : m.stamp === "PARTIAL" ? AMBER : m.stamp === "WAIVED" ? "#4c6086" : AMBER;
  ctx.save();
  ctx.translate(812, y - 26);
  ctx.rotate(-0.16);
  ctx.strokeStyle = stampColor;
  ctx.lineWidth = 5;
  rr(ctx, -158, -52, 316, 96, 14);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = stampColor;
  ctx.globalAlpha = 0.92;
  ctx.font = '800 46px "Bricolage Grotesque", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(m.stamp, 0, 14);
  ctx.restore();
  ctx.globalAlpha = 1;

  // footer
  const fy = 1216;
  ctx.strokeStyle = "#c3cdd9";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(93, fy);
  ctx.lineTo(W - 93, fy);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = "center";
  ctx.fillStyle = SLATE;
  ctx.font = 'italic 400 23px "IBM Plex Sans", sans-serif';
  const note = m.footerNote.length > 92 ? m.footerNote.slice(0, 92) + "…" : m.footerNote;
  if (note) ctx.fillText(note, W / 2, fy + 44, W - 200);
  ctx.fillStyle = "#77879e";
  ctx.font = '400 21px "IBM Plex Sans", sans-serif';
  const addr = [m.address, m.phone].filter(Boolean).join("   ·   ");
  ctx.fillText(addr, W / 2, fy + 82, W - 200);

  // barcode
  let bx = W / 2 - 190;
  let seedNum = 0;
  for (let i = 0; i < m.slipNo.length; i++) seedNum = (seedNum * 31 + m.slipNo.charCodeAt(i)) >>> 0;
  for (let i = 0; i < 42; i++) {
    seedNum = (seedNum * 1103515245 + 12345) >>> 0;
    const wBar = 2 + (seedNum % 5);
    if (i % 2 === 0) {
      ctx.fillStyle = INK;
      ctx.fillRect(bx, fy + 104, wBar, 44);
    }
    bx += wBar + 3;
  }
  ctx.fillStyle = "#9aa8bc";
  ctx.font = '500 17px "IBM Plex Mono", monospace';
  ctx.fillText(`${m.slipNo}  ·  generated with Tuition Desk  ·  local-first record`, W / 2, fy + 172);

  return canvas;
}

export async function slipDataUrl(m: SlipModel): Promise<string> {
  try {
    await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
  } catch {
    /* fonts may not be ready — draw anyway */
  }
  return drawSlip(m).toDataURL("image/png");
}

export async function slipBlob(m: SlipModel): Promise<Blob> {
  const canvas = drawSlip(m);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}

export { statusOf, paidOf, balanceOf };
