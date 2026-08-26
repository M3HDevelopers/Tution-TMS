/* Core domain types — Tuition Management System (class-based, single timing) */

export type PageKey =
  | "dashboard" | "students" | "student" | "classes" | "attendance"
  | "fees" | "slips" | "calendar" | "reports" | "settings";

export interface Route {
  page: PageKey;
  params?: Record<string, string>;
  n: number;
}

export type ClassLevel =
  | "Pre-school" | "Nursery" | "Prep" | "Primary" | "Middle" | "Matric" | "Intermediate" | "College";

export const CLASS_LEVELS: ClassLevel[] = [
  "Pre-school", "Nursery", "Prep", "Primary", "Middle", "Matric", "Intermediate", "College",
];

export type StudentStatus = "active" | "inactive";

export interface Guardian {
  id: string;
  studentId: string;
  name: string;
  relation: string;
  phone: string;
  whatsapp: boolean;
  primary: boolean;
  notes?: string;
}

export interface Student {
  id: string;
  name: string;
  level: ClassLevel;
  grade: string;               // e.g. "Nursery", "Class 2", "Matric"
  school?: string;
  subjects?: string[];         // empty / undefined → ALL SUBJECTS
  feeDueDay: number;           // day of month the fee is due (default 1)
  monthlyFee: number;
  joiningDate?: string;        // optional — old admissions may not remember
  status: StudentStatus;
  address?: string;
  notes?: string;
  photo?: string | null;
}

/* legacy batch kept only for old-backup compatibility — no longer used in UI */
export interface Batch {
  id: string; name: string; level: ClassLevel; grade: string; subjects: string[];
  days: number[]; startTime: string; endTime: string; capacity?: number;
  defaultFee?: number; status: "active" | "inactive";
}

export type AttendanceStatus = "present" | "absent" | "late" | "leave";

export interface AttendanceRecord {
  id: string;
  date: string;
  studentId: string;
  className?: string | null;
  status: AttendanceStatus;
  markedAt: string;
}

export type HolidayScope = "all" | "class";

export interface Holiday {
  id: string;
  date: string;
  scope: HolidayScope;
  className?: string;
  title: string;
  reason?: string;
}

export interface FeeRecord {
  id: string;
  studentId: string;
  period: string;              // YYYY-MM
  dueDate: string;
  baseFee: number;
  lateFee: number;
  adjustment: number;
  waived: boolean;
  waiveReason?: string;        // required when the tutor forgives a month's fee
  lateFeeApplied: boolean;
  createdAt: string;
}

export type PaymentMethod = "Cash" | "Bank Transfer" | "Mobile Wallet" | "Other";
export const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Bank Transfer", "Mobile Wallet", "Other"];

export type PaymentState = "recorded" | "edited" | "voided";

export interface Payment {
  id: string;
  receiptNo: string;           // RCP-####
  feeRecordId: string;
  studentId: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  reference?: string;
  note?: string;
  state: PaymentState;
  createdAt: string;
}

export interface FeeSlipLog {
  id: string;
  kind: "challan" | "receipt";
  refId: string;               // feeRecordId or paymentId
  no: string;                  // CHL-#### or RCP-####
  generatedAt: string;
  sentTo: string[];
  sent: boolean;
}

export interface TimingNotice {
  id: string;
  title: string;
  message: string;
  startDate: string;
  days: number;
  startTime: string;
  endTime: string;
  note?: string;
  createdAt: string;
  sentTo: string[];
}

export type TemplatePreset = "roman" | "english" | "short";

export interface FeePolicy {
  dueDay: number;
  graceDays: number;
  lateFee: number;
  currency: string;
  defaultFee: number;
}

export interface Settings {
  tuitionName: string;
  tutorName: string;
  phone: string;
  email: string;
  address: string;
  footerNote: string;
  tutorPhoto?: string | null;  // data URL uploaded in Settings
  username: string;
  password: string;
  startTime: string;           // single tuition timing for ALL classes
  endTime: string;
  weeklyOffs: number[];
  feePolicy: FeePolicy;
  templatePreset: TemplatePreset;
  challanTemplate: string;
  dateFormat: "dmy" | "mdy" | "iso";
}

export interface ActivityItem {
  id: string;
  at: string;
  text: string;
  kind: "student" | "fee" | "attendance" | "settings" | "backup" | "share" | "notice";
}

export interface DataState {
  students: Student[];
  guardians: Guardian[];
  batches: Batch[];            // legacy only
  attendance: AttendanceRecord[];
  holidays: Holiday[];
  feeRecords: FeeRecord[];
  payments: Payment[];
  slips: FeeSlipLog[];
  notifications: TimingNotice[];
  activity: ActivityItem[];
  settings: Settings;
}

export const CHALLAN_TEMPLATES: Record<TemplatePreset, string> = {
  roman:
    "Assalam-o-Alaikum! {student} ki {period} ki tuition fee slip attach kar di gayi hai. Kul payable: {total}. Due date: {due}. Baqi raqam: {balance}. Barah-e-karam waqt par ada karein. JazakAllah! — {tuition}",
  english:
    "Dear Parent, please find attached the tuition fee challan of {student} for {period}. Total payable: {total}. Due date: {due}. Remaining balance: {balance}. Kindly pay on time. Thank you — {tuition}",
  short:
    "Fee slip — {student} ({period}). Payable: {total}. Due: {due}. Remaining: {balance}. Thank you! — {tuition}",
};

export const DEFAULT_SETTINGS: Settings = {
  tuitionName: "Bright Stars Tuition",
  tutorName: "Miss Ayesha Khan",
  phone: "0300-1234567",
  email: "ayesha@brightstars.pk",
  address: "House 21, Street 9, Satellite Town, Rawalpindi",
  footerNote: "Fee is payable by the due date. Kindly inform in advance if a child will be absent. Thank you for your trust!",
  tutorPhoto: null,
  username: "tutor",
  password: "tutor123",
  startTime: "16:00",
  endTime: "20:00",
  weeklyOffs: [0],
  feePolicy: { dueDay: 1, graceDays: 3, lateFee: 50, currency: "Rs", defaultFee: 1500 },
  templatePreset: "roman",
  challanTemplate: CHALLAN_TEMPLATES.roman,
  dateFormat: "dmy",
};
