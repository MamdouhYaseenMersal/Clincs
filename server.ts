import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";

// Simple JSON Database setup
const DB_FILE = "database.json";
const UPLOADS_DIR = "uploads";

interface Database {
  patients: any[];
  doctors: any[];
  visits: any[];
  reports: any[];
  appointments: any[];
}

const DEFAULT_DB: Database = {
  patients: [],
  doctors: [],
  visits: [],
  reports: [],
  appointments: [],
};

async function readDb(): Promise<Database> {
  try {
    if (!existsSync(DB_FILE)) {
      await fs.writeFile(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));
      return DEFAULT_DB;
    }
    const data = await fs.readFile(DB_FILE, "utf-8");
    const parsed = JSON.parse(data);
    // Ensure appointments array exists for legacy databases
    if (!parsed.appointments) parsed.appointments = [];
    return parsed;
  } catch (err) {
    console.error("Error reading DB", err);
    return DEFAULT_DB;
  }
}

async function writeDb(db: Database) {
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

// Multer setup for uploads
if (!existsSync(UPLOADS_DIR)) {
  fs.mkdir(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cors());

  // API Routes
  
  // Patients
  app.get("/api/patients", async (req, res) => {
    const db = await readDb();
    res.json(db.patients);
  });

  app.post("/api/patients", async (req, res) => {
    const db = await readDb();
    const newPatient = { ...req.body, id: uuidv4(), createdAt: new Date().toISOString() };
    db.patients.push(newPatient);
    await writeDb(db);
    res.json(newPatient);
  });

  // Doctors
  app.get("/api/doctors", async (req, res) => {
    const db = await readDb();
    res.json(db.doctors);
  });

  app.post("/api/doctors", async (req, res) => {
    const db = await readDb();
    const newDoctor = { ...req.body, id: uuidv4() };
    db.doctors.push(newDoctor);
    await writeDb(db);
    res.json(newDoctor);
  });

  // Appointments
  app.get("/api/appointments", async (req, res) => {
    const db = await readDb();
    res.json(db.appointments);
  });

  app.get("/api/appointments/:patientId", async (req, res) => {
    const db = await readDb();
    const patientAppointments = db.appointments.filter(a => a.patientId === req.params.patientId);
    res.json(patientAppointments);
  });

  app.post("/api/appointments", async (req, res) => {
    const db = await readDb();
    const newAppointment = { 
      ...req.body, 
      id: uuidv4(), 
      status: 'scheduled', 
      createdAt: new Date().toISOString() 
    };
    db.appointments.push(newAppointment);
    await writeDb(db);
    res.json(newAppointment);
  });

  app.patch("/api/appointments/:id", async (req, res) => {
    const db = await readDb();
    const index = db.appointments.findIndex(a => a.id === req.params.id);
    if (index !== -1) {
      if (req.body.status) db.appointments[index].status = req.body.status;
      if (req.body.reminderSent !== undefined) db.appointments[index].reminderSent = req.body.reminderSent;
      await writeDb(db);
      res.json(db.appointments[index]);
    } else {
      res.status(404).json({ error: "Appointment not found" });
    }
  });

  // Visits
  app.get("/api/visits", async (req, res) => {
    const db = await readDb();
    res.json(db.visits);
  });

  app.post("/api/visits", async (req, res) => {
    const db = await readDb();
    const doctor = db.doctors.find(d => d.id === req.body.doctorId);
    
    let cost = Number(req.body.basePrice || 0);
    let doctorEarnings = 0;

    if (doctor) {
      if (doctor.accountingSystem === 'fixed') {
        doctorEarnings = Number(doctor.fixedRate || 0);
      } else if (doctor.accountingSystem === 'percentage') {
        const percentage = Number(doctor.percentageRate || 0);
        doctorEarnings = (cost * percentage) / 100;
      } else if (doctor.accountingSystem === 'hybrid') {
        const today = new Date().toISOString().split('T')[0];
        const todayVisitsCount = db.visits.filter(v => 
          v.doctorId === doctor.id && 
          new Date(v.date).toISOString().split('T')[0] === today
        ).length;

        if (todayVisitsCount >= (doctor.hybridThreshold || 0)) {
          doctorEarnings = Number(doctor.hybridExtraRate || 0);
        } else {
          doctorEarnings = 0; // Covered by daily part of hybrid
        }
      } else if (doctor.accountingSystem === 'daily') {
        doctorEarnings = 0; // Daily salary is separate
      }
    }

    const clinicEarnings = cost - doctorEarnings;

    const newVisit = { 
      ...req.body, 
      id: uuidv4(), 
      cost,
      doctorEarnings,
      clinicEarnings,
      date: req.body.date || new Date().toISOString() 
    };
    db.visits.push(newVisit);
    await writeDb(db);
    res.json(newVisit);
  });

  // Reports / File Upload
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });
    
    const db = await readDb();
    const newReport = {
      id: uuidv4(),
      patientId: req.body.patientId,
      visitId: req.body.visitId || null,
      filename: file.filename,
      originalName: file.originalname,
      title: req.body.title || file.originalname,
      type: req.body.type || 'other', // 'prescription' or 'report'
      createdAt: new Date().toISOString()
    };
    db.reports.push(newReport);
    await writeDb(db);
    res.json(newReport);
  });

  app.get("/api/reports/:patientId", async (req, res) => {
    const db = await readDb();
    const reports = db.reports.filter(r => r.patientId === req.params.patientId);
    res.json(reports);
  });

  // Serve uploaded files
  app.use("/uploads", express.static(UPLOADS_DIR));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
