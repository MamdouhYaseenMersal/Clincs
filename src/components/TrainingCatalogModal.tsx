import React, { useState } from 'react';
import { 
  X, BookOpen, Download, FileText, CheckCircle2, DollarSign, Users, 
  Layers, Settings, Shield, ChevronLeft, ChevronRight, RotateCcw, 
  Calculator, Table, Info, Key, Activity, Calendar, Eye, Printer, AlertTriangle, 
  Megaphone, Plus, Search, BarChart3, TrendingUp, Trash2, Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

interface TrainingCatalogModalProps {
  onClose: () => void;
  initialStep?: CatalogStepId;
}

export type CatalogStepId = 'login' | 'dashboard' | 'patients' | 'appointments' | 'doctors' | 'rooms' | 'schedule' | 'queue' | 'inventory' | 'finance' | 'messages' | 'audit';

export default function TrainingCatalogModal({ onClose, initialStep }: TrainingCatalogModalProps) {
  const [activeStep, setActiveStep] = useState<CatalogStepId>(initialStep || 'login');
  const [activeTab, setActiveTab] = useState<'guide' | 'calculator'>('guide');

  // Interactive Calculator State
  const [calcCost, setCalcCost] = useState<number>(400);
  const [calcDocShare, setCalcDocShare] = useState<number>(60);
  const [calcQuantity, setCalcQuantity] = useState<number>(10);
  
  // Calculations
  const calculatedDocEarnings = (calcCost * calcDocShare) / 100;
  const calculatedClinicEarnings = calcCost - calculatedDocEarnings;
  const totalCalculatedBatch = calcCost * calcQuantity;

  // Custom uploaded screenshots state
  const [customScreenshots, setCustomScreenshots] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('catalog_custom_screenshots');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleUploadScreenshot = (stepId: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const updated = { ...customScreenshots, [stepId]: base64String };
      setCustomScreenshots(updated);
      localStorage.setItem('catalog_custom_screenshots', JSON.stringify(updated));
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteScreenshot = (stepId: string) => {
    const updated = { ...customScreenshots };
    delete updated[stepId];
    setCustomScreenshots(updated);
    localStorage.setItem('catalog_custom_screenshots', JSON.stringify(updated));
  };

  const handlePrintPDF = () => {
    window.print();
  };

  // 1. Export Content to Word (.doc) with complete styling and integrated step descriptions + images
  const handleExportWord = () => {
    let stepsSectionsHtml = '';
    
    (Object.keys(stepsMetadata) as CatalogStepId[]).map((key, index) => {
      const step = stepsMetadata[key];
      const customImg = customScreenshots[key];
      const imgTag = customImg ? `<div style="text-align:center;margin:15px 0;"><img src="${customImg}" style="max-width:400px;border:1px solid #cbd5e1;border-radius:6px;" /></div>` : '';
      
      stepsSectionsHtml += `
        <div style="margin-bottom: 30px; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; background-color: #f8fafc;">
          <h3 style="color: #1e3a8a; margin-top: 0;">الخطوة ${index + 1}: ${step.title}</h3>
          <p><b>الهدف والغرض الأساسي:</b> ${step.reason}</p>
          <p><b>وصف طريقة التشغيل بأدق التفاصيل:</b> ${step.details}</p>
          <p><b>البيانات والمدخلات المطلوبة لتفعيل الأداة:</b></p>
          <ul>
            ${step.fields.map(f => `<li>${f}</li>`).join('')}
          </ul>
          ${step.credentials ? `<p style="color:#b45309;font-weight:bold;">🔑 الحساب المعتمد لمحاكاة الشاشة: ${step.credentials}</p>` : ''}
          ${imgTag}
        </div>
      `;
    });

    const docHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>دليل تدريب الزملاء العملي المطور لمجمع الشفاء الطبي</title>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; text-align: right; line-height: 1.8; color: #1e293b; background-color: #ffffff; padding: 20px; }
          .header-box { text-align: center; border-bottom: 4px solid #3b82f6; padding-bottom: 15px; margin-bottom: 30px; }
          .title { color: #1e3a8a; font-size: 24pt; font-weight: bold; margin: 0; }
          .subtitle { color: #64748b; font-size: 13pt; margin-top: 5px; }
          h2 { color: #0f766e; border-right: 5px solid #0f766e; padding-right: 12px; font-size: 17pt; margin-top: 30pt; }
          p, li { font-size: 11pt; text-align: justify; }
          .highlight-card { background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 15px; margin: 15px 0; border-right: 6px solid #2563eb; }
          .table-style { width: 100%; border-collapse: collapse; margin: 20pt 0; }
          .table-style th { background-color: #0f172a; color: #ffffff; font-weight: bold; border: 1px solid #475569; padding: 10px; text-align: right; }
          .table-style td { border: 1px solid #cbd5e1; padding: 10px; font-size: 10pt; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h1 class="title">🏥 مجمع الشفاء الطبي التخصصي</h1>
          <div class="subtitle">الحقيبة التدريبية والدليل المرجعي والكتالوج الرقمي الشامل لعمليات الفروع والعيادات</div>
          <p>أول وثيقة تشغيل وتوجيه وظيفي متكاملة بالصور والبيانات التفصيلية (إصدار 2026)</p>
        </div>

        <h2>📌 الفصل الأول: مقدمة ورسالة النظام وشرح الصلاحيات</h2>
        <p>يهدف نظام مجمع الشفاء الطبي إلى إدارة الدورة الطبية والمالية والتنظيمية المتكاملة لجميع فروع المجمع (تفرعات المعادي والدقي)، وضبط كشوف تسجيل الحضور للأطباء، وموازنة حصص الرواتب وعقد الأخصائيين لضمان الشفافية ومطابقتها دفترياً، إلى جانب أتمتة الصيدلية والتحاليل والنداء الصوتي الذكي في صالات الانتظار.</p>
        
        <table class="table-style">
          <thead>
            <tr>
              <th>الدور الوظيفي المعتمد</th>
              <th>بيانات الاعتماد والدخول</th>
              <th>الوظائف والأهداف من الشاشة</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>مدير المجمع (Admin)</b></td>
              <td>اسم الحساب: ممدوح ياسين (mamdouhyasin30)</td>
              <td>الموافقة والاطلاع على رواتب الطواقم كافة، جرد مخازن الفروع، تفعيل الأطباء والاطلاع على المخططات المالية ميزانية وحساباً.</td>
            </tr>
            <tr>
              <td><b>أخصائي الاستقبال (Receptionist)</b></td>
              <td>اسم الحساب: موظف استقبال الشفاء المعتمد</td>
              <td>حجز وسداد الكشوفات، إدخال ملف مريض جديد، تعبئة القياسات الحيوية الأولية، التحكم في لوحة الاستدعاء الصوتي.</td>
            </tr>
            <tr>
              <td><b>الأطباء وأخصائي العيادات (Doctor)</b></td>
              <td>قائمة أطباء العيادات (الباطنة، الأسنان، العظام، الجراحة)</td>
              <td>رؤية الملف الطبي الموحد للمرضى، وكتابة التشخيصات الدوائية والتحاليل والأشعة، واستعراض حصص ومعاملات أرباح الطبيب الشخصية.</td>
            </tr>
          </tbody>
        </table>

        <h2>📋 الفصل الثاني: خطوات التشغيل اليومية والمدخلات بالتفصيل</h2>
        ${stepsSectionsHtml}

        <h2>💰 الفصل الثالث: طريقة الاحتساب المالي وتوزيع رواتب الأطباء</h2>
        <div class="highlight-card">
          <b>النموذج الحسابي المتكامل للمجمع:</b><br/>
          • إجمالي الحركة المالية للزيارة المدفوعة بواسطة المريض = <b>تكلفة الكشف (Visit Cost)</b><br/>
          • مستحقات الطبيب المعالج = <b>(قيمة الكشف &times; نسبة الطبيب معينة بالكشف) / 100</b><br/>
          • صافي حصة العيادة والأرباح التشغيلية للمجمع = <b>تكلفة الكشف - مستحقات الطبيب المعالج</b>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([docHtml], {
      type: 'application/msword;charset=utf-8'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'دليل_تشغيل_مجمع_الشفاء_الطبي_المفصل.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 2. Export Checklist & Sample Data to Excel (.xlsx) using preinstalled XLSX library
  const handleExportExcel = () => {
    const stepsData = [
      { 'مرحلة النظام': '1. بوابة تسجيل الدخول', 'المهمة المطلوبة': 'محاكاة أو تسجيل دخول الموظف وتأشير الهوية', 'الحقول والبيانات': 'اسم الحساب، كلمة المرور، تحديد فرع المجمع', 'السبب والهدف': 'قراءة الفرع الافتراضي وتوجيه صلاحية العرض' },
      { 'مرحلة النظام': '2. لوحة المؤشرات', 'المهمة المطلوبة': 'مراقبة العدادات والنشاط الفوري اليومي للعيادة', 'الحقول والبيانات': 'إحصاء الكشوف، مستويات الإشغال، الأطباء في الخدمة', 'السبب والهدف': 'متابعة التدفق الحي وصحة النظامات التشغيلية بالدقيقة' },
      { 'مرحلة النظام': '3. سجلات المرضى', 'المهمة المطلوبة': 'تسجيل المرضى وحفظ الملف الطبي الشامل', 'الحقول والبيانات': 'الاسم، الهاتف، الرقم القومي، فصيلة الدم، القياسات الحيوية', 'السبب والهدف': 'بناء ملف إلكتروني موحد يثبت التاريخ المرضي بالرسم البياني' },
      { 'مرحلة النظام': '4. حجز وتذكرة المواعيد', 'المهمة المطلوبة': 'حجز تذاكر الحالات وتوليد تفويضات الطباعة الورقية', 'الحقول والبيانات': 'اسم المريض، الطبيب بفرع مجمع الشفاء، نوع الكشف، طوابع الاعتماد', 'السبب والهدف': 'أتوثيق مواعيد الكشوف بختم رسمي وإتاحة تقارير الحجوزات اليومية' },
      { 'مرحلة النظام': '5. إدارة طاقم الأطباء ونسب التعاقد', 'المهمة المطلوبة': 'ضبط نسب العقد وتصنيف نوبات نوبة حضور الدكتور', 'الحقول والبيانات': 'اسم الطبيب، التخصص الدقيق، نسبة العقد، فرع العمل الأسبوعية', 'السبب والهدف': 'تفادي النزعات الدفترية وتسوية الرواتب آلياً بنسبة خطأ 0%' },
      { 'مرحلة النظام': '6. غرف العيادات التشغيلية', 'المهمة المطلوبة': 'ربط الأطباء بالغرف الشاغرة وتنظيم السعة المكانية', 'الحقول والبيانات': 'رقم الغرفة، التخصص الحاضن، حالة التشغيل، الأجهزة', 'السبب والهدف': 'تلافي تداخل نوبات الأطباء وتوجيه المريض ذكياً' },
      { 'مرحلة النظام': '7. جدول المواعيد الإلكتروني', 'المهمة المطلوبة': 'جدولة الحجوزات اليومية للعيادات وفحص التزامن', 'الحقول والبيانات': 'اسم المريض، الطبيب المستهدف، الساعة، حالة الدفع المسبق', 'السبب والهدف': 'منع تعارض الحجوزات والجدولة المثالية لكوادر المجمع' },
      { 'مرحلة النظام': '8. طابور النداء ذكي والنداء الآلي', 'المهمة المطلوبة': 'تشغيل الاستدعاء الصوتي للمريض وحل تتابع الغرف', 'الحقول والبيانات': 'أولوية الخطورة والعيادة، بث نداء صوتي مسموع بالاسم', 'السبب والهدف': 'توطيد الراحة لخدمة الطوارئ الحية وتنظيم صالات الانتظار والعيادات' },
      { 'مرحلة النظام': '9. المستودع والصيدلية الموحدة', 'المهمة المطلوبة': 'الرقابة والصرف للمستهلكات الطبية وجرد رفوف الأدوية', 'الحقول والبيانات': 'كود المادة، المورد، كمية المستودع، مستوى نفاد التوريد Reorder', 'السبب والهدف': 'تلافي نفاد المخزون الإستراتيجي وحل أزمة ترحيل فروع المجمع' },
      { 'مرحلة النظام': '10. الحسابات والرواتب الكلية', 'المهمة المطلوبة': 'توزيع المحصل الكلي ومطابقة الأرباح الكشف لرواتب الطبيب', 'الحقول والبيانات': 'إجمالي الإيرادات، صافي ربح المجمع الشفاء الطبية، حصة عقد الدكتور', 'السبب والهدف': 'قفل الخزينة بنسبة خطأ 0% وضبط الإكسل دفترياً' },
      { 'مرحلة النظام': '11. المراسلات ومذكرات الفروع', 'المهمة المطلوبة': 'مراسلة لحظية لطلب الدعم وتعميم توجيهات الصيدلية والمستودعات', 'الحقول والبيانات': 'المرسل، المتسلم أو القسم، العنوان والنص، طابع أسبقية التعميم العاجل', 'السبب والهدف': 'مراسلة وتنسيق داخلي آمن يغني عن اللجوء لتطبيقات الدردشة الخارجية' },
      { 'مرحلة النظام': '12. سجل العمليات والرقابة', 'المهمة المطلوبة': 'حفظ الصندوق الأسود لتتبع حركات الإغلاق والتعديل في المعادي والدقي', 'الحقول والبيانات': 'رقم الإجراء Log ID، اسم الموظف المنفذ، محتوى العملية، فرع الاستقبال', 'السبب والهدف': 'مكافحة السهو والتحقق التاريخي المطلق من الأحداث الإدارية' }
    ];

    const mathFormulaData = [
      { 'بند الحساب': 'إجمالي تذكرة الزيارة (Visit Cost)', 'المبلغ التقديري الافتراضي': 400, 'البيان الرياضي لخطوات الاحتساب المالي': 'إجمالي السعر المدفوع للحصول على الكشف أو الفحوصات بفرع الشفاء' },
      { 'بند الحساب': 'طبيب العيادة الممارس (Doctor Share)', 'المبلغ التقديري الافتراضي': 240, 'البيان الرياضي لخطوات الاحتساب المالي': 'المعادلة: (تكلفة الزيارة * نسبة أتعاب عقد الطبيب 60%) / 100' },
      { 'بند الحساب': 'صافي أرباح العيادة (Clinic Net)', 'المبلغ التقديري الافتراضي': 160, 'البيان الرياضي لخطوات الاحتساب المالي': 'المعادلة: تكلفة الزيارة - حصة الطبيب المعالج' },
      { 'بند الحساب': 'إجمالي فحص التحاليل المتعددة', 'المبلغ التقديري الافتراضي': 500, 'البيان الرياضي لخطوات الاحتساب المالي': 'الخدمات المساندة التي يقدمها المجمع لتأهيل الطبيب تشخيصياً' }
    ];

    const wb = XLSX.utils.book_new();
    const wsSteps = XLSX.utils.json_to_sheet(stepsData);
    const wsFormula = XLSX.utils.json_to_sheet(mathFormulaData);

    wsSteps['!dir'] = 'rtl';
    wsFormula['!dir'] = 'rtl';

    XLSX.utils.book_append_sheet(wb, wsSteps, 'مسارات تدريب الزملاء اليومي');
    XLSX.utils.book_append_sheet(wb, wsFormula, 'معادلات الحسابات والرواتب');

    XLSX.writeFile(wb, 'حقيبة_التدريب_النموذجية_مجمع_الشفاء.xlsx');
  };

  // Detailed Step Metadata Content with Screenshots Layout Mockups
  const stepsMetadata: Record<CatalogStepId, {
    title: string;
    icon: React.ReactNode;
    reason: string;
    fields: string[];
    details: string;
    credentials?: string;
    color: string;
    bgStyle: string;
    screenshotMock: React.ReactNode;
  }> = {
    login: {
      title: 'بوابة تسجيل الدخول والمحاكاة الآمنة',
      icon: <Key size={16} />,
      reason: 'الخطوة الأولى والأساسية لإثبات الهوية، قراءة الفرع الافتراضي النشط (المعادي / الدقي) لتصفية الجداول، وتحديد الصلاحيات المطبقة.',
      fields: [
        'اسم المستخدم الكامل (Username) لتحديد هوية صاحب الإجراء.',
        'كلمة الحماية والسرور المشفرة (Password) للتحقق الأمني.',
        'اسم فرع مجمع الشفاء الطبي المستهدف للعمليات كفرع افتراضي (المعادي / الدقي) لمنع تداخل المخزون والأدوية وحجوزات المواعيد.'
      ],
      details: 'من خلال البوابة، يسجل الموظف بيانات اعتماده أو يدخل فوراً بالضغط على حسابات المحاكاة للتدريب، ليقوم السيستم أوتوماتيكياً باهتداء فرعه المفضل، وتعديل لغات وواجهات الاستقبال والتحكم لمنع التشعب غير المسموح طبياً.',
      credentials: 'اسم الدخول: mamdouhyasin30 (أ. ممدوح ياسين - المدير العام) / موظف استقبال الشفاء (Receptionist) / د. علاء محمود العظام (Doctor)',
      color: 'text-amber-600 border-amber-500',
      bgStyle: 'bg-amber-500/10',
      screenshotMock: (
        <div className="border border-slate-200 rounded-xl bg-slate-900 text-white p-4 font-mono text-[9px] space-y-3 shadow-inner relative max-w-sm mx-auto text-right">
          <div className="absolute top-2 right-2 flex gap-1">
            <span className="size-1.5 rounded-full bg-red-500"></span>
            <span className="size-1.5 rounded-full bg-yellow-500"></span>
            <span className="size-1.5 rounded-full bg-green-500"></span>
          </div>
          <p className="text-center text-amber-400 font-bold border-b border-slate-800 pb-1.5">🔐 شاشة تسجيل الدخول ومحاكاة الحساب</p>
          <div className="space-y-1.5">
            <div>
              <span className="text-slate-400">اسم المستخدم المعتمد:</span>
              <div className="bg-slate-850 p-1 rounded font-sans pr-2 border border-slate-700 text-slate-200 mt-0.5">mamdouhyasin30</div>
            </div>
            <div>
              <span className="text-slate-400">كلمة السر (الباسورد):</span>
              <div className="bg-slate-850 p-1 rounded font-sans pr-2 border border-slate-700 text-slate-500 mt-0.5">•••••••••••••</div>
            </div>
            <div>
              <span className="text-slate-400">الفرع النشط الافتراضي الحالي:</span>
              <div className="bg-slate-850 p-1 rounded font-sans pr-2 border border-slate-700 text-emerald-400 font-bold mt-0.5">🏥 فرع المعادي الرئيسي</div>
            </div>
          </div>
          <button type="button" className="w-full py-1.5 bg-amber-500 text-slate-950 font-black rounded text-center cursor-default">
            تسجيل الحضور والدخول ➔
          </button>
        </div>
      )
    },
    dashboard: {
      title: 'لوحة التحكم والمؤشرات الكبرى',
      icon: <TrendingUp size={16} />,
      reason: 'رصد ملخص فوري وشامل لأداء العيادات ونسب الانتظار ومستويات الرصيد المخزني لليوم الحالي بالفرع بالدقيقة.',
      fields: [
        'عداد زيارات وكشوفات اليوم النشطة بفرعك الحالي لتقييم حركة الإشغال.',
        'عداد قاعدة المرضى الإجمالية المسجلين دفترياً.',
        'أعداد الطاقم الطبي والأطباء المتواجدين في الخدمة الآن.',
        'مؤشر بياني مستهدف لمستويات استغلال غرف الحالات.'
      ],
      details: 'تعتبر هذه الشاشة بمثابة رادار المجمع، تعرض لوحات وإحصائيات تفاعلية سهلة الفهم تلخص حركة المبيعات وتنبيهات الأدوية الناقصة حرجة الإمداد وإشارات الإستقبال بالصالة.',
      color: 'text-blue-600 border-blue-500',
      bgStyle: 'bg-blue-500/10',
      screenshotMock: (
        <div className="border border-slate-200 rounded-xl bg-white p-4 text-[9px] space-y-3 shadow-md max-w-sm mx-auto font-sans text-right">
          <div className="flex justify-between items-center border-b pb-1.5">
            <span className="font-extrabold text-slate-800">📊 لوحة المؤشرات الرئيسية للفرع</span>
            <span className="bg-blue-100 text-blue-800 text-[8px] px-1.5 py-0.5 rounded font-black">فرع المعادي</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 p-2 rounded border border-slate-100 text-center">
              <span className="text-slate-400 block text-[8px] font-bold">كشوفات اليوم</span>
              <span className="text-sm font-black text-slate-800">14 حالة</span>
            </div>
            <div className="bg-slate-50 p-2 rounded border border-slate-100 text-center">
              <span className="text-slate-400 block text-[8px] font-bold">المرضى النشطين</span>
              <span className="text-sm font-black text-slate-800">1,245 مريض</span>
            </div>
          </div>
          <div className="flex gap-1">
            <span className="bg-blue-50 p-1 rounded text-center block text-[7px] font-bold text-blue-700 flex-1 border border-blue-200">🤖 نداء آلي سريع</span>
          </div>
        </div>
      )
    },
    patients: {
      title: 'سجلات المرضى وتسجيل الحالة والملف الإلكتروني',
      icon: <Users size={16} />,
      reason: 'العمود الفقري لحفظ وتوثيق الأوراق الطبية للمرضى لمنع الأخطاء وتتبع الخطة العلاجية والضغط والسكر والقياسات الحيوية التاريخية بشكل مرئي.',
      fields: [
        'الاسم الرباعي الكامل للمريض لمنع التكرار اللفظي.',
        'رقم الهاتف المحمول الشخصي للتواصل السريع والمواعيد.',
        'الرقم القومي المدقق المكون من 14 رقماً لمنع تداخل هويات المواطنين.',
        'تاريخ الميلاد الدقيق ورصد فصيلة الدم والحساسية الطبية بدقة.',
        'الوزن، الطول، الضغط الشرياني، وقياس السكر الأولي للزيارة.'
      ],
      details: 'من خلال شاشة المرضى، يمكنك إدخال مريض جديد، تعبئة ملفه الطبي بالكامل، ورفع مرفقات كالأشعات والتحاليل الطبية بصيغة صور، وبناء خطة علاجية مئوية الإنجاز لمتابعة تطور الحالات والتاريخ الطبي.',
      color: 'text-emerald-600 border-emerald-500',
      bgStyle: 'bg-emerald-500/10',
      screenshotMock: (
        <div className="border border-slate-200 rounded-xl bg-white p-4 text-[9px] space-y-3 shadow-md max-w-sm mx-auto font-sans text-right">
          <div className="flex items-center gap-2 border-b pb-1.5">
            <div className="size-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 font-bold">م</div>
            <div>
              <span className="font-extrabold text-slate-800 block text-[10px]">محمد أحمد العباسي</span>
              <span className="text-slate-400 text-[8px]">الرقم القومي: 29505240105342</span>
            </div>
          </div>
          <div className="bg-slate-50 border p-2 rounded-xl text-center">
            <span className="text-[8px] font-black text-slate-500 block mb-1">📈 تتبع قياس ضغط الدم في أخر زيارات</span>
            <div className="flex justify-around items-end h-8 gap-2 pt-1">
              <div className="bg-blue-500 w-3 h-[60%] rounded-t-sm" title="ضغط: 120/80"></div>
              <div className="bg-red-500 w-3 h-[90%] rounded-t-sm" title="ضغط: 145/95"></div>
            </div>
          </div>
          <div className="p-1.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-100 text-[7px] font-mono font-bold text-center">
            الخطة العلاجية: علاج عصب أسنان من 4 جلسات (إنجاز: 75% ✓)
          </div>
        </div>
      )
    },
    appointments: {
      title: 'حجز المواعيد والتقرير اليومي المطبوع',
      icon: <Calendar size={16} />,
      reason: 'الجدولة الذكية ومنع تضارب حجوزات المريض مع مواعيد عيادات الدكتور بفرع المجمع، مع إتاحة طباعة الكشوف الطبية ذات أختام تفتيشية.',
      fields: [
        'اسم المريض والملف المستهدف للحجز.',
        'الطبيب المعالج، عيادة التخصص، وزمن وميعاد الزيارة باليوم والساعة.',
        'تحديد نوع الإجراء المطلوب (جديد / استشارة / خدمة علاجية).',
        'طوابع الاعتماد وتوقيع المدير الطبي بالتقرير المطبوع اليومي.'
      ],
      details: 'يقوم الاستقبال بحجز جدول الطبيب، ويفحص النظام آلياً وجود مواعيد سابقة للطبيب بنفس الساعة لمنع الانتظار الطويل في الصالة. ويوفر إمكانية طباعة النموذج اليومي للحجوزات ممهوراً بموقع رسمي لختم العيادة.',
      color: 'text-rose-600 border-rose-500',
      bgStyle: 'bg-rose-500/10',
      screenshotMock: (
        <div className="border border-slate-200 rounded-xl bg-white p-4 text-[9px] space-y-3 shadow-md max-w-sm mx-auto font-sans text-right">
          <p className="font-extrabold text-slate-800 text-center border-b pb-1.5 text-[9.5px]">🎫 تذكرة حجز كشف مريض مجدول</p>
          <div className="space-y-1 text-slate-600 font-bold">
            <div>• اسم الطبيب: <b className="text-slate-800">د. يوسف حسام (باطنية)</b></div>
            <div>• المريض: <b className="text-slate-800">عبدالرحمن عمر الصاوي</b></div>
            <div>• نوع الكشف: <span className="bg-rose-100 text-rose-800 px-1 py-0.2 rounded font-black text-[7.5px]">كشف جديد (عادي)</span></div>
          </div>
          <div className="border-t border-dashed pt-2 flex justify-between items-center text-[7.5px] text-slate-400">
            <div>التوقيع الطبي: ............</div>
            <div className="border border-slate-350 p-1 rounded-full font-black scale-95 border-dashed text-slate-400 select-none">
              ختم مجمع الشفاء 🏥
            </div>
          </div>
        </div>
      )
    },
    queue: {
      title: 'طابور النداء ونظام الاستدعاء الذكي بالعيادات',
      icon: <Megaphone size={16} />,
      reason: 'إقرار وتحديد مستويات الأسبقية طبياً، وتيسير حركة وسحب طوابير الحالات بالصالة مرئياً ومسموعاً.',
      fields: [
        'اسم المريض في صالة الاستقبال.',
        'اسم الدكتور المعالج والعيادة المصاحبة.',
        'علامة مستوى الخطورة والأولوية المقدرة (حالة طارئة حرجة جداً، فحص روتيني، استشارة عادية).'
      ],
      details: 'من صميم لوحة الاستقبال، تصنف الحالات عاجلة الطبية كحالات تاخذ اللون الأحمر وتصعد لقمة الطابور أوتوماتيكياً مع وميض ذكي يدعو الحالات للعيادة بصوت مسموع لترسيخ النظام والاستدامة.',
      color: 'text-purple-600 border-purple-500',
      bgStyle: 'bg-purple-500/10',
      screenshotMock: (
        <div className="border border-slate-200 rounded-xl bg-slate-950 text-slate-200 p-4 text-[9px] space-y-3 shadow-md max-w-sm mx-auto font-mono text-right relative overflow-hidden">
          <div className="absolute top-2 left-2 animate-ping size-2 rounded-full bg-red-500"></div>
          <div className="border-b border-slate-800 pb-1.5 flex justify-between items-center">
            <span className="font-extrabold text-purple-400">🔊 شاشة النداء الصوتي الآلي</span>
            <span className="text-[7px] text-slate-500">بث حي 📡</span>
          </div>
          <div className="p-1.5 bg-red-950/70 border border-red-800 rounded flex justify-between items-center animate-pulse">
            <span className="bg-red-650 text-white px-1 rounded text-[7px] font-bold">🔴 أولوية حرجة / طوارئ</span>
            <span className="font-bold text-white text-[9.5px]">المريض: كامل السويركي</span>
          </div>
          <p className="text-center text-[7.5px] text-purple-300 font-bold bg-purple-950/40 p-1 rounded border border-purple-900">
            يرجى من المريض كامل السويركي التوجه لعيادة الباطنة
          </p>
        </div>
      )
    },
    inventory: {
      title: 'المستودع والمخازن وإدارة صيدلية المجمع',
      icon: <Activity size={16} />,
      reason: 'الرقابة والجرد الصارم لأرصدة ومستهلكات الطبابة كالمسكنات والمحاقن وتفادي نفاد الأدوية الحرجة.',
      fields: [
        'كود تعريف الصنف الإداري الموحد (ID Code).',
        'اسم الصنف الطبي والعلاج الكيميائي بدقة والعيارية.',
        'الكمية الحالية المتاحة بالمخزن.',
        'الحد الأدنى الحرج للتنبيه (Reorder level point) الذي يثير إنذاراً عند هبوط الرصيد لتغذية المجمع فوراً.'
      ],
      details: 'من هنا تراقب وترصد الأصناف. يفرز المخزن بياناته حسب فرع الاستقبال، ويعرض بإضاءات حمراء الأصناف التي أوشكت على النفاد في رف عيادة فرع المعادي أو الدقي للتوجيه العملي السريع.',
      color: 'text-teal-600 border-teal-500',
      bgStyle: 'bg-teal-500/10',
      screenshotMock: (
        <div className="border border-slate-200 rounded-xl bg-white p-4 text-[9px] space-y-3 shadow-md max-w-sm mx-auto font-sans text-right">
          <div className="flex justify-between items-center border-b pb-1.5">
            <span className="font-extrabold text-slate-800">📦 واجهة مراقبة رصيد الصيدلية</span>
            <span className="text-slate-400 text-[8px]">فرع المعادي</span>
          </div>
          <div className="border rounded p-1.5 bg-rose-50 flex justify-between items-center">
            <span className="font-bold text-slate-800">أنسولين مائي 100ملم</span>
            <span className="font-mono bg-red-500 text-white font-black px-1.5 rounded text-[8px]">6 حبات - نقص حرج ⚠</span>
          </div>
        </div>
      )
    },
    finance: {
      title: 'الحسابات وسجل رواتب الأطباء المالي والنسب',
      icon: <DollarSign size={16} />,
      reason: 'ضبط وتوزيع العوائد المالية للكشوف الطبيب والعيادات بنسبة خطا 0% بالاعتماد التام على معادلات التسويات الدفترية.',
      fields: [
        'مستويات أسعار الكشف الحقيقية وتذاكر الزيارات المسددة.',
        'النسبة المئوية الشخصية لكل دكتور مدونة في العقد التشغيلي (مثل 60%).',
        'تحديد فترة الحساب وتوزيع جدول الرواتب Payroll.'
      ],
      details: 'تتم التسوية ديناميكياً عن طريق جرد إجمالي محفظة الكشوفات بفرع مجمع الشفاء، وضرب النسبة لحساب مقدار أجر الطبيب، وترحيل باقي عوائد التذكرة إيراداً تشغيلياً للمجمع لتغذية الاستشارات ومقارنة النشاط المالي بين فرع الدقي وفرع المعادي ببيانات واضحة.',
      color: 'text-indigo-600 border-indigo-500',
      bgStyle: 'bg-indigo-500/10',
      screenshotMock: (
        <div className="border border-slate-200 rounded-xl bg-white p-4 text-[9px] space-y-3 shadow-md max-w-sm mx-auto font-sans text-right">
          <p className="font-extrabold text-slate-800 text-center border-b pb-1.5 text-[9.5px]">💰 ميزان توزيع الإيرادات والأرباح</p>
          <div className="space-y-1 text-[8px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-150">
            <div className="flex justify-between">
              <span>إجمالي قيمة الكشوفات:</span>
              <span className="font-mono text-slate-900 font-extrabold">240,500 ج.م</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-blue-700">
              <span>أتعاب مستحقة للأطباء (60%):</span>
              <span className="font-mono font-extrabold">144,300 ج.م</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-emerald-700">
              <span>صافي أرباح مجمع الشفاء (40%):</span>
              <span className="font-mono font-extrabold">96,200 ج.م</span>
            </div>
          </div>
        </div>
      )
    },
    doctors: {
      title: 'إدارة طاقم الأطباء ونسب التعاقد التشغيلية',
      icon: <Settings size={16} />,
      reason: 'الرقابة والتوجيه اللوجستي الكامل على الكادر الطبي، وتعيين أسعار الكشوفات الفردية ونظام تصفية الرواتب بنسبة أمان مطلقة.',
      fields: [
        'اسم الطبيب رباعياً والتخصص الدقيق الملائم للقسم الطبي.',
        'نظام التعاقد الحسابي (أجر ثابت بالشهر، نسبة مئوية مقتطعة، نوبتجية يومية، أو نظام هجين).',
        'معدل ونسبة التعاقد (مثال: 60% للطبيب و40% لإيراد مجمع الشفاء).',
        'أيام وساعات الدوام والعدد الأقصى للحالات اليومية المأذونة.'
      ],
      details: 'من خلال شاشة الأطباء المتقدمة، يستطيع مدير المخصصات تعيين نسب اقتطاع التذاكر بشكل دقيق، وإرجاع الأداء الشهري للطبيب بالبيانات الحية، مع إتاحة تفعيل أو إيقاف الأطباء بفرعي المعادي والدقي للتوافق مع جدول التعويضات.',
      color: 'text-cyan-600 border-cyan-500',
      bgStyle: 'bg-cyan-500/10',
      screenshotMock: (
        <div className="border border-slate-200 rounded-xl bg-white p-4 text-[9px] space-y-3 shadow-md max-w-sm mx-auto font-sans text-right">
          <p className="font-extrabold text-slate-800 text-center border-b pb-1.5 text-[9.5px]">🩺 السجل العملي لعقود ونسب الأطباء المعينين</p>
          <div className="space-y-1.5 text-[8.5px] text-slate-600 font-bold">
            <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-150">
              <span className="text-slate-900 font-black">د. أحمد سمير (باطنية)</span>
              <span className="bg-cyan-150 text-cyan-800 px-1.5 py-0.5 rounded font-black text-[7.5px]">العقد: %60 نسبة</span>
            </div>
            <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-150">
              <span className="text-slate-900 font-black">د. رانيا يوسف (أطفال)</span>
              <span className="bg-cyan-150 text-cyan-800 px-1.5 py-0.5 rounded font-black text-[7.5px]">العقد: %55 نسبة</span>
            </div>
          </div>
        </div>
      )
    },
    rooms: {
      title: 'إدارة وتوزيع غرف العيادات وتلافي التداخل اللوجستي',
      icon: <Layers size={16} />,
      reason: 'توزيع غرف الأطباء وتحديد السعة التشغيلية المكانية مع استعراض الأجهزة الطبية المتوفرة بكل عيادة تفادياً للتضارب.',
      fields: [
        'معرف أو رقم الغرفة أو العيادة الاسترشادي داخل المجمع (رمز الغرفة).',
        'القسم الطبي والتخصص المستهدف (أطفال، علاج طبيعي، باطنة، عظام).',
        'الحالة اللوجستية الراهنة للغرفة (جاهزة للاستعمال، تحت صيانة المعدات، صيانة وتعقيم شامل).',
        'الطبيب النشط حالياً والمكلف بالخدمة فيها في الوردية.'
      ],
      details: 'تتحكم هذه الميزة في إدارة الطاقة في الفروع المختلفة، وتثبت جدول الطبيب المكلف في الغرفة بالفرع، مما يسمح للنداء الصوتي بتوجيه الحالات مباشرة وتجنب إحداث أي ارتباك صفي أو تكدس في ممرات وغرف المجمع.',
      color: 'text-orange-600 border-orange-500',
      bgStyle: 'bg-orange-500/10',
      screenshotMock: (
        <div className="border border-slate-200 rounded-xl bg-white p-4 text-[9px] space-y-3 shadow-md max-w-sm mx-auto font-sans text-right">
          <div className="flex justify-between border-b pb-1.5">
            <span className="font-extrabold text-slate-800">🏥 خريطة عيادات وغرف المجمع</span>
            <span className="text-orange-600 font-bold text-[8px]">فرع المعادي</span>
          </div>
          <div className="space-y-1.5 text-[8px] font-bold">
            <div className="flex justify-between bg-emerald-50 text-emerald-800 p-2 rounded border border-emerald-100">
              <span>🚪 عيادة 101 - باطنية</span>
              <span>نشطة - د. يوسف حسام</span>
            </div>
            <div className="flex justify-between bg-amber-50 text-amber-800 p-2 rounded border border-amber-100">
              <span>🚪 عيادة 102 - الأسنان</span>
              <span>تحت التعقيم الفوري 🧴</span>
            </div>
          </div>
        </div>
      )
    },
    schedule: {
      title: 'جدول المواعيد العام ومخطط توزيع الحجوزات اليومي',
      icon: <Calendar size={16} />,
      reason: 'أتمتة حجوزات الاستشارات والكشوفات مع الفلترة باليوم والفرع وتفادي التضارب التام بالدقيقة والخلل المزدوج للطبيب.',
      fields: [
        'اسم المريض الكامل وهويته بالسيستم.',
        'الدكتور المعالج، تخصص العيادة، وموعد الفتح.',
        'فترة الحجز الدقيقة (اليوم، الساعة، رمز الوردية).',
        'طريقة الفرز (باليوم الحالي، الفرع، أو تصفية باسم طبيب معين).'
      ],
      details: 'من خلال شاشة الجدولة، تظهر قائمة خطية أو تقويمية للمواعيد المعينة بالفرع النشط، مع التحقق من شغولية الدكتور المطلوب لمنع تعارض مواعيد الزيارات وحفظ البيانات التشغيلية للعيادة في قالب يسهل تصديره.',
      color: 'text-pink-600 border-pink-500',
      bgStyle: 'bg-pink-500/10',
      screenshotMock: (
        <div className="border border-slate-200 rounded-xl bg-white p-4 text-[9px] space-y-3 shadow-md max-w-sm mx-auto font-sans text-right">
          <p className="font-extrabold text-slate-800 text-center border-b pb-1.5 text-[9.5px]">📅 مخطط توزيع جدول الحجوزات اليومي</p>
          <div className="space-y-1.5 text-[8px] font-bold text-slate-650">
            <div className="flex justify-between border-b pb-1">
              <span>⏰ 12:00 م - 12:30 م</span>
              <span className="text-slate-800">المريض: أحمد عسيري</span>
            </div>
            <div className="flex justify-between border-b pb-1 text-rose-600 bg-rose-50 p-1.5 rounded">
              <span>⏰ 12:30 م - 01:00 م</span>
              <span>🚨 تعارض موعد د. يوسف حسام!</span>
            </div>
          </div>
        </div>
      )
    },
    messages: {
      title: 'الدردشة وحوكمة المراسلات والتوجيهات الداخلية الكلية',
      icon: <Megaphone size={16} />,
      reason: 'تسهيل قنوات نقل البيانات الفورية بين موظفي الاستقبال وأطباء فرعي المعادي والدقي وإيصال التعليمات اللحظية المعتمدة.',
      fields: [
        'معرف أو اسم الموظف المرسل والصلاحية (استقبال، أدمن، طبيب).',
        'الطرف الآخر المستلم أو القسم الطبي الحاضر (أخصائيو الباطنة، الصيدلية ومخازن الأدوية).',
        'عنوان المذكرة وتوجيه المضمون المكتوب مع تأشير مستوى الخطورة.',
        'تأشير القراءة وموعد الإطلاق والوصول.'
      ],
      details: 'يسمح نظام المراسلات المدمج بتواصل الطاقم في منصة واحدة آمنة لا تتطلب اللجوء لتطبيقات الدردشة الخارجية، مما يدعم سرعة سحب أجهزة الاستنشاق أو طلب دفعة أنسولين إضافية بفرز تلقائي وعجالة.',
      color: 'text-indigo-600 border-indigo-500',
      bgStyle: 'bg-indigo-500/10',
      screenshotMock: (
        <div className="border border-slate-200 rounded-xl bg-white p-4 text-[9px] space-y-3 shadow-md max-w-sm mx-auto font-sans text-right">
          <div className="flex justify-between items-center border-b pb-1.5">
            <span className="font-extrabold text-slate-800">💬 مراسلات مجمع الشفاء الداخلية</span>
            <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-black text-[7px] animate-pulse">هام جداً 🚨</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-150">
            <div className="flex justify-between text-slate-400 font-extrabold mb-1 text-[7px]">
              <span>المدير الطبي: ممدوح ياسين</span>
              <span>02:30 م</span>
            </div>
            <p className="text-slate-850 font-bold leading-normal text-[8px]">يرجى مطابقة كشوف الحسابات وتذاكر الزيارات المسددة مع الخزينة النقدية اليوم قبل إغلاق النوبات اليومية بالفروع.</p>
          </div>
        </div>
      )
    },
    audit: {
      title: 'سجل العمليات التاريخي والرقابة والأمان (الصندوق الأسود)',
      icon: <FileText size={16} />,
      reason: 'تأمين الحوكمة المطلقة والتدقيق التفتيشي لجميع حركات الإضافة والتعديل أو تعديل نسب الطبيب ومكافحة السهو البشري.',
      fields: [
        'معرف الأمان للعملية (Log ID) والوقت الدقيق بالثانية.',
        'الحساب والمنفذ للإجراء (مثل: mamdouhyasin30).',
        'طبيعة وموقع الحدث (المعادي، الدقي) والإجراء الكلي (الإلغاء، تعديل، صرف).',
        'نص العملية والمحتوى قبل وبعد التحديث.'
      ],
      details: 'يمارس سجل الرقابة دور الصندوق الأسود الإداري، ويحظر على أي مستخدم بالسيستم بما فيهم طاقم الإدارة العام حذف أو تعديل أي سجلات تاريخية، مما يعزز الحماية ومطابقة جرد الصيدلية ويوثق كفاءة العمل.',
      color: 'text-slate-600 border-slate-500',
      bgStyle: 'bg-slate-500/10',
      screenshotMock: (
        <div className="border border-slate-200 rounded-xl bg-slate-900 text-emerald-400 p-4 font-mono text-[7.5px] space-y-1.5 shadow-inner max-w-md mx-auto text-right">
          <p className="border-b border-slate-800 pb-1 text-slate-400 font-black">🛡️ سجل تتبع حركات النظام الفورية (Audit Log)</p>
          <div className="space-y-1 font-bold">
            <div><span className="text-slate-500">[14:45:10]</span> [المعادي] <b className="text-white">mamdouhyasin30</b> أضاف الدكتور: أحمد سمير</div>
            <div><span className="text-slate-500">[14:52:01]</span> [الدقي] <b className="text-white">Reception_M</b> حدّث موعد الحجز للمريض محمد أحمد</div>
            <div><span className="text-slate-500">[14:55:30]</span> [النظام] <b className="text-white">Admin</b> وافق على تقرير تسوية رواتب عيادات الشفاء</div>
          </div>
        </div>
      )
    }
  };

  const handleNextStep = () => {
    const sequence: CatalogStepId[] = ['login', 'dashboard', 'patients', 'appointments', 'doctors', 'rooms', 'schedule', 'queue', 'inventory', 'finance', 'messages', 'audit'];
    const index = sequence.indexOf(activeStep);
    if (index < sequence.length - 1) {
      setActiveStep(sequence[index + 1]);
    } else {
      setActiveStep(sequence[0]);
    }
  };

  const handlePrevStep = () => {
    const sequence: CatalogStepId[] = ['login', 'dashboard', 'patients', 'appointments', 'doctors', 'rooms', 'schedule', 'queue', 'inventory', 'finance', 'messages', 'audit'];
    const index = sequence.indexOf(activeStep);
    if (index > 0) {
      setActiveStep(sequence[index - 1]);
    } else {
      setActiveStep(sequence[sequence.length - 1]);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[150] flex items-center justify-center p-4 overflow-hidden select-none font-sans" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
      >
        {/* Top Header Card */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-500/20">
              <BookOpen size={22} />
            </div>
            <div>
              <h2 className="font-extrabold text-sm flex items-center gap-2 header-title tracking-tight">
                <span>📖 الكتالوج التفصيلي المطور ودليل تدريب الزملاء</span>
                <span className="bg-emerald-500 text-slate-950 text-[9px] px-2 py-0.5 rounded-full font-black animate-pulse">إصدار 2026 الذهبي</span>
              </h2>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">دليل شامل مدعم بالصور التفسيرية، والمدخلات المطلوبة، والأغراض لكل أداة بالسيستم</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 px-3 border border-slate-700 hover:border-slate-500 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all text-xs flex items-center gap-1.5 cursor-pointer font-bold"
          >
            إغلاق الكتالوج <X size={14} />
          </button>
        </div>

        {/* Tab Controls Menu */}
        <div className="bg-slate-100 border-b border-slate-200 p-3 px-6 flex flex-wrap gap-3 justify-between items-center shrink-0">
          <div className="flex bg-slate-200/80 p-1 rounded-xl">
            <button 
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`px-5 py-2 rounded-lg text-[11px] font-black transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'guide' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Layers size={14} /> الدليل التدريبي التفسيري المدعم بالصور والمدخلات
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('calculator')}
              className={`px-5 py-2 rounded-lg text-[11px] font-black transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'calculator' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Calculator size={14} /> محاكي الحسابات الرياضي لتدريب الزملاء
            </button>
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportWord}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-1.5 px-4 text-[10.5px] font-black flex items-center gap-1.5 shadow-md shadow-blue-500/10 transition-all active:scale-[0.97] cursor-pointer"
            >
              <Download size={13} /> تحميل كـ Word (.doc)
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg p-1.5 px-4 text-[10.5px] font-black flex items-center gap-1.5 shadow-md shadow-emerald-500/10 transition-all active:scale-[0.97] cursor-pointer"
            >
              <Table size={13} /> تحميل كـ Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={handlePrintPDF}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg p-1.5 px-4 text-[10.5px] font-black flex items-center gap-1.5 shadow-md shadow-rose-500/10 transition-all active:scale-[0.97] cursor-pointer"
            >
              <Printer size={13} /> طباعة وتحميل كـ PDF 📄
            </button>
          </div>
        </div>

        {/* Core Body Container */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row font-sans">
          
          {/* Main Handbook Tab */}
          {activeTab === 'guide' && (
            <>
              {/* Left Side: Steps Menu */}
              <div className="w-full md:w-72 bg-slate-50 border-l border-slate-200 overflow-y-auto p-4 shrink-0 space-y-1.5">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2 border-b pb-1">⚙️ أقسام وأدوات السيستم</span>
                
                {(Object.keys(stepsMetadata) as CatalogStepId[]).map((key, idx) => {
                  const step = stepsMetadata[key];
                  const isSelected = activeStep === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveStep(key)}
                      className={`w-full text-right p-2.5 rounded-xl border transition-all flex items-center gap-2 cursor-pointer relative overflow-hidden ${isSelected ? 'bg-white border-blue-500 shadow-sm text-blue-900 font-extrabold' : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`}
                    >
                      {isSelected && <span className="absolute right-0 top-0 bottom-0 w-1 bg-blue-600"></span>}
                      <span className={`p-1.5 rounded-lg ${isSelected ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                        {step.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] block truncate">{step.title}</span>
                        <span className="text-[8.5px] text-slate-400 block font-normal mt-0.5">الباب {idx + 1}</span>
                      </div>
                    </button>
                  );
                })}

                <div className="pt-3 mt-3 border-t border-slate-200 space-y-2">
                  <div className="p-2.5 bg-blue-50/50 border border-blue-100 rounded-xl">
                    <span className="text-[9.5px] font-black text-blue-800 flex items-center gap-1">
                      <Info size={12} /> تلميح لتدريب المشرفين
                    </span>
                    <p className="text-[8.5px] text-slate-500 font-bold leading-relaxed mt-1">
                      اتبع الترتيب التسلسلي من تسجيل الدخول وصولاً للحسابات لإدخال سيناريوهات تدريبية حقيقية بنسبة كفاءة تامة.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Side: Step Content Area */}
              <div className="flex-1 overflow-y-auto p-6 bg-white flex flex-col justify-between">
                <div>
                  {/* Step Title Flag */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b pb-3 border-slate-150">
                    <div>
                      <span className="bg-slate-100 text-slate-700 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                        الدليل المرجعي التفصيلي بالسيستم 📂
                      </span>
                      <h3 className="text-sm font-black text-slate-800 mt-1 flex items-center gap-2">
                        <span className="p-1 px-2.5 bg-blue-600 text-white rounded-lg text-xs">
                          {Object.keys(stepsMetadata).indexOf(activeStep) + 1}
                        </span>
                        {stepsMetadata[activeStep].title}
                      </h3>
                    </div>
                    {/* Navigation buttons inside catalog */}
                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={handlePrevStep} 
                        className="p-1 px-3 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-600 flex items-center gap-1 cursor-pointer"
                      >
                        السابق <ChevronRight size={14} />
                      </button>
                      <button 
                        type="button" 
                        onClick={handleNextStep} 
                        className="p-1 px-3 bg-blue-50 hover:bg-blue-100 rounded-lg text-xs font-bold text-blue-700 flex items-center gap-1 cursor-pointer"
                      >
                        اللاحق <ChevronLeft size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Information Column */}
                    <div className="lg:col-span-7 space-y-4">
                      <div className="p-4 bg-slate-50 border border-slate-200-80 rounded-2xl space-y-1.5">
                        <span className="text-[9px] font-extrabold text-blue-800 p-1 px-2 rounded bg-blue-50 inline-block uppercase pb-0.5">
                          💡 طفرة وسبب إدراج وجود الأداة للقائمة (Reason of use)
                        </span>
                        <p className="text-[10.5px] text-slate-750 font-bold leading-relaxed">
                          {stepsMetadata[activeStep].reason}
                        </p>
                      </div>

                      <div className="p-4 bg-slate-50 border border-slate-200-80 rounded-2xl space-y-1.5">
                        <span className="text-[9px] font-extrabold text-indigo-800 p-1 px-2 rounded bg-indigo-50 inline-block uppercase pb-0.5">
                          📝 البيانات والمدخلات المطلوبة بالتفصيل (Required Field Parameters)
                        </span>
                        <ul className="text-[10px] text-slate-600 font-bold space-y-1.5 list-disc list-inside mt-2 pr-2">
                          {stepsMetadata[activeStep].fields.map((field, idx) => (
                            <li key={idx} className="leading-relaxed">
                              {field}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-4 bg-slate-50 border border-slate-200-80 rounded-2xl space-y-1.5">
                        <span className="text-[9px] font-extrabold text-teal-850 p-1 px-2 rounded bg-teal-50 inline-block uppercase pb-0.5">
                          ⚙️ تفاصيل مسار وطريقة التشغيل (Workflow details)
                        </span>
                        <p className="text-[10.5px] text-slate-650 leading-relaxed text-justify font-normal">
                          {stepsMetadata[activeStep].details}
                        </p>
                      </div>

                      {stepsMetadata[activeStep].credentials && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
                          <Shield size={14} className="text-amber-600" />
                          <div>
                            <span className="text-[8px] uppercase tracking-wider block font-extrabold text-amber-800">بيانات المحاكاة والاعتماد (Demo configuration)</span>
                            <p className="text-[9px] text-amber-800 font-bold mt-0.5">{stepsMetadata[activeStep].credentials}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Styled High-Fidelity Mockup (Screenshot Representation) */}
                    <div className="lg:col-span-5 space-y-4">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block text-center lg:tracking-wider">
                        🖼️ صورة تفسيرية لشكل الشاشة (Screen View)
                      </span>
                      <div className="p-4 bg-gradient-to-tr from-slate-100 to-slate-200 border border-slate-300 rounded-2xl shadow-sm relative overflow-hidden flex flex-col items-center justify-center min-h-[250px]">
                        <div className="absolute top-2 left-2 text-[8px] bg-slate-800 text-slate-400 p-0.5 px-2 rounded-full font-bold">
                          {customScreenshots[activeStep] ? '📸 صورة مخصصة مرفوعة' : 'معاينة بمحاكاة ذكية 📊'}
                        </div>
                        {customScreenshots[activeStep] ? (
                          <div className="w-full text-center">
                            <img 
                              src={customScreenshots[activeStep]} 
                              alt={`${stepsMetadata[activeStep].title} screenshot`}
                              className="w-full h-auto max-h-[180px] object-contain rounded-lg border border-slate-300 bg-white shadow-md mx-auto mt-4"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="w-full mt-4">
                            {stepsMetadata[activeStep].screenshotMock}
                          </div>
                        )}

                        {/* File Upload Trigger */}
                        <div className="mt-4 flex flex-wrap gap-1.5 w-full justify-center">
                          <label className="cursor-pointer bg-slate-800 hover:bg-slate-900 border border-slate-700 text-white rounded-lg p-1.5 px-2.5 text-[9px] font-black flex items-center gap-1 transition-all active:scale-95">
                            <Upload size={11} /> تحميل لقطة شاشة حقيقية
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleUploadScreenshot(activeStep, e.target.files[0]);
                                }
                              }}
                            />
                          </label>
                          {customScreenshots[activeStep] && (
                            <button
                              type="button"
                              onClick={() => handleDeleteScreenshot(activeStep)}
                              className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg p-1.5 px-2 text-[9px] font-black flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Trash2 size={11} /> حذف الصورة
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-center">
                        <p className="text-[8px] text-slate-500 font-bold leading-normal">
                          * الصورة بأعلاه تمثل لقطة الشاشة التدريبية، يمكنك رفع صورة حقيقية مخصصة لحسابك للتدريب العملي.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom navigation helper */}
                <div className="border-t border-slate-100 pt-4 mt-4 flex justify-between items-center text-[10px] text-slate-500 font-bold">
                  <span>التبويب النشط: {stepsMetadata[activeStep].title} 🏥</span>
                  <span>خطوات تدريب موظفي مجمع الشفاء التخصصي</span>
                </div>
              </div>
            </>
          )}

          {/* Calculator Tab */}
          {activeTab === 'calculator' && (
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
              <div className="max-w-3xl mx-auto space-y-6">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                    <Calculator size={18} className="text-blue-600" />
                    محاكي الحسابات الرياضية وتصفية رواتب للأطباء
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold mt-1 leading-relaxed">
                    استخدم هذا المحاكي العملي المطور لتدريب الزملاء بفرع المعادي أو الدقي على معادلات الاحتساب الذاتي للنسب وتقاسم المبالغ الكشوف الدقيقة لمنع السهو أو التلفيات الدفترية.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Cost visit input */}
                  <div className="bg-white border rounded-xl p-4 shadow-sm space-y-1.5">
                    <label className="text-[10.5px] font-bold text-slate-650 block">💵 تكلفة الكشف / الزيارة للمريض (Visit Cost)</label>
                    <input 
                      type="number" 
                      value={calcCost}
                      onChange={(e) => setCalcCost(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-blue-500 rounded-lg p-2 font-mono text-xs font-extrabold text-right transition-all outline-none"
                    />
                    <span className="text-[8.5px] text-slate-400 block font-normal">المبلغ الذي ييسده المريض للاستقبال للحجز.</span>
                  </div>

                  {/* Doctor contract percentage */}
                  <div className="bg-white border rounded-xl p-4 shadow-sm space-y-1.5">
                    <label className="text-[10.5px] font-bold text-slate-650 block">📈 نسبة الطبيب المتعاقد عليها بالعقد (Doctor %)</label>
                    <input 
                      type="number" 
                      value={calcDocShare}
                      onChange={(e) => setCalcDocShare(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-blue-500 rounded-lg p-2 font-mono text-xs font-extrabold text-right transition-all outline-none"
                    />
                    <span className="text-[8.5px] text-slate-400 block font-normal">أتعاب أخصائي العيادة بالعقد (مثلاً %60).</span>
                  </div>

                  {/* Quantity simulated */}
                  <div className="bg-white border rounded-xl p-4 shadow-sm space-y-1.5">
                    <label className="text-[10.5px] font-bold text-slate-650 block">👥 إجمالي كشوف الحالات بمجموع العمليات</label>
                    <input 
                      type="number" 
                      value={calcQuantity}
                      onChange={(e) => setCalcQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-blue-500 rounded-lg p-2 font-mono text-xs font-extrabold text-right transition-all outline-none"
                    />
                    <span className="text-[8.5px] text-slate-400 block font-normal">عدد المرضى الفعليين في عينة المحاسبة.</span>
                  </div>
                </div>

                {/* Math Outcomes display */}
                <div className="bg-white border rounded-2xl p-6 shadow-sm divide-y divide-slate-100">
                  <div className="pb-4 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-extrabold text-slate-800 block text-[11px]">مستحقات الطبيب المعالج للحالة الفردية</span>
                      <span className="text-[8.5px] text-slate-400 font-bold">المعادلة: (تكلفة الزيارة × نسبة عقد الطبيب) / 100</span>
                    </div>
                    <div className="text-left">
                      <span className="font-mono text-blue-600 font-black text-sm block">{calculatedDocEarnings} ج.م</span>
                      <span className="text-[8px] bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded font-bold">صافي مستحقات الدكتور</span>
                    </div>
                  </div>

                  <div className="py-4 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-extrabold text-slate-800 block text-[11px]">أرباح مجمع الشفاء للزيارة الفردية</span>
                      <span className="text-[8.5px] text-slate-400 font-bold">المعادلة: تكلفة الزيارة - مستحقات الطبيب</span>
                    </div>
                    <div className="text-left">
                      <span className="font-mono text-emerald-600 font-black text-sm block">{calculatedClinicEarnings} ج.م</span>
                      <span className="text-[8px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-bold">صافي عوائد العيادة</span>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-extrabold text-slate-800 block text-[11px]">إجمالي التذكرة الكلي للحملة والرواتب</span>
                      <span className="text-[8.5px] text-slate-400 font-bold">المعادلة: تكلفة الزيارة × المجموع</span>
                    </div>
                    <div className="text-left">
                      <span className="font-mono text-indigo-600 font-black text-sm block">{totalCalculatedBatch} ج.م</span>
                      <span className="text-[8px] bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded font-bold">إجمالي المبيعات</span>
                    </div>
                  </div>
                </div>

                {/* High contrast note */}
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl flex items-start gap-2.5">
                  <Activity size={18} className="text-teal-650 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-extrabold text-teal-850 text-[11px] block">✓ المطابقة الرياضية الذاتية بنسبة خطأ %0</span>
                    <p className="text-[9.5px] text-slate-600 font-bold mt-1 leading-normal">
                      عند التنزيل لملف Excel المرفق، ستجد كشوف معادلات الحسابات الرياضية مخزنة جاهزة ليتم تصفية حصص الأطباء تلقائياً لتفادي سوء الاتفاقات أو النماذج الدفترية.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Credit Area */}
        <div className="bg-slate-100 p-3 px-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 font-bold shrink-0">
          <span>مجمع الشفاء الطبي التخصصي - الحقيبة التدريبية المعتمدة (2026) 🏥</span>
          <span className="text-slate-500">تم المراجعة والاعتماد بواسطة: الأستاذ ممدوح ياسين والطاقم الطبي</span>
        </div>
      </motion.div>

      {/* Scoped CSS Style For Direct Print Functionality */}
      <style>{`
        @media print {
          /* Hide the normal modal overlay on print, only show manual-root */
          body > *, #root > * {
            visibility: hidden !important;
            height: 0 !important;
            overflow: hidden !important;
          }
          #training-print-manual-root, #training-print-manual-root * {
            visibility: visible !important;
          }
          #training-print-manual-root {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            color: black !important;
            direction: rtl !important;
          }
        }
      `}</style>

      {/* Printable Area - Rendered off-screen, visible ONLY on print */}
      <div id="training-print-manual-root" className="hidden print:block text-right p-8 font-sans bg-white text-slate-900" dir="rtl">
        <div className="border-b-4 border-slate-900 pb-4 text-center mb-8">
          <h1 className="text-3xl font-black text-slate-900">🏥 مجمع الشفاء الطبي التخصصي وشركة الشفاء الطبية</h1>
          <h2 className="text-lg font-bold text-slate-600 mt-2">الحقيبة التدريبية ودليل التوجيه التشغيلية الشاملة للفروع</h2>
          <p className="text-xs text-slate-400 mt-1">تصدير رقمي معتمد لعام 2026</p>
        </div>

        <div className="space-y-8">
          <section className="border-b pb-4">
            <h3 className="text-lg font-black text-slate-800">📌 الفصل الأول: مقدمة ورسالة النظام</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed text-justify">
              يهدف نظام مجمع الشفاء الطبي إلى إدارة الدورة الطبية والمالية والتنظيمية المتكاملة لجميع فروع المجمع (تفرعات المعادي والدقي)، وضبط كشوف تسجيل الحضور للأطباء، وموازنة حصص الرواتب وعقد الأخصائيين لضمان الشفافية ومطابقتها دفترياً، إلى جانب أتمتة الصيدلية والتحاليل والنداء الصوتي الذكي في صالات الانتظار.
            </p>
          </section>

          <section className="border-b pb-4">
            <h3 className="text-lg font-black text-slate-800">🔐 الفصل الثاني: مسارات تسجيل الدخول ومحاكاة الصلاحيات</h3>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-right border-collapse text-[10px] border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="p-2 border">الدور الوظيفي</th>
                    <th className="p-2 border">بيانات الدخول الافتراضية</th>
                    <th className="p-2 border">الأهداف والمهام من الشاشة</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2 border font-bold">مدير المجمع (Admin)</td>
                    <td className="p-2 border">ممدوح ياسين (المدير الكلي)</td>
                    <td className="p-2 border">إدارة الفروع، تفعيل الأطباء والرواتب والمستودعات الإستراتيجية.</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 border font-bold">أخصائي الاستقبال</td>
                    <td className="p-2 border">موظف استقبال الشفاء</td>
                    <td className="p-2 border">تسجيل وحجز الكشوفات، وتعديل بيانات المرضى واستدعاء الحالات.</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 border font-bold">الأطباء والعيادات</td>
                    <td className="p-2 border">أطباء الفروع والجراحة</td>
                    <td className="p-2 border">عرض الملفات الموحدة، قياسات العينات الحيوية، والتشخيص الدوائي والتحاليل.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-6">
            <h3 className="text-lg font-black text-slate-800 border-b pb-2">📋 الفصل الثالث: خطوات التشغيل اليومية والمدخرات الطبية</h3>
            {(Object.keys(stepsMetadata) as CatalogStepId[]).map((key, index) => {
              const step = stepsMetadata[key];
              const customImg = customScreenshots[key];
              return (
                <div key={key} className="border border-slate-300 p-4 rounded-xl space-y-3 break-inside-avoid">
                  <h4 className="font-black text-sm text-blue-800">{index + 1}. {step.title}</h4>
                  <p className="text-xs text-slate-600 font-bold"><b>الغرض البرمجي: </b>{step.reason}</p>
                  <p className="text-xs text-slate-700 leading-relaxed text-justify"><b>شرح طريقة العمل: </b>{step.details}</p>
                  <div className="text-[10px] text-slate-500">
                    <b>المدخلات الأساسية المطلوبة:</b> {step.fields.join(' - ')}
                  </div>
                  {customImg ? (
                    <div className="text-center mt-2">
                      <p className="text-[9px] text-slate-400 mb-1">📸 لقطة الشاشة المرفقة المخصصة:</p>
                      <img src={customImg} className="max-h-[170px] mx-auto object-contain border rounded" referrerPolicy="no-referrer" />
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-dashed rounded p-3 text-center text-slate-400 text-[10px] mt-2">
                      [الصورة المرفقة للسيستم: {step.title}]
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          <section className="border-t pt-4">
            <h3 className="text-lg font-black text-slate-800">💰 الفصل الرابع: نموذج ميزان السداد المالي والرواتب</h3>
            <p className="text-xs text-slate-600 leading-relaxed text-justify">
              تصفية الكشوفات والنسب مدمجة لضمان الشفافية ومطابقتها دفترياً بنشاط خطأ 0% مبني على معادلة العقد المعتمدة:<br/>
              <b>مستحقات الطبيب المعالج = (قيمة الكشف × نسبة الطبيب المعين بالعقد) / 100</b>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
