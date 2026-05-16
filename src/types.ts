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
  accountingSystem: DocAccountingSystem;
  fixedRate?: number;
  percentageRate?: number;
  dailyRate?: number;
  hybridThreshold?: number;
  hybridExtraRate?: number;
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
  createdAt: string;
}

export interface Visit {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  arrivalTime?: string;
  departureTime?: string;
  serviceType: string; // بند الحجز
  sendingAdministration?: string; // الإدارة المرسلة
  basePrice: number;
  doctorEarnings: number;
  clinicEarnings: number;
  notes: string;
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
