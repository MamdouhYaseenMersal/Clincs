import { Patient, Doctor, Visit, Report, Appointment } from '../types';

const API_BASE = '/api';

export const api = {
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

  // Appointments
  getAppointments: async (patientId?: string): Promise<Appointment[]> => {
    const url = patientId ? `${API_BASE}/appointments/${patientId}` : `${API_BASE}/appointments`;
    const res = await fetch(url);
    return res.json();
  },
  createAppointment: async (appointment: Omit<Appointment, 'id' | 'status' | 'createdAt'>): Promise<Appointment> => {
    const res = await fetch(`${API_BASE}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointment),
    });
    return res.json();
  },
  updateAppointment: async (id: string, status: Appointment['status'], reminderSent?: boolean): Promise<Appointment> => {
    const res = await fetch(`${API_BASE}/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reminderSent }),
    });
    return res.json();
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
  }
};
