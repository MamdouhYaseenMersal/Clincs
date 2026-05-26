import { Patient, Doctor, Visit, Report, Appointment, AuditLog, InventoryItem, User, Message } from '../types';

const API_BASE = '/api';

export const api = {
  // Inventory
  getInventory: async (): Promise<InventoryItem[]> => {
    const res = await fetch(`${API_BASE}/inventory`);
    return res.json();
  },
  addInventoryItem: async (item: Omit<InventoryItem, 'id' | 'lastUpdated'>): Promise<InventoryItem> => {
    const res = await fetch(`${API_BASE}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return res.json();
  },
  updateInventoryItem: async (id: string, item: Partial<InventoryItem>): Promise<InventoryItem> => {
    const res = await fetch(`${API_BASE}/inventory/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return res.json();
  },
  deleteInventoryItem: async (id: string): Promise<void> => {
    await fetch(`${API_BASE}/inventory/${id}`, { method: 'DELETE' });
  },

  // Patients
  getPatients: async (): Promise<Patient[]> => {
    const res = await fetch(`${API_BASE}/patients`);
    return res.json();
  },
  createPatient: async (patient: Omit<Patient, 'id' | 'createdAt'>): Promise<Patient> => {
    const res = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient),
    });
    return res.json();
  },
  updatePatient: async (id: string, patient: Partial<Patient>): Promise<Patient> => {
    const res = await fetch(`${API_BASE}/patients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient),
    });
    return res.json();
  },

  // Doctors
  getDoctors: async (): Promise<Doctor[]> => {
    const res = await fetch(`${API_BASE}/doctors`);
    return res.json();
  },
  createDoctor: async (doctor: Omit<Doctor, 'id'>): Promise<Doctor> => {
    const res = await fetch(`${API_BASE}/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doctor),
    });
    return res.json();
  },
  updateDoctor: async (id: string, doctor: Partial<Doctor>): Promise<Doctor> => {
    const res = await fetch(`${API_BASE}/doctors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doctor),
    });
    return res.json();
  },

  // Visits
  getVisits: async (): Promise<Visit[]> => {
    const res = await fetch(`${API_BASE}/visits`);
    return res.json();
  },
  createVisit: async (visit: any): Promise<Visit> => {
    const res = await fetch(`${API_BASE}/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visit),
    });
    return res.json();
  },
  updateVisit: async (id: string, visit: any): Promise<Visit> => {
    const res = await fetch(`${API_BASE}/visits/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visit),
    });
    return res.json();
  },

  // Appointments
  getAppointments: async (patientId?: string): Promise<Appointment[]> => {
    const url = patientId ? `${API_BASE}/appointments/${patientId}` : `${API_BASE}/appointments`;
    const res = await fetch(url);
    return res.json();
  },
  createAppointment: async (appointment: Omit<Appointment, 'id' | 'createdAt'> & { status?: Appointment['status'] }): Promise<Appointment> => {
    const res = await fetch(`${API_BASE}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointment),
    });
    return res.json();
  },
  updateAppointment: async (id: string, statusOrPartial: Appointment['status'] | Partial<Appointment>, reminderSent?: boolean): Promise<Appointment> => {
    const body = typeof statusOrPartial === 'string' 
      ? { status: statusOrPartial, reminderSent } 
      : statusOrPartial;
    const res = await fetch(`${API_BASE}/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  },
  deleteAppointment: async (id: string): Promise<void> => {
    await fetch(`${API_BASE}/appointments/${id}`, { method: 'DELETE' });
  },

  // Reports
  getReports: async (patientId: string): Promise<Report[]> => {
    const res = await fetch(`${API_BASE}/reports/${patientId}`);
    return res.json();
  },
  uploadReport: async (patientId: string, file: File, title: string, type: string, visitId?: string): Promise<Report> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('patientId', patientId);
    formData.append('title', title);
    formData.append('type', type);
    if (visitId) formData.append('visitId', visitId);

    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  // Audit Logs
  getAuditLogs: async (): Promise<AuditLog[]> => {
    const res = await fetch(`${API_BASE}/audit-logs`);
    return res.json();
  },

  // Users
  getUsers: async (): Promise<User[]> => {
    const res = await fetch(`${API_BASE}/users`);
    return res.json();
  },
  createUser: async (user: Omit<User, 'id'>): Promise<User> => {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    return res.json();
  },
  deleteUser: async (id: string): Promise<void> => {
    await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE' });
  },

  getBackup: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/backup`);
    return res.json();
  },

  // Appointment Reminders
  sendAppointmentReminder: async (id: string): Promise<void> => {
    await fetch(`${API_BASE}/appointments/${id}/remind`, { method: 'POST' });
  },

  // Internal Messaging System
  getMessages: async (): Promise<Message[]> => {
    const res = await fetch(`${API_BASE}/messages`);
    return res.json();
  },
  sendMessage: async (msg: Omit<Message, 'id' | 'createdAt' | 'isRead'>): Promise<Message> => {
    const res = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    });
    return res.json();
  },
  markMessageAsRead: async (id: string): Promise<Message> => {
    const res = await fetch(`${API_BASE}/messages/${id}/read`, {
      method: 'PATCH',
    });
    return res.json();
  },
  deleteMessage: async (id: string): Promise<void> => {
    await fetch(`${API_BASE}/messages/${id}`, { method: 'DELETE' });
  },

  // State Restoration
  restoreState: async (logId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/audit-logs/${logId}/restore`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "فشلت استعادة الحالة");
    }
    return res.json();
  },

  // Prescription Auto-Deduction
  dispensePrescription: async (items: { id: string; quantity: number }[]): Promise<any> => {
    const res = await fetch(`${API_BASE}/inventory/dispense`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "فشل خصم وصرف الأدوية");
    }
    return res.json();
  },

  // Patients Extension
  deletePatient: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/patients/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "فشل حذف المريض");
    }
  },

  // Room Management
  getRooms: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/rooms`);
    return res.json();
  },
  createRoom: async (room: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(room),
    });
    return res.json();
  },
  updateRoom: async (id: string, room: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/rooms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(room),
    });
    return res.json();
  },
  deleteRoom: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/rooms/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "فشل حذف الغرفة");
    }
  },
  startRoomExam: async (id: string, body: { patientId: string, doctorId: string, durationMinutes: number }): Promise<any> => {
    const res = await fetch(`${API_BASE}/rooms/${id}/start-exam`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  },
  endRoomExam: async (id: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/rooms/${id}/end-exam`, {
      method: 'POST',
    });
    return res.json();
  }
};
