import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Stethoscope, 
  Calendar, 
  Plus, 
  Search, 
  TrendingUp, 
  FileText, 
  Upload, 
  ChevronRight, 
  ChevronLeft,
  DollarSign,
  UserPlus,
  LayoutDashboard,
  Clock,
  Menu,
  X,
  CreditCard,
  Download,
  Filter,
  BarChart as BarChartIcon,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  AreaChart, 
  Area,
  Legend,
  Cell
} from 'recharts';
import { api } from './lib/api';
import { Patient, Doctor, Visit, Report, DocAccountingSystem, Appointment } from './types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ar';

dayjs.extend(relativeTime);
dayjs.locale('ar');

type View = 'dashboard' | 'patients' | 'doctors' | 'accounting' | 'patient-profile';

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Load Initial Data
  const loadData = async () => {
    try {
      const [pts, docs, vst] = await Promise.all([
        api.getPatients(),
        api.getDoctors(),
        api.getVisits()
      ]);
      setPatients(pts);
      setDoctors(docs);
      setVisits(vst);
    } catch (error) {
      console.error("Failed to load data", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const navigateToProfile = (id: string) => {
    setSelectedPatientId(id);
    setActiveView('patient-profile');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans flex overflow-hidden" dir="rtl">
      {/* Sidebar */}
      <aside 
        className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white transition-all duration-300 flex flex-col z-50 border-l border-slate-800`}
      >
        <div className="p-6 border-b border-slate-800">
          <div className={`flex flex-col ${!isSidebarOpen && 'hidden'}`}>
            <h1 className="text-xl font-bold text-blue-400 leading-tight">مدير العيادات المتكامل</h1>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">نظام الإدارة الذكي</p>
          </div>
          {!isSidebarOpen && (
            <div className="flex justify-center">
              <Stethoscope className="text-blue-400" />
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 mt-4">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="لوحة التحكم الرئيسي" 
            active={activeView === 'dashboard'} 
            onClick={() => setActiveView('dashboard')} 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<Users size={20} />} 
            label="سجلات المرضى" 
            active={activeView === 'patients' || activeView === 'patient-profile'} 
            onClick={() => setActiveView('patients')} 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<Stethoscope size={20} />} 
            label="إدارة الأطباء" 
            active={activeView === 'doctors'} 
            onClick={() => setActiveView('doctors')} 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<DollarSign size={20} />} 
            label="المحاسبة والتقارير" 
            active={activeView === 'accounting'} 
            onClick={() => setActiveView('accounting')} 
            collapsed={!isSidebarOpen}
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-800">
            <div className="size-10 bg-slate-700 rounded-lg flex items-center justify-center font-bold text-slate-300">
              مد
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium truncate">د. أحمد القحطاني</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">مدير النظام</span>
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className="w-full mt-4 p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex justify-center"
          >
            {isSidebarOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-40">
           <div className="flex items-center bg-slate-100 rounded-full px-4 py-1.5 w-96 border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
            <Search className="text-slate-400 ml-2" size={16} />
            <input 
              type="text" 
              placeholder="بحث عن مريض بالاسم أو رقم الهاتف..." 
              className="bg-transparent border-none focus:outline-none text-sm w-full" 
            />
          </div>
          <div className="flex items-center gap-4">
             <button 
              onClick={() => setActiveView('patients')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-all active:scale-95"
            >
              + تسجيل حالة جديدة
            </button>
            <div className="size-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors relative">
              <span className="size-2 bg-red-500 rounded-full absolute top-0 right-0 border-2 border-white"></span>
              <Users size={18} />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 relative">
          <AnimatePresence mode="wait">
            {activeView === 'dashboard' && <Dashboard key="dash" patients={patients} doctors={doctors} visits={visits} navigateToProfile={navigateToProfile} />}
            {activeView === 'patients' && <PatientsView key="pts" patients={patients} onRefresh={loadData} onSelectPatient={navigateToProfile} />}
            {activeView === 'doctors' && <DoctorsView key="docs" doctors={doctors} visits={visits} onRefresh={loadData} />}
            {activeView === 'accounting' && <AccountingView key="acc" visits={visits} doctors={doctors} />}
            {activeView === 'patient-profile' && selectedPatientId && (
              <PatientProfileView 
                key="prof" 
                patientId={selectedPatientId} 
                doctors={doctors}
                onRefresh={loadData} 
                onBack={() => setActiveView('patients')}
              />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed }: { icon: any, label: string, active: boolean, onClick: () => void, collapsed: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
    >
      <span className={active ? 'text-white' : 'opacity-60'}>{icon}</span>
      {!collapsed && <span className="font-medium text-sm truncate">{label}</span>}
    </button>
  );
}

// --- Dashboard View ---
interface StatsCardConfig {
  id: string;
  label: string;
  visible: boolean;
}

function Dashboard({ patients, doctors, visits, navigateToProfile }: any) {
  const [cardConfig, setCardConfig] = useState<StatsCardConfig[]>(() => {
    const saved = localStorage.getItem('dashboard_cards');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'total-patients', label: 'إجمالي الحالات', visible: true },
      { id: 'today-visits', label: 'كشوفات اليوم', visible: true },
      { id: 'today-revenue', label: 'إيرادات اليوم', visible: true },
      { id: 'waiting-visits', label: 'زيارات الانتظار', visible: true },
    ];
  });

  const [isEditing, setIsEditing] = useState(false);

  const toggleCard = (id: string) => {
    const newConfig = cardConfig.map(c => c.id === id ? { ...c, visible: !c.visible } : c);
    setCardConfig(newConfig);
    localStorage.setItem('dashboard_cards', JSON.stringify(newConfig));
  };

  const todayVisits = visits.filter((v: any) => dayjs(v.date).isSame(dayjs(), 'day'));
  const totalCost = visits.reduce((acc: any, v: any) => acc + (v.cost || 0), 0);

  const stats = [
    { 
      id: 'total-patients',
      label: "إجمالي الحالات", 
      value: patients.length, 
      trend: "+12% عن الشهر الماضي", 
      trendColor: "text-green-500" 
    },
    { 
      id: 'today-visits',
      label: "كشوفات اليوم", 
      value: todayVisits.length, 
      trend: `جاري الكشف على ${todayVisits.filter((v: any) => dayjs(v.date).isAfter(dayjs().subtract(30, 'minute'))).length}`, 
      trendColor: "text-blue-500" 
    },
    { 
      id: 'today-revenue',
      label: "إيرادات اليوم", 
      value: `${visits.filter((v: any) => dayjs(v.date).isSame(dayjs(), 'day')).reduce((acc: any, v: any) => acc + v.cost, 0)} ج.م`, 
      trend: "نظام محاسبة الدكاترة نشط", 
      trendColor: "text-slate-400" 
    },
    { 
      id: 'waiting-visits',
      label: "زيارات الانتظار", 
      value: Math.max(0, todayVisits.length - 3), 
      trend: "تطلب مراجعة فورية", 
      trendColor: "text-red-500" 
    },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="text-blue-600" size={18} />
          <h1 className="text-sm font-black text-slate-800 uppercase tracking-wider">نظرة عامة على النشاط اليومي</h1>
        </div>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${isEditing ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
        >
          {isEditing ? 'حفظ التغييرات' : 'تخصيص اللوحة'}
        </button>
      </div>

      {isEditing && (
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-wrap gap-4 animate-in fade-in slide-in-from-top-1 duration-300">
          <p className="w-full text-[10px] font-black text-blue-600 mb-2 uppercase tracking-widest">اختر البطاقات التي تريد إظهارها:</p>
          {cardConfig.map(card => (
            <button 
              key={card.id}
              onClick={() => toggleCard(card.id)}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${card.visible ? 'bg-white text-blue-600 border-blue-200 shadow-sm' : 'bg-slate-100 text-slate-400 border-slate-200 border-dashed'}`}
            >
              {card.label}
              {card.visible ? ' ✓' : ' +'}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cardConfig.map((config) => {
          if (!config.visible) return null;
          const data = stats.find(s => s.id === config.id);
          if (!data) return null;
          return <StatsCard key={data.id} label={data.label} value={data.value} trend={data.trend} trendColor={data.trendColor} />;
        })}
      </div>

      <div className="grid grid-cols-12 gap-6 h-[500px]">
        <div className="col-span-12 lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
            <h2 className="font-bold text-slate-800">الحالات المترددة حالياً</h2>
            <button className="text-blue-600 text-xs font-bold hover:underline">عرض الكل</button>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm text-right border-collapse">
              <thead className="bg-slate-50 text-slate-500 sticky top-0 font-medium z-10">
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3">المريض</th>
                  <th className="px-6 py-3">التخصص</th>
                  <th className="px-6 py-3">الطبيب المعالج</th>
                  <th className="px-6 py-3">الحالة</th>
                  <th className="px-6 py-3">التكلفة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visits.slice(-10).reverse().map((v: any) => {
                  const pt = patients.find((p: any) => p.id === v.patientId);
                  const doc = doctors.find((d: any) => d.id === v.doctorId);
                  return (
                    <tr key={v.id} onClick={() => navigateToProfile(v.patientId)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <div>{pt?.name || 'غير معروف'}</div>
                        <div className="text-[9px] text-slate-400 font-mono italic">#{pt?.caseCode || '---'}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        <div className="text-xs">{doc?.specialty}</div>
                        <div className="text-[9px] text-blue-500 font-bold">{v.serviceType}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">د. {doc?.name}</td>
                      <td className="px-6 py-4">
                        <div className={`px-2 py-1 rounded-full text-[10px] font-bold inline-block ${dayjs(v.date).isBefore(dayjs().subtract(1, 'hour')) ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {dayjs(v.date).isBefore(dayjs().subtract(1, 'hour')) ? 'تم الكشف' : 'في الانتظار'}
                        </div>
                        {v.arrivalTime && <div className="text-[8px] text-slate-400 mt-1 font-bold">حضر: {v.arrivalTime}</div>}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-700">{v.cost} ج.م</td>
                    </tr>
                  );
                })}
                {visits.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-slate-400">لا توجد حالات مسجلة بعد</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-bold text-slate-800 mb-4">ملف آخر حالة</h2>
            {patients.length > 0 ? (
              <>
                <div className="flex items-center gap-4 mb-6">
                  <div className="size-14 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 text-xl font-bold border border-blue-100">
                    {patients[patients.length - 1].name[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-900">{patients[patients.length - 1].name}</p>
                    <p className="text-[10px] text-slate-500 font-mono tracking-tighter uppercase">رقم الملف: #MED-{patients[patients.length - 1].id.slice(0, 4)}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs border-b border-slate-50 pb-2">
                    <span className="text-slate-400">تاريخ التسجيل</span>
                    <span className="text-slate-600 font-medium">{dayjs(patients[patients.length - 1].createdAt).format('DD/MM/YYYY')}</span>
                  </div>
                  <div className="flex justify-between text-xs border-b border-slate-50 pb-2">
                    <span className="text-slate-400">رقم الهاتف</span>
                    <span className="text-slate-600 font-medium">{patients[patients.length - 1].phone}</span>
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  <button onClick={() => navigateToProfile(patients[patients.length - 1].id)} className="w-full py-2.5 bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                    عرض الملف بالكامل <ChevronLeft size={14} />
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-10 text-slate-300 text-sm italic">لا يوجد مرضى حالياً</div>
            )}
          </div>

          <div className="bg-blue-600 rounded-xl p-5 text-white shadow-lg shadow-blue-200">
            <h3 className="text-sm font-bold mb-2">نظام عمولة الأطباء</h3>
            <p className="text-[11px] opacity-80 leading-relaxed mb-4">يتم احتساب مستحقات الأطباء تلقائياً بناءً على إعدادات كل عيادة وتكلفة الكشف والخدمات الإضافية.</p>
            <div className="flex justify-between items-center bg-blue-700/50 p-3 rounded-lg border border-blue-500/30">
              <span className="text-[10px] font-bold uppercase">تحصيل الشهر الحالي</span>
              <span className="font-black text-lg">{totalCost} ج.م</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatsCard({ label, value, trend, trendColor = 'text-slate-400' }: any) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-transform hover:scale-[1.02]">
      <p className="text-slate-500 text-[10px] font-bold uppercase mb-1 tracking-wider">{label}</p>
      <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
      <p className={`${trendColor} text-[10px] font-medium mt-1`}>{trend}</p>
    </div>
  );
}

// --- Patients View ---
function PatientsView({ patients, onRefresh, onSelectPatient }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = patients.filter((p: any) => 
    p.name.includes(search) || p.phone.includes(search)
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="space-y-6"
    >
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">سجل المرضى</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">إدارة وتتبع سجلات الحالات</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-900/10 transition-all active:scale-95 text-sm"
        >
          <Plus size={18} />
          <span>إضافة مريض</span>
        </button>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-slate-50/30">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="البحث بالاسم أو رقم الهاتف..." 
              className="w-full pr-10 pl-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                <th className="px-6 py-4 border-b border-slate-100">المريض / الكود</th>
                <th className="px-6 py-4 border-b border-slate-100">الهاتف والعنوان</th>
                <th className="px-6 py-4 border-b border-slate-100">السن</th>
                <th className="px-6 py-4 border-b border-slate-100">تاريخ التسجيل</th>
                <th className="px-6 py-4 border-b border-slate-100">العمليات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {filtered.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onSelectPatient(p.id)}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold text-xs uppercase">
                        {p.name[0]}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono italic">#{p.caseCode || '---'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-600 font-mono">{p.phone}</div>
                    <div className="text-[10px] text-slate-400">{p.nationality || '---'}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{p.age} سنة</td>
                  <td className="px-6 py-4 text-slate-400 text-xs">{dayjs(p.createdAt).format('DD MMM YYYY')}</td>
                  <td className="px-6 py-4">
                    <button className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:underline">
                      عرض <ChevronLeft size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                   <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">لا يوجد مرضى مطابقين للبحث</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <PatientModal 
            onClose={() => setIsAdding(false)} 
            onSubmit={async (data: any) => {
              await api.createPatient(data);
              onRefresh();
              setIsAdding(false);
            }} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PatientModal({ onClose, onSubmit }: any) {
  const [formData, setFormData] = useState({ 
    name: "", 
    phone: "", 
    age: "", 
    gender: "male",
    nationality: "",
    caseCode: "",
    commissionNumber: "",
    dateOfBirth: ""
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="bg-white w-full max-w-lg rounded-xl overflow-hidden shadow-2xl border border-slate-200"
      >
        <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800">إضافة مريض جديد</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"><X size={20} /></button>
        </div>
        <form className="p-6 space-y-4 text-right overflow-y-auto max-h-[80vh]" onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">اسم المريض الكامل</label>
              <input required type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">كود الحالة (Case Code)</label>
              <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-mono" value={formData.caseCode} onChange={(e) => setFormData({...formData, caseCode: e.target.value})} placeholder="CODE-001" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">رقم المفوضية</label>
              <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-mono" value={formData.commissionNumber} onChange={(e) => setFormData({...formData, commissionNumber: e.target.value})} placeholder="COMM-XXX" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">رقم الهاتف</label>
              <input required type="tel" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-mono" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">الجنسية</label>
              <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm" value={formData.nationality} onChange={(e) => setFormData({...formData, nationality: e.target.value})} placeholder="مصري، سوري..." />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">تاريخ الميلاد</label>
              <input type="date" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm" value={formData.dateOfBirth} onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">السن</label>
              <input required type="number" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm" value={formData.age} onChange={(e) => setFormData({...formData, age: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">الجنس</label>
              <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm" value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})}>
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </select>
            </div>
          </div>
          <div className="pt-4">
            <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/10 text-sm">حفظ بيانات المريض</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// --- Doctors View ---
function DoctorsView({ doctors, visits, onRefresh }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<any>(null);

  const getDoctorMonthlyStats = (docId: string) => {
    const startOfMonth = dayjs().startOf('month');
    const doctorVisits = visits.filter((v: any) => v.doctorId === docId && dayjs(v.date).isAfter(startOfMonth));
    const totalEarnings = doctorVisits.reduce((acc: number, v: any) => acc + (v.doctorEarnings || 0), 0);
    
    // For daily/hybrid, we also need to count days worked if we want to show daily salary
    // However, for simplicity now, we just sum the visit earnings.
    // In a real system, we'd have a separate table for daily salaries or days worked.
    return {
      count: doctorVisits.length,
      earnings: totalEarnings
    };
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">طاقم الأطباء</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">إدارة الدكاترة ونظام المحاسبة المتقدم</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/10 text-sm"
        >
          <Plus size={18} />
          <span>إضافة دكتور</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {doctors.map((d: any) => {
          const stats = getDoctorMonthlyStats(d.id);
          return (
            <div key={d.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 h-1.5 w-full bg-blue-500/10 group-hover:bg-blue-600 transition-colors"></div>
              
              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-start gap-4">
                    <div className="size-14 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center font-bold text-xl group-hover:bg-blue-600 group-hover:text-white transition-all border border-slate-100 shadow-inner" style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                      {d.name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-black text-slate-900 text-lg">د. {d.name}</div>
                      <div className="text-[10px] text-blue-600 font-black uppercase tracking-widest px-2 py-0.5 bg-blue-50 rounded inline-block border border-blue-100/50">{d.specialty}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setEditingDoctor(d)}
                    className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  >
                    <FileText size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                    <div className="text-[9px] text-slate-400 font-black uppercase tracking-tighter mb-1">كشوفات الشهر</div>
                    <div className="text-lg font-black text-slate-800">{stats.count}</div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-center">
                    <div className="text-[9px] text-blue-600 font-black uppercase tracking-tighter mb-1">سعر الكشف</div>
                    <div className="text-lg font-black text-blue-700">{d.examinationPrice || 0} <span className="text-[10px]">ج.م</span></div>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-center col-span-2">
                    <div className="text-[9px] text-emerald-600 font-black uppercase tracking-tighter mb-1">أتعاب الشهر المتوقعة</div>
                    <div className="text-lg font-black text-emerald-700">{stats.earnings} <span className="text-[10px]">ج.م</span></div>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-50">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-bold">نظام المحاسبة</span>
                    <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {d.accountingSystem === 'fixed' ? 'أجر ثابت لكل كشف' : 
                       d.accountingSystem === 'percentage' ? 'نسبة مئوية من الكشف' :
                       d.accountingSystem === 'daily' ? 'راتب يومي ثابت' : 'نظام هجين'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-bold">معدل الدفع</span>
                    <span className="font-black text-slate-800">
                      {d.accountingSystem === 'fixed' ? `${d.fixedRate} ج.م` : 
                       d.accountingSystem === 'percentage' ? `${d.percentageRate}%` :
                       d.accountingSystem === 'daily' ? `${d.dailyRate} ج.م / يوم` : 
                       `${d.dailyRate} ج.م (يومي) + ${d.hybridExtraRate} ج.م (إضافي)`}
                    </span>
                  </div>
                  {d.accountingSystem === 'hybrid' && (
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold italic">
                      <span>حد الإضافة يبدأ بعد:</span>
                      <span>{d.hybridThreshold} كشف</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {doctors.length === 0 && <div className="col-span-full py-20 text-center text-slate-300 italic">لم يتم تسجيل أطباء بعد</div>}
      </div>

      <AnimatePresence>
        {isAdding && (
          <DoctorModal 
            onClose={() => setIsAdding(false)} 
            onSubmit={async (data: any) => {
              await api.createDoctor(data);
              onRefresh();
              setIsAdding(false);
            }} 
          />
        )}
        {editingDoctor && (
          <DoctorModal 
            initialData={editingDoctor}
            onClose={() => setEditingDoctor(null)} 
            onSubmit={async (data: any) => {
              await api.updateDoctor(editingDoctor.id, data);
              onRefresh();
              setEditingDoctor(null);
            }} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DoctorModal({ onClose, onSubmit, initialData }: any) {
  const [formData, setFormData] = useState({ 
    name: initialData?.name || "", 
    specialty: initialData?.specialty || "", 
    examinationPrice: initialData?.examinationPrice || 0,
    accountingSystem: initialData?.accountingSystem || DocAccountingSystem.FIXED,
    fixedRate: initialData?.fixedRate || 0,
    percentageRate: initialData?.percentageRate || 0,
    dailyRate: initialData?.dailyRate || 0,
    hybridThreshold: initialData?.hybridThreshold || 0,
    hybridExtraRate: initialData?.hybridExtraRate || 0
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="bg-white w-full max-w-lg rounded-xl overflow-hidden shadow-2xl border border-slate-200"
      >
        <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800">{initialData ? 'تعديل بيانات الدكتور' : 'إضافة دكتور جديد'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"><X size={20} /></button>
        </div>
        <form className="p-6 space-y-4 text-right overflow-y-auto max-h-[80vh]" onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">اسم الدكتور</label>
              <input required type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">التخصص</label>
              <input required type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm" value={formData.specialty} onChange={(e) => setFormData({...formData, specialty: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">سعر الكشف المحدد (ج.م)</label>
              <input required type="number" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-black" value={formData.examinationPrice} onChange={(e) => setFormData({...formData, examinationPrice: Number(e.target.value)})} />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">نظام محاسبة الأتعاب</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: DocAccountingSystem.FIXED, label: 'أجر ثابت مسبق' },
                { id: DocAccountingSystem.PERCENTAGE, label: 'نسبة مئوية من الكشف' },
                { id: DocAccountingSystem.DAILY, label: 'راتب يومي ثابت' },
                { id: DocAccountingSystem.HYBRID, label: 'نظام هجين (يومي + إضافي)' },
              ].map((sys) => (
                <label key={sys.id} className={`flex items-center justify-center p-3 rounded-lg border transition-all cursor-pointer text-center ${formData.accountingSystem === sys.id ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 bg-slate-50 text-slate-400'}`}>
                  <input type="radio" className="hidden" name="acc" value={sys.id} checked={formData.accountingSystem === sys.id} onChange={() => setFormData({...formData, accountingSystem: sys.id as any})} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{sys.label}</span>
                </label>
              ))}
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2 space-y-4">
              {formData.accountingSystem === DocAccountingSystem.FIXED && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">الأجر الثابت لكل كشف (ج.م)</label>
                  <input required type="number" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-black" value={formData.fixedRate} onChange={(e) => setFormData({...formData, fixedRate: Number(e.target.value)})} />
                </div>
              )}
              {formData.accountingSystem === DocAccountingSystem.PERCENTAGE && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">النسبة المئوية من سعر الكشف (%)</label>
                  <input required type="number" max="100" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-black" value={formData.percentageRate} onChange={(e) => setFormData({...formData, percentageRate: Number(e.target.value)})} />
                </div>
              )}
              {formData.accountingSystem === DocAccountingSystem.DAILY && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">الراتب اليومي الثابت (ج.م)</label>
                  <input required type="number" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-black" value={formData.dailyRate} onChange={(e) => setFormData({...formData, dailyRate: Number(e.target.value)})} />
                </div>
              )}
              {formData.accountingSystem === DocAccountingSystem.HYBRID && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">الراتب اليومي الأساسي (ج.م)</label>
                    <input required type="number" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-black" value={formData.dailyRate} onChange={(e) => setFormData({...formData, dailyRate: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">عدد الكشوفات المشمولة</label>
                    <input required type="number" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-black" value={formData.hybridThreshold} onChange={(e) => setFormData({...formData, hybridThreshold: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">سعر الكشف الإضافي (ج.م)</label>
                    <input required type="number" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-black" value={formData.hybridExtraRate} onChange={(e) => setFormData({...formData, hybridExtraRate: Number(e.target.value)})} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4">
            <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/10 text-sm">حفظ بيانات الدكتور</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// --- Patient Profile View ---
function PatientProfileView({ patientId, doctors, onRefresh, onBack }: any) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientVisits, setPatientVisits] = useState<Visit[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState<'visits' | 'reports' | 'personal' | 'appointments'>('visits');
  const [isAddingVisit, setIsAddingVisit] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  const loadProfile = async () => {
    const pts = await api.getPatients();
    const target = pts.find(p => p.id === patientId);
    if (target) {
      setPatient(target);
      const [vsts, reps, apps] = await Promise.all([
        api.getVisits(),
        api.getReports(patientId),
        api.getAppointments(patientId)
      ]);
      setPatientVisits(vsts.filter(v => v.patientId === patientId));
      setReports(reps);
      setAppointments(apps);
    }
  };

  useEffect(() => { loadProfile(); }, [patientId]);

  const [reportSort, setReportSort] = useState<{ key: string, dir: 'asc' | 'desc' }>({ key: 'createdAt', dir: 'desc' });

  const sortedReports = [...reports].sort((a: any, b: any) => {
    if (a[reportSort.key] < b[reportSort.key]) return reportSort.dir === 'asc' ? -1 : 1;
    if (a[reportSort.key] > b[reportSort.key]) return reportSort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleReportSort = (key: string) => {
    setReportSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleSendReminder = async (apptId: string) => {
    // In a real app, this would call an API that interacts with an SMS/Email gateway.
    // Here we just mark it as sent in our DB.
    await api.updateAppointment(apptId, 'scheduled', true); // I need to update API signature
    loadProfile();
  };

  if (!patient) return null;

  const tabs = [
    { id: 'visits', label: 'الزيارات', icon: <Clock size={16} /> },
    { id: 'appointments', label: 'المواعيد', icon: <Calendar size={16} /> },
    { id: 'reports', label: 'الملفات', icon: <FileText size={16} /> },
    { id: 'personal', label: 'البيانات الشخصية', icon: <Users size={16} /> },
  ];

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm text-slate-400 hover:text-slate-900">
            <ChevronRight size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">{patient.name}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
              <span className="flex items-center gap-1"><Users size={12} className="text-blue-500" /> {patient.phone}</span>
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">كود: {patient.caseCode || '---'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsAddingVisit(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-blue-700 transition-all shadow-md shadow-blue-900/10"
          >
            <Plus size={14} /> تسجيل كشف
          </button>
          <button 
            onClick={() => setIsScheduling(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-900/10"
          >
            <Calendar size={14} /> جدولة متابعة
          </button>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 pb-3 text-sm font-bold transition-all relative ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm min-h-[400px]">
        {activeTab === 'visits' && (
          <div className="p-6">
            <div className="relative border-r border-slate-100 mr-2 space-y-6">
              {patientVisits.slice().reverse().map((v: any) => {
                const doc = doctors.find((d: any) => d.id === v.doctorId);
                return (
                  <div key={v.id} className="relative pr-6 group">
                    <div className="absolute right-[-4.5px] top-1.5 size-2 bg-slate-200 rounded-full border-2 border-white group-hover:bg-blue-600 transition-colors"></div>
                    <div className="bg-slate-50/50 p-4 rounded-xl group-hover:bg-white group-hover:shadow-md border border-transparent group-hover:border-slate-100 transition-all">
                      <div className="flex items-center justify-between mb-2">
                         <div className="font-bold text-slate-800 text-sm">
                           د. {doc?.name} 
                           <span className="text-[10px] text-blue-600 font-black uppercase opacity-60 mr-2">({doc?.specialty})</span>
                           <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded mx-2">{v.serviceType}</span>
                         </div>
                         <div className="text-[10px] font-black text-slate-900 bg-white px-2 py-1 rounded border border-slate-100 font-mono">{v.cost} ج.م</div>
                      </div>
                      <div className="text-xs text-slate-500 mb-2 leading-relaxed">{v.notes}</div>
                      <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase">
                        <div>{dayjs(v.date).format('DD MMMM YYYY - hh:mm a')}</div>
                        {v.arrivalTime && <span>حضر: {v.arrivalTime}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {patientVisits.length === 0 && <div className="text-center py-20 text-slate-300 italic text-sm">لا يوجد زيارات مسجلة.</div>}
            </div>
          </div>
        )}

        {activeTab === 'appointments' && (
          <div className="p-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {appointments.slice().reverse().map((a: any) => {
                const doc = doctors.find((d: any) => d.id === a.doctorId);
                return (
                  <div key={a.id} className={`p-4 rounded-xl border ${a.status === 'scheduled' ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-bold text-slate-800 text-sm">د. {doc?.name}</div>
                        <div className="text-[10px] text-indigo-600 font-black uppercase">{doc?.specialty}</div>
                      </div>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${a.status === 'scheduled' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                        {a.status === 'scheduled' ? 'موعد قائم' : a.status === 'completed' ? 'تمت الزيارة' : 'ملغي'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 mb-3 text-xs font-bold bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <Clock size={12} className="text-indigo-400" />
                      {dayjs(a.date).format('DD MMMM YYYY - hh:mm a')}
                    </div>
                    
                    {a.reminderEnabled && a.status === 'scheduled' && (
                      <div className="flex items-center justify-between bg-blue-50/50 p-2 rounded-lg border border-blue-100 mb-3">
                         <div className="flex items-center gap-2">
                           <div className={`size-1.5 rounded-full ${a.reminderSent ? 'bg-green-500' : 'bg-blue-500 animate-pulse'}`} />
                           <span className="text-[9px] font-black text-blue-700 uppercase">
                             {a.reminderSent ? 'تم إرسال التذكير' : `تذكير تلقائي (قبل ${a.reminderLeadTimeHours}س)`}
                           </span>
                         </div>
                         {!a.reminderSent && (
                           <button 
                            onClick={() => handleSendReminder(a.id)}
                            className="text-[9px] font-black text-white bg-blue-600 px-2 py-1 rounded hover:bg-blue-700 transition-all uppercase"
                           >
                             إرسال الآن
                           </button>
                         )}
                      </div>
                    )}

                    <div className="text-[11px] text-slate-500 italic mb-4 line-clamp-2">{a.notes || 'لا يوجد ملاحظات إضافية'}</div>
                    
                    {a.status === 'scheduled' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={async () => { await api.updateAppointment(a.id, 'completed'); loadProfile(); }}
                          className="flex-1 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black uppercase rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                        >
                          إتمام الكشف
                        </button>
                        <button 
                          onClick={async () => { await api.updateAppointment(a.id, 'cancelled'); loadProfile(); }}
                          className="flex-1 py-2 bg-white text-slate-400 border border-slate-200 text-[10px] font-black uppercase rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all"
                        >
                          إلغاء
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {appointments.length === 0 && <div className="col-span-full py-20 text-center text-slate-300 italic text-sm">لا يوجد مواعيد متابعة مجدولة.</div>}
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">سجل التقارير والأشعة والروشتات</h3>
              <button 
                onClick={() => setIsUploading(true)}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-md shadow-emerald-900/10"
              >
                <Upload size={14} /> رفع ملف جديد
              </button>
            </div>
            
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest text-center">
                    <th className="px-6 py-4 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => toggleReportSort('createdAt')}>
                      التاريخ {reportSort.key === 'createdAt' && (reportSort.dir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-4 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors text-right" onClick={() => toggleReportSort('title')}>
                      العنوان {reportSort.key === 'title' && (reportSort.dir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-4 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => toggleReportSort('type')}>
                      النوع {reportSort.key === 'type' && (reportSort.dir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-4 border-b border-slate-100">الزيارة المرتبطة</th>
                    <th className="px-6 py-4 border-b border-slate-100">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sortedReports.map((r: any) => {
                    const associatedVisit = patientVisits.find(v => v.id === r.visitId);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors text-center">
                        <td className="px-6 py-4 text-xs text-slate-500 font-bold">{dayjs(r.createdAt).format('DD MMM YYYY')}</td>
                        <td className="px-6 py-4 font-bold text-sm text-slate-800 text-right">{r.title}</td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            r.type === 'prescription' ? 'bg-amber-100 text-amber-700' : 
                            r.type === 'report' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {r.type === 'prescription' ? 'روشتة' : r.type === 'report' ? 'تقرير' : 'أخرى'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {associatedVisit ? (
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-slate-600 italic">كشف {dayjs(associatedVisit.date).format('DD/MM')}</span>
                              <span className="text-[9px] text-slate-400">د. {doctors.find((d: any) => d.id === associatedVisit.doctorId)?.name}</span>
                            </div>
                          ) : <span className="text-slate-300">---</span>}
                        </td>
                        <td className="px-6 py-4">
                           <a 
                            href={`/uploads/${r.filename}`} target="_blank" rel="noreferrer"
                            className="inline-block bg-slate-800 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-blue-600 transition-all shadow-sm"
                          >
                            فتح الملف
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                  {reports.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-slate-300 italic text-sm">لا يوجد ملفات طبية حالياً</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'personal' && (
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b border-blue-50 pb-2">المعلومات الأساسية</h4>
                <div className="space-y-4">
                   <InfoRow label="الاسم الكامل" value={patient.name} />
                   <InfoRow label="رقم الهاتف" value={patient.phone} />
                   <InfoRow label="السن" value={`${patient.age} سنة`} />
                   <InfoRow label="الجنس" value={patient.gender === 'male' ? 'ذكر' : 'أنثى'} />
                   <InfoRow label="تاريخ الميلاد" value={patient.dateOfBirth || 'غير مسجل'} />
                </div>
              </div>
              <div className="space-y-6">
                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b border-blue-50 pb-2">البيانات الإدارية</h4>
                <div className="space-y-4">
                   <InfoRow label="الجنسية" value={patient.nationality || '---'} />
                   <InfoRow label="كود الحالة" value={patient.caseCode || '---'} />
                   <InfoRow label="رقم المفوضية" value={patient.commissionNumber || '---'} />
                   <InfoRow label="تاريخ التسجيل" value={dayjs(patient.createdAt).format('DD MMMM YYYY')} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAddingVisit && (
          <VisitModal 
            onClose={() => setIsAddingVisit(false)} 
            doctors={doctors}
            onSubmit={async (data: any) => {
              await api.createVisit({ ...data, patientId });
              loadProfile();
              setIsAddingVisit(false);
            }} 
          />
        )}
        {isUploading && (
          <UploadModal 
            onClose={() => setIsUploading(false)} 
            visits={patientVisits}
            doctors={doctors}
            onUpload={async (file: File, title: string, type: string, visitId: string) => {
              await api.uploadReport(patientId, file, title, type, visitId);
              loadProfile();
              setIsUploading(false);
            }} 
          />
        )}
        {isScheduling && (
          <AppointmentModal 
            onClose={() => setIsScheduling(false)} 
            doctors={doctors}
            onSubmit={async (data: any) => {
              await api.createAppointment({ ...data, patientId });
              loadProfile();
              setIsScheduling(false);
              setActiveTab('appointments');
            }} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InfoRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-3 last:border-0">
      <span className="text-slate-400 font-bold">{label}</span>
      <span className="text-slate-700 font-black">{value}</span>
    </div>
  );
}

function VisitModal({ onClose, doctors, onSubmit }: any) {
  const [formData, setFormData] = useState({ 
    doctorId: doctors[0]?.id || "", 
    basePrice: doctors[0]?.examinationPrice || 0, 
    notes: "", 
    date: dayjs().format('YYYY-MM-DDTHH:mm'),
    arrivalTime: dayjs().format('HH:mm'),
    departureTime: "",
    serviceType: "كشف عادي",
    sendingAdministration: ""
  });

  // Auto-populate price when doctor changes
  useEffect(() => {
    const selectedDoc = doctors.find((d: any) => d.id === formData.doctorId);
    if (selectedDoc) {
      setFormData(prev => ({ ...prev, basePrice: selectedDoc.examinationPrice || 0 }));
    }
  }, [formData.doctorId, doctors]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="bg-white w-full max-w-md rounded-xl overflow-hidden shadow-2xl border border-slate-200"
      >
        <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800">تسجيل كشف جديد</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"><X size={20} /></button>
        </div>
        <form className="p-6 space-y-4 text-right" onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">بند الحجز / نوع الخدمة</label>
            <select required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold" value={formData.serviceType} onChange={(e) => setFormData({...formData, serviceType: e.target.value})}>
              <option value="كشف عادي">كشف عادي</option>
              <option value="استشارة">استشارة</option>
              <option value="طوارئ">طوارئ</option>
              <option value="فحص شامل">فحص شامل</option>
              <option value="خدمة تمريض">خدمة تمريض</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">الطبيب المعالج</label>
            <select required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold" value={formData.doctorId} onChange={(e) => setFormData({...formData, doctorId: e.target.value})}>
              <option value="">اختر الطبيب</option>
              {doctors.map((d: any) => <option key={d.id} value={d.id}>د. {d.name} ({d.specialty})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">سعر الكشف (ج.م)</label>
              <input required type="number" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-black" value={formData.basePrice} onChange={(e) => setFormData({...formData, basePrice: Number(e.target.value)})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">الإدارة المرسلة (اختياري)</label>
              <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold" value={formData.sendingAdministration} onChange={(e) => setFormData({...formData, sendingAdministration: e.target.value})} placeholder="مثال: التأمين الصحي" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">تاريخ الزيارة</label>
              <input required type="datetime-local" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">ميعاد الحضور</label>
              <input type="time" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm" value={formData.arrivalTime} onChange={(e) => setFormData({...formData, arrivalTime: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">ميعاد الانصراف</label>
              <input type="time" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm" value={formData.departureTime} onChange={(e) => setFormData({...formData, departureTime: e.target.value})} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">ملاحظات طبية</label>
            <textarea rows={2} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="الشكوى والتشخيص الأولي..." />
          </div>
          <div className="pt-4">
            <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/10 text-sm">تسجيل الكشف</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function AppointmentModal({ onClose, doctors, onSubmit }: any) {
  const [formData, setFormData] = useState({ 
    doctorId: doctors[0]?.id || "", 
    date: dayjs().add(1, 'week').format('YYYY-MM-DDTHH:mm'),
    notes: "",
    reminderEnabled: true,
    reminderLeadTimeHours: 24
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="bg-white w-full max-w-md rounded-xl overflow-hidden shadow-2xl border border-slate-200"
      >
        <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800">جدولة موعد متابعة</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"><X size={20} /></button>
        </div>
        <form className="p-6 space-y-4 text-right" onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">الطبيب المطلوب</label>
            <select required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold" value={formData.doctorId} onChange={(e) => setFormData({...formData, doctorId: e.target.value})}>
              <option value="">اختر الطبيب</option>
              {doctors.map((d: any) => <option key={d.id} value={d.id}>د. {d.name} ({d.specialty})</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">تاريخ الموعد</label>
            <input required type="datetime-local" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
          </div>
          <div className="space-y-3 pt-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">تفعيل التذكير التلقائي</label>
              <button 
                type="button"
                onClick={() => setFormData({...formData, reminderEnabled: !formData.reminderEnabled})}
                className={`w-10 h-5 rounded-full transition-all relative ${formData.reminderEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 size-3 bg-white rounded-full transition-all ${formData.reminderEnabled ? 'right-6' : 'right-1'}`} />
              </button>
            </div>
            {formData.reminderEnabled && (
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-loose">موعد التذكير (قبل الموعد بـ ساعة)</label>
                <input type="number" className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-xs font-bold" value={formData.reminderLeadTimeHours} onChange={(e) => setFormData({...formData, reminderLeadTimeHours: Number(e.target.value)})} />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">ملاحظات للمتابعة</label>
            <textarea rows={2} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="السبب من المتابعة..." />
          </div>
          <div className="pt-4">
            <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/10 text-sm">جدولة الموعد</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function UploadModal({ onClose, onUpload, visits, doctors }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<'prescription' | 'report' | 'other'>('prescription');
  const [visitId, setVisitId] = useState("");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="bg-white w-full max-w-md rounded-xl overflow-hidden shadow-2xl border border-slate-200"
      >
        <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800">رفع ملف طبي</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"><X size={20} /></button>
        </div>
        <form className="p-6 space-y-4 text-right" onSubmit={(e) => { e.preventDefault(); if(file) onUpload(file, title, type, visitId); }}>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">نوع الملف</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setType('prescription')} className={`flex-1 p-3 rounded-lg border transition-all font-black text-[10px] uppercase tracking-widest ${type === 'prescription' ? 'border-emerald-600 bg-emerald-50 text-emerald-600' : 'border-slate-100 bg-slate-50 text-slate-400'}`}>روشتة</button>
              <button type="button" onClick={() => setType('report')} className={`flex-1 p-3 rounded-lg border transition-all font-black text-[10px] uppercase tracking-widest ${type === 'report' ? 'border-emerald-600 bg-emerald-50 text-emerald-600' : 'border-slate-100 bg-slate-50 text-slate-400'}`}>تقرير طبي</button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">عنوان الملف</label>
            <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all text-sm" placeholder="مثال: تحليل دم، أشعة..." value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">ارتباط بزيارة (اختياري)</label>
            <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold" value={visitId} onChange={(e) => setVisitId(e.target.value)}>
              <option value="">لا يوجد ارتباط</option>
              {visits.slice().reverse().map((v: any) => (
                <option key={v.id} value={v.id}>
                  كشف {dayjs(v.date).format('DD/MM')} - د. {doctors.find((d: any) => d.id === v.doctorId)?.name}
                </option>
              ))}
            </select>
          </div>
          <div 
            className="border border-dashed border-slate-200 rounded-xl p-6 text-center bg-slate-50 hover:bg-white hover:border-emerald-200 transition-all cursor-pointer relative group"
          >
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <div className="flex flex-col items-center gap-2">
              <div className="size-10 bg-white rounded-lg flex items-center justify-center shadow-sm text-slate-400 group-hover:text-emerald-500 border border-slate-100">
                <Upload size={18} />
              </div>
              <div className="font-bold text-xs text-slate-600 truncate max-w-64">{file ? file.name : 'اسحب الملف هنا أو اضغط للاختيار'}</div>
              <div className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">PDF, JPG, PNG up to 10MB</div>
            </div>
          </div>
          <div className="pt-4">
            <button type="submit" disabled={!file} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-lg shadow-emerald-900/10 text-sm disabled:opacity-50">رفع الملف الآن</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function AccountingView({ visits, doctors }: any) {
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [dateRange, setDateRange] = useState({ 
    start: dayjs().startOf('month').format('YYYY-MM-DD'), 
    end: dayjs().endOf('month').format('YYYY-MM-DD') 
  });

  const filteredVisits = visits.filter((v: any) => {
    const d = dayjs(v.date);
    return d.isAfter(dayjs(dateRange.start).subtract(1, 'day')) && d.isBefore(dayjs(dateRange.end).add(1, 'day'));
  });

  const totalRev = filteredVisits.reduce((acc: any, v: any) => acc + (v.cost || 0), 0);
  const totalDoc = filteredVisits.reduce((acc: any, v: any) => acc + (v.doctorEarnings || 0), 0);
  const totalClinic = filteredVisits.reduce((acc: any, v: any) => acc + (v.clinicEarnings || 0), 0);

  // Prepare Chart Data (group by day)
  const chartData = Array.from({ length: dayjs(dateRange.end).diff(dayjs(dateRange.start), 'day') + 1 }).map((_, i) => {
    const date = dayjs(dateRange.start).add(i, 'day');
    const dayVisits = filteredVisits.filter((v: any) => dayjs(v.date).isSame(date, 'day'));
    return {
      name: date.format('DD/MM'),
      إيرادات: dayVisits.reduce((acc: any, v: any) => acc + (v.cost || 0), 0),
      أطباء: dayVisits.reduce((acc: any, v: any) => acc + (v.doctorEarnings || 0), 0),
      أرباح: dayVisits.reduce((acc: any, v: any) => acc + (v.clinicEarnings || 0), 0),
    };
  });

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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
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
            <span className="text-slate-300">|</span>
            <input 
              type="date" 
              className="bg-transparent border-none text-[10px] font-bold focus:outline-none" 
              value={dateRange.end} 
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})} 
            />
          </div>
          <button 
            onClick={exportFinancialReport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
          >
            <Download size={14} /> تصدير CSV
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-1 w-full bg-blue-500 transition-colors"></div>
          <div className="flex items-center justify-between mb-4">
            <div className="size-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
              <TrendingUp size={20} />
            </div>
            <div className="text-blue-500 text-[10px] font-black uppercase tracking-widest">إجمالي الإيرادات</div>
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">{totalRev} <span className="text-xs font-normal text-slate-400">ج.م</span></div>
          <div className="mt-2 text-[10px] text-slate-400 font-bold uppercase">المبلغ الإجمالي المحصل من المرضى</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-1 w-full bg-emerald-500 transition-colors"></div>
          <div className="flex items-center justify-between mb-4">
            <div className="size-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
              <Stethoscope size={20} />
            </div>
            <div className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">أتعاب الأطباء</div>
          </div>
          <div className="text-3xl font-black text-emerald-600 tracking-tight">{totalDoc} <span className="text-xs font-normal text-emerald-400">ج.م</span></div>
          <div className="mt-2 text-[10px] text-slate-400 font-bold uppercase">إجمالي العمولات والرواتب اليومية</div>
        </div>
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-1 w-full bg-indigo-500 transition-colors"></div>
          <div className="flex items-center justify-between mb-4">
            <div className="size-10 bg-slate-800 rounded-lg flex items-center justify-center text-indigo-400">
              <DollarSign size={20} />
            </div>
            <div className="text-indigo-400 text-[10px] font-black uppercase tracking-widest">صافي ربح العيادة</div>
          </div>
          <div className="text-3xl font-black text-white tracking-tight">{totalClinic} <span className="text-xs font-normal text-indigo-400/50">ج.م</span></div>
          <div className="mt-2 text-[10px] text-slate-500 font-bold uppercase">ما يتبقى للعيادة بعد خصم الأتعاب</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-500" />
              مؤشرات الأداء المالي
            </h3>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setChartType('bar')}
                className={`p-1.5 rounded-md transition-all ${chartType === 'bar' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
              >
                <BarChartIcon size={14} />
              </button>
              <button 
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
                  <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} dy={10} />
                  <YAxis fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} dx={-10} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    cursor={{ fill: '#F1F5F9' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                  <Bar dataKey="إيرادات" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="أرباح" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              ) : (
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} dy={10} />
                  <YAxis fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} dx={-10} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                  <Area type="monotone" dataKey="إيرادات" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                  <Area type="monotone" dataKey="أرباح" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden flex flex-col">
          <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2 mb-6">
            <PieChartIcon size={16} className="text-blue-500" />
            توزيع الإيراد حسب التخصص
          </h3>
          <div className="flex-1 flex flex-col justify-center">
             <div className="space-y-4">
                {Array.from(new Set(doctors.map((d: any) => d.specialty))).map(spec => {
                  const specVisits = filteredVisits.filter((v: any) => doctors.find((d: any) => d.id === v.doctorId)?.specialty === spec);
                  const specRev = specVisits.reduce((acc: any, v: any) => acc + (v.cost || 0), 0);
                  const percentage = totalRev > 0 ? (specRev / totalRev) * 100 : 0;
                  return (
                    <div key={spec}>
                      <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-tighter">
                        <span>{spec}</span>
                        <span>{percentage.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${percentage}%` }} 
                          className="h-full bg-blue-500 rounded-full" 
                        />
                      </div>
                    </div>
                  );
                })}
                {totalRev === 0 && <div className="text-center py-10 text-slate-300 italic text-sm">لا توجد بيانات للفترة المختارة</div>}
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/20">
             <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2">
               <Users size={16} className="text-blue-500" />
               كشف رواتب ومستحقات الأطباء (Payroll)
             </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
               <thead>
                 <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                   <th className="px-6 py-4">اسم الطبيب</th>
                   <th className="px-6 py-4">التخصص</th>
                   <th className="px-6 py-4">نظام المحاسبة</th>
                   <th className="px-6 py-4">عدد الزيارات</th>
                   <th className="px-6 py-4">إجمالي الإيرادات</th>
                   <th className="px-6 py-4">الاستقطاعات</th>
                   <th className="px-6 py-4">صافي المستحق</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50 font-bold text-sm">
                 {doctors.map((d: any) => {
                    const docVisits = filteredVisits.filter((v: any) => v.doctorId === d.id);
                    const earnings = docVisits.reduce((acc: any, v: any) => acc + (v.doctorEarnings || 0), 0);
                    const revenue = docVisits.reduce((acc: any, v: any) => acc + (v.cost || 0), 0);
                    
                    // Deductions placeholder (can be expanded later if needed)
                    const deductions = 0; 
                    const netPay = earnings - deductions;

                    if (docVisits.length === 0 && earnings === 0) return null;

                    return (
                      <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-black">د. {d.name}</td>
                        <td className="px-6 py-4 text-xs">
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">{d.specialty}</span>
                        </td>
                        <td className="px-6 py-4 text-[10px] text-slate-400 uppercase tracking-tighter">
                          {d.accountingSystem === 'fixed' ? 'ثابت' : 
                           d.accountingSystem === 'percentage' ? 'نسبة' :
                           d.accountingSystem === 'daily' ? 'يومي' : 'هجين'}
                        </td>
                        <td className="px-6 py-4">{docVisits.length}</td>
                        <td className="px-6 py-4 font-mono">{revenue} ج.م</td>
                        <td className="px-6 py-4 font-mono text-red-500">{deductions} ج.م</td>
                        <td className="px-6 py-4">
                          <span className="text-emerald-600 font-mono text-lg">{netPay} ج.م</span>
                        </td>
                      </tr>
                    );
                 })}
                 {doctors.filter((d: any) => filteredVisits.some((v: any) => v.doctorId === d.id)).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center text-slate-300 italic text-sm">لا توجد بيانات رواتب للفترة المختارة</td>
                  </tr>
                 )}
               </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
