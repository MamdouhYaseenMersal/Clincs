import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import dayjs from 'dayjs';
import { 
  X, BarChart as BarChartIcon, LineChart as LineChartIcon, PieChart as PieChartIcon, 
  TrendingUp, TrendingDown, Coins, AlertCircle, FileText, ChevronRight, 
  Download, Activity, Calendar, Award 
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, 
  Tooltip, Legend, PieChart, Pie, Cell, CartesianGrid 
} from 'recharts';
import { api } from '../lib/api';

interface AccountingViewProps {
  key?: string;
  visits: any[];
  doctors: any[];
  allVisits?: any[];
  allPatients?: any[];
  allAppointments?: any[];
  allDoctors?: any[];
}

export default function AccountingView({ 
  visits, 
  doctors, 
  allVisits = [], 
  allPatients = [], 
  allAppointments = [], 
  allDoctors = [] 
}: AccountingViewProps) {
  // Local date range for filtering reports
  const [dateRange, setDateRange] = useState({ 
    start: dayjs().subtract(30, 'day').format('YYYY-MM-DD'), 
    end: dayjs().format('YYYY-MM-DD') 
  });
  const [activeSubTab, setActiveSubTab] = useState<'financial' | 'diseases' | 'doctors' | 'reports' | 'growth'>('financial');
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [yearlyChartType, setYearlyChartType] = useState<'bar' | 'line'>('bar');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [reportInsights, setReportInsights] = useState("");
  const [selectedDailyExportDate, setSelectedDailyExportDate] = useState(dayjs().format('YYYY-MM-DD'));

  // Multi-period comparison reports state
  const [compPreset, setCompPreset] = useState<'current-vs-last-month' | 'current-vs-last-quarter' | 'current-vs-last-week'>('current-vs-last-month');
  const [compPeriodA, setCompPeriodA] = useState({ start: dayjs().subtract(30, 'day').format('YYYY-MM-DD'), end: dayjs().format('YYYY-MM-DD') });
  const [compPeriodB, setCompPeriodB] = useState({ start: dayjs().subtract(60, 'day').format('YYYY-MM-DD'), end: dayjs().subtract(30, 'day').format('YYYY-MM-DD') });

  const finalPatients = allPatients;
  const finalDoctors = allDoctors;

  const currentYear = dayjs().year();

  // 1. Locally filter visits based on date range
  const filteredVisits = useMemo(() => {
    return visits.filter((v: any) => {
      const d = dayjs(v.date).format('YYYY-MM-DD');
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [visits, dateRange]);

  // Derived financials
  const totalRev = useMemo(() => filteredVisits.reduce((acc, v) => acc + (v.cost || 0), 0), [filteredVisits]);
  const totalDoc = useMemo(() => filteredVisits.reduce((acc, v) => acc + (v.doctorEarnings || 0), 0), [filteredVisits]);
  const totalClinic = useMemo(() => filteredVisits.reduce((acc, v) => acc + (v.clinicEarnings || 0), 0), [filteredVisits]);
  const outstandingAmount = useMemo(() => filteredVisits.filter(v => !v.isPaid).reduce((acc, v) => acc + (v.cost || 0), 0), [filteredVisits]);

  // 2. Prepare 30-day chartData
  const chartData = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => dayjs(dateRange.end).subtract(i, 'day')).reverse().map(date => {
      const dayVisits = filteredVisits.filter((v: any) => dayjs(v.date).isSame(date, 'day'));
      return {
        name: date.format('DD/MM'),
        إيرادات: dayVisits.reduce((acc: any, v: any) => acc + (v.cost || 0), 0),
        أطباء: dayVisits.reduce((acc: any, v: any) => acc + (v.doctorEarnings || 0), 0),
        أرباح: dayVisits.reduce((acc: any, v: any) => acc + (v.clinicEarnings || 0), 0),
      };
    });
  }, [filteredVisits, dateRange.end]);

  // COLORS palette
  const COLORS = ['#3B82F6', '#10B981', '#6366F1', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6'];

  // Specialty Breakdown
  const specialtyData = useMemo(() => {
    const specialties = Array.from(new Set(doctors.map((d: any) => d.specialty)));
    return specialties.map(spec => {
      const specVisits = filteredVisits.filter((v: any) => doctors.find((d: any) => d.id === v.doctorId)?.specialty === spec);
      const specRev = specVisits.reduce((acc: any, v: any) => acc + (v.cost || 0), 0);
      return {
        name: spec,
        value: specRev
      };
    }).filter(d => d.value > 0);
  }, [doctors, filteredVisits]);

  // YearlyMonthly comparison chart (Simulated months)
  const yearlyMonthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthStart = dayjs().year(currentYear).month(i).startOf('month');
      const monthEnd = dayjs().year(currentYear).month(i).endOf('month');
      const mVisits = allVisits.filter((v: any) => {
        const d = dayjs(v.date);
        return d.isAfter(monthStart) && d.isBefore(monthEnd);
      });
      return {
        name: monthStart.locale('ar').format('MMMM'),
        'إجمالي_الإيرادات': mVisits.reduce((acc: any, v: any) => acc + (v.cost || 0), 0),
        'أرباح_الأطباء': mVisits.reduce((acc: any, v: any) => acc + (v.doctorEarnings || 0), 0),
        'إيرادات_العيادة': mVisits.reduce((acc: any, v: any) => acc + (v.clinicEarnings || 0), 0),
      };
    });
  }, [allVisits, currentYear]);

  // Diseases/Diagnoses stats breakdown
  const diagnosisBreakdown = useMemo(() => {
    const counts: Record<string, { count: number; totalCost: number }> = {};
    filteredVisits.forEach((v: any) => {
      let diag = (v.diagnosis || "").trim();
      if (!diag) diag = "غير محدد / استشارات عامة";
      if (!counts[diag]) {
        counts[diag] = { count: 0, totalCost: 0 };
      }
      counts[diag].count += 1;
      counts[diag].totalCost += (v.cost || 0);
    });
    
    return Object.entries(counts)
      .map(([name, data]) => ({
        name,
        count: data.count,
        totalCost: data.totalCost,
        percentage: filteredVisits.length > 0 ? ((data.count / filteredVisits.length) * 100).toFixed(1) : "0"
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredVisits]);

  // Doctors comprehensive performance / case breakdown
  const doctorsBreakdown = useMemo(() => {
    return doctors.map((d: any) => {
      const docVisits = filteredVisits.filter((v: any) => v.doctorId === d.id);
      const totalCost = docVisits.reduce((acc: any, v: any) => acc + (v.cost || 0), 0);
      const docPay = docVisits.reduce((acc: any, v: any) => acc + (v.doctorEarnings || 0), 0);
      const clinicProf = docVisits.reduce((acc: any, v: any) => acc + (v.clinicEarnings || 0), 0);
      const avgCost = docVisits.length > 0 ? (totalCost / docVisits.length).toFixed(1) : '0';
      return {
        id: d.id,
        name: d.name,
        specialty: d.specialty,
        visitsCount: docVisits.length,
        totalRevenue: totalCost,
        doctorEarnings: docPay,
        clinicProfit: clinicProf,
        averageVisitCost: avgCost
      };
    }).sort((a: any, b: any) => b.visitsCount - a.visitsCount);
  }, [doctors, filteredVisits]);

  // Period A vs Period B comparative metrics
  const branchComparisonData = useMemo(() => {
    // Collect active branches
    const branches = ['المعادي', 'الدقي', 'مدينة نصر', 'اسكندرية'];
    return branches.map(b => {
      const visitsA = allVisits.filter((v: any) => v.branch === b && dayjs(v.date).format('YYYY-MM-DD') >= compPeriodA.start && dayjs(v.date).format('YYYY-MM-DD') <= compPeriodA.end);
      const visitsB = allVisits.filter((v: any) => v.branch === b && dayjs(v.date).format('YYYY-MM-DD') >= compPeriodB.start && dayjs(v.date).format('YYYY-MM-DD') <= compPeriodB.end);
      return {
        name: b,
        revenue1: visitsA.reduce((sum, v) => sum + (v.cost || 0), 0),
        revenue2: visitsB.reduce((sum, v) => sum + (v.cost || 0), 0),
        patients1: Array.from(new Set(visitsA.map(v => v.patientId))).length,
        patients2: Array.from(new Set(visitsB.map(v => v.patientId))).length,
      };
    });
  }, [allVisits, compPeriodA, compPeriodB]);

  // Patients growth rate list monthly
  const patientGrowthData = useMemo(() => {
    return Array.from({ length: 6 }, (_, idx) => {
      const month = dayjs().subtract(idx, 'month').format('YYYY-MM');
      const monthLabel = dayjs().subtract(idx, 'month').locale('ar').format('MMMM YYYY');
      const count = finalPatients.filter((p: any) => p.createdAt && p.createdAt.startsWith(month)).length;
      return { monthKey: month, label: monthLabel, count };
    }).reverse().map((item, index, list) => {
      const prev = index > 0 ? list[index - 1].count : 0;
      let growthRate = 0;
      if (prev > 0) {
        growthRate = Math.round(((item.count - prev) / prev) * 100);
      }
      return { ...item, growthRate };
    });
  }, [finalPatients]);

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).join(',')).join('\n');
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers + '\n' + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportFinancialReport = () => {
    const reportData = doctors.map((d: any) => {
      const docVisits = filteredVisits.filter((v: any) => v.doctorId === d.id);
      return {
        'اسم الدكتور': d.name,
        'التخصص': d.specialty,
        'عدد الحالات': docVisits.length,
        'إجمالي الإيراد': docVisits.reduce((acc: any, v: any) => acc + (v.cost || 0), 0),
        'مستحقات الدكتور': docVisits.reduce((acc: any, v: any) => acc + (v.doctorEarnings || 0), 0),
        'صافي ربح العيادة': docVisits.reduce((acc: any, v: any) => acc + (v.clinicEarnings || 0), 0),
      };
    });
    exportToCSV(reportData, `Financial_Report_${dateRange.start}_to_${dateRange.end}`);
  };

  const handleGeneratePeriodicInsights = async () => {
    setIsGeneratingInsights(true);
    setReportInsights("");
    try {
      const metrics = {
        totalRevenue: totalRev,
        doctorEarnings: totalDoc,
        clinicProfit: totalClinic,
        outstandingAmount: outstandingAmount,
        visitsCount: filteredVisits.length,
        completedCount: filteredVisits.filter((v: any) => v.status === 'completed' || !v.status).length,
        cancelledCount: filteredVisits.filter((v: any) => v.status === 'cancelled').length,
        outstandingCount: filteredVisits.filter((v: any) => !v.isPaid).length,
        dateRange: `${dateRange.start} to ${dateRange.end}`,
        topSpecialties: specialtyData.map((s: any) => `${s.name}: ${s.value} ج.م`).join(', '),
        topDiagnoses: diagnosisBreakdown.slice(0, 5).map((d: any) => `${d.name} (${d.count} حالات)`).join(', '),
        doctorsPerformance: doctorsBreakdown.map((d: any) => `${d.name}: ${d.visitsCount} كشف (صافي للعيادة ${d.clinicProfit} ج.م)`).join(', ')
      };

      const res = await fetch("/api/generate-report-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrics })
      });

      if (res.ok) {
        const data = await res.json();
        setReportInsights(data.insights || "حدث خطأ أثناء صياغة تقرير التحليل الإحصائي الذكي.");
      } else {
        setReportInsights("فشل الاتصال بخدمة التحليلات الذكية. الرجاء التحقق من إعدادات الذكاء الاصطناعي.");
      }
    } catch (err) {
      console.error(err);
      setReportInsights("عذراً، تباطأ الاتصال بالخادم الرئيسي للمؤشرات الذكية.");
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const handleCompPresetChange = (preset: typeof compPreset) => {
    setCompPreset(preset);
    let startA, endA, startB, endB;
    if (preset === 'current-vs-last-month') {
      startA = dayjs().startOf('month').format('YYYY-MM-DD');
      endA = dayjs().endOf('month').format('YYYY-MM-DD');
      startB = dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
      endB = dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
    } else if (preset === 'current-vs-last-quarter') {
      startA = dayjs().subtract(3, 'month').format('YYYY-MM-DD');
      endA = dayjs().format('YYYY-MM-DD');
      startB = dayjs().subtract(6, 'month').format('YYYY-MM-DD');
      endB = dayjs().subtract(3, 'month').format('YYYY-MM-DD');
    } else {
      // week
      startA = dayjs().startOf('week').format('YYYY-MM-DD');
      endA = dayjs().endOf('week').format('YYYY-MM-DD');
      startB = dayjs().subtract(1, 'week').startOf('week').format('YYYY-MM-DD');
      endB = dayjs().subtract(1, 'week').endOf('week').format('YYYY-MM-DD');
    }
    setCompPeriodA({ start: startA, end: endA });
    setCompPeriodB({ start: startB, end: endB });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 text-right" dir="rtl">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-205 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">التقارير المالية والمحاسبية</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">إدارة الأرباح وتوزيع مستحقات الأطباء</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <input 
              type="date" 
              className="bg-transparent border-none text-[10px] font-bold focus:outline-none" 
              value={dateRange.start} 
              onChange={(e) => setDateRange({...dateRange, start: e.target.value})} 
            />
            <span className="text-slate-400 font-bold text-xs">إلى</span>
            <input 
              type="date" 
              className="bg-transparent border-none text-[10px] font-bold focus:outline-none" 
              value={dateRange.end} 
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})} 
            />
          </div>
          <button 
            onClick={exportFinancialReport}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
          >
            <Download size={14} /> تصدير التقرير المالي الموحد
          </button>
        </div>
      </header>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">إجمالي الإيرادات المالية</span>
              <Coins className="text-blue-500" size={18} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 font-sans mt-3">{totalRev.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span></h3>
          </div>
          <div className="text-[9px] text-slate-400 font-bold mt-4 pt-3 border-t border-slate-50 flex items-center gap-1">
            <span className="text-blue-500">📊</span> تشمل كافة الفحوصات والعمليات العيادية المؤكدة
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">أتعاب ومستحقات الأطباء</span>
              <Award className="text-emerald-500" size={18} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 font-sans mt-3">{totalDoc.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span></h3>
          </div>
          <div className="text-[9px] text-slate-400 font-bold mt-4 pt-3 border-t border-slate-50 flex items-center gap-1">
            <span className="text-emerald-500">🩺</span> المبالغ الصافية المستحقة للأطباء بالفترة المختارة
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">الأرباح التشغيلية للعيادة</span>
              <TrendingUp className="text-indigo-500" size={18} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 font-sans mt-3">{totalClinic.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span></h2>
          </div>
          <div className="text-[9px] text-slate-400 font-bold mt-4 pt-3 border-t border-slate-50 flex items-center gap-1">
            <span className="text-indigo-500">🏢</span> الحصة الصافية لخزينة العيادات بعد دفع مستحقات الأطباء
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">التحصيلات المتأخرة / الديون</span>
              <AlertCircle className="text-rose-500 animate-pulse" size={18} />
            </div>
            <h3 className="text-2xl font-black text-rose-700 font-sans mt-3">{outstandingAmount.toLocaleString()} <span className="text-xs font-bold text-rose-455">ج.م</span></h3>
          </div>
          <div className="text-[9px] text-rose-550/70 font-semibold mt-4 pt-3 border-t border-slate-50 flex items-center gap-1 bg-rose-50/20 -mx-6 px-6 -mb-6 pb-4">
            ⚠️ كشوفات تم إتمام تشخيصها السريري ولم يتم دفع بندها المالي بعد
          </div>
        </div>
      </div>

      {/* Artificial Intelligence periodic reporter */}
      <div className="bg-slate-900 text-slate-200 p-6 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.15),transparent_40%)]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span className="animate-spin text-blue-400">✨</span>
              <span>المدقق الإحصائي التلقائي وصياغة التحليلات الذكية</span>
            </h3>
            <p className="text-[10px] text-slate-450 font-medium">يقوم بمراجعة كافة السجلات الطبية والمالية وصياغة المؤشرات العيادية للفترة: {dayjs(dateRange.start).format('DD MMMM')} - {dayjs(dateRange.end).format('DD MMMM')}</p>
          </div>
          <button
            onClick={handleGeneratePeriodicInsights}
            disabled={isGeneratingInsights}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-800 disabled:text-slate-500 font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-md items-center gap-2 flex self-start md:self-auto cursor-pointer"
          >
            {isGeneratingInsights ? "جاري صياغة السجلات الإحصائية..." : "✨ ابدأ صياغة التقرير الذكي"}
          </button>
        </div>

        {reportInsights && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="mt-5 p-4 bg-slate-850 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 leading-relaxed max-h-[300px] overflow-y-auto"
          >
            {reportInsights}
          </motion.div>
        )}
      </div>

      {/* Subtab Navigation */}
      <div className="flex border-b border-slate-200 pb-px gap-3 overflow-x-auto text-right">
        {[
          { key: 'financial', label: '📊 الهيكل والتحليل المالي العامة' },
          { key: 'diseases', label: '🦠 الأمراض والتصنيفات الطبية الشيوعاً' },
          { key: 'doctors', label: '🩺 كفاءة وأتعاب الأطباء' },
          { key: 'reports', label: '📑 تقارير المقارنة الدورية والطباعة' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key as any)}
            className={`pb-3.5 px-1 font-black text-xs transition-all tracking-tight shrink-0 border-b-2 hover:text-slate-800 relative cursor-pointer ${
              activeSubTab === tab.key 
                ? 'border-slate-800 text-slate-900 font-black' 
                : 'border-transparent text-slate-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Tab Panels with Animations */}
      <AnimatePresence mode="wait">
        {/* PANEL 1: FINANCIALS */}
        {activeSubTab === 'financial' && (
          <motion.div 
            key="financial"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily performance flow */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden flex flex-col justify-between">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="font-black text-slate-850 text-sm flex items-center gap-1.5">
                      <span>📈 تدفقات الإيرادات والأرباح اليومية</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">منحنى زمني تفاعلي يعرض الدعم والربحية على مدار الـ 30 يوماً الماضية</p>
                  </div>
                  <div className="flex bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
                    <button 
                      type="button"
                      onClick={() => setChartType('bar')}
                      className={`p-1.5 rounded-md transition-all ${chartType === 'bar' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                    >
                      <BarChartIcon size={14} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => setChartType('line')}
                      className={`p-1.5 rounded-md transition-all ${chartType === 'line' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                    >
                      <LineChartIcon size={14} />
                    </button>
                  </div>
                </div>

                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" fontSize={10} fontBold axisLine={false} tickLine={false} dy={10} />
                        <YAxis fontSize={10} fontBold axisLine={false} tickLine={false} dx={-10} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                          cursor={{ fill: '#F1F5F9' }}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                        <Bar name="إجمالي الإيرادات" dataKey="إيرادات" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar name="صافي العيادة" dataKey="أرباح" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
                      </BarChart>
                    ) : (
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" fontSize={10} fontBold axisLine={false} tickLine={false} dy={10} />
                        <YAxis fontSize={10} fontBold axisLine={false} tickLine={false} dx={-10} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                        <Area name="إجمالي الإيرادات" type="monotone" dataKey="إيرادات" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                        <Area name="صافي العيادة" type="monotone" dataKey="أرباح" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Specialty Pie Chart */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden flex flex-col justify-between">
                <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2 mb-6">
                  <PieChartIcon size={16} className="text-blue-500" />
                  توزيع الإيراد حسب التخصص الطبي
                </h3>
                <div className="flex-1 flex flex-col justify-center">
                  {specialtyData.length > 0 ? (
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={specialtyData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {specialtyData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any) => [`${value.toLocaleString()} ج.م`]} />
                          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '20px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-300 italic text-sm">لا توجد بيانات للفترة المختارة</div>
                  )}
                </div>
              </div>
            </div>

            {/* Annual Multi-month Comparison */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                    <TrendingUp size={18} className="text-teal-650 animate-pulse" />
                    <span>المقارنة السنوية الشهرية لعام {currentYear} 📅</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">المقارنة التفاعلية بين الإيرادات الإجمالية ومستحقات الأطباء والأرباح شهرياً</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
                  <button 
                    type="button"
                    onClick={() => setYearlyChartType('bar')}
                    className={`px-3 py-1.5 rounded-md text-xs font-black transition-all flex items-center gap-1 ${yearlyChartType === 'bar' ? 'bg-white shadow-sm text-teal-650 font-black' : 'text-slate-400'}`}
                  >
                    <BarChartIcon size={12} /> أعمدة مجمعة
                  </button>
                  <button 
                    type="button"
                    onClick={() => setYearlyChartType('line')}
                    className={`px-3 py-1.5 rounded-md text-xs font-black transition-all flex items-center gap-1 ${yearlyChartType === 'line' ? 'bg-white shadow-sm text-teal-650 font-black' : 'text-slate-400'}`}
                  >
                    <LineChartIcon size={12} /> خطوط بيانية
                  </button>
                </div>
              </div>

              {/* Quick statistics */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6 text-right">
                <div className="p-3 bg-teal-50/20 border border-teal-100/50 rounded-xl">
                  <span className="text-[9px] text-slate-400 font-bold block mb-0.5">إجمالي أرباح العيادة السنوية 🏥</span>
                  <span className="text-base font-black text-emerald-600">
                    {yearlyMonthlyData.reduce((acc, curr) => acc + curr['إيرادات_العيادة'], 0).toLocaleString()} ج.م
                  </span>
                </div>
                <div className="p-3 bg-blue-50/20 border border-blue-100/50 rounded-xl">
                  <span className="text-[9px] text-slate-400 font-bold block mb-0.5">إجمالي أتعاب الأطباء السنوية 💵</span>
                  <span className="text-base font-black text-blue-600">
                    {yearlyMonthlyData.reduce((acc, curr) => acc + curr['أرباح_الأطباء'], 0).toLocaleString()} ج.م
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl">
                  <span className="text-[9px] text-slate-400 font-bold block mb-0.5">إجمالي الحركة المالية السنوية 💰</span>
                  <span className="text-base font-black text-slate-800">
                    {yearlyMonthlyData.reduce((acc, curr) => acc + curr['إجمالي_الإيرادات'], 0).toLocaleString()} ج.م
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl">
                  <span className="text-[9px] text-slate-400 font-bold block mb-0.5">أعلى الشهور ربحية للعيادة 📈</span>
                  <span className="text-xs font-black text-teal-700 truncate block mt-0.5">
                    {(() => {
                      const maxMonth = [...yearlyMonthlyData].sort((a, b) => b['إيرادات_العيادة'] - a['إيرادات_العيادة'])[0];
                      return maxMonth && maxMonth['إيرادات_العيادة'] > 0 ? `${maxMonth.name} (${maxMonth['إيرادات_العيادة'].toLocaleString()} ج.م)` : 'لا توجد بيانات';
                    })()}
                  </span>
                </div>
              </div>

              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {yearlyChartType === 'bar' ? (
                    <BarChart data={yearlyMonthlyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" fontSize={10} fontBold axisLine={false} tickLine={false} dy={10} />
                      <YAxis fontSize={10} fontBold axisLine={false} tickLine={false} dx={-10} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', direction: 'rtl', textAlign: 'right' }}
                        cursor={{ fill: '#F1F5F9' }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                      <Bar name="صافي أرباح العيادة" dataKey="إيرادات_العيادة" fill="#10B981" radius={[4, 4, 0, 0]} barSize={25} />
                      <Bar name="إجمالي أرباح الأطباء" dataKey="أرباح_الأطباء" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={25} />
                    </BarChart>
                  ) : (
                    <AreaChart data={yearlyMonthlyData}>
                      <defs>
                        <linearGradient id="colorLevelClinic" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorLevelDoc" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" fontSize={10} fontBold axisLine={false} tickLine={false} dy={10} />
                      <YAxis fontSize={10} fontBold axisLine={false} tickLine={false} dx={-10} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', direction: 'rtl', textAlign: 'right' }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                      <Area name="صافي أرباح العيادة" type="monotone" dataKey="إيرادات_العيادة" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorLevelClinic)" />
                      <Area name="إجمالي أرباح الأطباء" type="monotone" dataKey="أرباح_الأطباء" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorLevelDoc)" />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}

        {/* PANEL 2: DISEASES */}
        {activeSubTab === 'diseases' && (
          <motion.div 
            key="diseases"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                    <span>🦠 التصنيفات الطبية والأمراض الأكثر انتشاراً</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold tracking-tight">ترتيب الأمراض والتشخيصات تكراراً ومعدلات الإيرادات المصاحبة لها للفترة المحددة</p>
                </div>
                <button 
                  type="button"
                  onClick={() => exportToCSV(diagnosisBreakdown, `Diseases_Breakdown_${dateRange.start}_to_${dateRange.end}`)}
                  className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  📁 تصدير ملف إحصاءات الأمراض
                </button>
              </div>

              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-white rounded-lg border border-slate-100">
                  <div className="text-[9px] text-slate-400 font-black">إجمالي سجلات التشخيص للفترة</div>
                  <div className="text-2xl font-black text-slate-850 mt-1">{filteredVisits.length} حالة</div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-100">
                  <div className="text-[9px] text-slate-400 font-black">التشخيصات الفريدة المختلفة</div>
                  <div className="text-2xl font-black text-blue-600 mt-1">{diagnosisBreakdown.length} تشخيص متباين</div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-100">
                  <div className="text-[9px] text-slate-400 font-black">المرض الأكثر انتشاراً وعلاجاً</div>
                  <div className="text-sm font-black text-emerald-700 mt-2 truncate w-full px-1">
                    {diagnosisBreakdown[0]?.name || "لا توجد سجلات بعد"}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-150 rounded-xl">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-150">
                      <th className="px-6 py-4">اسم التشخيص / بند المرض السريري</th>
                      <th className="px-6 py-4">عدد الحالات المعالجة</th>
                      <th className="px-6 py-4">النسبة المئوية للاستحواذ</th>
                      <th className="px-6 py-4">أثر الكشف المالي للفئة</th>
                      <th className="px-6 py-4">الرسم الإحصائي للتوزيع للعيادة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-sm">
                    {diagnosisBreakdown.map((item: any, index: number) => (
                      <tr key={index} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3.5 font-black text-slate-805 text-right">{item.name}</td>
                        <td className="px-6 py-3.5 text-slate-600">{item.count} حالة رصد</td>
                        <td className="px-6 py-3.5 text-blue-600 font-mono text-xs">{item.percentage}%</td>
                        <td className="px-6 py-3.5 font-mono text-emerald-600">{item.totalCost.toLocaleString()} ج.م</td>
                        <td className="px-6 py-3.5 w-[200px]">
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${item.percentage}%` }}
                            ></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {diagnosisBreakdown.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-16 text-center text-slate-350 italic">لا توجد سجلات تشخيصات طبية للفترة المحددة</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* PANEL 3: DOCTORS */}
        {activeSubTab === 'doctors' && (
          <motion.div 
            key="doctors"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                    <span>% 🩺 كفاءة الأطباء والتحليل الإنتاجي والتكاليف</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold tracking-tight">إحصائية شاملة تعرض عدد المحجوز لكل طبيب، معدل سعر الزيارة للعيادة، مستحقات والربح التشغيلي الصافي للفريق</p>
                </div>
                <button 
                  type="button"
                  onClick={() => exportToCSV(doctorsBreakdown, `Doctors_Clinical_Power_${dateRange.start}_to_${dateRange.end}`)}
                  className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-705 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  📁 تصدير تقرير الأطباء المفصل
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-150 rounded-xl">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-150">
                      <th className="px-6 py-4">اسم الدكتور والتأهيل</th>
                      <th className="px-6 py-4">عدد الحالات المعالجة</th>
                      <th className="px-6 py-4">معدل تكلفة الكشف الواحد</th>
                      <th className="px-6 py-4">إجمالي الإيرادات للفترة</th>
                      <th className="px-6 py-4">أتعاب ومستحقات الدكتور</th>
                      <th className="px-6 py-4">صافي ربح العيادة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-101 font-bold text-sm">
                    {doctorsBreakdown.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-black text-slate-800">د. {item.name}</p>
                          <span className="text-[9px] text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md mt-1 inline-block">{item.specialty}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-700">{item.visitsCount} كشف طبي</td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{item.averageVisitCost} ج.م / كشف</td>
                        <td className="px-6 py-4 font-mono text-slate-700">{item.totalRevenue.toLocaleString()} ج.م</td>
                        <td className="px-6 py-4 font-mono text-blue-600">{item.doctorEarnings.toLocaleString()} ج.م</td>
                        <td className="px-6 py-4 font-mono text-emerald-600">{item.clinicProfit.toLocaleString()} ج.m</td>
                      </tr>
                    ))}
                    {doctorsBreakdown.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center text-slate-350 italic">لم تدرج أي سجلات أطباء ضمن نطاق التوقيت المختار</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* PANEL 4: PERIODIC COMPARISONS & PRINT */}
        {activeSubTab === 'reports' && (
          <motion.div 
            key="reports"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* 1. Comparison Control Station */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-loose">🎯 مقارنة الفترات الدورية ومعادلات الكفاءة والشرطة</h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">تتبع كفاءة العيادة وحجم حركة المرضى بين فترتين مستقلتين بشكل دقيق لمراقبة مؤشر النمو والتقدم</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1 shrink-0 font-sans font-bold">
                  <button 
                    onClick={() => handleCompPresetChange('current-vs-last-month')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all border cursor-pointer ${
                      compPreset === 'current-vs-last-month' 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    الشهر الحالي مقابل السابق
                  </button>
                  <button 
                    onClick={() => handleCompPresetChange('current-vs-last-quarter')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all border cursor-pointer ${
                      compPreset === 'current-vs-last-quarter' 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    الربع الحالي مقابل السابق
                  </button>
                  <button 
                    onClick={() => handleCompPresetChange('current-vs-last-week')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all border cursor-pointer ${
                      compPreset === 'current-vs-last-week' 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    الأسبوع الحالي مقابل السابق
                  </button>
                </div>
              </div>

              {/* Handpicked Custom Date Configuration inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-right pt-2">
                <div className="bg-blue-50/20 p-4 border border-blue-100/50 rounded-xl space-y-3">
                  <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-widest block">الفترة المستهدفة (أ) - Target Period A</span>
                  <div className="flex gap-2 text-xs font-bold font-sans">
                    <div className="flex-1">
                      <label className="text-[9px] text-slate-400 block mb-1">من تاريخ:</label>
                      <input type="date" value={compPeriodA.start} onChange={(e) => setCompPeriodA({...compPeriodA, start: e.target.value})} className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] text-slate-400 block mb-1">إلى تاريخ:</label>
                      <input type="date" value={compPeriodA.end} onChange={(e) => setCompPeriodA({...compPeriodA, end: e.target.value})} className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none" />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-3">
                  <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-widest block">فترة المقارنة (ب) - Base Period B</span>
                  <div className="flex gap-2 text-xs font-bold font-sans">
                    <div className="flex-1">
                      <label className="text-[9px] text-slate-400 block mb-1">من تاريخ:</label>
                      <input type="date" value={compPeriodB.start} onChange={(e) => setCompPeriodB({...compPeriodB, start: e.target.value})} className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] text-slate-400 block mb-1">إلى تاريخ:</label>
                      <input type="date" value={compPeriodB.end} onChange={(e) => setCompPeriodB({...compPeriodB, end: e.target.value})} className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Comparative Plots */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Financial comparison */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="text-right">
                  <h3 className="text-xs font-black text-slate-700">🏢 مقارنة إيرادات الفروع بين الفترتين</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">مقارنة الإيرادات المحققة للفروع التخصصية بين الفترة (أ) باللون الأزرق والفترة (ب) بالرمادي</p>
                </div>
                <div className="h-85 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={branchComparisonData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94A3B8" />
                      <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94A3B8" />
                      <Tooltip 
                        contentStyle={{ fontSize: '11px', fontWeight: 'bold', textAlign: 'right', borderRadius: '10px' }} 
                        formatter={(value: any) => [`${value} ج.م`]} 
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                      <Bar dataKey="revenue1" name="إيرادات الفترة أ" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="revenue2" name="إيرادات الفترة ب" fill="#94A3B8" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Patient Engagement Comparison */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="text-right">
                  <h3 className="text-xs font-black text-slate-700">👥 مقارنة كثافة المرضى النشطين بالفروع</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">عدد الحالات الفريدة التي قامت بزيارات فعلية خلال الفترة (أ) مقابل الفترة (ب)</p>
                </div>
                <div className="h-85 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={branchComparisonData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94A3B8" />
                      <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94A3B8" />
                      <Tooltip 
                        contentStyle={{ fontSize: '11px', fontWeight: 'bold', textAlign: 'right', borderRadius: '10px' }} 
                        formatter={(value: any) => [`${value} مريض`]} 
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                      <Bar dataKey="patients1" name="مرضى الفترة أ" fill="#6366F1" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="patients2" name="مرضى الفترة ب" fill="#CBD5E1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* patients growth tracking table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-1">📈 سجلات معدلات النمو والتحصيل الشهري للمرضى (Patient Acquisition Index)</h3>
                <p className="text-[10px] text-slate-400 font-bold">مؤشر زمني يعرض وتيرة زيادة وتسجيل الحالات الجديدة بالعيادات في الـ 6 أشهر الماضية لمنع انخفاض الفئات المستهدفة</p>
              </div>
              <div className="overflow-x-auto border border-slate-150 rounded-xl">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-150 font-bold text-xs">
                      <th className="px-6 py-4">الشهر المستهدف القياسي</th>
                      <th className="px-6 py-4">الحالات الطبية الجديدة المسجلة</th>
                      <th className="px-6 py-4">دليل التغير وسلوك الحركة</th>
                      <th className="px-6 py-4 text-center">معدل الفروق النسبية للنمو</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-705">
                    {patientGrowthData.map((data, index) => {
                      const isPositive = data.growthRate >= 0;
                      return (
                        <tr key={data.monthKey} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-slate-900 font-extrabold">{data.label}</td>
                          <td className="px-6 py-4 font-mono text-slate-850">{data.count} مريض جديد</td>
                          <td className="px-6 py-4">
                            {index === 0 ? (
                              <span className="text-slate-400">- شهري تمهيدي -</span>
                            ) : data.growthRate > 0 ? (
                              <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[10px]">📈 زيادة نشاط</span>
                            ) : data.growthRate < 0 ? (
                              <span className="text-red-650 bg-red-50/40 px-2 py-0.5 rounded text-[10px]">📉 تباطؤ نسبي</span>
                            ) : (
                              <span className="text-slate-500 bg-slate-50 px-2 py-0.5 rounded text-[10px]">➖ استقرار عددي</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {index === 0 ? (
                              <span className="text-slate-450 font-mono">0%</span>
                            ) : (
                              <span className={`px-2 py-1 rounded font-mono ${
                                isPositive && data.growthRate > 0 ? 'bg-emerald-50 text-emerald-700' :
                                !isPositive ? 'bg-red-50 text-red-750' :
                                'bg-slate-50 text-slate-700'
                              }`}>
                                {isPositive ? `+${data.growthRate}` : data.growthRate}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Daily Medical Audit Export Component (Requirement #5) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
                <div className="text-right">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <span>📑 تصدير وسجل الكشوفات اليومية والشواهد الإكلينيكية (Medical Audit & Clinical Records Log)</span>
                  </h4>
                  <p className="text-[10px] text-slate-405 font-bold">استخراج وطباعة المستندات الشاملة للفحوصات، التشخيصات والروشتات الطبية لكل يوم لإرفاقها بالسجلات الإدارية</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-slate-400 font-bold">اختر تاريخ الكشوفات:</label>
                  <input
                    type="date"
                    value={selectedDailyExportDate}
                    onChange={(e) => setSelectedDailyExportDate(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              {(() => {
                const targetVisitsForExams = allVisits.filter((v: any) => dayjs(v.date).format('YYYY-MM-DD') === selectedDailyExportDate);
                return targetVisitsForExams.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 italic text-xs bg-slate-50 border border-slate-150 border-dashed rounded-xl">
                    لا توجد كشوفات أو فحوصات طبية تم تأكيدها أو تسجيلها في تاريخ اليوم المختار: {dayjs(selectedDailyExportDate).format('YYYY/MM/DD')}
                  </div>
                ) : (
                  <div className="space-y-3 text-right">
                    {/* Table Preview of Today Clinical Exams */}
                    <div className="overflow-x-auto border border-slate-150 rounded-xl">
                      <table className="w-full text-xs font-bold border-collapse text-right">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 text-right">
                            <th className="py-2 px-3 text-right">المريض</th>
                            <th className="py-2 px-3 text-right">الطبيب المعالج</th>
                            <th className="py-2 px-3 text-center">التشخيص الطبي</th>
                            <th className="py-2 px-3 text-center">العلامات الحيوية</th>
                            <th className="py-2 px-3 text-right">الروشتة / الأدوية</th>
                            <th className="py-2 px-3 text-center">تكلفة الكشف</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-right">
                          {targetVisitsForExams.map((v: any) => {
                            const pat = finalPatients.find((p: any) => p.id === v.patientId);
                            const doc = finalDoctors.find((d: any) => d.id === v.doctorId);
                            return (
                              <tr key={v.id} className="hover:bg-slate-50/30 text-right">
                                <td className="py-2.5 px-3 text-right">
                                  <p className="font-extrabold text-slate-800 text-xs">{pat?.name || '---'}</p>
                                  <p className="text-[9px] text-slate-400 mt-0.5">الكود: {pat?.caseCode || '---'} | السن: {pat?.age || '---'}</p>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <p className="font-bold text-blue-900">{doc?.name ? `د. ${doc.name}` : '---'}</p>
                                  <p className="text-[9px] text-slate-400 mt-0.5">{doc?.specialty || '---'}</p>
                                </td>
                                <td className="py-2.5 px-3 text-center text-slate-705 font-extrabold">{v.diagnosis || 'كشف روتيني'}</td>
                                <td className="py-2.5 px-3 text-center font-sans font-bold">
                                  {v.vitals ? (
                                    <span className="text-[10px] bg-rose-50 border border-rose-100 text-rose-800 px-2 py-0.5 rounded block w-fit mx-auto">
                                      {v.vitals.temperature || '---'}°C | {v.vitals.bloodPressure || '---'}
                                    </span>
                                  ) : '---'}
                                </td>
                                <td className="py-2.5 px-3 text-right max-w-[150px] truncate" title={v.prescriptions?.map((p: any) => p.name).join(' ، ')}>
                                  {v.prescriptions && v.prescriptions.length > 0 ? (
                                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-110">{v.prescriptions.map((p: any) => p.name).join(' ، ')}</span>
                                  ) : 'لا يوجد أدوية'}
                                </td>
                                <td className="py-2.5 px-3 text-center font-sans text-slate-800">{v.cost || 0} ج.م</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Print / Download Trigger Button */}
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const printContentsForDailyExams = document.getElementById('printable-daily-exams-report')?.innerHTML;
                          const originalContents = document.body.innerHTML;
                          if (printContentsForDailyExams) {
                            document.body.innerHTML = `<div class="p-8 direction-rtl text-right font-sans" style="direction: rtl;">${printContentsForDailyExams}</div>`;
                            window.print();
                            document.body.innerHTML = originalContents;
                            window.location.reload();
                          }
                        }}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>📥 طباعة وتحميل التقرير الشامل لكشوفات يوم {dayjs(selectedDailyExportDate).format('YYYY/MM/DD')} ({targetVisitsForExams.length} حالة مفعّلة)</span>
                      </button>
                    </div>

                    {/* Hidden Printable Daily Exams Document Letterhead Frame */}
                    <div id="printable-daily-exams-report" className="hidden">
                      <div className="p-4 bg-white border border-slate-202 rounded-xl space-y-6 text-right" dir="rtl">
                        
                        {/* Letterhead Header */}
                        <div className="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-end">
                          <div className="text-right">
                            <h1 className="text-xl font-bold text-slate-900">🏢 الإدارة الطبية والعيادات التخصصية الشاملة</h1>
                            <p className="text-xs text-slate-500 font-bold mt-1">تقرير سجل كشوفات وفحوصات المرضى اليومي</p>
                          </div>
                          <div className="text-left font-mono">
                            <p className="text-sm font-bold text-blue-800">تاريخ الكشوفات المستهدفة: {dayjs(selectedDailyExportDate).format('YYYY/MM/DD')}</p>
                            <p className="text-[10px] text-slate-400 font-bold">تاريخ استخراج المستند: {dayjs().format('YYYY/MM/DD - hh:mm a')}</p>
                          </div>
                        </div>

                        {/* Summary statistics */}
                        <div className="grid grid-cols-4 gap-4 border border-slate-300 p-3 rounded-lg bg-slate-50 text-xs font-bold text-right pt-2 pb-2">
                          <div>تاريخ اليوم: {dayjs(selectedDailyExportDate).format('DD MMMM YYYY')}</div>
                          <div>إجمالي كشوفات اليوم: {targetVisitsForExams.length} كشوف مرصودة</div>
                          <div>أدوية مصاحبة: {targetVisitsForExams.filter(v => v.prescriptions && v.prescriptions.length > 0).length} روشتة</div>
                          <div>إجمالي مبالغ الكشوفات: {targetVisitsForExams.reduce((sum, current) => sum + (current.cost || 0), 0).toLocaleString()} ج.م</div>
                        </div>

                        {/* Detailed Records List */}
                        <div className="space-y-4 pt-4">
                          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-400 pb-1">📋 التفاصيل الإكلينيكية والتشخيص السريري لكل حالة باليوم المختار:</h3>
                          {targetVisitsForExams.map((v: any, index: number) => {
                            const pat = finalPatients.find((p: any) => p.id === v.patientId);
                            const doc = finalDoctors.find((d: any) => d.id === v.doctorId);
                            return (
                              <div key={v.id} className="p-4 border border-slate-300 rounded-lg space-y-2 text-xs" style={{ pageBreakInside: 'avoid' }}>
                                <div className="flex justify-between border-b border-slate-300 pb-1.5 mb-1.5 font-bold">
                                  <span className="text-slate-900 text-sm">#{index + 1} المريض: {pat?.name || '---'} (كود: {pat?.caseCode || '---'})</span>
                                  <span className="text-blue-900">د. {doc?.name || '---'} ({doc?.specialty || '---'})</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div><strong>العمر / الجنس:</strong> {pat?.age || '---'} سنة / {pat?.gender === 'female' ? 'أنثى' : 'ذكر'}</div>
                                  <div><strong>رقم المفوضية:</strong> {pat?.commissionNumber || '---'}</div>
                                  <div><strong>بند الكشف:</strong> {v.serviceType || '---'}</div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-1">
                                  <div>
                                    <strong>التشخيص الطبي للحالة:</strong>
                                    <p className="text-slate-800 mt-0.5">{v.diagnosis || 'كشف روتيني'}</p>
                                  </div>
                                  <div>
                                    <strong>تقييم الكشف الطبي ومخرجات الحالة:</strong>
                                    <p className="text-slate-650 mt-0.5">{v.clinicalAssessment || v.notes || '---'}</p>
                                  </div>
                                </div>

                                {v.vitals && (
                                  <div className="bg-rose-50/20 p-2 border border-slate-200 rounded mt-1 font-sans">
                                    <strong>العلامات الحيوية المقيسة بالكشف:</strong>
                                    <span className="font-mono ml-4">الحرارة: {v.vitals.temperature || '---'}°C</span> |  
                                    <span className="font-mono ml-4"> ضغط الدم: {v.vitals.bloodPressure || '---'} mmHg</span> |  
                                    <span className="font-mono ml-4"> النبض: {v.vitals.pulse || '---'} bpm</span> |  
                                    <span className="font-mono ml-4"> الوزن: {v.vitals.weight || '---'} كجم</span> |  
                                    <span className="font-mono"> الطول: {v.vitals.height || '---'} سم</span>
                                  </div>
                                )}

                                {v.prescriptions && v.prescriptions.length > 0 && (
                                  <div className="bg-emerald-50/20 p-2 border border-emerald-200 rounded mt-1.5">
                                    <strong className="text-emerald-950">💊 الروشتة المصروفة وتقرير العلاج المقرّر:</strong>
                                    <ul className="list-disc list-inside mt-1 space-y-1 text-slate-800">
                                      {v.prescriptions.map((p: any, pIdx: number) => (
                                        <li key={pIdx}>- {p.name} {p.quantity ? `(الكمية: ${p.quantity})` : ''} {p.duration ? `(المدة: ${p.duration})` : ''}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Signatures Footer */}
                        <div className="pt-12 flex justify-between text-xs font-bold border-t border-slate-300 mt-12">
                          <div>توقيع الكادر التمريضي / مدون العلامات: ______________________</div>
                          <div>توقيع وختم الطبيب المشرف على الكشف: ______________________</div>
                          <div>اعتماد إدارة العيادات والمراكز الشاملة: ______________________</div>
                        </div>

                      </div>
                    </div>

                  </div>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
