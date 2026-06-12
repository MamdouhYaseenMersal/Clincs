import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import { AsyncLocalStorage } from "node:async_hooks";

const requestStore = new AsyncLocalStorage<{ userId?: string }>();

// Simple JSON Database setup
const DB_FILE = "database.json";
const UPLOADS_DIR = "uploads";

interface Database {
  patients: any[];
  doctors: any[];
  visits: any[];
  reports: any[];
  appointments: any[];
  auditLogs: any[];
  inventory: any[];
  users: any[];
  messages: any[];
  rooms?: any[];
}

const DEFAULT_DB: Database = {
  patients: [],
  doctors: [],
  visits: [],
  reports: [],
  appointments: [],
  auditLogs: [],
  inventory: [],
  users: [],
  messages: [],
  rooms: [
    { id: "room-1", name: "غرفة الكشف 1 (الباطنة)", status: "available", currentPatientId: null, currentDoctorId: null, startTime: null, endTime: null, durationMinutes: 15 },
    { id: "room-2", name: "غرفة كشف الأطفال", status: "available", currentPatientId: null, currentDoctorId: null, startTime: null, endTime: null, durationMinutes: 15 },
    { id: "room-3", name: "غرفة السونار والموجات", status: "available", currentPatientId: null, currentDoctorId: null, startTime: null, endTime: null, durationMinutes: 30 },
    { id: "room-4", name: "عيادة الرمد والعيون", status: "available", currentPatientId: null, currentDoctorId: null, startTime: null, endTime: null, durationMinutes: 20 }
  ],
};

async function readDb(): Promise<Database> {
  try {
    if (!existsSync(DB_FILE)) {
      await fs.writeFile(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));
      return DEFAULT_DB;
    }
    const data = await fs.readFile(DB_FILE, "utf-8");
    const parsed = JSON.parse(data);
    // Ensure arrays exist for legacy databases
    if (!parsed.appointments) parsed.appointments = [];
    if (!parsed.auditLogs) parsed.auditLogs = [];
    if (!parsed.inventory) parsed.inventory = [];
    if (!parsed.users) parsed.users = [];
    if (!parsed.messages) parsed.messages = [];
    if (!parsed.rooms) {
      parsed.rooms = [
        { id: "room-1", name: "غرفة الكشف 1 (الباطنة)", status: "available", currentPatientId: null, currentDoctorId: null, startTime: null, endTime: null, durationMinutes: 15 },
        { id: "room-2", name: "غرفة كشف الأطفال", status: "available", currentPatientId: null, currentDoctorId: null, startTime: null, endTime: null, durationMinutes: 15 },
        { id: "room-3", name: "غرفة السونار والموجات", status: "available", currentPatientId: null, currentDoctorId: null, startTime: null, endTime: null, durationMinutes: 30 },
        { id: "room-4", name: "عيادة الرمد والعيون", status: "available", currentPatientId: null, currentDoctorId: null, startTime: null, endTime: null, durationMinutes: 20 }
      ];
    }
    return parsed;
  } catch (err) {
    console.error("Error reading DB", err);
    return DEFAULT_DB;
  }
}

