import type { ActivityItem, AttendanceRecord, AttendanceStatus, DataState, FeeRecord, Guardian, Holiday, Payment, Settings, Student, TimingNotice } from "../types";
import { DEFAULT_SETTINGS } from "../types";
import { addDays, clampDay, currentPeriod, fmtMoney, monthKeyOf, shiftPeriod, timeLabel, toISO, todayISO, uid } from "./utils";

const daysAgo = (n: number) => addDays(todayISO(), -n);

function mkGuardian(studentId: string, name: string, relation: string, phone: string, primary = true): Guardian {
  return { id: uid("grd"), studentId, name, relation, phone, whatsapp: true, primary, notes: "" };
}

export function buildDemoData(): DataState {
  const settings: Settings = { ...DEFAULT_SETTINGS };
  const today = todayISO();
  const period = currentPeriod();
  const prev1 = shiftPeriod(period, -1);
  const prev2 = shiftPeriod(period, -2);
  const prev3 = shiftPeriod(period, -3);
  const prev4 = shiftPeriod(period, -4);

  /* ---------- students (classes only — no batches) ---------- */
  const defs: [string, string, string, number, number, string | undefined][] = [
    // name, grade, level, fee, feeDueDay, joined
    ["Ayaan Malik", "Nursery", "Nursery", 800, 1, daysAgo(420)],
    ["Mahnoor Fatima", "Nursery", "Nursery", 800, 5, daysAgo(200)],
    ["Hira Shahid", "Class 2", "Primary", 1200, 1, daysAgo(380)],
    ["Umar Farooq", "Class 2", "Primary", 1200, 1, daysAgo(90)],
    ["Ahmed Raza", "Class 5", "Primary", 1500, 1, daysAgo(310)],
    ["Zainab Tariq", "Class 5", "Primary", 1500, 10, daysAgo(160)],
    ["Sara Iqbal", "Class 8", "Middle", 2000, 1, daysAgo(290)],
    ["Hamza Sheikh", "Class 8", "Middle", 2000, 1, daysAgo(240)],
    ["Ali Akbar", "Matric", "Matric", 2500, 1, daysAgo(350)],
    ["Fatima Noor", "Matric", "Matric", 2500, 7, daysAgo(120)],
    ["Hassan Javed", "First Year", "Intermediate", 3000, 1, daysAgo(280)],
    ["Areeba Khalid", "First Year", "Intermediate", 3000, 1, undefined], // joining date unknown — optional!
  ];

  const students: Student[] = defs.map(([name, grade, level, monthlyFee, feeDueDay, joiningDate]) => ({
    id: uid("stu"), name, grade, level: level as Student["level"], monthlyFee, feeDueDay,
    joiningDate, status: "active", school: "", address: "", notes: "", photo: null,
  }));

  const g = (si: number, n: string, r: string, p: string, pr = true) => mkGuardian(students[si].id, n, r, p, pr);
  const guardians: Guardian[] = [
    g(0, "Imran Malik", "Father", "0301-2345601"), g(0, "Sadia Malik", "Mother", "0302-8811001", false),
    g(1, "Naveed Alam", "Father", "0301-2345602"),
    g(2, "Shahid Mehmood", "Father", "0301-2345603"), g(2, "Rubina Shahid", "Mother", "0333-7712003", false),
    g(3, "Farooq Azam", "Father", "0301-2345604"),
    g(4, "Raza Muhammad", "Father", "0301-2345605"),
    g(5, "Tariq Jamil", "Father", "0301-2345606"), g(5, "Nadia Tariq", "Mother", "0345-9912006", false),
    g(6, "Iqbal Ahmed", "Father", "0301-2345607"),
    g(7, "Aslam Sheikh", "Father", "0301-2345608"),
    g(8, "Akbar Ali", "Father", "0301-2345609"), g(8, "Shazia Akbar", "Mother", "0300-5512009", false),
    g(9, "Noor Muhammad", "Father", "0301-2345610"),
    g(10, "Javed Iqbal", "Father", "0301-2345611"),
    g(11, "Khalid Mahmood", "Father", "0301-2345612"), g(11, "Saima Khalid", "Mother", "0321-6612012", false),
  ];
  guardians[3].whatsapp = false; // Umar's father — no WhatsApp (notify flow must skip)

  /* ---------- fee records: previous 4 months + current ---------- */
  const feeRecords: FeeRecord[] = [];
  const rec = (s: Student, p: string, extra?: Partial<FeeRecord>) => {
    const r: FeeRecord = {
      id: uid("fee"), studentId: s.id, period: p,
      dueDate: clampDay(p, s.feeDueDay), baseFee: s.monthlyFee,
      lateFee: 0, adjustment: 0, waived: false, lateFeeApplied: false,
      createdAt: new Date(Date.now() - 9000000 + feeRecords.length * 1000).toISOString(),
      ...extra,
    };
    feeRecords.push(r);
    return r;
  };
  for (const s of students) {
    rec(s, prev4); rec(s, prev3); rec(s, prev2); rec(s, prev1); rec(s, period);
  }
  const byIdxPeriod = (i: number, p: string) => feeRecords.find((r) => r.studentId === students[i].id && r.period === p)!;

  /* ---------- payments ---------- */
  const payments: Payment[] = [];
  let rno = 1000;
  const pay = (r: FeeRecord, amount: number, date: string, method: Payment["method"], reference?: string) => {
    rno++;
    payments.push({
      id: uid("pay"), receiptNo: `RCP-${rno}`, feeRecordId: r.id, studentId: r.studentId,
      amount, date, method, reference, state: "recorded", createdAt: new Date().toISOString(),
    });
  };
  const payFull = (i: number, p: string, date: string, method: Payment["method"] = "Cash") =>
    pay(byIdxPeriod(i, p), students[i].monthlyFee, date, method);

  // history fully paid
  for (let i = 0; i < students.length; i++) {
    const j = students[i].joiningDate;
    if (!j || monthKeyOf(j) <= prev4) { payFull(i, prev4, `${prev4}-06`); payFull(i, prev3, `${prev3}-05`); }
    if (!j || monthKeyOf(j) <= prev3) payFull(i, prev2, `${prev2}-07`, i % 2 ? "Mobile Wallet" : "Cash");
    if (!j || monthKeyOf(j) <= prev2) payFull(i, prev1, `${prev1}-08`);
  }
  // current month scenarios (dates inside this month so far)
  const d = (n: number) => (daysBetweenSafe(`${period}-01`, today) >= n ? `${period}-${String(n).padStart(2, "0")}` : today);
  payFull(0, period, d(2));                                             // Ayaan PAID
  pay(byIdxPeriod(1, period), 500, d(3), "Cash");                       // Mahnoor PARTIAL (800 → 300 due)
  payFull(2, period, d(1));                                             // Hira PAID
  // Umar — UNPAID
  payFull(4, period, d(4), "Mobile Wallet");                            // Ahmed PAID
  pay(byIdxPeriod(5, period), 800, d(5), "Cash");                       // Zainab PARTIAL (700 due)
  payFull(6, period, d(2));                                             // Sara PAID
  // Hamza — UNPAID
  payFull(8, period, d(3));                                             // Ali PAID
  // Fatima — UNPAID
  pay(byIdxPeriod(10, period), 1500, d(6), "Bank Transfer", "HBL ref 88112"); // Hassan PARTIAL
  payFull(11, period, d(6));                                            // Areeba PAID

  // last month leftovers → overdue with balance
  pay(byIdxPeriod(7, prev1), 1000, `${prev1}-12`, "Cash");              // Hamza last month 1000 due
  pay(byIdxPeriod(9, prev1), 1500, `${prev1}-15`, "Cash");              // Fatima last month 1000 due

  // late fee applied on old overdue (grace exceeded)
  byIdxPeriod(7, prev1).lateFee = settings.feePolicy.lateFee;
  byIdxPeriod(7, prev1).lateFeeApplied = true;
  byIdxPeriod(9, prev1).lateFee = settings.feePolicy.lateFee;
  byIdxPeriod(9, prev1).lateFeeApplied = true;

  /* ---------- attendance: last 15 days, mixed ---------- */
  const attendance: AttendanceRecord[] = [];
  const rnd = mulberry(42);
  for (let back = 15; back >= 1; back--) {
    const date = daysAgo(back);
    const wd = new Date(date + "T12:00:00").getDay();
    if (wd === 0) continue; // Sunday off
    if (date === daysAgo(9)) continue; // one-off holiday
    for (const s of students) {
      if (s.joiningDate && date < s.joiningDate) continue;
      const roll = rnd();
      const status: AttendanceStatus = roll < 0.82 ? "present" : roll < 0.9 ? "late" : roll < 0.96 ? "absent" : "leave";
      attendance.push({ id: uid("att"), date, studentId: s.id, className: s.grade, status, markedAt: date + "T18:00:00.000Z" });
    }
  }
  // make two students absent yesterday for the notify-parents flow
  const yday = daysAgo(1);
  if (new Date(yday + "T12:00:00").getDay() !== 0) {
    for (const idx of [3, 9]) {
      const existing = attendance.find((a) => a.date === yday && a.studentId === students[idx].id);
      if (existing) existing.status = "absent";
      else attendance.push({ id: uid("att"), date: yday, studentId: students[idx].id, className: students[idx].grade, status: "absent", markedAt: new Date().toISOString() });
    }
  }

  /* ---------- holidays ---------- */
  const holidays: Holiday[] = [
    { id: uid("hol"), date: daysAgo(9), scope: "all", title: "Urgent personal work", reason: "Tuition remained closed for one day." },
    { id: uid("hol"), date: addDays(today, 12), scope: "all", title: "Eid holidays start", reason: "Centre closed for Eid." },
    { id: uid("hol"), date: addDays(today, 5), scope: "class", className: "Matric", title: "Board paper — Class 10", reason: "Matric students have board examination." },
  ];

  /* No fake/sample notices — the bell only ever shows REAL, derived alerts:
     overdue fees, dues arriving soon, absentees today, and timing changes the
     tutor actually creates. */
  const notifications: TimingNotice[] = [];

  /* ---------- activity ---------- */
  const activity: ActivityItem[] = [
    { id: uid("act"), at: new Date(Date.now() - 3600e3 * 5).toISOString(), text: `Payment RCP-${rno} recorded — ${fmtMoney(1500, settings.feePolicy.currency)} from Hassan Javed.`, kind: "fee" },
    { id: uid("act"), at: new Date(Date.now() - 3600e3 * 22).toISOString(), text: `Attendance marked for ${students.length} students.`, kind: "attendance" },
    { id: uid("act"), at: new Date(Date.now() - 3600e3 * 30).toISOString(), text: "Fee cycle generated for all active students.", kind: "fee" },
  ];

  return {
    students, guardians, batches: [], attendance, holidays, feeRecords, payments,
    slips: [], notifications, activity, settings,
  };
}

function daysBetweenSafe(a: string, b: string): number {
  return Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000);
}

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function timingMessage(s: Settings, n: { startDate: string; days: number; startTime: string; endTime: string; note?: string }): string {
  const from = new Date(n.startDate + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `Assalam-o-Alaikum! IMPORTANT NOTICE from ${s.tuitionName}:\n\nTuition timing has been CHANGED for ${n.days} day${n.days > 1 ? "s" : ""}, starting ${from}.\n\nNew timing: ${timeLabel(n.startTime)} to ${timeLabel(n.endTime)}\n(Regular timing will resume after these ${n.days} day${n.days > 1 ? "s" : ""}.)${n.note ? `\n\nNote: ${n.note}` : ""}\n\nKindly inform your child. JazakAllah!\n— ${s.tutorName}, ${s.tuitionName}`;
}

export function emptyData(): DataState {
  return {
    students: [], guardians: [], batches: [], attendance: [], holidays: [],
    feeRecords: [], payments: [], slips: [], notifications: [], activity: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export { toISO };
