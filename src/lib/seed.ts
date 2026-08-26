import type { AttendanceRec, Batch, DataState, FeeRecord, Guardian, Payment, Settings, Student } from "../types";
import { addDays, clampDay, daysInPeriod, shiftPeriod, todayISO, toISO, weekdayIdx } from "./utils";

export function defaultSettings(): Settings {
  return {
    tuitionName: "Al-Noor Tuition Centre",
    tutorName: "Imran Hussain",
    phone: "0301-2345678",
    email: "imran@alnoortuition.pk",
    address: "House 42, Street 9, Model Town, Lahore",
    footerNote: "Fee is payable by the 10th of every month. JazakAllah for your cooperation.",
    auth: { username: "tutor", password: "tutor123" },
    feePolicy: { cycleStartDay: 1, dueDay: 10, graceDays: 3, defaultFee: 2000, lateFee: 100, currency: "Rs" },
    weeklyOffs: [0],
    whatsappTemplate:
      "Assalam-o-Alaikum! {month} ki tuition fee slip {student} ke liye attach ki gai hai.\nTotal payable: {total}\nDue date: {due}\nRemaining due: {remaining}\nShukriya — {tuition}",
    dateFormat: "dmy",
  };
}

export function emptyState(): DataState {
  return {
    students: [],
    guardians: [],
    batches: [],
    attendance: [],
    holidays: [],
    feeRecords: [],
    payments: [],
    slips: [],
    activity: [
      { id: "act_boot", at: new Date().toISOString(), text: "Workspace created. Add your first student or load demo data.", kind: "system" },
    ],
    settings: defaultSettings(),
  };
}