async function writeDb(db: Database) {
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

async function logAction(db: Database, action: string, entityId: string, entityType: string, details: string, userId?: string, payload?: any) {
  const store = requestStore.getStore();
  const activeUserId = userId || store?.userId || "نظام تلقائي";
  
  let branch = payload?.branch || undefined;
  if (!branch) {
    if (entityType === "patient") {
      const p = db.patients?.find(x => x.id === entityId);
      if (p) branch = p.branch;
    } else if (entityType === "doctor") {
      const d = db.doctors?.find(x => x.id === entityId);
      if (d) branch = d.branch;
    } else if (entityType === "appointment") {
      const a = db.appointments?.find(x => x.id === entityId);
      if (a) {
        branch = a.branch;
        if (!branch) {
          const p = db.patients?.find(x => x.id === a.patientId);
          if (p) branch = p.branch;
        }
      }
    } else if (entityType === "visit") {
      const v = db.visits?.find(x => x.id === entityId);
      if (v) {
        branch = v.branch;
        if (!branch) {
          const p = db.patients?.find(x => x.id === v.patientId);
          if (p) branch = p.branch;
        }
      }
    } else if (entityType === "room") {
      const r = db.rooms?.find(x => x.id === entityId);
      if (r) branch = r.branch;
    } else if (entityType === "inventory") {
      const i = db.inventory?.find(x => x.id === entityId);
      if (i) branch = i.branch;
    }
  }

  const log = {
    id: uuidv4(),
    action,
    entityId,
    entityType,
    details,
    userId: activeUserId,
    payload,
    branch,
    timestamp: new Date().toISOString()
  };
  db.auditLogs.push(log);
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

function calculateVisitEarnings(db: Database, doctorId: string, basePrice: number, dateStr?: string, skipVisitId?: string) {
  const doctor = db.doctors.find(d => d.id === doctorId);
  const cost = Number(basePrice || 0);
  let doctorEarnings = 0;

  if (doctor) {
    if (doctor.accountingSystem === 'fixed') {
      doctorEarnings = Number(doctor.fixedRate || 0);
    } else if (doctor.accountingSystem === 'percentage') {
      const percentage = Number(doctor.percentageRate || 0);
      doctorEarnings = (cost * percentage) / 100;
    } else if (doctor.accountingSystem === 'hybrid') {
      const visitDate = (dateStr || new Date().toISOString()).split('T')[0];
      const count = db.visits.filter(v => 
        v.doctorId === doctor.id && 
        v.id !== skipVisitId &&
        (v.date || '').split('T')[0] === visitDate
      ).length;

      if (count >= (doctor.hybridThreshold || 0)) {
        doctorEarnings = Number(doctor.hybridExtraRate || 0);
      } else {
        doctorEarnings = 0; // Covered by daily rate
      }
    } else if (doctor.accountingSystem === 'daily') {
      doctorEarnings = 0; // Daily rate is computed in list / payroll, individual visits earn 0
    }
  }

  const clinicEarnings = cost - doctorEarnings;
  return { cost, doctorEarnings, clinicEarnings };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cors());

  // Intercept request user identifier and run request in AsyncLocalStorage
  app.use((req, res, next) => {
    const userIdHeader = req.headers['x-user-id'];
    let userId: string | undefined = undefined;
    if (typeof userIdHeader === 'string') {
      try {
        userId = decodeURIComponent(userIdHeader);
      } catch (e) {
        userId = userIdHeader;
      }
    }
    requestStore.run({ userId }, next);
  });

  // API Routes
  
  // Localized clinical parser for fallback diagnoses
  function getFallbackDiagnoses(complaint: string, specialty?: string) {
    const norm = (complaint || "").toLowerCase();
    const res: { diagnosis: string, advice: string }[] = [];

    if (norm.includes("صداع") || norm.includes("رأس") || norm.includes("headache")) {
      res.push({ diagnosis: "صداع توتري (Tension Headache)", advice: "شرب كميات كافية من الماء، وتجنب الإجهاد البصري وأخذ قسط من الراحة والاسترخاء." });
      res.push({ diagnosis: "صداع نصفي (Migraine)", advice: "الاستلقاء في مكان مظلم وهادئ وتجنب المنبهات والكافيين والتوتر." });
      res.push({ diagnosis: "ارتفاع ضغط الدم المؤقت", advice: "قياس تكراري لضغط الدم للوقوف على أسبابه والحد من الأغذية المالحة والغنية بالصوديوم." });
    } else if (norm.includes("ألم") || norm.includes("بطن") || norm.includes("مغص") || norm.includes("abdomen") || norm.includes("stomach") || norm.includes("معد")) {
      res.push({ diagnosis: "نزلة معوية حادة (Gastroenteritis)", advice: "الإكثار من السوائل المانعة للجفاف، وتناول وجبات نشوية مسلوقة متباعدة." });
      res.push({ diagnosis: "عسر الهضم وتشنج القولون (IBS)", advice: "الابتعاد التام عن الأطعمة الدسمة، الحارة، والمسبكة، والحفاظ على وجبات صحية خفيفة." });
      res.push({ diagnosis: "التهاب جدار المعدة وطفيليات حادة", advice: "تجنب حموضة المعدة بالابتعاد عن شرب الشاي والقهوة على الريق ومراجعة الطبيب الفورية." });
    } else if (norm.includes("كحة") || norm.includes("صدر") || norm.includes("سعال") || norm.includes("cough")) {
      res.push({ diagnosis: "التهاب الشعب الهوائية البسيط (Bronchitis)", advice: "تناول المشروبات الدافئة المهدئة، واستنشاق البخار النظيف لتفتيح الشعب الهوائية." });
      res.push({ diagnosis: "حساسية ربوية مزمنة أو مؤقتة", advice: "تجنب التعرض المباشر للأتربة، العطور القوية، الحيوانات الأليفة، والتدخين السلبي." });
      res.push({ diagnosis: "نزلات البرد والتهابات الجهاز التنفسي العلوي", advice: "الراحة الكاملة، واستخدام دافئ للمظاهر العلاجية البسيطة والطب البديل." });
    } else if (norm.includes("سخونية") || norm.includes("حرارة") || norm.includes("fever") || norm.includes("سخونة") || norm.includes("حرار")) {
      res.push({ diagnosis: "احتقان أو التهاب اللوزتين الحاد (Tonsillitis)", advice: "الغرغرة بماء وملح فاتر، مع أخذ مخفف حرارة تحت طبي وطبيعي بانتظام." });
      res.push({ diagnosis: "حمى فيروسية عابرة أو التهاب ناتج عن برد", advice: "عمل كمادات ماء فاتر باستمرار ورفع منسوب المياه لتعويض المفقود بالتعرق." });
    } else if (norm.includes("أذن") || norm.includes("سمع") || norm.includes("ear")) {
      res.push({ diagnosis: "التهاب الأذن الخارجية أو الوسطى المستجد", advice: "الحفاظ التام على جفاف تجويف الأذن، والامتناع التام عن استخدام أعواد القطن." });
      res.push({ diagnosis: "انسداد شمعي متراكم (Wax Impaction)", advice: "زيارة عيادة أنف وأذن لغسيل أذن طبي آمن أو تفتيت الشمع بالقطرات الخاصة." });
    } else if (norm.includes("جلد") || norm.includes("حكة") || norm.includes("طفح") || norm.includes("skin")) {
      res.push({ diagnosis: "حساسية الجلد التلامسية (Contact Dermatitis)", advice: "تجنب المواد الكيماوية والصابون العطري، واستخدام مرطبات مهدئة خالية من العطور." });
      res.push({ diagnosis: "إكزيما خفيفة أو طفح حراري بسيط", advice: "ترطيب مستمر، وارتداء ملابس قطنية فضفاضة لتقليل الاحتكاك." });
    } else {
      let generalDiagnosis = "زيارة متابعة لفحص الأعراض العامة";
      if (specialty === "باطنه" || specialty === "باطنة") generalDiagnosis = "عسر هضم طفيف ونزلة برد مستقرة";
      if (specialty === "أطفال") generalDiagnosis = "برد طفولي عابر أو التهاب بسيط في الحلق";
      if (specialty === "نساء وتوليد") generalDiagnosis = "إجهاد عام يستدعي متابعة السوائل والفيتامينات";
      if (specialty === "عظام") generalDiagnosis = "شد عضلي خفيف أو التواء بأحد الأربطة";
      
      res.push({ diagnosis: generalDiagnosis, advice: "المتابعة والمراقبة الدورية لدرجات الحرارة والضغط وإعطاء راحة تامة للمريض." });
      res.push({ diagnosis: "إجهاد وتعب بدني عام (General Fatigue)", advice: "أخذ قسط وافر من النوم لا يقل عن 8 ساعات، ومحاولة تحسين المنظومة الغذائية." });
    }
    return res.slice(0, 3);
  }

  // AI-Powered Diagnosis Suggestions route
  app.post("/api/suggest-diagnosis", async (req, res) => {
    const { complaint, doctorSpecialty } = req.body;
    if (!complaint || complaint.trim().length === 0) {
      return res.json({ suggestions: [] });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const fallback = getFallbackDiagnoses(complaint, doctorSpecialty);
      return res.json({ suggestions: fallback, isFallback: true });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `أنت طبيب استشاري مساعد ذكي في عيادة طبية متكاملة.
بناءً على شكوى المريض المذكورة:
"${complaint}"
علماً بأن تخصص الطبيب المعالج للزيارة الحالية هو: "${doctorSpecialty || 'ممارس عام'}"

اقترح 3 تشخيصات طبية محتملة ممتازة ومطابقة باللغة العربية مع إرشادات فحص أو نصيحة طبية قصيرة جداً (موجزة بحدود جملة واحدة) لكل تشخيص.
أرجع النتيجة بصيغة مصفوفة JSON صالحة مباشرة (Valid JSON Array) دون تفسير أو تمهيد، مستخدماً الهيكل التالي تماماً:
[
  {
    "diagnosis": "اسم التشخيص المقترح باللغة العربية مع المصطلح الإنجليزي",
    "advice": "النصيحة الطبية أو الفحص الموصى به"
  }
]
تنبيه هام ومشدد: لا ترسل أي كلمات تمهيدية أو ذيول قبل أو بعد الـ JSON. أرسل مصفوفة الـ JSON مباشرة فقط ليستطيع الكود قراءتها بنجاح.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const text = response.text || "[]";
      try {
        const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanText);
        return res.json({ suggestions: parsed });
      } catch (innerErr) {
        console.error("JSON parsing of diagnosis failed: ", text);
        const fallback = getFallbackDiagnoses(complaint, doctorSpecialty);
        return res.json({ suggestions: fallback, isFallback: true });
      }
    } catch (err: any) {
      console.error("Gemini suggestion error:", err);
      const fallback = getFallbackDiagnoses(complaint, doctorSpecialty);
      res.json({ suggestions: fallback, isFallback: true, error: err.message });
    }
  });

  // AI-Powered Periodic Report Insights route
  app.post("/api/generate-report-insights", async (req, res) => {
    const { reportTitle, startDate, endDate, metrics } = req.body;
    const { totalRevenue, totalClinicProfit, totalCompletedVisits, topDoctor, topDiagnosis, criticalInventoryCount } = metrics || {};

    const apiKey = process.env.GEMINI_API_KEY;

    // Local dynamic rule-based insights engine as fallback
    const getFallbackInsights = () => {
      const insightsList = [
        `تحليل الفترة من [${startDate}] إلى [${endDate}]: مركز الرعاية سجل أداءً طبياً ممتازاً بإجمالي كشوفات بلغت (${totalCompletedVisits || 0}) كشفاً ناجحاً.`,
        `التحليل المالي يوضح كفاءة تشغيلية واضحة؛ بلغ إجمالي الإيرادات ج.م (${totalRevenue || 0}) بصافي أرباح عيادة بلغت (${totalClinicProfit || 0}) ج.م.`,
        `رُصد الدكتور (${topDoctor || 'غير محدد'}) كأعلى طبيب كفاءة وإنتاجية وتسكين للحالات خلال هذه الدورة.`,
        `التشخيص السريري الأكثر شيوعاً ورصداً هو (${topDiagnosis || 'غير محدد'}). يُنصح بشراء وتأمين مخزون فوري من الأدوية المضادة والمستلزمات المرتبطة به.`,
        criticalInventoryCount > 0 
          ? `⚠️ تحذير المخزون: يُرجى العلم بوجود عدد (${criticalInventoryCount}) أصناف من المستلزمات أو الأدوية الحرجة التي تقع تحت مستوى نقطة إعادة الطلب. يُوصى بالشراء الفوري لمنع تعطل كشف المرضى.`
          : `✅ منظومة الإمداد والمخازن في حالة مستقرة؛ لا توجد أي نواقص طبية حرجة بالعيادة حالياً.`
      ];
      return insightsList.join("\n\n");
    };

    if (!apiKey) {
      return res.json({ insights: getFallbackInsights(), isFallback: true });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `أنت خبير استشاري متقدم في الأنظمة الصحية وإدارة العيادات الطبية المشتركة.
كلفناك بتحليل أداء العيادة للفترة من [${startDate}] إلى [${endDate}] وبناءً على البيانات السريرية والمالية المغذاة التالية:
- عنوان التقرير الدوري: "${reportTitle || 'تقرير الأداء السريري المالي'}"
- إجمالي عدد زيارات المرضى المنجزة: ${totalCompletedVisits || 0} حالة
- إجمالي الإيرادات المالية المحصلة للعيادة: ${totalRevenue || 0} ج.م
- صافي أرباح العيادة بعد استبعاد مستحقات الأطباء: ${totalClinicProfit || 0} ج.م
- الطبيب الأكثر إنتاجية فحصاً للحالات: "د. ${topDoctor || 'غير معروف'}"
- التشخيص والحالة المرضية الأكثر رصداً وانتشاراً بالعيادة: "${topDiagnosis || 'لا يوجد'}"
- عدد المستلزمات الطبية والأدوية الطارئة في مستوى نقص كلي أو حرج: ${criticalInventoryCount || 0} أصناف

اكتب خلاصة تقرير وتحليل أداء تنفيذي سريري (Executive Analytical Summary) مؤلف من 2 إلى 3 فقرات باللغة العربية بأسلوب راقٍ، مباشر، ومحترف جداً. 
يجب أن يحتوي التحليل على:
1. قراءة موضوعية للأرقام المالية والزيارات.
2. نصيحة طبية أو سريرية للمركز بخصوص المرض الأكثر شيوعاً والتعامل معه.
3. التوصيات العاجلة بخصوص الأطباء والمخازن (خاصة إذا كان هناك نواقص حرجة).

تنبيه هام ومشدد: أرسل النص العربي للتحليل مباشرة دون أي تمهيدات أو علامات تخفيض (Markdown formatting outside plain text).`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      const text = response.text || "";
      return res.json({ insights: text.trim() });
    } catch (err: any) {
      console.error("Gemini report insights error:", err);
      res.json({ insights: getFallbackInsights(), isFallback: true, error: err.message });
    }
  });

  // AI Patient Medical File Summary endpoint (Medicolegal Quality Aligned)
  app.post("/api/patient-file-brief", async (req, res) => {
    const { patient, visitsHistory } = req.body;
    if (!patient) return res.status(400).json({ error: "Patient data required." });

    const apiKey = process.env.GEMINI_API_KEY;

    const getFallbackBrief = () => {
      const vHistory = Array.isArray(visitsHistory) ? visitsHistory : [];
      let specialtiesSpotted = vHistory.map(v => v.serviceType || "عيادة عامة");
      if (specialtiesSpotted.length === 0) specialtiesSpotted = ["العيادات الطبية العامة"];
      const uniqueSpecs = Array.from(new Set(specialtiesSpotted));

      return `**بيان ملخص الملف الطبي الشامل كلي الخصوصية للتخصصات الطبية المتعددة**
تاريخ المراجعة الآلية: ${new Date().toISOString().slice(0, 10)}

*   **الاسم الكامل للحالة:** ${patient.name} (${patient.gender === 'male' ? 'ذكر' : 'أنثى'} - السن: ${patient.age || 'غير محدد'})
*   **كود المريض السريري:** ${patient.caseCode || 'غير مسجل'}
*   **التخصصات الطبية المشمولة بالفحص:** ${uniqueSpecs.join('، ')}
*   **عدد الزيارات المسجلة بنظام الأرشيف:** ${vHistory.length} زيارة متكاملة.

**الخلاصة التحليلية السريرية السريعة (توصية لوحة الأطباء):**
تظهر السجلات الطبية أن المريض ${patient.name} يعاني من بعض الأعراض المرتبطة بـ (${vHistory[0]?.diagnosis || 'متابعة دورية'}). 
الخطة العلاجية المقترحة ومسارات الأدوية قيد المراقبة السريرية تحت رعاية الأقسام الطبية المختصة وسجل الطبيب (${vHistory[0]?.doctorName || 'الطبيب المعالج'}). تظل المؤشرات الحيوية السابقة ضمن النطاق المقبول.

**⚠️ إشعار الجودة والمسؤولية الطبية القانونية (Medicolegal Quality & Professional Disclaimer):**
هذا المستند عبارة عن مسودة ملخص فوري مولد بمساعدة تقنيات الذكاء الاصطناعي الطبية المساعدة (Decision Support AI). هذا التحليل ليس فحصاً عيادياً مباشراً ولا يعوض القرار الإكلينيكي للطبيب المعالج المرخص. تقع المسؤولية الكاملة في التوجيه الطبي وإقرار التشخيص وتصنيف دواء الحالة وجرعاته العلاجية قانونياً ومهنياً على عاتق الطبيب الاستشاري المشرف حصراً.`;
    };

    if (!apiKey) {
      return res.json({ brief: getFallbackBrief(), isFallback: true });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const vHistoryText = Array.isArray(visitsHistory) && visitsHistory.length > 0
        ? visitsHistory.map((v, idx) => `الزيارة رقم [${idx+1}] - التخصص: ${v.serviceType || 'غير محدد'}، الطبيب: د. ${v.doctorName || 'غير محدد'}، الشكوى السريرية: ${v.notes || 'لا يوجد'}، التشخيص المسجل: ${v.diagnosis || 'غير مسجل'}، الأدوية الموصوفة: ${Array.isArray(v.prescriptions) ? v.prescriptions.map((p: any) => p.name).join('، ') : 'لا يوجد'}`).join('\n')
        : "لا توجد زيارات سابقة مسجلة بتفاصيل كاملة.";

      const prompt = `أنت طبيب استشاري وخبير تدقيق طبي قانوني عالي الكفاءة (Medicolegal Clinical Auditor). 
مهمتك مراجعة ملف المريض الكامل وصياغة "بطاقة موجزة لملف المريض لكفة التخصصات الطبية" ليطلع عليها الأطباء وهيئة التمريض لسرعة متابعة الحالة.

بيانات المريض الأساسية:
- الاسم: ${patient.name}
- الجنس: ${patient.gender}
- السن: ${patient.age} سنة
- كود الحالة: ${patient.caseCode}

سجل الزيارات الطبية بالتفصيل:
${vHistoryText}

اكتب ملخصاً طبياً مهنياً وبليغاً باللغة العربية الفصحى يتضمن:
1. خلاصة تشخيصية متقاطعة تغطي كافة التخصصات التي زارها المريض.
2. تتبع الحالة الصحية والدوائية الحالية وأبرز النواحي العلاجية.
3. التوجيهات أو التنبيهات السريرية الأساسية لطاقم العيادة.
4. أضف في نهاية النص إشعاراً واضحاً ومشدداً باللغة العربية حول المسؤولية الطبية والقانونية وأنه تقرير مساند استرشادي فقط والقرار النهائي والمسؤولية تقع على الطبيب المعالج المشرف.

تنبيه هام: أرسل النص العربي مباشرة ليعرضه النظام وبأسلوب منسق ومرئي للأطباء.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      return res.json({ brief: (response.text || "").trim() });
    } catch (err: any) {
      console.error("Gemini patient brief error:", err);
      res.json({ brief: getFallbackBrief(), isFallback: true, error: err.message });
    }
  });

  // AI Patient Investigations Gallery Progress Summary endpoint
  app.post("/api/patient-investigations-brief", async (req, res) => {
    const { patient, files } = req.body;
    if (!patient) return res.status(400).json({ error: "Patient data required." });

    const apiKey = process.env.GEMINI_API_KEY;

    const getFallbackProgress = () => {
      const fileList = Array.isArray(files) ? files : [];
      if (fileList.length === 0) {
        return `**تقرير رصد التطور للفحوصات الطبية المرفقة**
تنبيه: لا توجد فحوصات أو تحاليل طبية مرفوعة حالياً في المعرض الطبي الخاص بهذا المريض لصياغة تقرير التطور البصري المساعد.`;
      }

      return `**📊 تقرير تحليل تقدم الفحوصات والتحاليل الطبية المخبرية**
تاريخ استخراج الخلاصة التطورية: ${new Date().toISOString().slice(0, 10)}

*   **اسم المريض وعمر الحالة:** ${patient.name} (${patient.gender === 'male' ? 'ذكر' : 'أنثى'} - السن: ${patient.age || 'غير محدد'})
*   **الفحوصات والأوراق المرصودة في المعرض المعاين:** 
    ${fileList.map((f, idx) => `   ${idx+1}. الملف: ${f.title || f.filename} (التاريخ: ${new Date(f.createdAt || Date.now()).toISOString().slice(0, 10)})`).join('\n')}

**📈 خط سیر وتقدم المؤشرات (Clinical Progress Evolution):**
بمراجعة عناوين وتواريخ التحاليل والأشعات الملحقة بالمعرض، يتبين وجود تطور تدريجي في تتبع الحالة الصحية. تشير التواريخ المتتابعة إلى التزام عالي ببروتوكول المتابعة الدورية المقررة من قبل الإدارة الطبية لتتبع المتغيرات المخبرية.

**توصيات الإدارة السريرية واستشاريي المتابعة:**
- حث المريض على الالتزام الكامل بمواعيد الفحص للمستوى التالي.
- مقارنة أحدث مستند من الأشعة الطبية بنتائج السونار المسجلة مسبقاً لمراقبة استجابة الأنسجة.
  
**⚠️ تنبيه طبي قانوني:** هذا التحليل مؤتمت للمستندات المرفوعة، والتحقق البصري المباشر وقراءة التقارير هي مسؤولية الإخصائي الاستشاري المشرف بالكامل.`;
    };

    if (!apiKey) {
      return res.json({ progress: getFallbackProgress(), isFallback: true });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const fileListText = Array.isArray(files) && files.length > 0
        ? files.map((f, idx) => `الملف رقم [${idx+1}] - العنوان: ${f.title || 'بلأ اسم'}، اسم الملف الأصلي: ${f.filename}، تاريخ الرفع بالملف: ${f.createdAt}`).join('\n')
        : "لم يتم رفع أي مستندات حتى الآن.";

      const prompt = `أنت طبيب استشاري متخصص في إدارة المتابعة الصحية وقراءة تطور الفحوصات الطبية (Clinician of Radiology and Lab Investigations).
تلقيت قائمة بالمرفقات الطبية (فحوصات، تحاليل، تذاكر سونار، تقارير مختبرات ومعامل) المرفوعة بمعرض المريض والمحفوظة في ملفه السريري الموحد.

بيانات المريض الأساسية:
- الاسم: ${patient.name}
- الجنس: ${patient.gender}
- السن: ${patient.age} سنة

قائمة الملفات والتحاليل المرفوعة بالمعرض حسب تسلسلها وتاريخها:
${fileListText}

اكتب باللغة العربية الفصحى تحليلاً "لمنحنى تقدم فحص وتحاليل المريض" (Patient Investigations Progress Brief):
1. رتب الفحوصات ذهنياً بحسب التسلسل التاريخي واكتب قراءة لتسلسل الفحص الطبي للمريض.
2. وضح مدى التزام المريض بالمتابعة وصور التطور أو التغير المتوقع في حالته الصحية والسريرية بناءً على الفحوصات المسجلة.
3. التوصيات الإكلينيكية الفعالة للأطباء لمقارنة البيانات السريرية.
4. إشعار بجودة وتعهد طبي قانوني ومحدد يُذكّر بأن تفسير الأشعة والتحاليل النهائي والتشخيص القانوني يعود لأطباء الأشعة والمختبر والأخصائي المعالج.

أرسل النص مباشرة بأسلوب منظم جداً ومجزء كتقرير مهني مصمت ليعرضه النظام.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      return res.json({ progress: (response.text || "").trim() });
    } catch (err: any) {
      console.error("Gemini patient investigations progress brief error:", err);
      res.json({ progress: getFallbackProgress(), isFallback: true, error: err.message });
    }
  });

  // Backup Full DB
  app.get("/api/backup", async (req, res) => {
    try {
      const db = await readDb();
      res.json(db);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to read database backup" });
    }
  });

  // Audit Logs
  app.get("/api/audit-logs", async (req, res) => {
    const db = await readDb();
    res.json(db.auditLogs.slice().reverse());
  });

  app.post("/api/audit-logs/:id/restore", async (req, res) => {
    const db = await readDb();
    const logIndex = db.auditLogs.findIndex(l => l.id === req.params.id);
    if (logIndex === -1) {
      return res.status(404).json({ error: "Audit log not found" });
    }
    const log = db.auditLogs[logIndex];
    if (log.action !== "DELETE" || !log.payload) {
      return res.status(400).json({ error: "This operation cannot be restored or holds no data" });
    }

    const { entityId, entityType, payload } = log;

    if (entityType === "patient") {
      const exists = db.patients.some(p => p.id === entityId);
      if (!exists) {
        db.patients.push(payload);
        await logAction(db, "CREATE", entityId, "patient", `استعادة بيانات المريض بنجاح: ${payload.name} من سجل العمليات`);
      } else {
        return res.status(400).json({ error: "المريض موجود بالفعل في قاعدة البيانات حالياً" });
      }
    } else if (entityType === "appointment") {
      const exists = db.appointments.some(a => a.id === entityId);
      if (!exists) {
        db.appointments.push(payload);
        await logAction(db, "CREATE", entityId, "appointment", `استعادة موعد المريض #${payload.patientId} الملغي/المحذوف من سجل العمليات`);
      } else {
        return res.status(400).json({ error: "الموعد موجود بالفعل في قاعدة البيانات حالياً" });
      }
    } else {
      return res.status(400).json({ error: "لا يمكن استعادة بيانات هذا الجدول حالياً" });
    }

    await writeDb(db);
    res.json({ success: true, message: "تمت استعادة الحالة بنجاح" });
  });

  // Users
  app.get("/api/users", async (req, res) => {
    const db = await readDb();
    res.json(db.users);
  });

  app.post("/api/users", async (req, res) => {
    const db = await readDb();
    const newUser = { ...req.body, id: uuidv4() };
    db.users.push(newUser);
    await logAction(db, "CREATE", newUser.id, "user", `Added user: ${newUser.username}`);
    await writeDb(db);
    res.json(newUser);
  });

  app.delete("/api/users/:id", async (req, res) => {
    const db = await readDb();
    const index = db.users.findIndex(u => u.id === req.params.id);
    if (index !== -1) {
      const username = db.users[index].username;
      db.users.splice(index, 1);
      await logAction(db, "DELETE", req.params.id, "user", `Deleted user: ${username}`);
      await writeDb(db);
      res.sendStatus(200);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  // Inventory
  app.get("/api/inventory", async (req, res) => {
    const db = await readDb();
    res.json(db.inventory);
  });

  app.post("/api/inventory", async (req, res) => {
    const db = await readDb();
    const newItem = { ...req.body, id: uuidv4(), lastUpdated: new Date().toISOString() };
    db.inventory.push(newItem);
    await logAction(db, "CREATE", newItem.id, "inventory", `Added inventory item: ${newItem.name}`);
    await writeDb(db);
    res.json(newItem);
  });

  app.patch("/api/inventory/:id", async (req, res) => {
    const db = await readDb();
    const index = db.inventory.findIndex(i => i.id === req.params.id);
    if (index !== -1) {
      const oldName = db.inventory[index].name;
      db.inventory[index] = { ...db.inventory[index], ...req.body, lastUpdated: new Date().toISOString() };
      await logAction(db, "UPDATE", req.params.id, "inventory", `Updated inventory item: ${oldName}`);
      await writeDb(db);
      res.json(db.inventory[index]);
    } else {
      res.status(404).json({ error: "Item not found" });
    }
  });

  app.delete("/api/inventory/:id", async (req, res) => {
    const db = await readDb();
    const index = db.inventory.findIndex(i => i.id === req.params.id);
    if (index !== -1) {
      const itemName = db.inventory[index].name;
      db.inventory.splice(index, 1);
      await logAction(db, "DELETE", req.params.id, "inventory", `Deleted inventory item: ${itemName}`);
      await writeDb(db);
      res.sendStatus(200);
    } else {
      res.status(404).json({ error: "Item not found" });
    }
  });

  app.post("/api/inventory/dispense", async (req, res) => {
    const { items } = req.body; // array of { id: string, quantity: number }
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Invalid items array" });
    }
    const db = await readDb();
    const dispensedDetails: string[] = [];

    for (const order of items) {
      const itemIndex = db.inventory.findIndex(i => i.id === order.id);
      if (itemIndex !== -1) {
        const oldQty = db.inventory[itemIndex].quantity;
        const qtyToDeduct = Number(order.quantity || 1);
        const newQty = Math.max(0, oldQty - qtyToDeduct);
        db.inventory[itemIndex].quantity = newQty;
        db.inventory[itemIndex].lastUpdated = new Date().toISOString();
        dispensedDetails.push(`صرف ${qtyToDeduct} ${db.inventory[itemIndex].unit} من ${db.inventory[itemIndex].name} (المتبقي: ${newQty})`);
      }
    }

    if (dispensedDetails.length > 0) {
      await logAction(db, "UPDATE", "inventory-dispense", "inventory", `صرف أدوية الروشتة في العيادة: ${dispensedDetails.join("، ")}`);
      await writeDb(db);
    }
    res.json({ success: true, inventory: db.inventory });
  });

  // Room Management Endpoints
  app.get("/api/rooms", async (req, res) => {
    const db = await readDb();
    res.json(db.rooms || []);
  });

  app.post("/api/rooms", async (req, res) => {
    const db = await readDb();
    const newRoom = {
      id: uuidv4(),
      name: req.body.name,
      status: req.body.status || "available",
      currentPatientId: req.body.currentPatientId || null,
      currentDoctorId: req.body.currentDoctorId || null,
      startTime: req.body.startTime || null,
      endTime: req.body.endTime || null,
      durationMinutes: Number(req.body.durationMinutes || 15)
    };
    if (!db.rooms) db.rooms = [];
    db.rooms.push(newRoom);
    await logAction(db, "CREATE", newRoom.id, "room", `إضافة غرفة عيادة جديدة: ${newRoom.name}`);
    await writeDb(db);
    res.status(201).json(newRoom);
  });

  app.patch("/api/rooms/:id", async (req, res) => {
    const db = await readDb();
    if (!db.rooms) db.rooms = [];
    const index = db.rooms.findIndex(r => r.id === req.params.id);
    if (index !== -1) {
      db.rooms[index] = { ...db.rooms[index], ...req.body };
      await logAction(db, "UPDATE", req.params.id, "room", `تعديل بيانات الغرفة: ${db.rooms[index].name}`);
      await writeDb(db);
      res.json(db.rooms[index]);
    } else {
      res.status(404).json({ error: "Room not found" });
    }
  });

  app.delete("/api/rooms/:id", async (req, res) => {
    const db = await readDb();
    if (!db.rooms) db.rooms = [];
    const index = db.rooms.findIndex(r => r.id === req.params.id);
    if (index !== -1) {
      const roomName = db.rooms[index].name;
      db.rooms.splice(index, 1);
      await logAction(db, "DELETE", req.params.id, "room", `حذف غرفة العيادة: ${roomName}`);
      await writeDb(db);
      res.sendStatus(200);
    } else {
      res.status(404).json({ error: "Room not found" });
    }
  });

  app.post("/api/rooms/:id/start-exam", async (req, res) => {
    const db = await readDb();
    if (!db.rooms) db.rooms = [];
    const index = db.rooms.findIndex(r => r.id === req.params.id);
    if (index !== -1) {
      const { patientId, doctorId, durationMinutes } = req.body;
      const parsedDuration = Number(durationMinutes || db.rooms[index].durationMinutes || 15);
      
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + parsedDuration * 60 * 1000);

      db.rooms[index].status = "occupied";
      db.rooms[index].currentPatientId = patientId;
      db.rooms[index].currentDoctorId = doctorId;
      db.rooms[index].startTime = startTime.toISOString();
      db.rooms[index].endTime = endTime.toISOString();
      db.rooms[index].durationMinutes = parsedDuration;

      const patient = db.patients.find(p => p.id === patientId);
      const doctor = db.doctors.find(d => d.id === doctorId);
      const details = `بدء فحص طبي وتسكين الغرفة (${db.rooms[index].name}) للمريض ${patient?.name || 'بدون اسم'} مع الدكتور ${doctor?.name || 'بدون اسم'}`;

      await logAction(db, "UPDATE", req.params.id, "room", details);
      await writeDb(db);
      res.json(db.rooms[index]);
    } else {
      res.status(404).json({ error: "Room not found" });
    }
  });

  app.post("/api/rooms/:id/end-exam", async (req, res) => {
    const db = await readDb();
    if (!db.rooms) db.rooms = [];
    const index = db.rooms.findIndex(r => r.id === req.params.id);
    if (index !== -1) {
      const oldRoomInfo = db.rooms[index];
      const patient = db.patients.find(p => p.id === oldRoomInfo.currentPatientId);
      const details = `إنهاء الكشف وفحص الغرفة وإخلائها (${oldRoomInfo.name}) للمريض ${patient?.name || 'مريض سابق'}`;

      db.rooms[index].status = "available";
      db.rooms[index].currentPatientId = null;
      db.rooms[index].currentDoctorId = null;
      db.rooms[index].startTime = null;
      db.rooms[index].endTime = null;

      await logAction(db, "UPDATE", req.params.id, "room", details);
      await writeDb(db);
      res.json(db.rooms[index]);
    } else {
      res.status(404).json({ error: "Room not found" });
    }
  });

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

  app.patch("/api/patients/:id", async (req, res) => {
    const db = await readDb();
    const index = db.patients.findIndex(p => p.id === req.params.id);
    if (index !== -1) {
      db.patients[index] = { ...db.patients[index], ...req.body };
      await logAction(db, "UPDATE", req.params.id, "patient", `Updated patient data for: ${db.patients[index].name}`);
      await writeDb(db);
      res.json(db.patients[index]);
    } else {
      res.status(404).json({ error: "Patient not found" });
    }
  });

  app.delete("/api/patients/:id", async (req, res) => {
    const db = await readDb();
    const index = db.patients.findIndex(p => p.id === req.params.id);
    if (index !== -1) {
      const patient = db.patients[index];
      db.patients.splice(index, 1);
      await logAction(db, "DELETE", req.params.id, "patient", `حذف بيانات المريض: ${patient.name} (كود الحساب: ${patient.caseCode || 'بدون'})`, undefined, patient);
      await writeDb(db);
      res.sendStatus(200);
    } else {
      res.status(404).json({ error: "Patient not found" });
    }
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
    await logAction(db, "CREATE", newDoctor.id, "doctor", `Added new doctor: ${newDoctor.name}`);
    await writeDb(db);
    res.json(newDoctor);
  });

  app.patch("/api/doctors/:id", async (req, res) => {
    const db = await readDb();
    const index = db.doctors.findIndex(d => d.id === req.params.id);
    if (index !== -1) {
      const oldName = db.doctors[index].name;
      db.doctors[index] = { ...db.doctors[index], ...req.body };
      await logAction(db, "UPDATE", db.doctors[index].id, "doctor", `Updated doctor: ${oldName} -> ${db.doctors[index].name}`);
      await writeDb(db);
      res.json(db.doctors[index]);
    } else {
      res.status(404).json({ error: "Doctor not found" });
    }
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
    await logAction(db, "CREATE", newAppointment.id, "appointment", `Scheduled appointment for date: ${newAppointment.date}`);
    await writeDb(db);
    res.json(newAppointment);
  });

  app.patch("/api/appointments/:id", async (req, res) => {
    const db = await readDb();
    const index = db.appointments.findIndex(a => a.id === req.params.id);
    if (index !== -1) {
      const oldStatus = db.appointments[index].status;
      const oldBranch = db.appointments[index].branch || "المعادي";
      const oldDate = db.appointments[index].date;
      
      db.appointments[index] = { ...db.appointments[index], ...req.body };
      
      const changes: string[] = [];
      if (req.body.status && req.body.status !== oldStatus) {
        changes.push(`تغيير حالة الموعد إلى ${req.body.status}`);
      }
      if (req.body.branch && req.body.branch !== oldBranch) {
        changes.push(`نقل الموعد من فرع (${oldBranch}) إلى فرع (${req.body.branch}) عبر السحب والإفلات السريع`);
      }
      if (req.body.date && req.body.date !== oldDate) {
        changes.push(`تعديل موعد الكشف إلى ${req.body.date}`);
      }

      if (changes.length > 0) {
        await logAction(db, "UPDATE", req.params.id, "appointment", changes.join(" | "), undefined, db.appointments[index]);
      } else {
        await logAction(db, "UPDATE", req.params.id, "appointment", "تحديث تفاصيل الموعد", undefined, db.appointments[index]);
      }
      
      await writeDb(db);
      res.json(db.appointments[index]);
    } else {
      res.status(404).json({ error: "Appointment not found" });
    }
  });

  app.delete("/api/appointments/:id", async (req, res) => {
    const db = await readDb();
    const index = db.appointments.findIndex(a => a.id === req.params.id);
    if (index !== -1) {
      const appointment = db.appointments[index];
      const patient = db.patients.find(p => p.id === appointment.patientId);
      const patientNameMsg = patient ? `للمريض ${patient.name}` : `(رقم المريض: ${appointment.patientId})`;
      db.appointments.splice(index, 1);
      await logAction(
        db, 
        "DELETE", 
        req.params.id, 
        "appointment", 
        `حذف الموعد مقرر العمل به بتاريخ ${appointment.date} ${patientNameMsg}`, 
        undefined, 
        appointment
      );
      await writeDb(db);
      res.sendStatus(200);
    } else {
      res.status(404).json({ error: "Appointment not found" });
    }
  });

  app.post("/api/appointments/:id/remind", async (req, res) => {
    const db = await readDb();
    const index = db.appointments.findIndex(a => a.id === req.params.id);
    if (index !== -1) {
      db.appointments[index].reminderSent = true;
      await logAction(db, "UPDATE", req.params.id, "appointment", `Sent reminder for appointment on ${db.appointments[index].date}`);
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
    const doctorId = req.body.doctorId;
    const basePrice = Number(req.body.basePrice || 0);
    const date = req.body.date || new Date().toISOString();

    const { cost, doctorEarnings, clinicEarnings } = calculateVisitEarnings(db, doctorId, basePrice, date);

    const newVisit = { 
      ...req.body, 
      id: uuidv4(), 
      cost,
      doctorEarnings,
      clinicEarnings,
      isPaid: req.body.isPaid !== undefined ? req.body.isPaid : true,
      date
    };
    db.visits.push(newVisit);
    await writeDb(db);
    res.json(newVisit);
  });

  app.patch("/api/visits/:id", async (req, res) => {
    const db = await readDb();
    const index = db.visits.findIndex(v => v.id === req.params.id);
    if (index !== -1) {
      const mergedVisit = { ...db.visits[index], ...req.body };
      const doctorId = mergedVisit.doctorId;
      const basePrice = Number(mergedVisit.basePrice || 0);
      const date = mergedVisit.date;

      const { cost, doctorEarnings, clinicEarnings } = calculateVisitEarnings(db, doctorId, basePrice, date, req.params.id);

      db.visits[index] = {
        ...mergedVisit,
        cost,
        doctorEarnings,
        clinicEarnings
      };

      await logAction(db, "UPDATE", req.params.id, "visit", `Updated details for visit: ${db.visits[index].id}`);
      await writeDb(db);
      res.json(db.visits[index]);
    } else {
      res.status(404).json({ error: "Visit not found" });
    }
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

  // Internal Messaging System Endpoints
  app.get("/api/messages", async (req, res) => {
    const db = await readDb();
    res.json(db.messages || []);
  });

  app.post("/api/messages", async (req, res) => {
    const db = await readDb();
    const newMessage = {
      id: uuidv4(),
      senderId: req.body.senderId,
      senderName: req.body.senderName,
      senderRole: req.body.senderRole,
      receiverId: req.body.receiverId || null,
      receiverRole: req.body.receiverRole || 'all',
      patientId: req.body.patientId || null,
      patientName: req.body.patientName || null,
      content: req.body.content,
      createdAt: new Date().toISOString(),
      isRead: false
    };
    db.messages.push(newMessage);
    await logAction(db, "CREATE", newMessage.id, "patient", `Internal Message sent by ${req.body.senderName}: ${req.body.content.substring(0, 30)}...`);
    await writeDb(db);
    res.status(201).json(newMessage);
  });

  app.patch("/api/messages/:id/read", async (req, res) => {
    const db = await readDb();
    const index = db.messages.findIndex(m => m.id === req.params.id);
    if (index !== -1) {
      db.messages[index].isRead = true;
      await writeDb(db);
      res.json(db.messages[index]);
    } else {
      res.status(404).json({ error: "Message not found" });
    }
  });

  app.delete("/api/messages/:id", async (req, res) => {
    const db = await readDb();
    const index = db.messages.findIndex(m => m.id === req.params.id);
    if (index !== -1) {
      db.messages.splice(index, 1);
      await writeDb(db);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Message not found" });
    }
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
