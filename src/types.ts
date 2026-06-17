export enum DocAccountingSystem {
  FIXED = 'fixed',
  PERCENTAGE = 'percentage',
  DAILY = 'daily',
  HYBRID = 'hybrid',
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  examinationPrice: number;
  accountingSystem: DocAccountingSystem;
  fixedRate?: number;
  percentageRate?: number;
  dailyRate?: number;
  hybridThreshold?: number;
  hybridExtraRate?: number;
  maxPatientsPerDay?: number;
  branch?: string;
  attendance?: Array<{
    date: string;       // YYYY-MM-DD
    arrivalTime: string; // HH:mm
    departureTime: string; // HH:mm
    hoursWorked: number;
  }>;
  weeklySchedule?: {
    activeDays: number[]; // 0 for Sunday, 1 for Monday... 6 for Saturday
    startTime: string; // "HH:mm"
    endTime: string; // "HH:mm"
  };
}

export interface Referral {
  id: string;
  type: 'emergency' | 'medical_admin' | 'oncology'; // emergency = طوارئ, medical_admin = إدارة طبية, oncology = أورام
  requestDescription: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  approvedBy?: string;
}

export interface Investigation {
  id: string;
  name: string;
  type: 'internal' | 'external';
  departmentName?: string;
  approvalRequired: boolean;
  approvalStatus: 'approved' | 'pending' | 'rejected' | 'not_required';
  approvedBy?: string;
  results?: string;
  vitalsOnExam?: {
    temperature?: string;
    bloodPressure?: string;
    pulse?: string;
    weight?: string;
    height?: string;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  age: string;
  gender: string;
  nationality: string;
  caseCode: string;
  commissionNumber: string;
  dateOfBirth?: string;
  nationalId?: string;
  passportNumber?: string;
  createdAt: string;
  branch?: string;
  referrals?: Referral[];
  investigations?: Investigation[];
  allergies?: string;
  surgicalHistory?: string;
  familyHistory?: string;
  chronicConditions?: string;
  longTermTreatmentPlans?: LongTermTreatmentPlan[];
}

export interface ChronicMedication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  startedAt: string;
}

export interface LongTermTreatmentPlan {
  id: string;
  planName: string;
  medications: ChronicMedication[];
  frequencyMonths: number; // e.g. 1, 3, 6, 12 months frequency
  lastReviewDate: string; // YYYY-MM-DD
  nextReviewDate: string; // YYYY-MM-DD
  notes?: string;
  status: 'active' | 'completed' | 'suspended';
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  notes: string;
  status: 'scheduled' | 'cancelled' | 'completed';
  reminderEnabled: boolean;
  reminderLeadTimeHours: number;
  reminderSent?: boolean;
  isSpecial?: boolean;
  specialPrice?: number;
  arrivalTime?: string;
  entryTime?: string;
  departureTime?: string;
  isConfirmed?: boolean;
  createdAt: string;
  branch?: string;
}

export interface Visit {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  arrivalTime?: string;
  entryTime?: string;
  departureTime?: string;
  serviceType: string; // بند الحجز
  sendingAdministration?: string; // الإدارة المرسلة
  basePrice: number;
  cost: number;
  doctorEarnings: number;
  clinicEarnings: number;
  notes: string;
  clinicalAssessment?: string; // الوصف الطبي للحالة المستنتج من الكشف
  prescriptions?: Array<{
    id: string;
    name: string;
    quantity: string;
    duration: string;
  }>;
  diagnosis?: string;
  isPaid: boolean;
  status?: 'completed' | 'cancelled';
  cancellationReason?: string;
  branch?: string;
  vitals?: {
    temperature?: string;
    bloodPressure?: string;
    pulse?: string;
    weight?: string;
    height?: string;
    bmi?: string;
  };
  followUpRequired?: boolean;
  followUpDate?: string;
  followUpNotes?: string;
  dietInstructions?: string;
}

export interface Report {
  id: string;
  patientId: string;
  visitId?: string; // Associated visit
  filename: string;
  originalName: string;
  title: string;
  type: 'prescription' | 'report' | 'other';
  createdAt: string;
  branch?: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  role: 'admin' | 'staff' | 'doctor';
  password?: string;
  doctorId?: string; // If user is a doctor
  permissions?: string[];
  branch?: string;
  additionalBranches?: string[];
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'medication' | 'disposable' | 'equipment' | 'other';
  quantity: number;
  unit: string;
  reorderPoint: number;
  expirationDate?: string;
  lastUpdated: string;
  branch?: string;
  storeType?: 'medical' | 'non-medical';
  approvalStatus?: 'approved' | 'pending' | 'rejected';
  lastApprovedBy?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityId: string;
  entityType: string;
  userId?: string;
  details: string;
  timestamp: string;
  branch?: string;
  payload?: {
    beforeState?: any;
    afterState?: any;
    [key: string]: any;
  };
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'admin' | 'staff' | 'doctor';
  receiverId?: string; // Optional target specific user
  receiverRole?: 'doctor' | 'staff' | 'all'; // Target role
  patientId?: string; // Associated patient ID for case note exchanges
  patientName?: string; // Associated patient name helper
  content: string;
  createdAt: string;
  isRead?: boolean;
  branch?: string;
}

