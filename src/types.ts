export type ClassLevel =
  | "Pre-school"
  | "Nursery"
  | "Prep"
  | "Primary"
  | "Middle"
  | "Matric"
  | "Intermediate"
  | "College";

export type StudentStatus = "active" | "inactive" | "archived";
export type AttendanceStatus = "present" | "absent" | "late" | "leave";
export type FeeStatus = "upcoming" | "due" | "partial" | "paid" | "overdue" | "waived";
export type PaymentMethod = "Cash" | "Bank Transfer" | "Mobile Wallet" | "Other";
export type PaymentState = "recorded" | "edited" | "voided";
export type ShareStatus = "not_shared" | "ready" | "shared";
export type DateFormat = "dmy" | "mdy" | "iso";

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
  dob?: string;
  gender?: string;
  level: ClassLevel;
  grade: string;
  school?: string;
  subjects: string[];
  batchIds: string[];
  monthlyFee: number;
  dueDay?: number;
  joiningDate: string;
  status: StudentStatus;
  notes?: string;
}

export interface Batch {
  id: string;
  name: string;
  level: ClassLevel;
  grade: string;
  subjects: string[];
  days: number[]; // 0 = Sunday ... 6 = Saturday
  startTime: string; // "16:00"
  endTime: string;
  capacity?: number;
  defaultFee?: number;
  color: string;
  status: "active" | "inactive";
}

export interface AttendanceRec {
  id: string;
  date: string; // YYYY-MM-DD
  studentId: string;
  batchId: string | null;
  status: AttendanceStatus;
  note?: string;
  markedAt: string;
}

export interface Holiday {
  id: string;
  date: string;
  scope: "all" | "batch";
  batchId?: string;
  title: string;
  reason?: string;
}

export interface FeeRecord {
  id: string;
  studentId: string;
  period: string; // YYYY-MM
  dueDate: string; // YYYY-MM-DD
  baseFee: number;
  lateFee: number;
  adjustment: number; // negative = discount
  waived: boolean;
  lateFeeApplied: boolean;
  createdAt: string;
}

export interface Payment {
  id: string;
  receiptNo: string;
  feeRecordId: string;
  studentId: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  reference?: string;
  note?: string;
  state: PaymentState;
  createdAt: string;
  editedAt?: string;
}

export interface FeeSlipRec {
  id: string;
  feeRecordId: string;
  studentId: string;
  period: string;
  generatedAt: string;
  shareTargets: string[]; // guardian ids
  shareStatus: ShareStatus;
}

export interface ActivityRec {
  id: string;
  at: string;
  text: string;
  kind: "student" | "fee" | "payment" | "attendance" | "slip" | "system";
}

export interface FeePolicy {
  cycleStartDay: number;
  dueDay: number;
  graceDays: number;
  defaultFee: number;
  lateFee: number;
  currency: string;
}

export interface Settings {
  tuitionName: string;
  tutorName: string;
  phone: string;
  email: string;
  address: string;
  footerNote: string;
  auth: { username: string; password: string };
  feePolicy: FeePolicy;
  weeklyOffs: number[];
  whatsappTemplate: string;
  dateFormat: DateFormat;
}

export interface DataState {
  students: Student[];
  guardians: Guardian[];
  batches: Batch[];
  attendance: AttendanceRec[];
  holidays: Holiday[];
  feeRecords: FeeRecord[];
  payments: Payment[];
  slips: FeeSlipRec[];
  activity: ActivityRec[];
  settings: Settings;
}

export const CLASS_LEVELS: ClassLevel[] = [
  "Pre-school",
  "Nursery",
  "Prep",
  "Primary",
  "Middle",
  "Matric",
  "Intermediate",
  "College",
];

export const RELATIONS = ["Father", "Mother", "Guardian", "Brother", "Sister", "Uncle", "Aunt", "Other"];
export const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Bank Transfer", "Mobile Wallet", "Other"];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