export function buildDemoState(): DataState {
  const today = todayISO();
  const cur = today.slice(0, 7);
  const prev = shiftPeriod(cur, -1);

  const batches: Batch[] = [
    { id: "b_nursery", name: "Nursery & KG · 4 PM", level: "Nursery", grade: "Nursery–KG", subjects: ["English", "Urdu", "Math", "Drawing"], days: [1, 2, 3, 4, 5, 6], startTime: "16:00", endTime: "17:00", capacity: 12, defaultFee: 1500, color: "#0e7490", status: "active" },
    { id: "b_primary", name: "Primary · 5 PM", level: "Primary", grade: "Class 1–5", subjects: ["English", "Urdu", "Math", "Science", "Islamiat"], days: [1, 2, 3, 4, 5, 6], startTime: "17:00", endTime: "18:00", capacity: 15, defaultFee: 1800, color: "#b45309", status: "active" },
    { id: "b_middle", name: "Middle · 6 PM", level: "Middle", grade: "Class 6–8", subjects: ["English", "Math", "Science", "Urdu", "S.Studies"], days: [1, 2, 3, 4, 5], startTime: "18:00", endTime: "19:00", capacity: 15, defaultFee: 2400, color: "#4d7c0f", status: "active" },
    { id: "b_matric", name: "Matric Science · 7 PM", level: "Matric", grade: "Class 9–10", subjects: ["Physics", "Chemistry", "Biology", "Math", "English"], days: [1, 2, 3, 4, 5], startTime: "19:00", endTime: "20:00", capacity: 14, defaultFee: 3000, color: "#9d174d", status: "active" },
    { id: "b_inter", name: "Inter / First Year · 8 PM", level: "Intermediate", grade: "1st Year", subjects: ["Physics", "Chemistry", "Math"], days: [1, 3, 5], startTime: "20:00", endTime: "21:00", capacity: 10, defaultFee: 3500, color: "#33415c", status: "active" },
  ];

  const mk = (
    id: string, name: string, level: Student["level"], grade: string, school: string,
    batchIds: string[], fee: number, joinMonthsAgo: number, subjects: string[],
    extra?: Partial<Student>
  ): Student => ({
    id, name, level, grade, school, batchIds,
    monthlyFee: fee,
    subjects,
    joiningDate: shiftPeriod(cur, -joinMonthsAgo) + "-05",
    status: "active",
    ...extra,
  });

  const students: Student[] = [
    mk("st_ayaan", "Ayaan Khalid", "Nursery", "Nursery", "Little Bloom School", ["b_nursery"], 1500, 8, ["English", "Urdu", "Drawing"], { dob: shiftPeriod(cur, -48) + "-14", gender: "Male" }),
    mk("st_hira", "Hira Shahid", "Primary", "Class 2", "The City School", ["b_primary"], 1500, 12, ["English", "Math", "Urdu"], { dob: shiftPeriod(cur, -96) + "-03", gender: "Female" }),
    mk("st_ahmed", "Ahmed Raza", "Primary", "Class 5", "Allied School", ["b_primary"], 2000, 10, ["Math", "Science", "English"], { gender: "Male" }),
    mk("st_fatima", "Fatima Noor", "Primary", "Class 3", "Beaconhouse Junior", ["b_primary"], 1500, 3, ["English", "Urdu", "Islamiat"], { gender: "Female" }),
    mk("st_sara", "Sara Imtiaz", "Middle", "Class 8", "LGS Model Town", ["b_middle"], 2500, 14, ["Math", "Science", "English"], { gender: "Female", notes: "Strong in science — preparing for class 9 board stream." }),
    mk("st_zain", "Zain Abdullah", "Middle", "Class 7", "The Educators", ["b_middle"], 2500, 6, ["Math", "Science", "S.Studies"], { gender: "Male" }),
    mk("st_hamza", "Hamza Tariq", "Matric", "Class 10", "Punjab Group of Colleges", ["b_matric"], 3000, 16, ["Physics", "Chemistry", "Math"], { gender: "Male", notes: "Board candidate — extra past-paper practice on Saturdays." }),
    mk("st_maryam", "Maryam Aslam", "Matric", "Class 9", "Punjab Group of Colleges", ["b_matric"], 3000, 5, ["Biology", "Chemistry", "English"], { gender: "Female" }),
    mk("st_ali", "Ali Haider", "College", "First Year", "GCU Lahore", ["b_inter"], 3500, 9, ["Physics", "Chemistry", "Math"], { level: "College", grade: "First Year (Pre-Eng)" }),
    mk("st_bilal", "Bilal Ahmed", "Intermediate", "1st Year", "Superior College", ["b_inter"], 3200, 7, ["Physics", "Math", "Chemistry"], { gender: "Male" }),
    mk("st_usman", "Usman Ghani", "Middle", "Class 6", "The Educators", ["b_middle"], 2400, 18, ["Math", "Science"], { status: "archived", notes: "Moved to another city in the holidays. History preserved." }),
  ];

  const guardians: Guardian[] = [
    { id: "g_ayaan_m", studentId: "st_ayaan", name: "Sana Khalid", relation: "Mother", phone: "0300-1112201", whatsapp: true, primary: true },
    { id: "g_ayaan_f", studentId: "st_ayaan", name: "Khalid Mehmood", relation: "Father", phone: "0321-4405501", whatsapp: true, primary: false },
    { id: "g_hira_f", studentId: "st_hira", name: "Shahid Iqbal", relation: "Father", phone: "0333-7706602", whatsapp: true, primary: true },
    { id: "g_ahmed_f", studentId: "st_ahmed", name: "Raza Muhammad", relation: "Father", phone: "0345-9908803", whatsapp: true, primary: true },
    { id: "g_ahmed_u", studentId: "st_ahmed", name: "Imran Raza (Uncle)", relation: "Uncle", phone: "0301-2203304", whatsapp: false, primary: false, notes: "Picks up Ahmed on Tuesdays." },
    { id: "g_fatima_m", studentId: "st_fatima", name: "Nadia Noor", relation: "Mother", phone: "0322-5504405", whatsapp: true, primary: true },
    { id: "g_sara_m", studentId: "st_sara", name: "Rubina Imtiaz", relation: "Mother", phone: "0334-6605506", whatsapp: true, primary: true },
    { id: "g_zain_f", studentId: "st_zain", name: "Abdullah Saeed", relation: "Father", phone: "0346-7706607", whatsapp: true, primary: true },
    { id: "g_hamza_f", studentId: "st_hamza", name: "Tariq Jameel", relation: "Father", phone: "0302-8807708", whatsapp: true, primary: true },
    { id: "g_hamza_b", studentId: "st_hamza", name: "Saad Tariq", relation: "Brother", phone: "0323-9908809", whatsapp: true, primary: false },
    { id: "g_maryam_f", studentId: "st_maryam", name: "Aslam Pervaiz", relation: "Father", phone: "0335-1109910", whatsapp: true, primary: true },
    { id: "g_ali_f", studentId: "st_ali", name: "Haider Abbas", relation: "Father", phone: "0347-2210011", whatsapp: true, primary: true },
    { id: "g_bilal_m", studentId: "st_bilal", name: "Shazia Ahmed", relation: "Mother", phone: "0303-3311112", whatsapp: true, primary: true },
    { id: "g_usman_f", studentId: "st_usman", name: "Ghani Abbas", relation: "Father", phone: "0324-4412213", whatsapp: false, primary: true },
  ];

  /* attendance: last 14 days, Sundays skipped, today left unmarked */
  const attendance: AttendanceRec[] = [];
  const activeStudents = students.filter((s) => s.status === "active");
  for (let back = 14; back >= 1; back--) {
    const date = addDays(today, -back);
    const wd = weekdayIdx(date);
    if (wd === 0) continue; // Sunday weekly off
    for (const b of batches) {
      if (!b.days.includes(wd)) continue;
      const members = activeStudents.filter((s) => s.batchIds.includes(b.id));
      members.forEach((s, si) => {
        const h = (back * 131 + si * 17 + b.name.length * 7) % 100;
        const status = h < 84 ? "present" : h < 90 ? "late" : h < 95 ? "absent" : "leave";
        // leave a couple of gaps mid-history so "not marked" is visible
        if (back === 6 && b.id === "b_inter") return;
        attendance.push({ id: `att_${back}_${s.id}_${b.id}`, date, studentId: s.id, batchId: b.id, status, markedAt: date + "T18:00:00.000Z" });
      });
    }
  }

  /* fee records: previous + current period */
  const feeRecords: FeeRecord[] = [];
  const fr = (studentId: string, period: string, baseFee: number, opts?: Partial<FeeRecord>): FeeRecord => {
    const rec: FeeRecord = {
      id: `fee_${studentId}_${period}`,
      studentId, period,
      dueDate: clampDay(period, 10),
      baseFee, lateFee: 0, adjustment: 0, waived: false, lateFeeApplied: false,
      createdAt: period + "-01T06:00:00.000Z",
      ...opts,
    };
    feeRecords.push(rec);
    return rec;
  };

  const feesFor: Record<string, number> = { st_ayaan: 1500, st_hira: 1500, st_ahmed: 2000, st_fatima: 1500, st_sara: 2500, st_zain: 2500, st_hamza: 3000, st_maryam: 3000, st_ali: 3500, st_bilal: 3200 };
  for (const sid of Object.keys(feesFor)) fr(sid, prev, feesFor[sid]);
  for (const sid of Object.keys(feesFor)) fr(sid, cur, feesFor[sid]);
  // previous-month specials
  feeRecords.find((r) => r.id === `fee_st_hamza_${prev}`)!.lateFee = 100;
  feeRecords.find((r) => r.id === `fee_st_hamza_${prev}`)!.lateFeeApplied = true;
  feeRecords.find((r) => r.id === `fee_st_ali_${prev}`)!.adjustment = -200;
  feeRecords.find((r) => r.id === `fee_st_hamza_${cur}`)!.adjustment = -200;
  // archived student: history only, two months back
  fr("st_usman", shiftPeriod(cur, -2), 2400);

  /* payments */
  const payments: Payment[] = [];
  let rcp = 1000;
  const pay = (feeRecordId: string, studentId: string, amount: number, date: string, method: Payment["method"] = "Cash", note?: string, state: Payment["state"] = "recorded") => {
    payments.push({
      id: `pay_${++rcp}`,
      receiptNo: `RCP-${rcp}`,
      feeRecordId, studentId, amount, date, method, note, state,
      createdAt: date + "T17:30:00.000Z",
    });
  };
  const dimPrev = daysInPeriod(prev);
  const pd = (day: number) => `${prev}-${String(Math.min(day, dimPrev)).padStart(2, "0")}`;
  pay(`fee_st_ayaan_${prev}`, "st_ayaan", 1500, pd(7), "Cash");
  pay(`fee_st_hira_${prev}`, "st_hira", 1500, pd(8), "Mobile Wallet", "JazzCash from mother");
  pay(`fee_st_ahmed_${prev}`, "st_ahmed", 2000, pd(9));
  pay(`fee_st_fatima_${prev}`, "st_fatima", 1500, pd(10));
  pay(`fee_st_sara_${prev}`, "st_sara", 1500, pd(12), "Bank Transfer", "HBL transfer", "edited");
  pay(`fee_st_zain_${prev}`, "st_zain", 2500, pd(8));
  pay(`fee_st_maryam_${prev}`, "st_maryam", 3000, pd(9), "Mobile Wallet");
  pay(`fee_st_bilal_${prev}`, "st_bilal", 3200, pd(11));
  pay(`fee_st_ali_${prev}`, "st_ali", 2000, pd(14), "Cash", "Advance from uncle");
  pay(`fee_st_usman_${shiftPeriod(cur, -2)}`, "st_usman", 2400, `${shiftPeriod(cur, -2)}-09`);
  // current month
  const dimCur = daysInPeriod(cur);
  const cd = (day: number) => (day <= dimCur && day <= Number(today.slice(8)) ? `${cur}-${String(day).padStart(2, "0")}` : addDays(today, -1));
  pay(`fee_st_ayaan_${cur}`, "st_ayaan", 1500, cd(3), "Mobile Wallet");
  pay(`fee_st_hira_${cur}`, "st_hira", 1500, cd(4));
  pay(`fee_st_ahmed_${cur}`, "st_ahmed", 1000, cd(6), "Cash", "Remaining after salary week");
  pay(`fee_st_zain_${cur}`, "st_zain", 2500, cd(5), "Bank Transfer");
  pay(`fee_st_maryam_${cur}`, "st_maryam", 3000, cd(7));
  pay(`fee_st_bilal_${cur}`, "st_bilal", 3200, cd(4), "Mobile Wallet", "EasyPaisa");

  /* holidays */
  const holidays = [
    { id: "hol_1", date: addDays(today, -9), scope: "all" as const, title: "Shab-e-Barat", reason: "Religious holiday" },
    { id: "hol_2", date: addDays(today, 12), scope: "all" as const, title: "Annual sports day", reason: "Tuition closed for the evening" },
    { id: "hol_3", date: addDays(today, 4), scope: "batch" as const, batchId: "b_matric", title: "Board paper prep", reason: "Matric batch self-study — no class" },
  ];

  const slips = [
    { id: "slip_demo_1", feeRecordId: `fee_st_ayaan_${cur}`, studentId: "st_ayaan", period: cur, generatedAt: new Date(Date.now() - 2 * 86400000).toISOString(), shareTargets: ["g_ayaan_m"], shareStatus: "shared" as const },
  ];

  const nowIso = new Date().toISOString();
  const activity = [
    { id: "act_d1", at: nowIso, text: "Demo workspace loaded — 11 students, 5 batches.", kind: "system" as const },
    { id: "act_d2", at: new Date(Date.now() - 86400000).toISOString(), text: `Fee records generated for ${cur}.`, kind: "fee" as const },
    { id: "act_d3", at: new Date(Date.now() - 2 * 86400000).toISOString(), text: "Fee slip shared for Ayaan Khalid.", kind: "slip" as const },
    { id: "act_d4", at: new Date(Date.now() - 3 * 86400000).toISOString(), text: "Payment RCP-1013 recorded for Zain Abdullah.", kind: "payment" as const },
  ];

  return {
    students, guardians, batches, attendance, holidays, feeRecords, payments, slips, activity,
    settings: { ...defaultSettings() },
  };
}

export function validateImport(raw: unknown): DataState | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<DataState> & { schemaVersion?: number };
  const lists: (keyof DataState)[] = ["students", "guardians", "batches", "attendance", "holidays", "feeRecords", "payments", "slips", "activity"];
  for (const k of lists) if (!Array.isArray(d[k])) return null;
  if (!d.settings || typeof d.settings !== "object" || !d.settings.auth || !d.settings.feePolicy) return null;
  return d as DataState;
}

export const demoDayLabel = toISO(new Date());
