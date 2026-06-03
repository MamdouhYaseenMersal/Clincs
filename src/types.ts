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
  attendance?: Array<{
    date: string;       // YYYY-MM-DD
    arrivalTime: string; // HH:mm
    departureTime: string; // HH:mm
    hoursWorked: number;
  }>;
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
  createdAt: string;
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
  diagnosis?: string;
  isPaid: boolean;
  status?: 'completed' | 'cancelled';
  cancellationReason?: string;
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
}

export interface User {
  id: string;
  name: string;
  username: string;
  role: 'admin' | 'staff' | 'doctor';
  password?: string;
  doctorId?: string; // If user is a doctor
  permissions?: string[];
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
}

export interface AuditLog {
  id: string;
  action: string;
  entityId: string;
  entityType: string;
  userId?: string;
  details: string;
  timestamp: string;
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
}

