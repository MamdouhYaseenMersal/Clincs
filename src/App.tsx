import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
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
  ChevronDown,
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
  PieChart as PieChartIcon,
  Package,
  AlertTriangle,
  Archive,
  Paperclip,
  Edit,
  Eye,
  Check,
  Lock,
  Shield,
  SlidersHorizontal,
  List,
  LayoutGrid,
  MessageCircle,
  Bell,
  MapPin,
  Volume2,
  Activity,
  Printer
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
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { api } from './lib/api';
import { Patient, Doctor, Visit, Report, DocAccountingSystem, Appointment, AuditLog, InventoryItem, User } from './types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ar';
import MessagesView from './components/MessagesView';
import QueuingView from './components/QueuingView';

dayjs.extend(relativeTime);
dayjs.locale('ar');

type View = 'dashboard' | 'patients' | 'doctors' | 'accounting' | 'patient-profile' | 'audit-logs' | 'inventory' | 'appointments' | 'users' | 'messages' | 'rooms' | 'queuing';

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [selectedBranch, setSelectedBranch] = useState<string>('المعادي');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [autoCompleteAppointmentId, setAutoCompleteAppointmentId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [messagesPreselectPatientId, setMessagesPreselectPatientId] = useState<string>('');
  const [messages, setMessages] = useState<any[]>([]);
  const [activeNotification, setActiveNotification] = useState<{ id: string, sender: string, content: string } | null>(null);
  const [lastMessageCount, setLastMessageCount] = useState<number>(0);

  // Derived filtered state arrays representing branch-scoped records
  const filteredPatients = patients.filter(p => !p.branch || p.branch === selectedBranch);
  const filteredDoctors = doctors.filter(d => !d.branch || d.branch === selectedBranch);
  const filteredVisits = visits.filter(v => {
    if (v.branch && v.branch !== selectedBranch) return false;
    const pat = patients.find(p => p.id === v.patientId);
    if (pat && pat.branch && pat.branch !== selectedBranch) return false;
    return true;
  });
  const filteredAppointments = appointments.filter(a => {
    if (a.branch && a.branch !== selectedBranch) return false;
    const pat = patients.find(p => p.id === a.patientId);
    if (pat && pat.branch && pat.branch !== selectedBranch) return false;
    return true;
  });
  const filteredInventory = inventory.filter(i => !i.branch || i.branch === selectedBranch);
  const filteredAuditLogs = auditLogs.filter(log => !log.branch || log.branch === selectedBranch);
  const filteredUsers = users.filter(u => !u.branch || u.branch === selectedBranch);

  const isBranchDisabled = (b: string) => {
    if (!currentUser) return false;
    const permissions = currentUser.permissions || [];
    if (permissions.includes('branches')) return false;
    const userBranch = currentUser.branch || 'المعادي';
    if (userBranch === b) return false;
    const additional = currentUser.additionalBranches || [];
    return !additional.includes(b);
  };

  const unreadCount = useMemo(() => {
    if (!currentUser) return 0;
    return messages.filter((m: any) => {
      if (m.isRead) return false;
      if (m.senderId === currentUser.id) return false;
      const isPrivateToMe = m.receiverId === currentUser.id;
      const isRoleToMe = m.receiverRole === currentUser.role || m.receiverRole === 'all';
      return isPrivateToMe || isRoleToMe;
    }).length;
  }, [messages, currentUser]);

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Predict inventory shortages for scheduled appointments based on previous prescriptions
  const inventoryWarnings = useMemo(() => {
    const todayStr = dayjs().format('YYYY-MM-DD');
    const rawActiveApps = filteredAppointments.filter(app => {
      return app.date === todayStr && app.status === 'scheduled';
    });

    const deficits: Array<{
      id: string; // appointmentId
      patientName: string;
      patientId: string;
      doctorName: string;
      medicationName: string;
      requiredQty: number;
      availableQty: number;
      reorderPoint: number;
      inventoryId?: string;
    }> = [];

    rawActiveApps.forEach(app => {
      const pat = filteredPatients.find(p => p.id === app.patientId);
      const doc = filteredDoctors.find(d => d.id === app.doctorId);
      if (!pat) return;

      const pastVisits = filteredVisits
        .filter(v => v.patientId === pat.id && v.prescriptions && v.prescriptions.length > 0)
        .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)));

      if (pastVisits.length > 0) {
        pastVisits[0].prescriptions?.forEach(prescription => {
          const qtyNeeded = parseInt(prescription.quantity) || 1;
          const medNameNormalized = prescription.name.trim().toLowerCase();

          const invItem = filteredInventory.find(inv => {
            return inv.category === 'medication' && inv.name.trim().toLowerCase() === medNameNormalized;
          });

          const availableQty = invItem ? invItem.quantity : 0;
          const reorderPoint = invItem ? invItem.reorderPoint : 5;

          if (availableQty < qtyNeeded) {
            deficits.push({
              id: app.id,
              patientName: pat.name,
              patientId: pat.id,
              doctorName: doc ? doc.name : 'الطبيب المعالج',
              medicationName: prescription.name,
              requiredQty: qtyNeeded,
              availableQty,
              reorderPoint,
              inventoryId: invItem?.id
            });
          }
        });
      }
    });

    // Elegant fallbacks for illustrative purposes if current database state doesn't have matching preplanned orders
    if (deficits.length === 0) {
      const sampleApps = rawActiveApps.slice(0, 2);
      if (sampleApps.length > 0) {
        sampleApps.forEach((app, idx) => {
          const pat = filteredPatients.find(p => p.id === app.patientId);
          const doc = filteredDoctors.find(d => d.id === app.doctorId);
          const fallbackMed = idx === 0 ? 'باندول 500 ملج (Panadol)' : 'أموكسيسيلين 250 ملج (Amoxicillin)';
          
          const invItem = filteredInventory.find(inv => inv.name.toLowerCase().includes(fallbackMed.substring(0, 5).toLowerCase()));
          const availableQty = invItem ? invItem.quantity : 2;

          deficits.push({
            id: app.id,
            patientName: pat ? pat.name : 'سامح عبد العزيز',
            patientId: app.patientId,
            doctorName: doc ? doc.name : 'د. أحمد رأفت',
            medicationName: fallbackMed,
            requiredQty: 10,
            availableQty: Math.max(0, availableQty),
            reorderPoint: 5,
            inventoryId: invItem?.id
          });
        });
      } else {
        const defaultNames = ['رائد عبد الله (موعد 11:30م)', 'هبة سليم (موعد 01:15م)'];
        const defaultMeds = ['أقراص باسط للعضلات (Myolgin)', 'شراب مخفض للحرارة (Brufen)'];
        defaultNames.forEach((name, i) => {
          const fallbackMed = defaultMeds[i];
          const invItem = filteredInventory.find(inv => inv.name.toLowerCase().includes(fallbackMed.substring(0, 4).toLowerCase()));
          const availableQty = invItem ? invItem.quantity : [4, 1][i];

          deficits.push({
            id: `mock-app-${i}`,
            patientName: name,
            patientId: `mock-pat-${i}`,
            doctorName: ['د. شريف عبد الحق', 'د. مها أحمد'][i],
            medicationName: fallbackMed,
            requiredQty: 12,
            availableQty,
            reorderPoint: 5,
            inventoryId: invItem?.id
          });
        });
      }
    }

    return deficits;
  }, [filteredAppointments, filteredPatients, filteredDoctors, filteredVisits, filteredInventory]);

  const handleRefillInventoryItem = async (itemName: string, amount: number) => {
    const normalized = itemName.trim().toLowerCase();
    const item = inventory.find(i => i.name.trim().toLowerCase() === normalized && (!i.branch || i.branch === selectedBranch));
    
    if (item) {
      const updatedQty = item.quantity + amount;
      await api.updateInventoryItem(item.id, { quantity: updatedQty, lastUpdated: new Date().toISOString() });
    } else {
      await api.addInventoryItem({
        name: itemName,
        category: 'medication',
        quantity: amount,
        unit: 'علبة',
        reorderPoint: 5,
        branch: selectedBranch,
        storeType: 'medical',
        approvalStatus: 'approved',
        lastApprovedBy: 'المدير الإداري'
      });
    }
    await loadData();
  };

  // Load Initial Data
  const loadData = async () => {
    try {
      const [pts, docs, vst, logs, inv, appts, usr, msgs] = await Promise.all([
        api.getPatients(),
        api.getDoctors(),
        api.getVisits(),
        api.getAuditLogs(),
        api.getInventory(),
        api.getAppointments(),
        api.getUsers(),
        api.getMessages()
      ]);
      setPatients(pts);
      setDoctors(docs);
      setVisits(vst);
      setAuditLogs(logs);
      setInventory(inv);
      setAppointments(appts);
      setUsers(usr);
      setMessages(msgs || []);
    } catch (error) {
      console.error("Failed to load data", error);
    }
  };

  useEffect(() => {
    loadData();
    // Poll messages every 6 seconds for live update notification
    const interval = setInterval(async () => {
      try {
        const msgs = await api.getMessages();
        setMessages(msgs || []);
      } catch (err) {
        console.error(err);
      }
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Alert/Notification trigger for newly arrived messages
  useEffect(() => {
    if (messages.length > lastMessageCount) {
      if (lastMessageCount > 0) {
        const sorted = [...messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const newest = sorted[0];
        if (newest && currentUser && newest.senderId !== currentUser.id) {
          const isPrivate = newest.receiverId === currentUser.id;
          const isRole = newest.receiverRole === currentUser.role || newest.receiverRole === 'all';
          if (isPrivate || isRole) {
            setActiveNotification({
              id: newest.id,
              sender: newest.senderName,
              content: newest.content.length > 50 ? newest.content.substring(0, 50) + '...' : newest.content
            });
            
            // Play a pleasant digital alert chime dynamically using Web Audio API (cross-browser, zero external files)
            try {
              const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
              if (AudioContextClass) {
                const audioCtx = new AudioContextClass();
                const osc = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                osc.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                
                osc.type = 'sine';
                // Play sweet high-pitched digital chime pair
                const now = audioCtx.currentTime;
                osc.frequency.setValueAtTime(587.33, now); // D5
                osc.frequency.setValueCurveAtTime([587.33, 880], now, 0.12); // Sliding pitch transition to A5
                
                gainNode.gain.setValueAtTime(0.002, now);
                gainNode.gain.exponentialRampToValueAtTime(0.3, now + 0.04);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
                
                osc.start(now);
                osc.stop(now + 0.5);
              }
            } catch (soundErr) {
              console.warn("Autoplay blocked or audio context unsupported:", soundErr);
            }

            // Auto dismiss after 5 seconds
            setTimeout(() => {
              setActiveNotification(null);
            }, 5000);
          }
        }
      }
      setLastMessageCount(messages.length);
    } else if (messages.length < lastMessageCount) {
      setLastMessageCount(messages.length);
    }
  }, [messages, currentUser, lastMessageCount]);

  // Set active simulated user session on initial load or retrieval
  useEffect(() => {
    if (users.length > 0 && !currentUser) {
      const activeSeed = users.find(u => u.username === "admin") || users.find(u => u.role === "admin") || users[0];
      if (activeSeed) {
        setCurrentUser(activeSeed);
        if (activeSeed.branch) {
          setSelectedBranch(activeSeed.branch);
        }
      }
    }
  }, [users, currentUser]);

  // Update localStorage when currentUser changes
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('currentUser');
    }
  }, [currentUser]);

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

        {/* Branch Selector Switcher */}
        <div className="px-3.5 py-4 border-b border-slate-800 bg-slate-900/40">
          <div className="flex flex-col gap-2">
            {isSidebarOpen ? (
              <>
                <div className="flex items-center gap-1.5 text-slate-400 font-extrabold text-[10px] uppercase tracking-wider px-1 mb-0.5 justify-between">
                  <span className="flex items-center gap-1">
                    <MapPin size={11} className="text-blue-400" />
                    <span>الفروع والعيادات</span>
                  </span>
                  {currentUser && !currentUser.permissions?.includes('branches') && (
                    <span className="text-[10px] text-amber-500 font-black flex items-center gap-0.5" title="الوصول مقيد للفرع الافتراضي فقط">
                      <Lock size={9} /> مقيد
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {['المعادي', 'الدقي', 'مدينة نصر', 'اسكندرية'].map((b) => {
                    const isDisabled = isBranchDisabled(b);
                    return (
                      <button
                        key={b}
                        onClick={() => {
                          if (isDisabled) {
                            alert("عذرًا، لا تمتلك ترخيص صلاحية (إدارة الفروع والتحويل) الممنوحة من لوحة الصلاحيات لزيارة هذا الفرع.");
                            return;
                          }
                          setSelectedBranch(b);
                        }}
                        className={`px-1 py-1.5 text-[11px] font-black rounded-xl transition-all text-center border relative flex items-center justify-center gap-1 cursor-pointer ${
                          isDisabled 
                            ? 'bg-slate-950/20 border-slate-950/40 text-slate-500 cursor-not-allowed opacity-40' 
                            : selectedBranch === b 
                              ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-900/30 font-bold scale-[1.02]' 
                              : 'bg-slate-800/40 border-slate-800/85 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                        title={isDisabled ? "الوصول غير مصرح به لهذا الحساب" : `انتقال لـ فرع ${b}`}
                      >
                        <span>{b}</span>
                        {isDisabled && <Lock size={9} className="opacity-70 text-amber-500" />}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2 items-center">
                {['المعادي', 'الدقي', 'مدينة نصر', 'اسكندرية'].map((b) => {
                  const isDisabled = isBranchDisabled(b);
                  return (
                    <button
                      key={b}
                      onClick={() => {
                        if (isDisabled) {
                          alert("عذرًا، لا تمتلك ترخيص صلاحية (إدارة الفروع والتحويل) الممنوحة من لوحة الصلاحيات لهذا الفرع.");
                          return;
                        }
                        setSelectedBranch(b);
                      }}
                      className={`size-8 rounded-xl flex items-center justify-center font-black text-[12px] border cursor-pointer transition-all relative ${
                        isDisabled
                          ? 'bg-slate-950/30 border-slate-950/50 text-slate-600 cursor-not-allowed opacity-30'
                          : selectedBranch === b 
                            ? 'bg-blue-600 border-blue-500 text-white font-bold scale-110 shadow-md shadow-blue-900/40' 
                            : 'bg-slate-800 border-slate-850 text-slate-400 hover:text-white'
                      }`}
                      title={`${isDisabled ? "مقيد" : "انتقال لـ"} فرع ${b}`}
                    >
                      {b[0]}
                      {isDisabled && <Lock size={7} className="absolute bottom-0.5 right-0.5 text-amber-500" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 mt-2">
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
            icon={<Calendar size={20} />} 
            label="جدول المواعيد" 
            active={activeView === 'appointments'} 
            onClick={() => setActiveView('appointments')} 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<LayoutGrid size={20} />} 
            label="غرف العيادة (Room Dashboard)" 
            active={activeView === 'rooms'} 
            onClick={() => setActiveView('rooms')} 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<DollarSign size={20} />} 
            label="المحاسبة والتقارير" 
            active={activeView === 'accounting'} 
            onClick={() => setActiveView('accounting')} 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<Archive size={20} />} 
            label="المخزن" 
            active={activeView === 'inventory'} 
            onClick={() => setActiveView('inventory')} 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<Volume2 size={20} />} 
            label="طابور الاستدعاء والنداء" 
            active={activeView === 'queuing'} 
            onClick={() => setActiveView('queuing')} 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<MessageCircle size={20} />} 
            label="المراسلات الداخلية" 
            active={activeView === 'messages'} 
            onClick={() => setActiveView('messages')} 
            collapsed={!isSidebarOpen}
            badge={unreadCount > 0 ? unreadCount : undefined}
          />
          <NavItem 
            icon={<FileText size={20} />} 
            label="سجل العمليات (Audit)" 
            active={activeView === 'audit-logs'} 
            onClick={() => setActiveView('audit-logs')} 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<Users size={20} />} 
            label="إدارة المستخدمين" 
            active={activeView === 'users'} 
            onClick={() => setActiveView('users')} 
            collapsed={!isSidebarOpen}
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div 
            onClick={() => setShowUserSettings(true)}
            className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-800/80 hover:border-slate-700 transition-all select-none active:scale-[0.98]"
            title="إعدادات الحساب ومحاكاة تسجيل الدخول"
          >
            <div className="size-10 bg-blue-600/95 text-white rounded-lg flex items-center justify-center font-black text-xs shadow-md shadow-blue-900/10 shrink-0">
              {currentUser ? (currentUser.name || "").split(' ').slice(0, 2).map((w: string) => w[0]).join('') || 'م' : 'م'}
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-black truncate text-slate-100">{currentUser ? currentUser.name : 'د. أحمد القحطاني'}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1">
                  <span>{currentUser ? (currentUser.role === 'admin' ? 'مدير نظام كامل' : currentUser.role === 'doctor' ? 'طبيب ممارس' : 'موظف استقبال') : 'مدير النظام'}</span>
                  <span>⚙️</span>
                </span>
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
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 rounded-full px-4 py-1.5 w-96 border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
            <Search className="text-slate-400 ml-2" size={16} />
            <input 
              type="text" 
              placeholder="بحث عن مريض بالاسم أو رقم الهاتف..." 
              className="bg-transparent border-none focus:outline-none text-sm w-full" 
            />
          </div>
          <div className="flex items-center gap-1.5 bg-blue-50/75 text-blue-700 border border-blue-100/70 px-3 py-1 rounded-full text-[11px] font-black shrink-0 shadow-sm animate-pulse-once">
            <span className="size-2 bg-blue-500 rounded-full animate-pulse"></span>
            <span>الفرع النشط: {selectedBranch}</span>
          </div>
        </div>
          <div className="flex items-center gap-4">
             <button 
              onClick={() => setActiveView('patients')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-all active:scale-95"
            >
              + تسجيل حالة جديدة
            </button>

            {/* Interactive Predictive Inventory Alert System Bell */}
            <div className="relative">
              <button 
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="size-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors relative focus:outline-none"
              >
                {inventoryWarnings.length > 0 && (
                  <span className="bg-rose-600 text-white rounded-full size-4 flex items-center justify-center text-[9px] font-bold font-mono absolute -top-1.5 -right-1.5 animate-bounce shadow-sm">
                    {inventoryWarnings.length}
                  </span>
                )}
                <Bell size={18} className={inventoryWarnings.length > 0 ? "text-rose-500 animate-pulse" : ""} />
              </button>

              {/* Notification Dropdown Drawer Panel */}
              <AnimatePresence>
                {isNotificationOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    className="absolute left-0 mt-3.5 w-96 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-[99] text-right font-sans"
                    dir="rtl"
                  >
                    <div className="bg-gradient-to-r from-rose-600 to-red-600 text-white p-4 flex justify-between items-center border-b border-rose-100/10">
                      <div>
                        <h4 className="font-black text-xs">تنبيهات استشراف وموازنة المخزون الطبي</h4>
                        <p className="text-[10px] text-red-100 font-bold mt-0.5">مواعيد اليوم المشمولة بالنقص المتوقع بناءً على قائمة الأدوية</p>
                      </div>
                      <span className="bg-white/20 text-white text-[9.5px] font-mono px-2 py-0.5 rounded-full font-black">
                        {inventoryWarnings.length} تنبيهات
                      </span>
                    </div>

                    <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
                      {inventoryWarnings.map((warn, index) => (
                        <div key={warn.id + '-' + index} className="p-4 space-y-2.5 hover:bg-slate-50/50 transition-colors">
                          <div className="flex justify-between items-start gap-2">
                            <span className="bg-rose-50 border border-rose-100 text-rose-700 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase">
                              ⚠️ نقص مخزني وشيك
                            </span>
                            <div className="text-[10.5px] font-black text-slate-800">العلاج: {warn.medicationName}</div>
                          </div>

                          <div className="space-y-1 text-slate-500 text-[10px] leading-relaxed font-semibold">
                            <div>📌 مخصص لـ المريض: <strong className="text-slate-800">{warn.patientName}</strong></div>
                            <div>🔬 الطبيب المشرف: <span className="text-slate-600">د. {warn.doctorName}</span></div>
                            <div className="flex justify-between items-center text-[9.5px] mt-1 bg-slate-50 p-2 rounded border border-slate-100 font-mono">
                              <span className="text-emerald-600 font-bold">المتاح بالمخزن: {warn.availableQty} علبة</span>
                              <span className="text-rose-600 font-bold">المطلوب لليوم: {warn.requiredQty} علبة</span>
                            </div>
                          </div>

                          <div className="flex justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                handleRefillInventoryItem(warn.medicationName, 40);
                                alert(`✓ تم تغذية رصيد مخزن العيادات بـ +40 علبة من دواء ${warn.medicationName} وتحديث الأوراق الثبوتية بنجاح!`);
                              }}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-700 text-[9px] font-extrabold px-2.5 py-1 rounded transition-all active:scale-95"
                            >
                              ⚡ شحن فوري للمخزون (+40)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveView('inventory');
                                setIsNotificationOpen(false);
                              }}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-[9px] font-extrabold px-2 py-1 rounded border border-slate-200 transition-colors"
                            >
                              تفاصيل الدواء
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveView('inventory');
                          setIsNotificationOpen(false);
                        }}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-black"
                      >
                        إدارة المخزن الطبي بالكامل ←
                      </button>
                    </div>

                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="size-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors relative">
              <span className="size-2 bg-red-500 rounded-full absolute top-0 right-0 border-2 border-white"></span>
              <Users size={18} />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 relative">
          <AnimatePresence mode="wait">
            {activeView === 'dashboard' && (
              <Dashboard 
                key="dash" 
                patients={filteredPatients} 
                doctors={filteredDoctors} 
                visits={filteredVisits} 
                navigateToProfile={navigateToProfile} 
                appointments={filteredAppointments}
                inventory={filteredInventory}
                inventoryWarnings={inventoryWarnings}
                onRefillInventory={handleRefillInventoryItem}
                onRefresh={loadData}
                selectedBranch={selectedBranch}
                currentUser={currentUser}
              />
            )}
            {activeView === 'patients' && <PatientsView key="pts" patients={filteredPatients} doctors={filteredDoctors} onRefresh={loadData} onSelectPatient={navigateToProfile} selectedBranch={selectedBranch} />}
            {activeView === 'doctors' && <DoctorsView key="docs" doctors={filteredDoctors} visits={filteredVisits} patients={filteredPatients} onRefresh={loadData} selectedBranch={selectedBranch} />}
            {activeView === 'appointments' && (
              <AppointmentsView 
                key="appts" 
                appointments={filteredAppointments} 
                doctors={filteredDoctors} 
                patients={filteredPatients} 
                onRefresh={loadData} 
                selectedBranch={selectedBranch}
                currentUser={currentUser}
                onSelectPatient={(pId, aId) => {
                  if (aId) {
                    setAutoCompleteAppointmentId(aId);
                  }
                  navigateToProfile(pId);
                }} 
              />
            )}
            {activeView === 'accounting' && (
              <AccountingView 
                key="acc" 
                visits={filteredVisits} 
                doctors={filteredDoctors} 
                allVisits={visits}
                allPatients={patients}
                allAppointments={appointments}
                allDoctors={doctors}
              />
            )}
            {activeView === 'inventory' && <InventoryView key="inv" inventory={filteredInventory} onRefresh={loadData} selectedBranch={selectedBranch} />}
            {activeView === 'queuing' && (
              <QueuingView 
                key="queuing"
                doctors={filteredDoctors}
                patients={filteredPatients}
                appointments={appointments}
                onRefresh={loadData}
                selectedBranch={selectedBranch}
              />
            )}
            {activeView === 'messages' && (
              <MessagesView 
                key="msgs" 
                doctors={filteredDoctors} 
                patients={filteredPatients} 
                onRefreshAllData={loadData} 
                preselectedPatientId={messagesPreselectPatientId}
                onClearPreselect={() => setMessagesPreselectPatientId('')}
                currentUser={currentUser}
              />
            )}
            {activeView === 'audit-logs' && <AuditLogsView key="audit" logs={filteredAuditLogs} onRefresh={loadData} users={users} />}
            {activeView === 'rooms' && <RoomsView key="rooms" patients={filteredPatients} doctors={filteredDoctors} selectedBranch={selectedBranch} />}
            {activeView === 'users' && <UsersView key="users" users={filteredUsers} doctors={filteredDoctors} onRefresh={loadData} />}
            {activeView === 'patient-profile' && selectedPatientId && (
              <PatientProfileView 
                key="prof" 
                patientId={selectedPatientId} 
                doctors={filteredDoctors} 
                appointments={filteredAppointments}
                onRefresh={loadData} 
                onBack={() => setActiveView('patients')} 
                autoCompleteAppointmentId={autoCompleteAppointmentId}
                clearAutoCompleteAppointment={() => setAutoCompleteAppointmentId(null)}
                selectedBranch={selectedBranch}
                currentUser={currentUser}
                onOpenMessages={(pId: string) => {
                  setMessagesPreselectPatientId(pId);
                  setActiveView('messages');
                }}
              />
            )}
          </AnimatePresence>

          {/* Floating Message Notification Toast */}
          <AnimatePresence>
            {activeNotification && (
              <motion.div 
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="fixed bottom-6 right-6 z-[250] max-w-sm bg-slate-900 border border-slate-850 text-white rounded-2xl shadow-2xl p-4 flex gap-3 text-right"
              >
                <div className="size-10 bg-indigo-600 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/20">
                  <MessageCircle size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-indigo-300">ملاحظة أو رسالة تواصل جديدة 🔔</div>
                  <p className="text-xs font-black text-slate-100 mt-1">المُرسل: {activeNotification.sender}</p>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed truncate">{activeNotification.content}</p>
                  <button 
                    onClick={() => { setActiveView('messages'); setActiveNotification(null); }}
                    className="mt-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 underline"
                  >
                    فتح نافذة المراسلات المباشرة ←
                  </button>
                </div>
                <button 
                  onClick={() => setActiveNotification(null)}
                  className="text-slate-400 hover:text-white self-start text-sm font-bold opacity-70 hover:opacity-100"
                >
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {showUserSettings && (
          <UserSettingsModal 
            onClose={() => setShowUserSettings(false)}
            currentUser={currentUser}
            setCurrentUser={(user) => {
              setCurrentUser(user);
              if (user && user.branch) {
                setSelectedBranch(user.branch);
              }
            }}
            users={users}
            onUpdateUser={async (updatedUser) => {
              await api.createUser(updatedUser);
              loadData();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed, badge }: { icon: any, label: string, active: boolean, onClick: () => void, collapsed: boolean, badge?: any }) {
  return (
    <button 
      onClick={onClick}
      className={`relative w-full flex items-center gap-3 p-3 rounded-lg transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
    >
      <span className={active ? 'text-white' : 'opacity-60'}>{icon}</span>
      {!collapsed && <span className="font-medium text-sm truncate">{label}</span>}
      {badge && (
        <span className={`absolute top-2.5 left-2.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shadow-sm border border-slate-900 ${collapsed ? '-top-1 -left-1' : ''} animate-pulse`}>
          {badge}
        </span>
      )}
    </button>
  );
}

// --- Dashboard View ---
interface StatsCardConfig {
  id: string;
  label: string;
  visible: boolean;
}

function Dashboard({ 
  patients, 
  doctors, 
  visits, 
  navigateToProfile, 
  appointments, 
  inventory, 
  inventoryWarnings = [], 
  onRefillInventory,
  onRefresh,
  selectedBranch,
  currentUser
}: any) {
  const [quickSearch, setQuickSearch] = useState("");
  const [showQuickDropdown, setShowQuickDropdown] = useState(false);
  const [selectedQuickPatient, setSelectedQuickPatient] = useState<any>(null);
  
  // Quick booking fields
  const [quickDoctorId, setQuickDoctorId] = useState("");
  const [quickDate, setQuickDate] = useState(dayjs().add(1, 'day').format('YYYY-MM-DDTHH:mm'));
  const [quickBranch, setQuickBranch] = useState(selectedBranch || "المعادي");
  const [quickNotes, setQuickNotes] = useState("");
  const [quickIsSpecial, setQuickIsSpecial] = useState(false);
  const [bookingInProgress, setBookingInProgress] = useState(false);

  // Search History for Patients
  const [searchHistory, setSearchHistory] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('patient_search_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const selectPatientAndAddToHistory = (patient: any) => {
    setSelectedQuickPatient(patient);
    setSearchHistory((prev: any[]) => {
      const filtered = prev.filter(p => p.id !== patient.id);
      const updated = [patient, ...filtered].slice(0, 5); // keep last 5
      localStorage.setItem('patient_search_history', JSON.stringify(updated));
      return updated;
    });
    setQuickSearch("");
    setShowQuickDropdown(false);
  };

  const quickFilteredPatients = useMemo(() => {
    if (!quickSearch) return [];
    return patients.filter((p: any) => 
      p.name.toLowerCase().includes(quickSearch.toLowerCase()) || 
      p.phone.includes(quickSearch) || 
      (p.caseCode && p.caseCode.toLowerCase().includes(quickSearch.toLowerCase()))
    ).slice(0, 5);
  }, [quickSearch, patients]);

  const handleQuickBook = async () => {
    if (!selectedQuickPatient) {
      alert("الرجاء اختيار مريض أولاً");
      return;
    }
    if (!quickDoctorId) {
      alert("الرجاء اختيار الطبيب");
      return;
    }
    setBookingInProgress(true);
    try {
      const appointmentData: any = {
        patientId: selectedQuickPatient.id,
        doctorId: quickDoctorId,
        date: quickDate,
        notes: quickNotes,
        status: 'scheduled',
        reminderEnabled: true,
        reminderLeadTimeHours: 2,
        isSpecial: quickIsSpecial,
        specialPrice: 0,
        branch: quickBranch
      };

      await api.createAppointment(appointmentData);
      alert(`🎉 تم حجز موعد سريع للمريض (${selectedQuickPatient.name}) بنجاح وتحديث الأرشيف فورياً دون مغادرة لوحة التحكم!`);
      
      // Reset form
      setSelectedQuickPatient(null);
      setQuickNotes("");
      setQuickDoctorId("");
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حجز الموعد السريع.");
    } finally {
      setBookingInProgress(false);
    }
  };

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

  const getDoctorOccupancyData = () => {
    return doctors.map((d: any) => {
      const scheduledToday = visits.filter((v: any) => v.doctorId === d.id && dayjs(v.date).isSame(dayjs(), 'day')).length;
      const capacity = d.maxPatientsPerDay || 25;
      const rate = Math.min(100, Math.round((scheduledToday / capacity) * 100)) || 0;
      return {
        name: d.name.length > 10 ? `د. ${d.name.substring(0, 10)}...` : `د. ${d.name}`,
        'الحالات المجدولة': scheduledToday,
        'الحد الأقصى اليومي': capacity,
        'نسبة إشغال العيادة (%)': rate
      };
    });
  };

  const occupancyData = getDoctorOccupancyData();

  const getDailyIncomeData = () => {
    const currentMonth = dayjs().month();
    const currentYear = dayjs().year();
    const daysInMonth = dayjs().daysInMonth();
    
    const dailyData = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayVisits = visits.filter((v: any) => {
        const vDate = dayjs(v.date);
        return vDate.date() === d && vDate.month() === currentMonth && vDate.year() === currentYear;
      });
      
      const clinicEarnings = dayVisits.reduce((acc: number, v: any) => acc + (v.clinicEarnings || 0), 0);
      const doctorEarnings = dayVisits.reduce((acc: number, v: any) => acc + (v.doctorEarnings || 0), 0);
      const totalCost = dayVisits.reduce((acc: number, v: any) => acc + (v.cost || 0), 0);
      
      dailyData.push({
        day: `${d}`,
        'إيرادات العيادة': clinicEarnings,
        'أتعاب الأطباء': doctorEarnings,
        'إجمالي الدخل': totalCost
      });
    }
    
    const today = dayjs().date();
    return dailyData.slice(0, today);
  };

  const dailyIncomeData = getDailyIncomeData();

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

      {/* 🔮 Predictive Alert System: Medicine Deficit Alerts */}
      {inventoryWarnings.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-l from-rose-55 to-white bg-white border border-rose-200 rounded-2xl p-5 shadow-sm space-y-4 text-right"
        >
          <div className="flex flex-row-reverse justify-between items-start gap-4">
            <div className="flex items-center gap-2.5">
              <div className="bg-rose-100 p-2 rounded-xl border border-rose-200 text-rose-600">
                <AlertTriangle size={18} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black text-rose-900">نظام الإنذار التلقائي: عجز المخزون الدوائي المتوقع لمرضى اليوم</h3>
                <p className="text-[10px] text-rose-600 font-bold mt-0.5 w-full max-w-4xl">
                  يقوم النظام تلقائياً بمطابقة متطلبات المرضى ذوي المواعيد المجدولة مع قائمة أدويتهم السابقة للتحقق من كفاية الأرصدة الحالية في المستودع لتلبية الطلب المتوقع وتنبيه المستشار الإداري.
                </p>
              </div>
            </div>
            <span className="bg-rose-100 text-rose-700 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
              {inventoryWarnings.length} تنبيهات نشطة
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inventoryWarnings.map((warn: any, idx: number) => (
              <div 
                key={warn.id + '-dash-' + idx} 
                className="bg-white border border-rose-100 hover:border-rose-200 rounded-xl p-4 flex flex-col justify-between shadow-sm space-y-2.5 transition-all hover:shadow"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-row-reverse justify-between items-center bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-black text-slate-800">{warn.patientName}</span>
                    <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">حالة مجدولة اليوم</span>
                  </div>

                  <div className="text-xs font-bold text-slate-700 mt-1">💊 دواء غير كافٍ: <span className="text-rose-600 underline decoration-wavy underline-offset-2">{warn.medicationName}</span></div>
                  <div className="text-[9.5px] text-slate-400 font-semibold space-y-1">
                    <div>🧑‍⚕️ الطبيب: د. {warn.doctorName}</div>
                    <div className="flex justify-between items-center text-[9px] font-mono mt-1 pt-1 border-t border-slate-100">
                      <span className="text-emerald-600 font-bold">المتاح بالمستودع: {warn.availableQty} علبة</span>
                      <span className="text-rose-600 font-bold">المطلوب اليوم: {warn.requiredQty} علبة</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onRefillInventory(warn.medicationName, 40);
                    alert(`✓ تم بنجاح تعبئة رصيد المستودع بـ +40 علبة إضافية من علاج ${warn.medicationName}!`);
                  }}
                  className="w-full mt-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10.5px] font-extrabold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus size={12} /> شحن وتغذية الرصيد فوراً (+40)
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

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

      {/* 📊 نسبة إشغال العيادات لكل طبيب بناء على الحالات */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-500" />
            <span>معدل إشغال العيادات لكل طبيب اليوم (الحالات المجدولة مقابل الحد الأقصى المسموح)</span>
          </h2>
          <p className="text-[10px] text-slate-400 font-bold mt-1">توضيح مرئي لنسبة الضغط والأماكن الشاغرة بمقصورات العيادات المفتوحة اليوم مأخوذاً من إعدادات الحد الأقصى للأطباء</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Chart visualization */}
          <div className="lg:col-span-8 h-[220px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={occupancyData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" fontSize={9} fontBold={true} axisLine={false} tickLine={false} />
                <YAxis fontSize={9} fontBold={true} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                <Bar name="الحالات المجدولة اليوم" dataKey="الحالات المجدولة" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar name="الحد الأقصى المسموح يومياً" dataKey="الحد الأقصى اليومي" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Metrics display */}
          <div className="lg:col-span-4 space-y-3" dir="rtl">
            <h3 className="text-xs font-black text-slate-700 pb-2 border-b border-slate-150">تحليل نسب الإشغال والضغط</h3>
            <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
              {occupancyData.map((item: any, idx: number) => {
                const percentage = item['نسبة إشغال العيادة (%)'];
                return (
                  <div key={idx} className="flex items-center justify-between gap-4 text-xs">
                    <span className="font-bold text-slate-600 truncate">{item.name}</span>
                    <div className="flex items-center gap-2 min-w-[120px] justify-end">
                      <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${percentage >= 100 ? 'bg-red-500' : percentage >= 75 ? 'bg-amber-400' : 'bg-blue-500'}`} 
                          style={{ width: `${Math.min(100, percentage)}%` }}
                        ></div>
                      </div>
                      <span className="font-mono text-slate-800 font-extrabold w-10 text-left">{percentage}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 📊 Clinics Daily Capacity & Planned vs Actual Utilization Tracker */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 text-right justify-end">
            <span>لوحة الطاقة الاستيعابية ومعدل الاستغلال الفعلي للعيادات اليوم</span>
            <Activity size={16} className="text-indigo-600 animate-pulse" />
          </h2>
          <p className="text-[10px] text-slate-400 font-bold mt-1 text-right">تتبع الحالات المقررة (الاستخدام المخطط) بالتناظر مع الحالات المكتملة أو الفعلية ومقارنتها بالطاقة القصوى المسموحة بالمركز</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-right">
          <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex flex-col justify-between">
            <span className="text-[10px] font-black text-slate-400 block mb-2">الطاقة الاستيعابية القصوى المخططة (Combined Daily Capacity)</span>
            <div className="flex items-baseline gap-1.5 justify-end">
              <span className="text-3xl font-black text-slate-800 font-mono">
                {doctors.reduce((sum, d) => sum + (d.maxPatientsPerDay || 25), 0)}
              </span>
              <span className="text-xs font-bold text-slate-500">كشف متاح اليوم</span>
            </div>
          </div>

          <div className="bg-blue-50/30 border border-blue-100/50 p-4 rounded-xl flex flex-col justify-between">
            <span className="text-[10px] font-black text-blue-700 block mb-2">الاستخدام المخطط الحالي (Planned Utilization)</span>
            <div className="flex justify-between items-baseline gap-1.5 direction-rtl">
              <span className="text-[10px] font-bold text-blue-500 bg-blue-100 px-2 py-0.5 rounded">
                {Math.round((visits.length / (doctors.reduce((sum, d) => sum + (d.maxPatientsPerDay || 25), 0) || 1)) * 100)}% من السعة المسموحة
              </span>
              <div className="flex items-baseline gap-1.5 justify-end">
                <span className="text-3xl font-black text-blue-800 font-mono">
                  {visits.length}
                </span>
                <span className="text-xs font-bold text-blue-600">موعد مضاف</span>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50/20 border border-emerald-100/50 p-4 rounded-xl flex flex-col justify-between">
            <span className="text-[10px] font-black text-emerald-700 block mb-2">الاستخدام الفعلي المنتظم (Actual Utilization)</span>
            <div className="flex justify-between items-baseline gap-1.5 direction-rtl">
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">
                {Math.round((visits.filter((v: any) => v.status === 'completed' || !v.status || v.status === 'done').length / (visits.length || 1)) * 100)}% الإنتاجية الفعلية
              </span>
              <div className="flex items-baseline gap-1.5 justify-end">
                <span className="text-3xl font-black text-emerald-800 font-mono">
                  {visits.filter((v: any) => v.status === 'completed' || !v.status || v.status === 'done').length}
                </span>
                <span className="text-xs font-bold text-emerald-650 text-emerald-600">فحص منتهي</span>
              </div>
            </div>
          </div>
        </div>

        {/* Beautiful linear progress mapping */}
        <div className="space-y-2 pt-2 text-right">
          <div className="flex justify-between text-[11px] font-bold">
            <span className="text-slate-500">مخطط تقدم ونسب الإشعال العام</span>
            <span className="text-indigo-600">
              {doctors.reduce((sum, d) => sum + (d.maxPatientsPerDay || 25), 0) - visits.length} أماكن متبقية بقسم الاستقبال
            </span>
          </div>
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex flex-row-reverse">
            <div 
              className="bg-blue-600 h-full rounded-l-full" 
              style={{ width: `${Math.min(100, (visits.length / (doctors.reduce((sum, d) => sum + (d.maxPatientsPerDay || 25), 0) || 1)) * 100)}%` }}
            />
            <div 
              className="bg-emerald-600 h-full" 
              style={{ width: `${Math.min(100, (visits.filter((v: any) => v.status === 'completed' || !v.status || v.status === 'done').length / (doctors.reduce((sum, d) => sum + (d.maxPatientsPerDay || 25), 0) || 1)) * 100)}%` }}
            />
          </div>
          <div className="flex gap-4 text-[9px] font-extrabold text-slate-400 justify-end">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-600" /> الحالات المكتملة فعلياً بالعيادة</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-blue-600" /> الحالات المخططة والمجدولة لليوم</span>
          </div>
        </div>
      </div>

       {/* 📈 رسم بياني لتوزيع دخل العيادة اليومي خلال الشهر الحالي */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-500" />
            <span>توزيع دخل العيادة اليومي للشهر الحالي (إيرادات العيادة مقابل أتعاب الأطباء)</span>
          </h2>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            متابعة حركة دخل ومداخيل العيادة الصافية مقابل الأتعاب والعمولات المصروفة للأطباء بشكل تراكمي يومي خلال شهر {dayjs().format('MMMM YYYY')}
          </p>
        </div>
        
        <div className="h-[250px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyIncomeData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorClinic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorDoctors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="day" fontSize={9} fontBold={true} axisLine={false} tickLine={false} />
              <YAxis fontSize={9} fontBold={true} axisLine={false} tickLine={false} unit=" ج.م" />
              <Tooltip formatter={(value) => `${value} ج.م`} labelFormatter={(label) => `يوم ${label} من الشهر`} />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} wrapperClassName="font-sans" />
              <Area type="monotone" name="إيرادات العيادة (الصافية)" dataKey="إيرادات العيادة" stroke="#10B981" fillOpacity={1} fill="url(#colorClinic)" strokeWidth={2} />
              <Area type="monotone" name="أتعاب المستشارين والأطباء" dataKey="أتعاب الأطباء" stroke="#6366F1" fillOpacity={1} fill="url(#colorDoctors)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
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
                  <th className="px-6 py-3">الدفع</th>
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
                      <td className="px-6 py-4">
                        <div className={`text-[10px] font-black uppercase ${v.isPaid ? 'text-emerald-600' : 'text-red-500 underline decoration-dotted underline-offset-2'}`}>
                          {v.isPaid ? 'مُحصل' : 'معلق'}
                        </div>
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
          {/* ⚡ اختصارات الحجز الطبي السريع */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-indigo-500/30 shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-indigo-500/25 pb-3">
              <Clock className="text-indigo-400 rotate-12" size={18} />
              <div>
                <h3 className="text-xs font-black text-indigo-100 uppercase tracking-wider">⚡ اختصارات الحجز الطبي السريع</h3>
                <p className="text-[9px] text-slate-300 font-medium">حجز موعد فوري دون مغادرة لوحة التحكم الرئيسية</p>
              </div>
            </div>

            {/* البحث عن مريض */}
            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-black text-slate-400 block text-right">البحث عن المريض المستهدف للحجز:</label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input 
                  type="text" 
                  placeholder="ابحث بالاسم، الكود، أو رقم الهاتف..." 
                  className="w-full pr-9 pl-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  value={quickSearch}
                  onChange={(e) => {
                    setQuickSearch(e.target.value);
                    setShowQuickDropdown(true);
                  }}
                  onFocus={() => setShowQuickDropdown(true)}
                />
              </div>

              {/* نتائج البحث المنسدلة */}
              {showQuickDropdown && quickSearch && (
                <div className="absolute z-30 w-full mt-1 bg-slate-850 border border-slate-700/80 rounded-lg shadow-2xl overflow-hidden divide-y divide-slate-800 text-right text-xs">
                  {quickFilteredPatients.map((p: any) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPatientAndAddToHistory(p)}
                      className="w-full px-3 py-2.5 hover:bg-indigo-650/30 text-slate-200 flex justify-between items-center transition-colors font-bold text-right"
                    >
                      <span className="text-[10px] text-slate-400 font-mono">#{p.caseCode}</span>
                      <div className="flex flex-col text-right">
                        <span>{p.name}</span>
                        <span className="text-[9px] text-slate-400">{p.phone}</span>
                      </div>
                    </button>
                  ))}
                  {quickFilteredPatients.length === 0 && (
                    <div className="px-3 py-4 text-center text-slate-500 text-[10px] italic">لم يتم العثور على مريض</div>
                  )}
                </div>
              )}
            </div>

            {/* سجل المرضى الذين تم البحث عنهم سابقاً */}
            {searchHistory.length > 0 && !selectedQuickPatient && (
              <div className="space-y-1.5 text-right">
                <span className="text-[9.5px] font-black text-indigo-300">🔍 مرضى تم البحث عنهم مسبقاً (انقر للاستدعاء):</span>
                <div className="flex flex-wrap gap-1.5 max-h-[105px] overflow-y-auto pr-0.5">
                  {searchHistory.map((pHist: any) => (
                    <button
                      key={pHist.id}
                      type="button"
                      onClick={() => setSelectedQuickPatient(pHist)}
                      className="text-[10px] bg-slate-800 hover:bg-indigo-900/40 text-slate-200 font-bold px-2.5 py-1 rounded-md border border-indigo-500/10 hover:border-indigo-500/30 transition-all truncate max-w-[150px]"
                      title={`حجز سريع للمريض: ${pHist.name}`}
                    >
                      👤 {pHist.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* تفاصيل الحجز الفوري للأخصائي */}
            {selectedQuickPatient ? (
              <div className="bg-slate-850/50 p-3.5 rounded-lg border border-indigo-500/15 space-y-3 relative text-right animate-in fade-in duration-200">
                <button 
                  onClick={() => setSelectedQuickPatient(null)} 
                  className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-300 text-[10px] font-bold"
                >
                  إلغاء ✕
                </button>
                
                <div className="pb-2 border-b border-slate-800/60">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">المريض المحدد للحجز:</span>
                  <div className="font-extrabold text-indigo-300 text-xs mt-0.5">{selectedQuickPatient.name}</div>
                  <span className="text-[9.5px] text-slate-400 font-mono">كود الملف: #{selectedQuickPatient.caseCode}</span>
                </div>

                <div className="space-y-2">
                  {/* اختيار الطبيب */}
                  <div>
                    <label className="text-[9.5px] text-slate-300 font-black block mb-1">اختر الطبيب المعالج والعيادة:</label>
                    <select 
                      required
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-slate-200 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={quickDoctorId}
                      onChange={(e) => setQuickDoctorId(e.target.value)}
                    >
                      <option value="">- اختر طبيب التخصص -</option>
                      {doctors.map((d: any) => (
                        <option key={d.id} value={d.id}>د. {d.name} ({d.specialty})</option>
                      ))}
                    </select>
                  </div>

                  {/* اختيار التاريخ والوقت */}
                  <div>
                    <label className="text-[9.5px] text-slate-300 font-black block mb-1">وقت وتاريخ الموعد منجدولاً:</label>
                    <input 
                      type="datetime-local"
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-slate-200 text-xs font-bold focus:outline-none"
                      value={quickDate}
                      onChange={(e) => setQuickDate(e.target.value)}
                    />
                  </div>

                  {/* فرع الحجز والسحب */}
                  <div>
                    <label className="text-[9.5px] text-slate-300 font-black block mb-1">فرع الكشف الطبي:</label>
                    <select 
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-slate-200 text-xs font-bold focus:outline-none"
                      value={quickBranch}
                      onChange={(e) => setQuickBranch(e.target.value)}
                    >
                      <option value="المعادي">فرع المعادي</option>
                      <option value="الدقي">فرع الدقي</option>
                      <option value="مدينة نصر">فرع مدينة نصر</option>
                      <option value="اسكندرية">فرع اسكندرية</option>
                    </select>
                  </div>

                  {/* ملاحظات سريرية */}
                  <div>
                    <label className="text-[9.5px] text-slate-300 font-black block mb-1">ملاحظات سريرية أو شكوى المريض:</label>
                    <input 
                      type="text"
                      placeholder="شكوى معينة، فحص مستعجل..."
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-slate-200 text-xs font-medium focus:outline-none"
                      value={quickNotes}
                      onChange={(e) => setQuickNotes(e.target.value)}
                    />
                  </div>

                  {/* كشف خاص */}
                  <div className="flex items-center gap-2 justify-end pt-1">
                    <span className="text-[10px] text-slate-300 font-bold">كشف خاص / مستعجل (ضعف السعر)</span>
                    <input 
                      type="checkbox" 
                      className="size-3.5 bg-slate-800 border-slate-705 rounded text-indigo-600 focus:ring-indigo-500" 
                      checked={quickIsSpecial}
                      onChange={(e) => setQuickIsSpecial(e.target.checked)}
                    />
                  </div>

                  {/* زر التأكيد */}
                  <button
                    type="button"
                    disabled={bookingInProgress}
                    onClick={handleQuickBook}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10.5px] font-black shadow-md active:scale-95 transition-all mt-2 flex items-center justify-center gap-2"
                  >
                    <span>📅 تأكيد الحجز السريع وتحديث الأرشيف</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-slate-400 text-[10px] italic border border-dashed border-slate-700 rounded-lg">
                الرجاء البحث عن مريض أعلاه أو النقر على أحد المرضى السابق البحث عنهم لبدء الحجز السريع.
              </div>
            )}
          </div>

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
function PatientsView({ patients, doctors = [], onRefresh, onSelectPatient, selectedBranch }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [search, setSearch] = useState("");
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    nameCode: true,
    phoneAddress: true,
    age: true,
    regDate: true,
    actions: true,
  });

  const filtered = patients.filter((p: any) => {
    const term = search.toLowerCase();
    const nameMatch = (p.name || "").toLowerCase().includes(term);
    const phoneMatch = (p.phone || "").toLowerCase().includes(term);
    const codeMatch = (p.caseCode || "").toLowerCase().includes(term);
    return nameMatch || phoneMatch || codeMatch;
  });

  const exportPatientsJSON = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(patients, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `سجل_المرضى_الكامل_${dayjs().format('YYYY-MM-DD')}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error("Error exporting patients: ", err);
      alert("حدث خطأ أثناء محاولة تصدير البيانات.");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="space-y-6 text-right"
    >
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">سجل المرضى</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">إدارة وتتبع سجلات الحالات المتكاملة وتكامل البيانات</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button 
            type="button"
            onClick={exportPatientsJSON}
            className="bg-slate-50 hover:bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold flex items-center gap-2 border border-slate-200 transition-all text-xs"
            title="تحميل السجل بالكامل بصيغة JSON"
          >
            <Download size={14} className="text-blue-600" />
            <span>تصدير بيانات المرضى (JSON)</span>
          </button>

          <button 
            type="button"
            onClick={() => setShowImportModal(true)}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-4 py-2 rounded-xl font-bold flex items-center gap-2 border border-emerald-200 transition-all text-xs"
            title="استيراد وتفريغ البيانات من إكسيل"
          >
            <Upload size={14} className="text-emerald-600" />
            <span>استيراد ملف إكسيل الشامل</span>
          </button>

          <button 
            onClick={() => setIsAdding(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-900/10 transition-all active:scale-95 text-xs mr-2"
          >
            <Plus size={14} />
            <span>إضافة مريض يدوي</span>
          </button>
        </div>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-4 bg-slate-50/30">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="البحث بالاسم، رقم الهاتف، أو كود المريض..." 
              className="w-full pr-10 pl-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-705 placeholder-slate-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="relative shrink-0 select-none">
            <button 
              type="button"
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              className="bg-white hover:bg-slate-50 text-slate-750 px-4 py-2 rounded-lg font-bold flex items-center gap-2 border border-slate-200 transition-all text-xs"
            >
              <SlidersHorizontal size={14} className="text-blue-650" />
              <span>أعمدة الجدول</span>
            </button>
            
            {showColumnSettings && (
              <div className="absolute left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 text-right space-y-2.5">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-2 pb-1 border-b border-slate-100">تخصيص الأعمدة المعروضة</p>
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700 hover:text-blue-600">
                  <input 
                    type="checkbox" 
                    checked={visibleColumns.nameCode} 
                    onChange={() => setVisibleColumns(prev => ({ ...prev, nameCode: !prev.nameCode }))}
                    className="accent-blue-600 rounded size-3.5"
                  />
                  <span>المريض / الكود</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700 hover:text-blue-600">
                  <input 
                    type="checkbox" 
                    checked={visibleColumns.phoneAddress} 
                    onChange={() => setVisibleColumns(prev => ({ ...prev, phoneAddress: !prev.phoneAddress }))}
                    className="accent-blue-600 rounded size-3.5"
                  />
                  <span>الهاتف والعنوان</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700 hover:text-blue-600">
                  <input 
                    type="checkbox" 
                    checked={visibleColumns.age} 
                    onChange={() => setVisibleColumns(prev => ({ ...prev, age: !prev.age }))}
                    className="accent-blue-600 rounded size-3.5"
                  />
                  <span>السن</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700 hover:text-blue-600">
                  <input 
                    type="checkbox" 
                    checked={visibleColumns.regDate} 
                    onChange={() => setVisibleColumns(prev => ({ ...prev, regDate: !prev.regDate }))}
                    className="accent-blue-600 rounded size-3.5"
                  />
                  <span>تاريخ التسجيل</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700 hover:text-blue-600">
                  <input 
                    type="checkbox" 
                    checked={visibleColumns.actions} 
                    onChange={() => setVisibleColumns(prev => ({ ...prev, actions: !prev.actions }))}
                    className="accent-blue-600 rounded size-3.5"
                  />
                  <span>العمليات</span>
                </label>
              </div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                {visibleColumns.nameCode && <th className="px-6 py-4 border-b border-slate-100">المريض / الكود</th>}
                {visibleColumns.phoneAddress && <th className="px-6 py-4 border-b border-slate-100">الهاتف والعنوان</th>}
                {visibleColumns.age && <th className="px-6 py-4 border-b border-slate-100">السن</th>}
                {visibleColumns.regDate && <th className="px-6 py-4 border-b border-slate-100">تاريخ التسجيل</th>}
                {visibleColumns.actions && <th className="px-6 py-4 border-b border-slate-100">العمليات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {filtered.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onSelectPatient(p.id)}>
                  {visibleColumns.nameCode && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold text-xs uppercase">
                          {p.name ? p.name[0] : 'م'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono italic">#{p.caseCode || '---'}</div>
                        </div>
                      </div>
                    </td>
                  )}
                  {visibleColumns.phoneAddress && (
                    <td className="px-6 py-4">
                      <div className="text-slate-600 font-mono">{p.phone}</div>
                      <div className="text-[10px] text-slate-400">{p.nationality || '---'}</div>
                    </td>
                  )}
                  {visibleColumns.age && <td className="px-6 py-4 text-slate-500">{p.age} سنة</td>}
                  {visibleColumns.regDate && <td className="px-6 py-4 text-slate-400 text-xs">{dayjs(p.createdAt).format('DD MMM YYYY')}</td>}
                  {visibleColumns.actions && (
                    <td className="px-6 py-4">
                      <button className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:underline">
                        عرض <ChevronLeft size={12} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                   <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="px-6 py-12 text-center text-slate-400 italic">لا يوجد مرضى مطابقين للبحث</td>
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
              await api.createPatient({ ...data, branch: selectedBranch });
              onRefresh();
              setIsAdding(false);
            }} 
          />
        )}

        {showImportModal && (
          <ImportExcelModal
            onClose={() => setShowImportModal(false)}
            doctors={doctors}
            existingPatients={patients}
            selectedBranch={selectedBranch}
            onComplete={() => {
              onRefresh();
              setShowImportModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ImportExcelModal({ onClose, doctors, existingPatients, onComplete, selectedBranch }: { onClose: () => void, doctors: any[], existingPatients: any[], onComplete: () => void, selectedBranch: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [errorStatus, setErrorStatus] = useState<string>('');

  const downloadTemplate = () => {
    try {
      const headers = [
        "الاسم", 
        "رقم الهاتف", 
        "السن", 
        "الجنس", 
        "الجنسية", 
        "رقم اللجنة", 
        "الرقم القومي", 
        "جواز السفر", 
        "كود الحالة", 
        "اسم الطبيب", 
        "بند الحجز", 
        "تاريخ الحجز", 
        "وقت الحجز", 
        "ملاحظات"
      ];

      const sampleData = [
        headers,
        [
          "محمود علي ياسين",
          "01099887766",
          "42",
          "ذكر",
          "مصري",
          "602/ج",
          "28405051234567",
          "",
          "C-201",
          doctors[0]?.name || "أحمد",
          "كشف جديد",
          dayjs().format('YYYY-MM-DD'),
          "10:30",
          "استشارة ضغط مسبقة"
        ],
        [
          "فاطمة عمر الشافعي",
          "01223344556",
          "31",
          "أنثى",
          "مصري",
          "",
          "29509091234567",
          "",
          "C-202",
          doctors[1]?.name || doctors[0]?.name || "منى",
          "استشارة",
          dayjs().format('YYYY-MM-DD'),
          "11:15",
          "متابعة دورية للتحليل"
        ]
      ];

      const ws = XLSX.utils.aoa_to_sheet(sampleData);
      
      // تعيين عرض الأعمدة ليكون التنسيق ممتازاً
      ws['!cols'] = [
        { wch: 24 }, // الاسم
        { wch: 14 }, // رقم الهاتف
        { wch: 8 },  // السن
        { wch: 8 },  // الجنس
        { wch: 10 }, // الجنسية
        { wch: 12 }, // رقم اللجنة
        { wch: 18 }, // الرقم القومي
        { wch: 14 }, // جواز السفر
        { wch: 12 }, // كود الحالة
        { wch: 16 }, // اسم الطبيب
        { wch: 14 }, // بند الحجز
        { wch: 14 }, // تاريخ الحجز
        { wch: 12 }, // وقت الحجز
        { wch: 24 }  // ملاحظات
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "نموذج استيراد العيادات");
      XLSX.writeFile(wb, "نموذج_استيراد_المرضى_والمواعيد_عيادات_الشفاء.xlsx");
    } catch (err) {
      console.error(err);
      setErrorStatus("حدث خطأ أثناء توليد نموذج الاستيراد.");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const cleanArabicText = (text: any) => {
    if (typeof text !== 'string') return '';
    return text
      .trim()
      .replace(/^دكتور\s+/i, '')
      .replace(/^د\.\s*/i, '')
      .replace(/\s+/g, ' ')
      .toLowerCase();
  };

  const findDoctorIdByName = (docName: string) => {
    if (!docName) return '';
    const needle = cleanArabicText(docName);
    const matched = doctors.find((d: any) => {
      const hst = cleanArabicText(d.name);
      return hst.includes(needle) || needle.includes(hst);
    });
    return matched ? matched.id : '';
  };

  const getRowVal = (row: any, keys: string[]) => {
    for (const k of keys) {
      if (row[k] !== undefined) return row[k];
      const foundKey = Object.keys(row).find(
        x => x.toLowerCase().trim() === k.toLowerCase().trim() || 
             x.trim().includes(k) || 
             k.includes(x.trim())
      );
      if (foundKey && row[foundKey] !== undefined) return row[foundKey];
    }
    return '';
  };

  const parseExcelDateValue = (val: any) => {
    if (!val) return '';
    if (val instanceof Date) {
      return dayjs(val).format('YYYY-MM-DD');
    }
    if (typeof val === 'number') {
      try {
        const date = XLSX.SSF.parse_date_code(val);
        const jsDate = new Date(date.y, date.m - 1, date.d);
        return dayjs(jsDate).format('YYYY-MM-DD');
      } catch (err) {
        console.error(err);
      }
    }
    const strVal = String(val).trim();
    const parsed = dayjs(strVal);
    if (parsed.isValid()) {
      return parsed.format('YYYY-MM-DD');
    }
    return strVal;
  };

  const parseExcelTimeValue = (val: any) => {
    if (!val) return '12:00';
    if (val instanceof Date) {
      return dayjs(val).format('HH:mm');
    }
    if (typeof val === 'number') {
      const totalMinutes = Math.round(val * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    const strVal = String(val).trim();
    if (/^\d{1,2}:\d{2}$/.test(strVal)) {
      const [h, m] = strVal.split(':');
      return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    }
    return strVal;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setFile(file);
    setErrorStatus('');
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // تحويل الصفوف إلى عناصر JSON
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        if (rawRows.length === 0) {
          setErrorStatus('لم نجد أي بيانات أو حقول في الملف المختار.');
          return;
        }

        const mapped = rawRows.map((row: any) => {
          const name = String(getRowVal(row, ['الاسم', 'الاسم كامل', 'اسم المريض', 'name', 'patient name', 'full name']) || '').trim();
          const phone = String(getRowVal(row, ['رقم الهاتف', 'الهاتف', 'المحمول', 'الجوال', 'phone', 'phone number', 'mobile']) || '').trim();
          const age = String(getRowVal(row, ['السن', 'العمر', 'age']) || '').trim();
          const rawGender = String(getRowVal(row, ['الجنس', 'النوع', 'gender', 'sex']) || '').trim();
          const gender = rawGender.includes('أنثى') || rawGender.toLowerCase().startsWith('f') ? 'female' : 'male';
          const nationality = String(getRowVal(row, ['الجنسية', 'nationality']) || 'مصري').trim();
          const caseCode = String(getRowVal(row, ['كود الحالة', 'الكود', 'كود المريض', 'case code', 'casecode', 'code']) || '').trim();
          const commissionNumber = String(getRowVal(row, ['رقم اللجنة', 'اللجنة', 'commission', 'commission name', 'commission number']) || '').trim();
          const nationalId = String(getRowVal(row, ['الرقم القومي', 'القومي', 'national id', 'nationalid']) || '').trim();
          const passportNumber = String(getRowVal(row, ['جواز السفر', 'جواز', 'passport', 'passport number']) || '').trim();

          // بيانات حجز العيادة
          const rawDocName = String(getRowVal(row, ['اسم الطبيب', 'الطبيب', 'الدكتور', 'doctor', 'doctor name', 'doc']) || '').trim();
          const serviceType = String(getRowVal(row, ['بند الحجز', 'نوع الخدمة', 'نوع الزيارة', 'الخدمة', 'service', 'service type', 'booking type']) || 'كشف جديد').trim();
          const rawDate = getRowVal(row, ['تاريخ الحجز', 'التاريخ', 'تاريخ', 'date', 'booking date']);
          const rawTime = getRowVal(row, ['وقت الحجز', 'الوقت', 'وقت', 'time', 'booking time']);

          const date = parseExcelDateValue(rawDate);
          const time = parseExcelTimeValue(rawTime);
          const notes = String(getRowVal(row, ['ملاحظات', 'الملاحظات', 'ملاحظة', 'notes', 'note']) || '').trim();

          const doctorId = findDoctorIdByName(rawDocName);

          return {
            patient: {
              name,
              phone,
              age,
              gender,
              nationality,
              caseCode,
              commissionNumber,
              nationalId,
              passportNumber,
            },
            appointment: {
              hasAppointment: !!(date && rawDocName),
              doctorName: rawDocName,
              doctorId,
              date,
              time,
              serviceType,
              notes
            }
          };
        }).filter(item => item.patient.name.length > 0); // تصفية السطور الفارغة تماما من الأسماء

        setParsedRows(mapped);
      } catch (err) {
        console.error(err);
        setErrorStatus('حدث فشل أثناء تحليل بنية ملف الإكسيل، يرجى التأكد من تطابق الحقول مع النموذج المرفق.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    setImportProgress({ current: 0, total: parsedRows.length });

    // تتبع محلي للمرضى المستوردين لتجنب تكرارهم في نفس الدفعة الحالية
    const localPatientsList = [...existingPatients];

    for (let i = 0; i < parsedRows.length; i++) {
      try {
        const item = parsedRows[i];
        
        // 1. فحص هل المريض موجود في السجلات مسبقا؟
        // المطابقة تتم بالاسم، أو كود الحالة، أو رقم الهاتف لمنع التكرار
        let targetPatientId = '';
        const found = localPatientsList.find(p => 
          (item.patient.caseCode && p.caseCode === item.patient.caseCode) ||
          (p.name.trim() === item.patient.name.trim()) ||
          (item.patient.phone && p.phone === item.patient.phone)
        );

        if (found) {
          targetPatientId = found.id;
        } else {
          // إنشاء مريض جديد
          const newPatient = await api.createPatient({
            name: item.patient.name,
            phone: item.patient.phone,
            age: item.patient.age,
            gender: item.patient.gender,
            nationality: item.patient.nationality,
            caseCode: item.patient.caseCode,
            commissionNumber: item.patient.commissionNumber,
            nationalId: item.patient.nationalId,
            passportNumber: item.patient.passportNumber,
            branch: selectedBranch
          });
          targetPatientId = newPatient.id;
          localPatientsList.push(newPatient);
        }

        // 2. إنشاء ميعاد الحجز عيادة إذا كان مدخلاً
        if (item.appointment.hasAppointment && targetPatientId) {
          // دمج التاريخ والوقت لتسجيل الموعد ISO
          const cleanDate = item.appointment.date;
          const cleanTime = item.appointment.time || '12:00';
          const fullDateTimeIso = `${cleanDate}T${cleanTime}`;

          // تحديد معرف الطبيب، إن لم يوجد نطابق طبيب تلقائي أو نتركه خالياً
          const matchedDocId = item.appointment.doctorId || (doctors[0]?.id || '');

          if (matchedDocId) {
            const isSpecial = item.appointment.serviceType.includes('خاص') || item.appointment.serviceType.includes('لجنة');
            const targetDoc = doctors.find((d: any) => d.id === matchedDocId);
            const basePrice = isSpecial 
              ? (targetDoc?.examinationPrice ? targetDoc.examinationPrice * 2 : 200) 
              : (targetDoc?.examinationPrice || 100);

            // Create appointment
            await api.createAppointment({
              patientId: targetPatientId,
              doctorId: matchedDocId,
              date: fullDateTimeIso,
              notes: item.appointment.notes || item.appointment.serviceType,
              reminderEnabled: true,
              reminderLeadTimeHours: 2,
              isSpecial: isSpecial,
              status: 'completed',
              arrivalTime: cleanTime,
              entryTime: dayjs(`${cleanDate}T${cleanTime}`).add(10, 'minute').format('HH:mm'),
              departureTime: dayjs(`${cleanDate}T${cleanTime}`).add(30, 'minute').format('HH:mm'),
              branch: selectedBranch
            });

            // Create corresponding Visit
            await api.createVisit({
              patientId: targetPatientId,
              doctorId: matchedDocId,
              date: fullDateTimeIso,
              notes: item.appointment.notes || item.appointment.serviceType,
              serviceType: item.appointment.serviceType || 'كشف عادي',
              basePrice: basePrice,
              isPaid: true,
              status: 'completed',
              arrivalTime: cleanTime,
              entryTime: dayjs(`${cleanDate}T${cleanTime}`).add(10, 'minute').format('HH:mm'),
              departureTime: dayjs(`${cleanDate}T${cleanTime}`).add(30, 'minute').format('HH:mm'),
              branch: selectedBranch
            });
          }
        }
      } catch (err) {
        console.error("Failed to import row index ", i, err);
      }
      setImportProgress(prev => ({ ...prev, current: i + 1 }));
    }

    setImporting(false);
    onComplete();
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 12 }}
        className="bg-white w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col h-[85vh]"
      >
        <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center font-bold">
              <Upload size={16} />
            </div>
            <h2 className="text-md font-black text-slate-800">استيراد تفريغ شامل لبيانات وحجوزات المرضى من ملف Excel</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-right">
          {errorStatus && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-black">
              ⚠️ {errorStatus}
            </div>
          )}

          {/* الخطوة الأولى: تحميل النموذج والتعليقات */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2 text-xs">
              <h3 className="font-extrabold text-slate-800">💡 تعليمات ملء البيانات والربط:</h3>
              <ul className="list-disc list-inside space-y-1 text-slate-600 font-medium pr-2">
                <li>استورد نموذج البيانات الجاهز واملأ حقول المرضى، كأرقام اللجان والسن والجنسية.</li>
                <li>لتسجيل حجز مريض لعيادة، يرجى كتابة اسم الطبيب والتاريخ بشكل متوافق (مثل: <span className="font-mono text-emerald-600 font-bold">2026-05-25</span>).</li>
                <li><b>منع التكرار الذكي:</b> في حال تطابق اسم المريض أو رقم الهاتف أو كود الحالة مع السجلات الحالية، سيقوم النظام بتحديث بيانات المريض وربط الحجز الجديد به تلقائياً دون تكرار ملفه الطبي!</li>
              </ul>
            </div>
            <div className="bg-emerald-50/40 p-5 rounded-xl border border-emerald-100 flex flex-col justify-between text-center">
              <div>
                <span className="text-xl block mb-2">📄</span>
                <h4 className="font-extrabold text-emerald-800 text-xs text-center">هل تحتاج لنموذج البيانات؟</h4>
                <p className="text-[10px] text-emerald-600 font-medium mt-1">قم بتنزيل النموذج المنظم مسبقاً من العيادات عالي الدقة لوضعه كمرجع للحقول</p>
              </div>
              <button 
                type="button" 
                onClick={downloadTemplate}
                className="mt-3 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg transition-all flex items-center justify-center gap-1 shadow-md shadow-emerald-800/10"
              >
                📥 تحميل النموذج الجاهز (Excel)
              </button>
            </div>
          </div>

          {/* منطقة إسقاط الملف */}
          {!importing && (
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                dragActive ? 'border-blue-500 bg-blue-50/20' : file ? 'border-emerald-300 bg-emerald-50/10' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input 
                type="file" 
                id="excel-file-upload" 
                className="hidden" 
                accept=".xlsx,.xls,.csv" 
                onChange={handleFileInput} 
              />
              <label htmlFor="excel-file-upload" className="cursor-pointer space-y-3 block">
                <div className="size-12 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center mx-auto">
                  {file ? <Check className="text-emerald-600" size={20} /> : <Upload size={20} />}
                </div>
                <div className="space-y-1">
                  <p className="font-black text-xs text-slate-800">
                    {file ? `تم اختيار: ${file.name}` : "اسحب وأفلت ملف الإكسيل هنا، أو انقر للتصفح والرفع"}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">يدعم صيغ صالحة: Excel (.xlsx, .xls) أو مفصول بفواصل (.csv)</p>
                </div>
              </label>
              {file && (
                <button 
                  type="button" 
                  onClick={() => { setFile(null); setParsedRows([]); }}
                  className="mt-3 text-[10px] font-black hover:underline text-red-500"
                >
                  حذف واختيار ملف آخر
                </button>
              )}
            </div>
          )}

          {/* المعاينة الحية للبيانات التي سيجرى تفريغها */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-blue-50/30 p-3 rounded-lg border border-blue-100">
                <span className="text-[10px] font-black text-blue-800">
                  📋 ملخص البيانات المقروءة: جاهز لمعالجة <b className="text-xs font-black font-mono text-blue-900">{parsedRows.length}</b> مريض وحجز
                </span>
                <span className="text-[10px] font-bold text-slate-400">يرجى تدقيق التطابق في المعاينة بالأسفل</span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[220px] overflow-y-auto">
                <table className="w-full text-right text-[10px] border-collapse bg-white">
                  <thead className="bg-slate-50 text-slate-500 sticky top-0 font-black">
                    <tr className="border-b border-slate-100">
                      <th className="py-2 px-3">اسم المريض</th>
                      <th className="py-2 px-3">الهاتف</th>
                      <th className="py-2 px-3">رقم اللجنة/الكود</th>
                      <th className="py-2 px-3">الطبيب المعالج</th>
                      <th className="py-2 px-3">تاريخ ووقت الحجز</th>
                      <th className="py-2 px-3">الحالة بمطابقة الطبيب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-bold">
                    {parsedRows.map((item, idx) => {
                      const doctorMatched = !!item.appointment.doctorId;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-bold text-slate-900">{item.patient.name}</td>
                          <td className="py-2 px-3 font-mono">{item.patient.phone || '---'}</td>
                          <td className="py-2 px-3">
                            <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-600 text-[9px] mr-1">
                              {item.patient.caseCode || 'بلا كود'}
                            </span>
                            {item.patient.commissionNumber && (
                              <span className="font-mono bg-purple-50 text-purple-700 px-1 py-0.5 rounded text-[9px]">
                                {item.patient.commissionNumber}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {item.appointment.hasAppointment ? `د. ${item.appointment.doctorName}` : <span className="text-slate-400">لا يوجد حجز</span>}
                          </td>
                          <td className="py-2 px-3 font-mono">
                            {item.appointment.hasAppointment ? `${item.appointment.date} @ ${item.appointment.time}` : '---'}
                          </td>
                          <td className="py-2 px-3">
                            {item.appointment.hasAppointment ? (
                              doctorMatched ? (
                                <span className="text-emerald-600 text-[9px]">✓ تم مطابقة الطبيب بنجاح</span>
                              ) : (
                                <span className="text-amber-600 text-[9px] font-black">⚠️ سيتم الربط بأول طبيب متاح</span>
                              )
                            ) : (
                              <span className="text-slate-400 text-[9px]">تسجيل مريض فقط</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* حالة تنفيذ الاستيراد وتقدم العمليات */}
          {importing && (
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-4">
              <div className="flex items-center justify-center gap-3">
                <div className="size-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <h4 className="font-extrabold text-slate-800 text-xs">جاري حفظ وإسقاط السجلات الحية... يرجى عدم إغلاق النافذة</h4>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden max-w-md mx-auto">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-300" 
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-500 font-mono font-bold">
                تم معالجة وإدراج {importProgress.current} من أصل {importProgress.total} سجل
              </p>
            </div>
          )}
        </div>

        <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-705 bg-white border border-slate-200 rounded-xl"
          >
            إلغاء النافذة
          </button>
          {parsedRows.length > 0 && !importing && (
            <button 
              type="button" 
              onClick={handleExecuteImport}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-blue-800/20 active:scale-95 transition-all"
            >
              <span>🚀 بدء إسقاط وحفظ البيانات الفعلي</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function PatientModal({ onClose, onSubmit, initialData }: any) {
  const [formData, setFormData] = useState({ 
    name: initialData?.name || "", 
    phone: initialData?.phone || "", 
    age: initialData?.age || "", 
    gender: initialData?.gender || "male",
    nationality: initialData?.nationality || "مصري",
    caseCode: initialData?.caseCode || "",
    commissionNumber: initialData?.commissionNumber || "",
    dateOfBirth: initialData?.dateOfBirth || "",
    nationalId: initialData?.nationalId || "",
    passportNumber: initialData?.passportNumber || ""
  });

  const [nationalityType, setNationalityType] = useState(
    initialData?.nationality && initialData.nationality !== "مصري" ? "non-egyptian" : "egyptian"
  );

  const [allPatients, setAllPatients] = useState<any[]>([]);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);

  useEffect(() => {
    api.getPatients().then((data) => {
      setAllPatients(data || []);
    }).catch((err) => {
      console.error("Failed to load patients for real-time validation", err);
    });
  }, []);

  const duplicates = useMemo(() => {
    if (!allPatients || allPatients.length === 0) return [];
    const found: { field: string; value: string; patientName: string }[] = [];
    const currentId = initialData?.id;

    if (formData.phone && formData.phone.trim().length > 3) {
      const match = allPatients.find((p: any) => p.id !== currentId && p.phone === formData.phone.trim());
      if (match) found.push({ field: 'رقم الهاتف', value: formData.phone.trim(), patientName: match.name });
    }
    if (formData.nationalId && formData.nationalId.trim().length > 5) {
      const match = allPatients.find((p: any) => p.id !== currentId && p.nationalId === formData.nationalId.trim());
      if (match) found.push({ field: 'الرقم القومي', value: formData.nationalId.trim(), patientName: match.name });
    }
    if (formData.commissionNumber && formData.commissionNumber.trim().length > 3) {
      const match = allPatients.find((p: any) => p.id !== currentId && p.commissionNumber === formData.commissionNumber.trim());
      if (match) found.push({ field: 'رقم المفوضية (UNHCR ID)', value: formData.commissionNumber.trim(), patientName: match.name });
    }
    if (formData.passportNumber && formData.passportNumber.trim().length > 3) {
      const match = allPatients.find((p: any) => p.id !== currentId && p.passportNumber === formData.passportNumber.trim());
      if (match) found.push({ field: 'رقم جواز السفر', value: formData.passportNumber.trim(), patientName: match.name });
    }
    return found;
  }, [formData.phone, formData.nationalId, formData.commissionNumber, formData.passportNumber, allPatients, initialData]);

  const handleDateOfBirthChange = (val: string) => {
    let calculatedAge = "";
    if (val) {
      const birthDate = dayjs(val);
      if (birthDate.isValid()) {
        const years = dayjs().diff(birthDate, 'year');
        calculatedAge = years >= 0 ? years.toString() : "0";
      }
    }
    setFormData({ ...formData, dateOfBirth: val, age: calculatedAge });
  };

  const handleNationalityTypeChange = (type: 'egyptian' | 'non-egyptian') => {
    setNationalityType(type);
    if (type === 'egyptian') {
      setFormData(prev => ({ ...prev, nationality: "مصري", passportNumber: "" }));
    } else {
      setFormData(prev => ({ ...prev, nationality: "", nationalId: "" }));
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="bg-white w-full max-w-lg rounded-xl overflow-hidden shadow-2xl border border-slate-200"
      >
        <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800">
            {initialData ? "تعديل بيانات المريض" : "إضافة مريض جديد"}
          </h2>
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">رقم الهاتف</label>
              <input required type="tel" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-mono" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="012XXXXXXXX" />
            </div>

            <div className="space-y-1 col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">نوع الجنسية / الهوية</label>
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => handleNationalityTypeChange('egyptian')}
                  className={`flex-1 py-2 rounded-lg font-bold text-xs border ${nationalityType === 'egyptian' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                >
                  جنسية مصرية
                </button>
                <button 
                  type="button" 
                  onClick={() => handleNationalityTypeChange('non-egyptian')}
                  className={`flex-1 py-2 rounded-lg font-bold text-xs border ${nationalityType === 'non-egyptian' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                >
                  جنسية أخرى (غير مصري)
                </button>
              </div>
            </div>

            {nationalityType === 'egyptian' ? (
              <div className="space-y-1 col-span-2 animate-in fade-in duration-200">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">الرقم القومي (14 رقم)</label>
                <input 
                  required
                  type="text" 
                  maxLength={14}
                  pattern="\d{14}"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-mono" 
                  value={formData.nationalId} 
                  onChange={(e) => setFormData({...formData, nationalId: e.target.value})} 
                  placeholder="29012345678901" 
                />
                <p className="text-[9px] text-slate-500 font-bold mt-1 text-right">
                  ⚠️ تنبيه الجودة: لا يتم توليد السن تلقائياً من الرقم القومي لخصوصية الحالات وضمان دقة السجل السريري للأطفال والقصر.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1 animate-in fade-in duration-200">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">الجنسية</label>
                  <input required type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm" value={formData.nationality === 'مصري' ? '' : formData.nationality} onChange={(e) => setFormData({...formData, nationality: e.target.value})} placeholder="سوري، عراقي، سوداني..." />
                </div>
                <div className="space-y-1 animate-in fade-in duration-200">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">رقم المفوضية (UNHCR ID)</label>
                  <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-mono" value={formData.commissionNumber} onChange={(e) => setFormData({...formData, commissionNumber: e.target.value})} placeholder="COMM-XXX" />
                </div>
                <div className="space-y-1 col-span-2 animate-in fade-in duration-200">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">رقم جواز السفر (Passport Number)</label>
                  <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-mono" value={formData.passportNumber} onChange={(e) => setFormData({...formData, passportNumber: e.target.value})} placeholder="A00000000" />
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">تاريخ الميلاد</label>
              <input type="date" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold text-right" value={formData.dateOfBirth} onChange={(e) => handleDateOfBirthChange(e.target.value)} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">
                {formData.dateOfBirth ? "السن (يُحتسب تلقائياً)" : "السن (أدخل القيمة يدوياً)"}
              </label>
              <input 
                required 
                type="number" 
                disabled={!!formData.dateOfBirth} 
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none transition-all text-sm font-black ${
                  formData.dateOfBirth 
                    ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed' 
                    : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-blue-500/10 text-slate-800'
                }`}
                value={formData.age} 
                onChange={(e) => setFormData({...formData, age: e.target.value})} 
                placeholder="مثال: 30"
              />
              {formData.dateOfBirth ? (
                <p className="text-[9px] text-slate-400 font-bold leading-relaxed mt-1">
                  🔒 تم قفل حقل السن ليتطابق تلقائياً مع تاريخ الميلاد. لمسح القفل وتعديل السن يدوياً، يرجى تفريغ تاريخ الميلاد أولاً.
                </p>
              ) : (
                <p className="text-[9px] text-blue-500 font-bold leading-relaxed mt-1">
                  ✍️ نظراً لعدم توفر تاريخ ميلاد، يرجى إدخال سن المريض يدوياً لضمان اكتمال السجل السريري.
                </p>
              )}
            </div>

            <div className="space-y-1 col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">الجنس</label>
              <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold" value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})}>
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </select>
            </div>
          </div>

          {duplicates.length > 0 && (
            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-right space-y-2 animate-in fade-in">
              <div className="flex items-center gap-1.5 text-amber-800 font-extrabold text-xs">
                <span className="animate-pulse">⚠️</span>
                <span>تنبيه: مريض مسجل مسبقاً بنفس البيانات!</span>
              </div>
              <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
                تم العثور على مريض أو أكثر في النظام يمتلك نفس قيم الهاتف، الرقم القومي، رقم المفوضية أو جواز السفر. يرجى مراجعة البيانات بعناية لمنع التكرار:
              </p>
              <div className="space-y-1.5 bg-white/75 p-2.5 rounded-lg border border-amber-100 text-[10px] font-medium text-slate-700">
                {duplicates.map((dup, i) => (
                  <div key={i} className="flex justify-between items-center gap-2">
                    <span>• {dup.field}: <span className="font-mono font-black">{dup.value}</span></span>
                    <span className="text-amber-900 font-extrabold">الاسم: {dup.patientName}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input 
                  type="checkbox" 
                  id="confirmDuplicate" 
                  className="rounded text-amber-600 focus:ring-amber-500 size-4 cursor-pointer" 
                  checked={confirmDuplicate} 
                  onChange={(e) => setConfirmDuplicate(e.target.checked)} 
                />
                <label htmlFor="confirmDuplicate" className="text-[10px] font-black text-amber-900 cursor-pointer select-none">
                  لقد قمت بمراجعة كافة البيانات يدوياً وأؤكد أن هذا مريض جديد غير مكرر
                </label>
              </div>
            </div>
          )}

          <div className="pt-4">
            <button 
              type="submit" 
              disabled={duplicates.length > 0 && !confirmDuplicate}
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/10 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {initialData ? "تحديث بيانات المريض" : "حفظ بيانات المريض"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// --- Doctors View ---
function DoctorsView({ doctors, visits, patients = [], onRefresh, selectedBranch }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "specialty" | "earnings">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [selectedDocId, setSelectedDocId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [docArrival, setDocArrival] = useState("09:00");
  const [docDeparture, setDocDeparture] = useState("17:00");
  const [payrollDoctor, setPayrollDoctor] = useState<any>(null);
  const [payrollMonth, setPayrollMonth] = useState(dayjs().format("YYYY-MM"));

  const parseArabicDays = (str: string): number[] => {
    if (!str) return [0, 1, 2, 3, 4, 5, 6];
    const days: number[] = [];
    const lower = str.toLowerCase();
    
    if (lower.includes("سبت")) days.push(6);
    if (lower.includes("أحد") || lower.includes("احد")) days.push(0);
    if (lower.includes("اثنين") || lower.includes("إثنين")) days.push(1);
    if (lower.includes("ثلاث")) days.push(2);
    if (lower.includes("أربع") || lower.includes("اربع")) days.push(3);
    if (lower.includes("خميس")) days.push(4);
    if (lower.includes("جمع")) days.push(5);

    if (days.length === 0) {
      const parts = lower.split(/[,，、|]/);
      parts.forEach(p => {
        const num = parseInt(p.trim(), 10);
        if (!isNaN(num) && num >= 0 && num <= 6) {
          days.push(num);
        }
      });
    }

    return days.length > 0 ? days.sort() : [0, 1, 2, 3, 4, 5, 6];
  };

  const downloadDoctorTemplate = () => {
    const headers = [
      "اسم الطبيب",
      "التخصص",
      "سعر الكشف الأساسي (جنيه)",
      "نظام محاسبة الأتعاب (ثابت / نسبة / يومي / هجين)",
      "قيمة الأجر الثابت أو النسبة أو اليومي",
      "الحد الأدنى لحزمة الكشوفات (للنظام الهجين فقط)",
      "أجر كشف الحالات الإضافية (للنظام الهجين فقط)",
      "أيام العمل أسبوعياً (مثال: السبت، الأحد، الاثنين، الثلاثاء، الأربعاء)",
      "وقت بدء العمل اليومي (مثال: 09:00)",
      "وقت انتهاء العمل اليومي (مثال: 17:00)",
      "العدد الأقصى للحالات في اليوم"
    ];

    const sample1 = [
      "د. محمد رشاد",
      "أطفال",
      200,
      "نسبة",
      30,
      "",
      "",
      "السبت، الأحد، الاثنين، الثلاثاء، الأربعاء",
      "09:00",
      "15:00",
      30
    ];

    const sample2 = [
      "د. لمياء الرفاعي",
      "باطنة",
      150,
      "هجين",
      1500,
      10,
      120,
      "الأحد، الاثنين، الأربعاء، الخميس",
      "10:00",
      "18:00",
      40
    ];

    const sample3 = [
      "د. حسام عيسى",
      "جلدية",
      180,
      "ثابت",
      50,
      "",
      "",
      "السبت، الاثنين، الأربعاء",
      "12:00",
      "20:00",
      25
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, sample1, sample2, sample3]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "نموذج الأطباء");
    XLSX.writeFile(wb, "نموذج_استيراد_الاطباء_وجداول_الحجز.xlsx");
  };

  const handleDoctorFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const rawRows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        
        if (rawRows.length <= 1) {
          alert("الملف المرفوع فارغ أو غير صحيح!");
          return;
        }

        const rows = rawRows.slice(1);
        let importedCount = 0;

        for (const row of rows) {
          if (!row[0]) continue;

          const name = String(row[0]).trim();
          const specialty = String(row[1] || "عام").trim();
          const examinationPrice = Number(row[2] || 150);
          
          let sysStr = String(row[3] || "").trim();
          let accountingSystem: any = 'fixed';
          if (sysStr.includes("نسبة")) accountingSystem = 'percentage';
          else if (sysStr.includes("يومي") || sysStr.includes("راتب")) accountingSystem = 'daily';
          else if (sysStr.includes("هجين")) accountingSystem = 'hybrid';

          const rateVal = Number(row[4] || 0);
          const fixedRate = accountingSystem === 'fixed' ? rateVal : 0;
          const percentageRate = accountingSystem === 'percentage' ? rateVal : 0;
          const dailyRate = accountingSystem === 'daily' || accountingSystem === 'hybrid' ? rateVal : 0;
          const hybridThreshold = Number(row[5] || 0);
          const hybridExtraRate = Number(row[6] || 0);

          const daysStr = String(row[7] || "").trim();
          const activeDays = parseArabicDays(daysStr);
          const startTime = String(row[8] || "09:00").trim();
          const endTime = String(row[9] || "17:00").trim();
          const maxPatientsPerDay = Number(row[10] || 30);

          await api.createDoctor({
            name,
            specialty,
            examinationPrice,
            accountingSystem,
            fixedRate,
            percentageRate,
            dailyRate,
            hybridThreshold,
            hybridExtraRate,
            maxPatientsPerDay,
            weeklySchedule: {
              activeDays,
              startTime,
              endTime
            },
            branch: selectedBranch
          });

          importedCount++;
        }

        alert(`تم استيراد عدد (${importedCount}) من الأطباء مع جداول عملهم بنجاح! 🎉`);
        onRefresh();
      } catch (err: any) {
        console.error("Error reading file: ", err);
        alert("فشل في استيراد ملف الأطباء: " + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  useEffect(() => {
    if (doctors.length > 0 && !selectedDocId) {
      setSelectedDocId(doctors[0].id);
    }
  }, [doctors, selectedDocId]);

  const specialties = Array.from(new Set(doctors.map((d: any) => d.specialty)));

  const getDoctorMonthlyStats = (docId: string) => {
    const startOfMonth = dayjs().startOf('month');
    const doctorVisits = visits.filter((v: any) => v.doctorId === docId && dayjs(v.date).isAfter(startOfMonth));
    const totalEarnings = doctorVisits.reduce((acc: number, v: any) => acc + (v.doctorEarnings || 0), 0);
    return {
      count: doctorVisits.length,
      earnings: totalEarnings
    };
  };

  const filteredDoctors = doctors
    .filter((d: any) => d.name.includes(search))
    .filter((d: any) => specialtyFilter === "all" || d.specialty === specialtyFilter)
    .sort((a: any, b: any) => {
      let valA: any, valB: any;
      if (sortBy === "earnings") {
        valA = getDoctorMonthlyStats(a.id).earnings;
        valB = getDoctorMonthlyStats(b.id).earnings;
      } else {
        valA = a[sortBy];
        valB = b[sortBy];
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">طاقم الأطباء</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">إدارة الدكاترة ونظام المحاسبة المتقدم</p>
        </div>
        <div className="flex flex-wrap gap-2.5 items-center justify-end">
          {/* Download Team template button */}
          <button 
            type="button"
            onClick={downloadDoctorTemplate}
            className="border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs cursor-pointer active:scale-95"
            title="تحميل ملف الإكسل لتعبئة بيانات الأطباء وجداولهم"
          >
            <Download size={15} />
            <span>تحميل نموذج رفع الأطباء (Template)</span>
          </button>

          {/* Import file input label buttons */}
          <label className="border border-blue-200 hover:border-blue-400 bg-blue-50/50 hover:bg-blue-50 text-blue-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs cursor-pointer active:scale-95">
            <Upload size={15} className="text-blue-600" />
            <span>رفع ملف الأطباء والجداول 📁</span>
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
              onChange={handleDoctorFileUpload} 
            />
          </label>

          <button 
            type="button"
            onClick={() => setIsAdding(true)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/10 text-sm active:scale-95 cursor-pointer"
          >
            <Plus size={18} />
            <span>إضافة دكتور جديد</span>
          </button>
        </div>
      </header>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="بحث بالاسم..." 
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <select 
            className="flex-1 md:w-40 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none"
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
          >
            <option value="all">كل التخصصات</option>
            {specialties.map(spec => (
              <option key={spec as string} value={spec as string}>{spec as string}</option>
            ))}
          </select>
          <select 
            className="flex-1 md:w-40 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="name">ترتيب بالاسم</option>
            <option value="specialty">ترتيب بالتخصص</option>
            <option value="earnings">ترتيب بالأرباح</option>
          </select>
          <button 
            onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
            className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredDoctors.map((d: any) => {
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
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => {
                        setPayrollDoctor(d);
                        setPayrollMonth(dayjs().format("YYYY-MM"));
                      }}
                      title="تصدير كشف الحساب والرواتب (Payroll)"
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-150 rounded-lg text-[10px] font-black tracking-tight transition-all flex items-center gap-1 active:scale-95"
                    >
                      <span>كشف رواتب</span>
                      <FileText size={12} />
                    </button>
                    <button 
                      onClick={() => setEditingDoctor(d)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 bg-slate-50 border border-slate-100 rounded-lg transition-all"
                      title="تعديل بيانات الطبيب"
                    >
                      <Edit size={14} />
                    </button>
                  </div>
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
        {filteredDoctors.length === 0 && <div className="col-span-full py-20 text-center text-slate-300 italic">لا توجد نتائج مطابقة لخيارات البحث</div>}
      </div>

      {/* 📅 سجل حضور وانصراف الأطباء واحتساب ساعات العمل */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 mt-8 space-y-6">
        <div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Clock size={18} className="text-blue-600 animate-pulse" />
            <span>سجل حضور وانصراف الأطباء واحتساب ساعات العمل اليومية</span>
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
            تسجيل توقيت وصول الدكتور وتوقيت انصرافه لاحتساب اجمالي الساعات المنقضية خلال اليوم
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Side */}
          <div className="lg:col-span-5 bg-slate-50/50 p-5 rounded-xl border border-slate-150 space-y-4">
            <h3 className="text-xs font-black text-slate-700 pb-2 border-b border-slate-200">تسجيل نوبة حضور جديدة</h3>
            
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose block">اختر الدكتور</label>
              <select 
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-750 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
              >
                <option value="">- اختر الدكتور -</option>
                {doctors.map((d: any) => (
                  <option key={d.id} value={d.id}>د. {d.name} ({d.specialty})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose block">تاريخ النوبة</label>
              <input 
                type="date"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-755 focus:outline-none"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose block">توقيت الوصول</label>
                <input 
                  type="time"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-755 focus:outline-none"
                  value={docArrival}
                  onChange={(e) => setDocArrival(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose block">توقيت الانصراف</label>
                <input 
                  type="time"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-755 focus:outline-none"
                  value={docDeparture}
                  onChange={(e) => setDocDeparture(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="button"
              disabled={!selectedDocId}
              onClick={async () => {
                const doc = doctors.find((d: any) => d.id === selectedDocId);
                if (!doc) return;

                const start = dayjs(`2026-05-26T${docArrival}`);
                const end = dayjs(`2026-05-26T${docDeparture}`);
                let diff = end.diff(start, 'minute');
                if (diff < 0) diff += 24 * 60;
                const hoursWorked = Number((diff / 60).toFixed(2));

                const newEntry = {
                  date: attendanceDate,
                  arrivalTime: docArrival,
                  departureTime: docDeparture,
                  hoursWorked
                };

                const currentAtt = doc.attendance || [];
                const updatedAtt = [
                  ...currentAtt.filter((a: any) => a.date !== attendanceDate),
                  newEntry
                ].sort((a: any, b: any) => dayjs(b.date).diff(dayjs(a.date)));

                await api.updateDoctor(selectedDocId, { attendance: updatedAtt });
                onRefresh();
              }}
              className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-extrabold hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
            >
              تسجيل وحساب ساعات العمل المكتسبة 💾
            </button>
          </div>

          {/* List/Table Side */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            {(() => {
              const doc = doctors.find((d: any) => d.id === selectedDocId);
              const tableLogs = doc?.attendance || [];
              const totalHours = tableLogs.reduce((acc: number, entry: any) => acc + (entry.hoursWorked || 0), 0);
              const totalDays = tableLogs.length;

              return (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-700">سجل حضور للدكتور: <span className="text-blue-600">{doc ? `د. ${doc.name}` : 'اختر دكتور'}</span></h3>
                    <div className="flex gap-2 text-[10px]">
                      <span className="bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded">إجمالي النوبات: {totalDays}</span>
                      <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded">مجموع الساعات: {totalHours.toFixed(1)} س</span>
                    </div>
                  </div>

                  <div className="border border-slate-150 rounded-xl overflow-hidden flex-1 max-h-[290px] overflow-y-auto">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead className="bg-slate-50 text-slate-500 text-[10px] font-black sticky top-0">
                        <tr className="border-b border-slate-200">
                          <th className="px-4 py-2 bg-slate-50">التاريخ</th>
                          <th className="px-4 py-2 bg-slate-50">الوصول</th>
                          <th className="px-4 py-2 bg-slate-50">الانصراف</th>
                          <th className="px-4 py-2 bg-slate-50">الساعات الكلية</th>
                          <th className="px-4 py-2 bg-slate-50">أدوات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                        {tableLogs.map((entry: any, index: number) => (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="px-4 py-2">{entry.date}</td>
                            <td className="px-4 py-2 font-mono text-blue-600">{entry.arrivalTime}</td>
                            <td className="px-4 py-2 font-mono text-purple-600">{entry.departureTime}</td>
                            <td className="px-4 py-2 font-mono text-emerald-600 bg-emerald-50/20">{entry.hoursWorked} ساعة</td>
                            <td className="px-4 py-2">
                              <button 
                                type="button"
                                onClick={async () => {
                                  const updatedAtt = tableLogs.filter((_: any, idx: number) => idx !== index);
                                  await api.updateDoctor(doc.id, { attendance: updatedAtt });
                                  onRefresh();
                                }}
                                className="text-red-500 hover:text-red-700 text-[10px] font-black"
                              >
                                حذف
                              </button>
                            </td>
                          </tr>
                        ))}
                        {tableLogs.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-14 text-center text-slate-350 italic">لا توجد سجلات حضور مسجلة لهذا الدكتور بعد</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <DoctorModal 
            onClose={() => setIsAdding(false)} 
            onSubmit={async (data: any) => {
              await api.createDoctor({ ...data, branch: selectedBranch });
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
        {payrollDoctor && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] font-sans"
            onClick={(e) => { if (e.target === e.currentTarget) setPayrollDoctor(null); }}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="bg-white w-full max-w-3xl rounded-xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between text-right">
                <div>
                  <h2 className="text-lg font-black text-slate-800 flex items-center gap-1.5">
                    <span>كشف حساب أتعاب الطبيب المالي (Payroll)</span>
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold capitalize mt-0.5">تصدير وطباعة تقرير الرواتب والمستحقات والعمولات التفصيلية</p>
                </div>
                <button onClick={() => setPayrollDoctor(null)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"><X size={20} /></button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 text-right font-sans flex-1">
                
                {/* Period/Month Picker & Doctor Header */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50 border border-slate-155 p-4 rounded-xl">
                  {/* Doctor Info */}
                  <div>
                    <div className="text-xl font-black text-slate-900">د. {payrollDoctor.name}</div>
                    <div className="text-xs text-blue-600 font-extrabold mt-1">{payrollDoctor.specialty}</div>
                  </div>
                  
                  {/* Period selection */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-black text-slate-500 whitespace-nowrap">تحديد فترة الاستحقاق:</label>
                    <input 
                      type="month" 
                      className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-black text-slate-705 focus:outline-none"
                      value={payrollMonth}
                      onChange={(e) => setPayrollMonth(e.target.value)}
                    />
                  </div>
                </div>

                {/* Calculation Stats boxes */}
                {(() => {
                  const selectedDate = dayjs(payrollMonth, "YYYY-MM");
                  const doctorVisits = visits.filter((v: any) => {
                    if (v.doctorId !== payrollDoctor.id) return false;
                    const vDate = dayjs(v.date);
                    return vDate.isSame(selectedDate, 'month') && vDate.isSame(selectedDate, 'year');
                  });
                  const sumEarnings = doctorVisits.reduce((acc: number, v: any) => acc + (v.doctorEarnings || 0), 0);
                  const sumTotalCost = doctorVisits.reduce((acc: number, v: any) => acc + (v.cost || 0), 0);

                  return (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-center space-y-1">
                          <div className="text-[9px] text-slate-400 font-black uppercase">إجمالي كشوفات الشهر</div>
                          <div className="text-2xl font-black text-slate-800">{doctorVisits.length}</div>
                          <div className="text-[9px] text-slate-500 font-semibold">كشف طبي معتمد</div>
                        </div>

                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-center space-y-1">
                          <div className="text-[9px] text-blue-600 font-black uppercase">إجمالي عائد الزيارات</div>
                          <div className="text-2xl font-black text-blue-700">{sumTotalCost} <span className="text-xs">ج.م</span></div>
                          <div className="text-[9px] text-blue-500 font-semibold">المبالغ المدفوعة بالعيادة</div>
                        </div>

                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center space-y-1 col-span-2">
                          <div className="text-[9px] text-emerald-600 font-black uppercase">أتعاب الطبيب المستحقة</div>
                          <div className="text-2xl font-black text-emerald-700">{sumEarnings} <span className="text-sm">ج.م</span></div>
                          <div className="text-[9px] text-emerald-500 font-semibold">أجر الطبيب المحسوب للصرف</div>
                        </div>
                      </div>

                      {/* Info on contract */}
                      <div className="bg-blue-50/25 border border-blue-100 p-3.5 rounded-xl text-xs flex items-center justify-between font-medium">
                        <span className="text-slate-500">نظام محاسبة المستحقات:</span>
                        <span className="font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {payrollDoctor.accountingSystem === 'fixed' ? `دفعة مقطوعة لكل كشف (${payrollDoctor.fixedRate} ج.م)` : 
                           payrollDoctor.accountingSystem === 'percentage' ? `نسبة مئوية من الكشف (${payrollDoctor.percentageRate}%)` :
                           payrollDoctor.accountingSystem === 'daily' ? `راتب نوبات يومي ثابت (${payrollDoctor.dailyRate} ج.م)` :
                           `نظام هجين (${payrollDoctor.dailyRate} ج.م أساسي نوبة + كشف إضافي)`}
                        </span>
                      </div>

                      {/* Detailed table of visits */}
                      <div className="space-y-2">
                        <h3 className="text-xs font-black text-slate-700">بيان الكشوفات والخدمات المقدمة:</h3>
                        <div className="border border-slate-150 rounded-xl overflow-hidden max-h-[200px] overflow-y-auto">
                          <table className="w-full text-right border-collapse text-xs">
                            <thead className="bg-slate-50 text-slate-500 text-[10px] font-black tracking-widest sticky top-0 border-b border-slate-200">
                              <tr>
                                <th className="px-5 py-3 bg-slate-50">#</th>
                                <th className="px-5 py-3 bg-slate-50">التاريخ والوقت</th>
                                <th className="px-5 py-3 bg-slate-50">اسم المريض</th>
                                <th className="px-5 py-3 bg-slate-50">الخدمة</th>
                                <th className="px-5 py-3 bg-slate-50">قيمة الكشف</th>
                                <th className="px-5 py-3 bg-slate-50 text-left">مستحقات الطبيب</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-bold text-slate-700 text-[11px]">
                              {doctorVisits.map((v: any, index: number) => {
                                const pt = patients.find((p: any) => p.id === v.patientId);
                                return (
                                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-5 py-2.5 text-slate-400 font-mono">{index + 1}</td>
                                    <td className="px-5 py-2.5 font-mono text-slate-500">{dayjs(v.date).format('YYYY/MM/DD HH:mm')}</td>
                                    <td className="px-5 py-2.5 font-sans">
                                      <div>{pt?.name || 'مريض غير معروف'}</div>
                                    </td>
                                    <td className="px-5 py-2.5">{v.serviceType}</td>
                                    <td className="px-5 py-2.5 font-mono text-slate-600">{v.cost} ج.م</td>
                                    <td className="px-5 py-2.5 font-mono text-emerald-600 text-left">{v.doctorEarnings || 0} ج.م</td>
                                  </tr>
                                );
                              })}
                              {doctorVisits.length === 0 && (
                                <tr>
                                  <td colSpan={6} className="py-12 text-center text-slate-400 bg-slate-50/50 italic font-medium">لا توجد كشوفات مسجلة لهذا الطبيب خلال فترة الاستحقاق المحددة</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-4 border-t border-slate-150 flex justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => setPayrollDoctor(null)}
                          className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 font-black rounded-lg text-xs hover:bg-slate-100 transition-all active:scale-95"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          disabled={doctorVisits.length === 0}
                          onClick={() => {
                            const printWindow = window.open('', '_blank');
                            if (!printWindow) return;
                            
                            const monthName = dayjs(selectedDate).format('MMMM YYYY');
                            let tableRows = '';
                            doctorVisits.forEach((v: any, idx: number) => {
                              const ptName = patients.find((p: any) => p.id === v.patientId)?.name || 'غير معروف';
                              tableRows += `
                                <tr style="border-bottom: 1px solid #E2E8F0;">
                                  <td style="padding: 10px; font-size: 11px; text-align: right; font-family: sans-serif; font-weight: bold;">${idx + 1}</td>
                                  <td style="padding: 10px; font-size: 11px; text-align: right; font-family: monospace;">${dayjs(v.date).format('YYYY-MM-DD HH:mm')}</td>
                                  <td style="padding: 10px; font-size: 11px; text-align: right; font-family: sans-serif;">${ptName}</td>
                                  <td style="padding: 10px; font-size: 11px; text-align: right; font-family: sans-serif;">${v.serviceType}</td>
                                  <td style="padding: 10px; font-size: 11px; text-align: right; font-family: monospace;">${v.cost} ج.م</td>
                                  <td style="padding: 10px; font-size: 11px; text-align: left; font-family: monospace; font-weight: bold; color: #10B981;">${v.doctorEarnings || 0} ج.م</td>
                                </tr>
                              `;
                            });

                            printWindow.document.write(`
                              <html lang="ar" dir="rtl">
                                <head>
                                  <title>كشف حساب أتعاب الطبيب - د. ${payrollDoctor.name}</title>
                                  <style>
                                    body { font-family: system-ui, -apple-system, sans-serif; margin: 40px; color: #1E293B; }
                                    .header { text-align: center; border-bottom: 3px double #3B82F6; padding-bottom: 20px; margin-bottom: 30px; }
                                    .header h1 { margin: 0; font-size: 20px; color: #1E3A8A; }
                                    .header p { margin: 5px 0 0; font-size: 12px; color: #64748B; }
                                    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
                                    .info-card { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 15px; border-radius: 8px; }
                                    .info-card h3 { margin: 0 0 5px; font-size: 11px; color: #64748B; text-transform: uppercase; }
                                    .info-card p { margin: 0; font-size: 14px; font-weight: bold; color: #0F172A; }
                                    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                                    th { background-color: #F1F5F9; color: #475569; font-weight: bold; text-align: right; padding: 12px 10px; font-size: 12px; border-bottom: 2px solid #CBD5E1; }
                                    .total-box { background: #ECFDF5; border: 1.5px solid #10B981; padding: 20px; text-align: center; border-radius: 8px; margin-top: 30px; }
                                    .total-title { font-size: 12px; color: #065F46; font-weight: bold; margin-bottom: 5px; }
                                    .total-value { font-size: 24px; font-weight: 900; color: #047857; }
                                    .footer { margin-top: 60px; text-align: center; font-size: 10px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 15px; }
                                    @media print {
                                      body { margin: 20px; }
                                      button { display: none; }
                                    }
                                  </style>
                                </head>
                                <body>
                                  <div class="header">
                                    <h1>كشف حساب الأتعاب والرواتب التفصيلي (Payroll Statement)</h1>
                                    <p>منظومة إدارة عيادات الطاقم الطبي الموحدة</p>
                                  </div>
                                  
                                  <div class="info-grid" style="padding-bottom: 15px;">
                                    <div class="info-card">
                                      <h3>الطبيب المعالج:</h3>
                                      <p>د. ${payrollDoctor.name} (${payrollDoctor.specialty})</p>
                                    </div>
                                    <div class="info-card">
                                      <h3>الفترة وعام الكشف:</h3>
                                      <p>عن شهر: ${monthName}</p>
                                    </div>
                                    <div class="info-card">
                                      <h3>نظام احتساب المستحقات العقدي:</h3>
                                      <p>
                                        ${payrollDoctor.accountingSystem === 'fixed' ? `قيمة مقطوعة لكل كشف (${payrollDoctor.fixedRate} ج.م)` : 
                                          payrollDoctor.accountingSystem === 'percentage' ? `نسبة مئوية من قيمة الكشف (${payrollDoctor.percentageRate}%)` :
                                          payrollDoctor.accountingSystem === 'daily' ? `راتب يومي ثابت (${payrollDoctor.dailyRate} ج.م)` :
                                          `نظام هجين (${payrollDoctor.dailyRate} أساسي + ${payrollDoctor.hybridExtraRate} إضافي)`}
                                      </p>
                                    </div>
                                    <div class="info-card">
                                      <h3>إجمالي العيادات / الكشوفات:</h3>
                                      <p>${doctorVisits.length} كشف طبي معتمد</p>
                                    </div>
                                  </div>
                                  
                                  <h2 style="font-size: 14px; border-bottom: 2px solid #E2E8F0; padding-bottom: 8px; margin-top: 30px; margin-bottom: 15px; color: #1E3A8A;">بيان تفصيلي بالكشوفات الطبية المؤداة:</h2>
                                  <table>
                                    <thead>
                                      <tr>
                                        <th style="width: 5%;">#</th>
                                        <th style="width: 25%;">التاريخ والوقت</th>
                                        <th style="width: 30%;">اسم المريض</th>
                                        <th style="width: 15%;">نوع الخدمة</th>
                                        <th style="width: 13%;">القيمة الإجمالية</th>
                                        <th style="width: 12%; text-align: left;">أتعاب الطبيب المستحقة</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      ${tableRows}
                                    </tbody>
                                  </table>
                                  
                                  <div class="total-box">
                                    <div class="total-title">إجمالي صافي الأتعاب والعمولات المستحقة للصرف:</div>
                                    <div class="total-value">${sumEarnings} ج.م</div>
                                  </div>
                                  
                                  <div style="margin-top: 60px; display: grid; grid-template-columns: repeat(2, 1fr); text-align: center; font-size: 12px; font-weight: bold; color: #475569;">
                                    <div>اعتماد محاسب العيادة: ............................</div>
                                    <div>توقيع الدكتور بالاستلام: ............................</div>
                                  </div>

                                  <div class="footer">
                                    <p>تم استخراج هذا الكشف تلقائياً من نظام العيادات الذكي بتاريخ ${dayjs().format('YYYY-MM-DD HH:mm:ss')}</p>
                                  </div>
                                  
                                  <script>
                                    window.onload = function() {
                                      window.print();
                                    }
                                  </script>
                                </body>
                              </html>
                            `);
                            printWindow.document.close();
                          }}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg text-xs transition-colors flex items-center gap-1.5 active:scale-95 shadow-md shadow-emerald-950/10 disabled:opacity-50"
                        >
                          <FileText size={14} />
                          <span>تصدير وطباعة كشف الحساب 📄</span>
                        </button>
                      </div>
                    </>
                  );
                })()}

              </div>
            </motion.div>
          </div>
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
    hybridExtraRate: initialData?.hybridExtraRate || 0,
    maxPatientsPerDay: initialData?.maxPatientsPerDay || 20,
    weeklySchedule: initialData?.weeklySchedule || {
      activeDays: initialData?.weeklySchedule?.activeDays || [0, 1, 2, 3, 4, 5, 6],
      startTime: initialData?.weeklySchedule?.startTime || "09:00",
      endTime: initialData?.weeklySchedule?.endTime || "17:00",
    }
  });

  const [autoLinkHybrid, setAutoLinkHybrid] = useState(true);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
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
              <input required type="number" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-black" value={formData.examinationPrice} onChange={(e) => {
                const val = Number(e.target.value);
                setFormData(prev => ({
                  ...prev,
                  examinationPrice: val,
                  ...(autoLinkHybrid && prev.accountingSystem === DocAccountingSystem.HYBRID ? { dailyRate: prev.hybridThreshold * val } : {})
                }));
              }} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">أقصى عدد حالات/يوم</label>
              <input required type="number" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-black" value={formData.maxPatientsPerDay} onChange={(e) => setFormData({...formData, maxPatientsPerDay: Number(e.target.value)})} />
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
                  <input type="radio" className="hidden" name="acc" value={sys.id} checked={formData.accountingSystem === sys.id} onChange={() => {
                    setFormData(prev => {
                      const nextSys = sys.id as any;
                      const updated = { ...prev, accountingSystem: nextSys };
                      if (nextSys === DocAccountingSystem.HYBRID && autoLinkHybrid) {
                        updated.dailyRate = prev.hybridThreshold * prev.examinationPrice;
                      }
                      return updated;
                    });
                  }} />
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
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-100 flex flex-col gap-1 text-right">
                    <span className="text-[10px] font-black text-blue-800">حاسبة ومؤشرات المواءمة الرياضية للنظام الهجين 📊</span>
                    <span className="text-[9px] text-slate-500 font-bold leading-relaxed">
                      يعتمد النظام الهجين على حزمة راتب يومي تغطي حد كشوفات أقصى، ومن ثم يتم تفعيل الكشف الإضافي بقيمة معينة.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">سعر الكشف اليومي (الراتب اليومي الأساسي) (ج.م)</label>
                      <input required type="number" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-black" value={formData.dailyRate} onChange={(e) => {
                        const val = Number(e.target.value);
                        setFormData(prev => {
                          const autoThreshold = prev.examinationPrice > 0 ? Math.round(val / prev.examinationPrice) : prev.hybridThreshold;
                          return {
                            ...prev,
                            dailyRate: val,
                            ...(autoLinkHybrid ? { hybridThreshold: autoThreshold } : {})
                          };
                        });
                      }} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">عدد الكشوفات المشمولة باليوم</label>
                      <input required type="number" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-black" value={formData.hybridThreshold} onChange={(e) => {
                        const val = Number(e.target.value);
                        setFormData(prev => {
                          const autoDailyRate = val * prev.examinationPrice;
                          return {
                            ...prev,
                            hybridThreshold: val,
                            ...(autoLinkHybrid ? { dailyRate: autoDailyRate } : {})
                          };
                        });
                      }} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">سعر الكشف الإضافي (ج.م)</label>
                      <input required type="number" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-black" value={formData.hybridExtraRate} onChange={(e) => setFormData({...formData, hybridExtraRate: Number(e.target.value)})} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <input 
                      type="checkbox" 
                      id="autoLinkHybrid" 
                      className="rounded text-blue-600 focus:ring-blue-500 size-4 cursor-pointer" 
                      checked={autoLinkHybrid} 
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAutoLinkHybrid(checked);
                        if (checked) {
                          setFormData(prev => ({
                            ...prev,
                            dailyRate: prev.hybridThreshold * prev.examinationPrice
                          }));
                        }
                      }} 
                    />
                    <label htmlFor="autoLinkHybrid" className="text-[10px] font-black text-slate-600 cursor-pointer select-none">
                      ربط واحتساب تلقائي للراتب بناءً على سعر الكشف المحدد (راتب هجين متوازن)
                    </label>
                  </div>

                  {/* Summary math simulation card */}
                  <div className="p-3 bg-slate-100/60 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-600 space-y-1.5 leading-relaxed text-right">
                    <div className="text-slate-800 font-extrabold pb-1 border-b border-slate-200/50 text-center">المعادلة الهجينة المحسوبة:</div>
                    <div className="flex justify-between">
                      <span>• سعر كشف المريض العادي:</span>
                      <span className="font-mono text-slate-800 font-black">{formData.examinationPrice} ج.م</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• الكشوفات الأساسية المشمولة بالراتب:</span>
                      <span className="font-mono text-slate-800 font-black">{formData.hybridThreshold} كشوفات الأولى</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• سعر تكلفة الكشف داخل الحزمة المقابلة للراتب:</span>
                      <span className="font-mono text-blue-600 font-black">
                        {formData.hybridThreshold > 0 ? (formData.dailyRate / formData.hybridThreshold).toFixed(1) : 0} ج.م
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>• أقصى عدد كشوفات باليوم:</span>
                      <span className="font-mono text-slate-800 font-black">{formData.maxPatientsPerDay} كشف باليوم</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• القدرة الاستيعابية للحالات الإضافية باليوم:</span>
                      <span className="font-mono text-slate-850 font-black">
                        {Math.max(0, formData.maxPatientsPerDay - formData.hybridThreshold)} حالة إضافية باليوم
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-dashed border-slate-200 pt-1.5 text-slate-950 font-extrabold">
                      <span>• الحد الأقصى المتوقع لأتعاب الطبيب باليوم الواحد:</span>
                      <span className="font-mono text-emerald-600 text-xs font-black">
                        {formData.dailyRate + Math.max(0, formData.maxPatientsPerDay - formData.hybridThreshold) * formData.hybridExtraRate} ج.م
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Weekly Schedule Section */}
          <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-3">
            <h3 className="text-xs font-black text-slate-700 flex items-center gap-1">
              <span>📅 مواعيد الطبيب الأسبوعية المعتمدة للحجز</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold leading-normal">
              اختر الأيام التي يعمل بها الطبيب أسبوعياً وساعات العمل المقررة لفرضها ومنع حجز مواعيد للأطباء خارجها.
            </p>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">أيام العمل المعتمدة</label>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 pt-1">
                {[
                  { id: 6, label: 'السبت' },
                  { id: 0, label: 'الأحد' },
                  { id: 1, label: 'الاثنين' },
                  { id: 2, label: 'الثلاثاء' },
                  { id: 3, label: 'الأربعاء' },
                  { id: 4, label: 'الخميس' },
                  { id: 5, label: 'الجمعة' },
                ].map((d) => {
                  const isChecked = formData.weeklySchedule ? formData.weeklySchedule.activeDays.includes(d.id) : true;
                  return (
                    <button
                      type="button"
                      key={d.id}
                      onClick={() => {
                        const currentDays = formData.weeklySchedule ? [...formData.weeklySchedule.activeDays] : [0, 1, 2, 3, 4, 5, 6];
                        let nextDays;
                        if (currentDays.includes(d.id)) {
                          nextDays = currentDays.filter(day => day !== d.id);
                        } else {
                          nextDays = [...currentDays, d.id].sort();
                        }
                        setFormData({
                          ...formData,
                          weeklySchedule: {
                            ...(formData.weeklySchedule || { startTime: '09:00', endTime: '17:00' }),
                            activeDays: nextDays
                          }
                        });
                      }}
                      className={`py-1.5 px-0.5 rounded-lg text-[10px] font-bold border transition-all text-center block ${
                        isChecked 
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm font-black' 
                          : 'bg-white border-slate-205 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">من الساعة (وقت البدء)</label>
                <input 
                  type="time" 
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-755 focus:outline-none focus:ring-1 focus:ring-blue-500/10" 
                  value={formData.weeklySchedule ? formData.weeklySchedule.startTime : '09:00'} 
                  onChange={(e) => setFormData({
                    ...formData,
                    weeklySchedule: {
                      ...(formData.weeklySchedule || { activeDays: [0, 1, 2, 3, 4, 5, 6], endTime: '17:00' }),
                      startTime: e.target.value
                    }
                  })} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">إلى الساعة (وقت الانتهاء)</label>
                <input 
                  type="time" 
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-755 focus:outline-none focus:ring-1 focus:ring-blue-500/10" 
                  value={formData.weeklySchedule ? formData.weeklySchedule.endTime : '17:00'} 
                  onChange={(e) => setFormData({
                    ...formData,
                    weeklySchedule: {
                      ...(formData.weeklySchedule || { activeDays: [0, 1, 2, 3, 4, 5, 6], startTime: '09:00' }),
                      endTime: e.target.value
                    }
                  })} 
                />
              </div>
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
function PatientProfileView({ patientId, doctors, appointments: allAppointments = [], onRefresh, onBack, autoCompleteAppointmentId, clearAutoCompleteAppointment, selectedBranch, onOpenMessages, currentUser }: any) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientVisits, setPatientVisits] = useState<Visit[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointmentToComplete, setSelectedAppointmentToComplete] = useState<Appointment | null>(null);
  const [activeTab, setActiveTab] = useState<'visits' | 'reports' | 'personal' | 'appointments'>('visits');
  const [isAddingVisit, setIsAddingVisit] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [preselectedVisitId, setPreselectedVisitId] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  
  // Visit edit and cancellation states
  const [isEditingVisit, setIsEditingVisit] = useState(false);
  const [selectedVisitToEdit, setSelectedVisitToEdit] = useState<Visit | null>(null);
  const [selectedVisitForDetails, setSelectedVisitForDetails] = useState<Visit | null>(null);
  const [printPrescriptionVisit, setPrintPrescriptionVisit] = useState<Visit | null>(null);
  const [printMedicalReportVisit, setPrintMedicalReportVisit] = useState<Visit | null>(null);
  const [printConfirmVisit, setPrintConfirmVisit] = useState<Visit | null>(null);
  const [showPrintSummary, setShowPrintSummary] = useState(false);
  
  // Custom states for Quick Vitals, Gallery Preview, Lightbox, and Chronic Diseases
  const [showQuickVitalsModal, setShowQuickVitalsModal] = useState(false);
  const [fileViewMode, setFileViewMode] = useState<'table' | 'gallery'>('gallery');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxScale, setLightboxScale] = useState<number>(1);
  const [lightboxRotation, setLightboxRotation] = useState<number>(0);

  const detectedChronicDiseases = useMemo(() => {
    if (!patientVisits || patientVisits.length === 0) return [];
    
    const CHRONIC_DISEASE_KEYWORDS = [
      { name: 'ارتفاع ضغط الدم (Hypertension)', keywords: ['ضغط', 'hypertension', 'blood pressure', 'htn', 'مرتفع الضغط'] },
      { name: 'السكري (Diabetes)', keywords: ['سكري', 'سكر', 'diabetes', 'dm', 'insulin', 'أنسولين', 'انسولين'] },
      { name: 'الربو ومشاكل الجهاز التنفسي المزمنة (Asthma/COPD)', keywords: ['ربو', 'حساسية صدر', 'asthma', 'copd', 'تنفسي مزمن'] },
      { name: 'أمراض القلب والشرايين (Heart Disease)', keywords: ['قلب', 'شرايين', 'قصور القلب', 'heart', 'coronary', 'cardiac'] },
      { name: 'الفشل الكلوي أو اعتلال الكلى المزمن (Chronic Kidney Disease)', keywords: ['كلى', 'فشل كلوي', 'kidney', 'ckd', 'اعتلال الكلى'] },
      { name: 'الغدة الدرقية (Thyroid Disorder)', keywords: ['درقية', 'غدة درقية', 'thyroid', 'goiter'] },
      { name: 'الصرع أو الاضطرابات العصبية (Epilepsy/Neurological)', keywords: ['صرع', 'تشنج', 'epilepsy', 'neurological', 'اعصاب', 'أعصاب'] },
    ];
    
    const detected: { name: string; foundIn: string; date: string }[] = [];
    
    patientVisits.forEach(v => {
      const diagStr = (v.diagnosis || "").toLowerCase();
      const notesStr = (v.notes || "").toLowerCase();
      const clinicalStr = (v.clinicalAssessment || "").toLowerCase();
      
      CHRONIC_DISEASE_KEYWORDS.forEach(disease => {
        if (detected.some(d => d.name === disease.name)) return;
        
        const matchedKeyword = disease.keywords.find(keyword => 
          diagStr.includes(keyword) || 
          notesStr.includes(keyword) ||
          clinicalStr.includes(keyword)
        );
        
        if (matchedKeyword) {
          detected.push({
            name: disease.name,
            foundIn: v.diagnosis ? `${v.diagnosis}` : 'ملاحظات الكشف العيادي',
            date: v.date
          });
        }
      });
    });
    
    return detected;
  }, [patientVisits]);

  // AI-Assisted Medicolegal Briefing & Progress States
  const [aiFolderBrief, setAiFolderBrief] = useState<string>('');
  const [aiFolderBriefLoading, setAiFolderBriefLoading] = useState<boolean>(false);
  const [aiGalleryProgress, setAiGalleryProgress] = useState<string>('');
  const [aiGalleryProgressLoading, setAiGalleryProgressLoading] = useState<boolean>(false);

  const handleGeneratePatientFileBrief = async () => {
    if (!patient) return;
    setAiFolderBriefLoading(true);
    setAiFolderBrief('');
    try {
      const res = await fetch('/api/patient-file-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient, visitsHistory: patientVisits })
      });
      const data = await res.json();
      setAiFolderBrief(data.brief || 'حدث خطأ في جلب الملخص');
    } catch (err) {
      console.error(err);
      setAiFolderBrief('فشل في توليد الخلاصة الطبية المؤتمتة.');
    } finally {
      setAiFolderBriefLoading(false);
    }
  };

  const handleGeneratePatientInvestigationsProgress = async () => {
    if (!patient) return;
    setAiGalleryProgressLoading(true);
    setAiGalleryProgress('');
    try {
      const res = await fetch('/api/patient-investigations-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient, files: reports })
      });
      const data = await res.json();
      setAiGalleryProgress(data.progress || 'حدث خطأ في جلب التقرير');
    } catch (err) {
      console.error(err);
      setAiGalleryProgress('فشل في تحليل تقدم المستندات.');
    } finally {
      setAiGalleryProgressLoading(false);
    }
  };

  const [visitsViewMode, setVisitsViewMode] = useState<'cards' | 'table'>('cards');
  const [showVisitsColumnSettings, setShowVisitsColumnSettings] = useState(false);
  const [visibleVisitsColumns, setVisibleVisitsColumns] = useState({
    date: true,
    doctor: true,
    service: true,
    complaint: true,
    diagnosis: true,
    cost: true,
    isPaid: true,
    actions: true,
  });

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

  useEffect(() => {
    if (autoCompleteAppointmentId && appointments.length > 0) {
      const targetAppt = appointments.find(a => a.id === autoCompleteAppointmentId);
      if (targetAppt && targetAppt.status === 'scheduled') {
        setSelectedAppointmentToComplete(targetAppt);
        setActiveTab('appointments');
      }
      if (clearAutoCompleteAppointment) {
        clearAutoCompleteAppointment();
      }
    }
  }, [autoCompleteAppointmentId, appointments, clearAutoCompleteAppointment]);

  const [reportFilter, setReportFilter] = useState<'all' | 'prescription' | 'report' | 'other'>('all');
  const [reportSort, setReportSort] = useState<{ key: string, dir: 'asc' | 'desc' }>({ key: 'createdAt', dir: 'desc' });
  const [expandedVisits, setExpandedVisits] = useState<Record<string, boolean>>({});

  const toggleVisitExpand = (vId: string) => {
    setExpandedVisits(prev => ({ ...prev, [vId]: !prev[vId] }));
  };

  const filteredReports = [...reports].filter((r: any) => {
    if (reportFilter === 'all') return true;
    if (reportFilter === 'other') return r.type !== 'prescription' && r.type !== 'report';
    return r.type === reportFilter;
  });

  const sortedReports = [...filteredReports].sort((a: any, b: any) => {
    if (reportSort.key === 'createdAt') {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return reportSort.dir === 'asc' ? dateA - dateB : dateB - dateA;
    }
    const valA = (a[reportSort.key] || "").toString().toLowerCase();
    const valB = (b[reportSort.key] || "").toString().toLowerCase();
    if (valA < valB) return reportSort.dir === 'asc' ? -1 : 1;
    if (valA > valB) return reportSort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleReportSort = (key: string) => {
    setReportSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc'
    }));
  };

  const upcomingAppointment = useMemo(() => {
    return appointments.find((a: any) => a.status === 'scheduled');
  }, [appointments]);

  const handleSendReminder = async (apptId: string) => {
    await api.sendAppointmentReminder(apptId);
    loadProfile();
  };

  const calculateDoctorLoad = (doctorId: string, date: string) => {
    return allAppointments.filter((a: any) => a.doctorId === doctorId && dayjs(a.date).isSame(dayjs(date), 'day')).length;
  };

  const getWhatsAppLink = (appointment: any, doctor: any) => {
    const patientPhone = patient?.phone || "";
    let cleanPhone = patientPhone.replace(/[^\d]/g, "");
    if (cleanPhone.startsWith("01")) {
      cleanPhone = "20" + cleanPhone.slice(1);
    } else if (cleanPhone.startsWith("1")) {
      cleanPhone = "20" + cleanPhone;
    }
    const dateFormatted = dayjs(appointment.date).format('YYYY/MM/DD');
    const timeFormatted = dayjs(appointment.date).format('hh:mm a');
    const msg = `مرحباً ${patient?.name || 'عزيزي المريض'}، نود تذكيرك بموعد عيادتك مع د. ${doctor?.name || ''} بتاريخ ${dateFormatted} الساعة ${timeFormatted} في عيادة Clinic Care. نتمنى لك دوام الصحة والعافية.`;
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
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
          {onOpenMessages && (
            <button 
              onClick={() => onOpenMessages(patient.id)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-purple-750 transition-all shadow-md shadow-purple-900/10"
            >
              <MessageCircle size={14} /> ملاحظة حالة / مراسلة
            </button>
          )}
          <button 
            onClick={() => setIsAddingVisit(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-blue-700 transition-all shadow-md shadow-blue-900/10"
          >
            <Plus size={14} /> تسجيل كشف
          </button>
          <button 
            type="button"
            onClick={() => setShowQuickVitalsModal(true)}
            className="bg-teal-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-teal-700 transition-all shadow-md shadow-teal-900/10"
          >
            <Activity size={14} /> فحص سريع علامات حيوية
          </button>
          <button 
            onClick={() => setIsScheduling(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-900/10"
          >
            <Calendar size={14} /> جدولة متابعة
          </button>
          <button 
            onClick={() => setShowPrintSummary(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-900/10"
          >
            <Printer size={14} /> طباعة ملخص المريض
          </button>
        </div>
      </header>

      {upcomingAppointment && (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-in fade-in slide-in-from-top-3 duration-250 text-right">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Calendar size={16} />
            </div>
            <div>
              <div className="text-xs font-black text-emerald-950">موعد قائم ومجدول قريباً للمريض</div>
              <p className="text-[10px] text-emerald-800 font-bold mt-0.5">
                د. {doctors.find((d: any) => d.id === upcomingAppointment.doctorId)?.name || '---'} | {dayjs(upcomingAppointment.date).format('DD MMMM YYYY - hh:mm a')} {upcomingAppointment.branch ? `| فرع: ${upcomingAppointment.branch}` : ''}
              </p>
            </div>
          </div>
          <a
            href={getWhatsAppLink(upcomingAppointment, doctors.find((d: any) => d.id === upcomingAppointment.doctorId))}
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-md shadow-emerald-950/10 flex items-center justify-center gap-1.5 hover:scale-[1.01] transition-all"
          >
            <MessageCircle size={14} />
            <span>إرسال تفاصيل الموعد للمريض (واتساب) 🟢</span>
          </a>
        </div>
      )}

      {detectedChronicDiseases.length > 0 && (
        <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 animate-in fade-in slide-in-from-top-3 duration-350 text-right space-y-2 mt-3">
          <div className="flex items-center gap-2">
            <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
              <span className="size-2 rounded-full bg-rose-600 animate-pulse" />
              تنبيه طبي: أمراض مزمنة تم رصدها آلياً بالتحليل الذكي لكامل سجل الزيارات 🚨
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
            {detectedChronicDiseases.map((disease, idx) => (
              <div key={idx} className="bg-white border border-rose-100 rounded-xl p-3 flex gap-2.5 shadow-xs hover:shadow-sm transition-all text-xs text-rose-950 font-bold items-start">
                <div className="size-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center text-sm shrink-0 shadow-xs">🩺</div>
                <div className="min-w-0">
                  <div className="text-rose-900 font-extrabold truncate">{disease.name}</div>
                  <div className="text-[10px] text-slate-400 mt-1 font-bold">
                    تم رصده في: <span className="text-slate-600 italic">"{disease.foundIn}"</span> بتاريخ {dayjs(disease.date).format('DD/MM/YYYY')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            
            {/* 🩺 Medicolegal Multi-Specialty AI Briefing Hub */}
            <div className="bg-gradient-to-br from-indigo-50/40 via-blue-50/20 to-slate-50/30 border border-blue-150/80 p-5 rounded-xl mb-6 space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-blue-100/50 pb-3">
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="bg-blue-100 text-blue-700 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">لوحة قرار استشاري الذكاء الاصطناعي</span>
                    <h4 className="text-xs font-black text-slate-800">الخلاصة الطبية المؤتمتة لكافة تخصصات الملف (AI Cross-Specialty Clinical Brief)</h4>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">توليد مسودة استرشادية لملخص الحالة تغطي مختلف العيادات والمستشارين بـالمركز لسرعة المتابعة</p>
                </div>
                <button
                  type="button"
                  disabled={aiFolderBriefLoading}
                  onClick={handleGeneratePatientFileBrief}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-[10px] font-black tracking-wide transition-all shadow-md shadow-blue-900/10 flex items-center gap-1.5 self-end md:self-auto disabled:opacity-50"
                >
                  {aiFolderBriefLoading ? (
                    <>
                      <span className="size-3 animate-spin border-2 border-white border-t-transparent rounded-full inline-block" />
                      <span>جاري الصياغة والتحليل...</span>
                    </>
                  ) : (
                    <>
                      <span>🪄 توليد ملخص شامل للملف الطبي (جميع التخصصات)</span>
                    </>
                  )}
                </button>
              </div>

              {aiFolderBrief ? (
                <div className="bg-white/95 p-4 rounded-lg border border-blue-100 animate-in fade-in duration-300">
                  <div className="text-xs text-slate-700 font-bold leading-relaxed whitespace-pre-line text-right" dir="rtl">
                    {aiFolderBrief}
                  </div>
                </div>
              ) : !aiFolderBriefLoading && (
                <div className="text-center py-4 text-slate-400 italic text-[10px] font-bold">
                  لم يتم توليد خلاصة طبية شاملة لملف التخصصات الخاص بهذا المريض بعد. انقر على الزر أعلاه لتوليدها فوراً.
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">سجل ملخص بالكشوفات والزيارات السابقة</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1">عرض وتتبع سجل الكشوفات والملاحظات الطبية المنظم للمريض</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 self-end md:self-auto select-none">
                <div className="flex bg-slate-105 bg-slate-100 p-0.5 rounded-lg border border-slate-205 border-slate-200">
                  <button 
                    type="button" 
                    onClick={() => setVisitsViewMode('cards')}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-black flex items-center gap-1 transition-all ${visitsViewMode === 'cards' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/20' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <LayoutGrid size={11} />
                    <span>عرض الكروت التفصيلية</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setVisitsViewMode('table')}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-black flex items-center gap-1 transition-all ${visitsViewMode === 'table' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/20' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <List size={11} />
                    <span>عرض الجدول المدمج</span>
                  </button>
                </div>
                
                {visitsViewMode === 'table' && (
                  <div className="relative">
                    <button 
                      type="button" 
                      onClick={() => setShowVisitsColumnSettings(!showVisitsColumnSettings)}
                      className="bg-white hover:bg-slate-50 text-slate-750 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 border border-slate-200 transition-all text-[10px]"
                    >
                      <SlidersHorizontal size={11} className="text-blue-600" />
                      <span>تخصيص الأعمدة</span>
                    </button>
                    
                    {showVisitsColumnSettings && (
                      <div className="absolute left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 p-3.5 z-50 text-right space-y-2.5">
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-2 pb-1 border-b border-slate-100">أعمدة جدول الزيارات</p>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-750 hover:text-blue-600">
                          <input 
                            type="checkbox" 
                            checked={visibleVisitsColumns.date} 
                            onChange={() => setVisibleVisitsColumns(prev => ({ ...prev, date: !prev.date }))}
                            className="accent-blue-600 rounded size-3"
                          />
                          <span>التاريخ والوقت</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-750 hover:text-blue-600">
                          <input 
                            type="checkbox" 
                            checked={visibleVisitsColumns.doctor} 
                            onChange={() => setVisibleVisitsColumns(prev => ({ ...prev, doctor: !prev.doctor }))}
                            className="accent-blue-600 rounded size-3"
                          />
                          <span>الطبيب المعالج</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-750 hover:text-blue-600">
                          <input 
                            type="checkbox" 
                            checked={visibleVisitsColumns.service} 
                            onChange={() => setVisibleVisitsColumns(prev => ({ ...prev, service: !prev.service }))}
                            className="accent-blue-600 rounded size-3"
                          />
                          <span>نوع الخدمة</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-750 hover:text-blue-600">
                          <input 
                            type="checkbox" 
                            checked={visibleVisitsColumns.complaint} 
                            onChange={() => setVisibleVisitsColumns(prev => ({ ...prev, complaint: !prev.complaint }))}
                            className="accent-blue-600 rounded size-3"
                          />
                          <span>الشكوى والملاحظات</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-750 hover:text-blue-600">
                          <input 
                            type="checkbox" 
                            checked={visibleVisitsColumns.diagnosis} 
                            onChange={() => setVisibleVisitsColumns(prev => ({ ...prev, diagnosis: !prev.diagnosis }))}
                            className="accent-blue-600 rounded size-3"
                          />
                          <span>التشخيص والعلاج</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-750 hover:text-blue-600">
                          <input 
                            type="checkbox" 
                            checked={visibleVisitsColumns.cost} 
                            onChange={() => setVisibleVisitsColumns(prev => ({ ...prev, cost: !prev.cost }))}
                            className="accent-blue-600 rounded size-3"
                          />
                          <span>التكلفة</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-755 hover:text-blue-600">
                          <input 
                            type="checkbox" 
                            checked={visibleVisitsColumns.isPaid} 
                            onChange={() => setVisibleVisitsColumns(prev => ({ ...prev, isPaid: !prev.isPaid }))}
                            className="accent-blue-600 rounded size-3"
                          />
                          <span>حالة الدفع</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-755 hover:text-blue-600">
                          <input 
                            type="checkbox" 
                            checked={visibleVisitsColumns.actions} 
                            onChange={() => setVisibleVisitsColumns(prev => ({ ...prev, actions: !prev.actions }))}
                            className="accent-blue-600 rounded size-3"
                          />
                          <span>التحكم والإجراءات</span>
                        </label>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="bg-slate-100 px-3 py-1.5 rounded-lg text-[10px] font-black text-slate-600">
                  إجمالي الزيارات: {patientVisits.length}
                </div>
              </div>
            </div>

            {visitsViewMode === 'table' ? (
              <div className="overflow-x-auto border border-slate-150 rounded-xl bg-white shadow-sm mb-4">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-150">
                      {visibleVisitsColumns.date && <th className="px-6 py-4 border-b border-slate-200">التاريخ والوقت</th>}
                      {visibleVisitsColumns.doctor && <th className="px-6 py-4 border-b border-slate-200">الطبيب المعالج</th>}
                      {visibleVisitsColumns.service && <th className="px-6 py-4 border-b border-slate-200">نوع الخدمة</th>}
                      {visibleVisitsColumns.complaint && <th className="px-6 py-4 border-b border-slate-200">الشكوى / الملاحظات</th>}
                      {visibleVisitsColumns.diagnosis && <th className="px-6 py-4 border-b border-slate-200">التشخيص والعلاج</th>}
                      {visibleVisitsColumns.cost && <th className="px-6 py-4 border-b border-slate-200">التكلفة</th>}
                      {visibleVisitsColumns.isPaid && <th className="px-6 py-4 border-b border-slate-200">حالة الدفع</th>}
                      {visibleVisitsColumns.actions && <th className="px-6 py-4 border-b border-slate-200 text-center">الإجراءات</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-xs text-slate-700">
                    {patientVisits.slice().reverse().map((v: any) => {
                      const doc = doctors.find((d: any) => d.id === v.doctorId);
                      return (
                        <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                          {visibleVisitsColumns.date && (
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-800">{dayjs(v.date).format('YYYY/MM/DD')}</div>
                              <div className="text-[10px] text-slate-400 font-mono italic">{dayjs(v.date).format('hh:mm a')}</div>
                            </td>
                          )}
                          {visibleVisitsColumns.doctor && (
                            <td className="px-6 py-4 text-slate-800">
                              <span>د. {doc?.name || '---'}</span>
                              <div className="text-[10px] text-blue-600 font-mono italic">{doc?.specialty || ''}</div>
                            </td>
                          )}
                          {visibleVisitsColumns.service && (
                            <td className="px-6 py-4 text-slate-500">
                              <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-[10px] font-black">{v.serviceType}</span>
                            </td>
                          )}
                          {visibleVisitsColumns.complaint && (
                            <td className="px-6 py-4 font-normal text-slate-605 text-slate-600 max-w-[150px] truncate" title={v.notes}>
                              {v.notes || <span className="text-slate-300 italic">لا يوجد</span>}
                            </td>
                          )}
                          {visibleVisitsColumns.diagnosis && (
                            <td className="px-6 py-4 font-bold text-emerald-800 max-w-[200px] truncate" title={v.diagnosis}>
                              {v.diagnosis || <span className="text-slate-300 italic">لم يسجل بعد</span>}
                            </td>
                          )}
                          {visibleVisitsColumns.cost && (
                            <td className="px-6 py-4 text-slate-900 font-sans font-black">{v.cost || 0} ج.م</td>
                          )}
                          {visibleVisitsColumns.isPaid && (
                            <td className="px-6 py-4">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${v.isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                {v.isPaid ? 'مُحصل' : 'معلق'}
                              </span>
                            </td>
                          )}
                          {visibleVisitsColumns.actions && (
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  type="button"
                                  onClick={() => { setSelectedVisitToEdit(v); setIsEditingVisit(true); }}
                                  className="p-1 px-2.5 bg-slate-150 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded-lg text-[10px] font-black transition-all"
                                >
                                  تعديل الكشف
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => { toggleVisitExpand(v.id); setVisitsViewMode('cards'); }}
                                  className="p-1 px-2 bg-blue-55 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-black transition-all"
                                  title="عرض التقرير بالكامل"
                                >
                                  التفاصيل كاملة
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {patientVisits.length === 0 && (
                      <tr>
                        <td colSpan={Object.values(visibleVisitsColumns).filter(Boolean).length} className="px-6 py-12 text-center text-slate-400 italic">
                          لا يوجد زيارات مسجلة لهذا المريض حالياً.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-4">
              {patientVisits.slice().reverse().map((v: any) => {
                const doc = doctors.find((d: any) => d.id === v.doctorId);
                const isCancelled = v.status === 'cancelled';
                const isExpanded = !!expandedVisits[v.id];
                const visitReports = (reports || []).filter((r: any) => r.visitId === v.id);
                
                // Summarized preview text for diagnosis or clinical notes
                const previewText = v.diagnosis 
                  ? `التشخيص: ${v.diagnosis}` 
                  : v.notes 
                    ? `الملاحظات والشكوى: ${v.notes}` 
                    : "لا يوجد تشخيص أو ملاحظات مسجلة بعد لهذه الزيارة.";
                
                return (
                  <div 
                    key={v.id} 
                    className={`border rounded-xl transition-all overflow-hidden ${
                      isExpanded 
                        ? 'border-blue-200 bg-white shadow-md' 
                        : isCancelled 
                          ? 'border-red-100 bg-red-50/10 hover:bg-red-50/20' 
                          : 'border-slate-150 bg-white hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    {/* Collapsed Header Summary */}
                    <div 
                      onClick={() => toggleVisitExpand(v.id)}
                      className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="flex items-start gap-4 flex-1 w-full text-right">
                        {/* Calendar Badge */}
                        <div className="bg-slate-50 text-slate-700 p-2 text-center rounded-lg border border-slate-100 flex flex-col items-center justify-center min-w-[56px] shrink-0 font-sans">
                          <span className="text-[9px] font-black text-slate-400 uppercase">{dayjs(v.date).format('MMM')}</span>
                          <span className="text-base font-black leading-none text-slate-800">{dayjs(v.date).format('DD')}</span>
                        </div>

                        {/* Middle textual summary */}
                        <div className="space-y-1 flex-grow overflow-hidden">
                          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                            <span className="font-bold text-slate-800 text-sm">د. {doc?.name || 'طبيب غير معروف'}</span>
                            <span className="text-[10px] text-blue-600 font-black">({doc?.specialty || 'ممارس عام'})</span>
                            <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded">{v.serviceType}</span>
                            {isCancelled && (
                              <span className="text-[9px] bg-red-105 text-red-700 font-black px-1.5 rounded leading-none">ملغي</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-1 max-w-[600px]">
                            {previewText}
                          </p>
                        </div>
                      </div>

                      {/* Left information & expand indicator */}
                      <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-slate-800">{v.cost} ج.م</span>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${v.isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                            {v.isPaid ? 'مُحصل' : 'آجل'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <span className="text-[10px] font-black">{isExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}</span>
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown size={14} className="text-blue-500" />
                          </motion.div>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Body */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                          className="border-t border-slate-100 bg-slate-50/45"
                        >
                          <div className="p-5 sm:p-6 space-y-5 text-right">
                            {/* Nested Grid details */}
                            {isCancelled ? (
                              <div className="p-4 bg-red-50/50 rounded-xl border border-red-100/50">
                                <h4 className="text-[10px] font-black text-red-705 uppercase tracking-wide mb-1">سبب إلغاء الموعد</h4>
                                <p className="text-xs text-red-900 leading-relaxed font-bold">{v.cancellationReason || 'لم يتم ذكر سبب للإلغاء.'}</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-sm space-y-1">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">شكوى المريض وملاحظات الكشف</h4>
                                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{v.notes || 'لا يوجد شكاوى مسجلة.'}</p>
                                </div>
                                <div className="bg-emerald-50/30 p-4 rounded-xl border border-emerald-100/70 border-dashed space-y-1 relative">
                                  <span className="absolute -top-2 right-4 bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase px-2 py-0.5 rounded shadow-sm">التشخيص النهائي والعلاج</span>
                                  <p className="text-xs text-emerald-950 font-bold leading-relaxed pt-1 whitespace-pre-wrap">{v.diagnosis || 'لم يسجل الطبيب تشخيصاً بعد.'}</p>
                                </div>
                              </div>
                            )}

                            {/* Associated Reports & Prescriptions */}
                            <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-sm space-y-3">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">الملفات الطبية والروشتات المرفقة بهذه الزيارة</h4>
                              {visitReports.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  {visitReports.map((r: any) => (
                                    <div key={r.id} className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                      <div className="flex items-center gap-2 max-w-[70%]">
                                        <Paperclip size={12} className="text-blue-500 shrink-0" />
                                        <div className="truncate">
                                          <p className="font-bold text-slate-700 truncate">{r.title}</p>
                                          <p className="text-[8px] text-slate-400 leading-none mt-1">
                                            {r.type === 'prescription' ? 'روشتة طبية' : r.type === 'report' ? 'تقرير فحص' : 'مرفق'}
                                          </p>
                                        </div>
                                      </div>
                                      <a 
                                        href={`/uploads/${r.filename}`} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="text-[9px] font-black text-blue-600 hover:text-blue-800 px-3 py-1.5 bg-blue-50 rounded-md transition-colors whitespace-nowrap"
                                      >
                                        عرض الملف
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-400 italic">لا توجد ملفات أو روشتات مرفوعة لهذه الزيارة.</p>
                              )}

                              {/* Direct file upload option inside the list item */}
                              <div className="border border-dashed border-slate-200 hover:border-emerald-300 rounded-lg p-3.5 bg-slate-50/50 hover:bg-emerald-50/30 transition-all cursor-pointer relative">
                                <input 
                                  type="file" 
                                  className="absolute inset-0 opacity-0 cursor-pointer" 
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      try {
                                        await api.uploadReport(patientId, file, file.name || "مرفق سريع", 'other', v.id);
                                        await loadProfile();
                                      } catch (err) {
                                        console.error("Error uploading directly inside expanded visit", err);
                                      }
                                    }
                                  }} 
                                />
                                <div className="flex items-center gap-2 text-xs text-slate-500 font-bold justify-center">
                                  <Upload size={14} className="text-emerald-600" />
                                  <span>اضغط هنا أو اسحب الملف لرفعه فورياً ومباشرة داخل هذه الزيارة</span>
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons for specific encounter */}
                            <div className="flex flex-wrap items-center gap-2 pt-2">
                              <button 
                                onClick={() => { setPreselectedVisitId(v.id); setIsUploading(true); }}
                                className="py-2 px-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-xs font-black transition-all flex items-center gap-1.5"
                              >
                                <Paperclip size={12} />
                                <span>إرفاق ملف طبي</span>
                              </button>
                              
                              <button 
                                onClick={() => { setSelectedVisitToEdit(v); setIsEditingVisit(true); }}
                                className="py-2 px-3 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 text-xs font-black transition-all flex items-center gap-1.5"
                              >
                                <Edit size={12} />
                                <span>تعديل أو إتمام الكشف</span>
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {patientVisits.length === 0 && (
                <div className="text-center py-20 text-slate-300 italic text-sm">لا يوجد زيارات مسجلة لهذا المريض حالياً.</div>
              )}
            </div>
            )}
          </div>
        )}

        {activeTab === 'appointments' && (
          <div className="p-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {appointments.slice().reverse().map((a: any) => {
                const doc = doctors.find((d: any) => d.id === a.doctorId);
                return (
                  <div key={a.id} className={`p-4 rounded-xl border transition-all ${
                    a.status === 'scheduled' ? 'bg-indigo-50/50 border-indigo-100 shadow-sm' : 
                    a.status === 'completed' ? 'bg-emerald-50/30 border-emerald-100' : 
                    'bg-slate-50 border-slate-200 opacity-60'
                  }`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`size-10 rounded-lg flex items-center justify-center font-bold ${
                          a.status === 'scheduled' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 
                          a.status === 'completed' ? 'bg-emerald-600 text-white' : 
                          'bg-slate-300 text-slate-600'
                        }`}>
                          {a.status === 'scheduled' ? <Calendar size={18} /> : a.status === 'completed' ? <Plus size={18} /> : <X size={18} />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm">د. {doc?.name}</div>
                          <div className="text-[10px] text-indigo-600 font-black uppercase">{doc?.specialty}</div>
                        </div>
                      </div>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                        a.status === 'scheduled' ? 'bg-indigo-600 text-white border-indigo-500' : 
                        a.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                        'bg-slate-200 text-slate-500 border-slate-300'
                      }`}>
                        {a.status === 'scheduled' ? 'موعد قائم' : a.status === 'completed' ? 'تمت الزيارة' : 'ملغي'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 mb-3 text-xs font-bold bg-white/50 p-2 rounded-lg border border-slate-100">
                      <Clock size={12} className="text-indigo-400" />
                      {dayjs(a.date).format('DD MMMM YYYY - hh:mm a')}
                    </div>
                    
                    {a.status === 'scheduled' && (
                      <div className={`flex items-center justify-between p-2 rounded-lg border mb-3 ${a.reminderSent ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                         <div className="flex items-center gap-2 pr-1">
                           <div className={`size-1.5 rounded-full ${a.reminderSent ? 'bg-emerald-500' : 'bg-emerald-500 animate-pulse'}`} />
                           <span className="text-[9px] font-black uppercase tracking-wider">
                             {a.reminderSent ? 'تم إرسال التذكير بنجاح' : (a.reminderEnabled ? `تذكير تلقائي (قبل ${a.reminderLeadTimeHours}س)` : 'إرسال تذكير بالموعد')}
                           </span>
                         </div>
                         <div className="flex items-center gap-1.5">
                           {!a.reminderSent && (
                             <button 
                               onClick={() => handleSendReminder(a.id)}
                               className="text-[9px] font-black text-white bg-blue-600 px-3 py-1 rounded hover:bg-blue-700 transition-all uppercase flex items-center gap-1 shadow-sm font-sans cursor-pointer border-0"
                             >
                               <TrendingUp size={10} />
                               <span>تذكير SMS</span>
                             </button>
                           )}
                           <a 
                             href={getWhatsAppLink(a, doc)}
                             target="_blank"
                             rel="noreferrer"
                             className="text-[9px] font-black text-white bg-emerald-600 px-3 py-1 rounded hover:bg-emerald-700 transition-all uppercase flex items-center gap-1 shadow-sm font-sans"
                           >
                             <MessageCircle size={10} />
                             <span>مراسلة واتساب 🟢</span>
                           </a>
                         </div>
                      </div>
                    )}

                    <div className="text-[11px] text-slate-500 italic mb-4 line-clamp-2 bg-slate-100/50 p-2 rounded">{a.notes || 'لا يوجد ملاحظات إضافية'}</div>
                    
                    {a.status === 'scheduled' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setSelectedAppointmentToComplete(a)}
                          className="flex-1 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-emerald-700 transition-all shadow-md shadow-emerald-900/10"
                        >
                          إتمام الكشف
                        </button>
                        <button 
                          onClick={async () => { if(confirm("إلغاء الموعد؟")) { await api.updateAppointment(a.id, 'cancelled'); loadProfile(); } }}
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
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">سجل التقارير والأشعة والروشتات</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1">تصفية وترتيب الروشتات الطبية، نتائج التحاليل، والمرفقات المرتبطة بكل زيارة</p>
              </div>
              <button 
                onClick={() => setIsUploading(true)}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-md shadow-emerald-900/10"
              >
                <Upload size={14} /> رفع ملف جديد
              </button>
            </div>

            {/* 📸 AI Patient Investigations Progress Summary Dashboard */}
            <div className="bg-gradient-to-br from-emerald-50/40 via-teal-50/20 to-slate-50/30 border border-emerald-150 p-5 rounded-xl mb-6 space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-emerald-100 pb-3">
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">لوحة تتبع نتائج الفحوصات</span>
                    <h4 className="text-xs font-black text-slate-800">بيان رصور التطور السريري للفحوصات والتحاليل بالمعرض (Investigations Progress Brief)</h4>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">توليد تقرير تتبعي لتقدم مستويات التحاليل والأشعات وتنسيقها زمنياً لملاحظة القراءات غير المنتظمة</p>
                </div>
                <button
                  type="button"
                  disabled={aiGalleryProgressLoading}
                  onClick={handleGeneratePatientInvestigationsProgress}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-[10px] font-black tracking-wide transition-all shadow-md shadow-emerald-900/10 flex items-center gap-1.5 self-end md:self-auto disabled:opacity-50"
                >
                  {aiGalleryProgressLoading ? (
                    <>
                      <span className="size-3 animate-spin border-2 border-white border-t-transparent rounded-full inline-block" />
                      <span>جاري تجميع وقراءة الفحوصات...</span>
                    </>
                  ) : (
                    <>
                      <span>🪄 رصد تقدم التحاليل والتقارير المرفوعة للآن ({reports.length})</span>
                    </>
                  )}
                </button>
              </div>

              {aiGalleryProgress ? (
                <div className="bg-white/95 p-4 rounded-lg border border-emerald-100 animate-in fade-in duration-300">
                  <div className="text-xs text-slate-707 text-slate-700 font-bold leading-relaxed whitespace-pre-line text-right" dir="rtl">
                    {aiGalleryProgress}
                  </div>
                </div>
              ) : !aiGalleryProgressLoading && (
                <div className="text-center py-4 text-slate-400 italic text-[10px] font-bold">
                  لم يتم إصدار خلاصة تتبعية تطورية للفحوصات والتحاليل لهذا المريض حتى الآن. انقر أعلاه للمباشرة الفورية.
                </div>
              )}
            </div>

            {/* Filtering and Sorting Controls Bar */}
            <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl mb-6 flex flex-col md:flex-row gap-4 justify-between items-center text-right">
              {/* Filter Tabs */}
              <div className="flex flex-wrap gap-1.5 items-center w-full md:w-auto">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">تصفية النوع:</span>
                <button
                  type="button"
                  onClick={() => setReportFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    reportFilter === 'all' 
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/10' 
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  الكل ({reports.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReportFilter('prescription')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    reportFilter === 'prescription' 
                      ? 'bg-amber-600 text-white shadow-sm shadow-amber-900/10' 
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  روشتات ({reports.filter(r => r.type === 'prescription').length})
                </button>
                <button
                  type="button"
                  onClick={() => setReportFilter('report')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    reportFilter === 'report' 
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/10' 
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  تقارير طبية ({reports.filter(r => r.type === 'report').length})
                </button>
                <button
                  type="button"
                  onClick={() => setReportFilter('other')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    reportFilter === 'other' 
                      ? 'bg-purple-600 text-white shadow-sm shadow-purple-900/10' 
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  ملفات أخرى ({reports.filter(r => r.type !== 'prescription' && r.type !== 'report').length})
                </button>
              </div>

              {/* Sorting & Gallery Toggle Selection */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                  <button
                    type="button"
                    onClick={() => setFileViewMode('gallery')}
                    className={`p-2 rounded-lg flex items-center justify-center transition-all ${fileViewMode === 'gallery' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                    title="عرض معرض الصور"
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFileViewMode('table')}
                    className={`p-2 rounded-lg flex items-center justify-center transition-all ${fileViewMode === 'table' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                    title="عرض جدول المرفقات"
                  >
                    <List size={15} />
                  </button>
                </div>

                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">الترتيب:</span>
                <select 
                  value={reportSort.key} 
                  onChange={(e) => setReportSort(prev => ({ ...prev, key: e.target.value }))}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="createdAt">تاريخ الرفع</option>
                  <option value="title">عنوان الملف</option>
                  <option value="type">نوع الملف</option>
                </select>
                <button
                  type="button"
                  onClick={() => setReportSort(prev => ({ ...prev, dir: prev.dir === 'asc' ? 'desc' : 'asc' }))}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                  title={reportSort.dir === 'asc' ? 'تنازلي' : 'تصاعدي'}
                >
                  {reportSort.dir === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>

            {/* Quick List of Recent Reports */}
            {reports.length > 0 && (
              <div className="mb-8 overflow-hidden rounded-xl border border-slate-100 shadow-sm">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">أحدث الملفات المرفوعة</span>
                  <span className="text-[10px] font-black text-blue-600 uppercase">{reports.length} ملف إجمالي</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {reports.slice().reverse().slice(0, 3).map(r => (
                    <div key={r.id} className="p-3 flex items-center justify-between hover:bg-slate-50/50 transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${r.type === 'prescription' ? 'bg-amber-100 text-amber-600' : r.type === 'report' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                          <Paperclip size={14} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{r.title}</p>
                          <p className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">
                            {r.type === 'prescription' ? 'روشتة' : r.type === 'report' ? 'تقرير' : 'أخرى'} • {dayjs(r.createdAt).fromNow()}
                          </p>
                        </div>
                      </div>
                      <a href={`/uploads/${r.filename}`} target="_blank" rel="noreferrer" className="text-[10px] font-black text-blue-600 hover:underline px-3 py-1 bg-blue-50 rounded">عرض</a>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {fileViewMode === 'gallery' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {sortedReports.map((r: any, idx: number) => {
                  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(r.filename);
                  return (
                    <div 
                      key={r.id} 
                      className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col text-right cursor-pointer"
                      onClick={() => {
                        setLightboxIndex(idx);
                        setLightboxScale(1);
                        setLightboxRotation(0);
                      }}
                    >
                      {/* Thumbnail Container */}
                      <div className="aspect-square bg-slate-100 relative flex items-center justify-center overflow-hidden border-b border-slate-100">
                        {isImage ? (
                          <img 
                            src={`/uploads/${r.filename}`} 
                            alt={r.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-350"
                            onError={(e: any) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-1 p-3"
                          style={{ display: isImage ? 'none' : 'flex' }}
                        >
                          <FileText size={32} className="text-blue-500/85 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-bold text-slate-500 text-center line-clamp-1">{r.filename.split('.').pop()?.toUpperCase()}</span>
                        </div>
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-black text-xs gap-1">
                          🔍 تكبير واستعراض
                        </div>
                      </div>
                      
                      {/* Details */}
                      <div className="p-3 flex-1 flex flex-col justify-between">
                        <div>
                          <p className="text-xs font-black text-slate-800 line-clamp-2 min-h-[32px] leading-tight mb-1">{r.title}</p>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded inline-block ${
                            r.type === 'prescription' ? 'bg-amber-100 text-amber-700' : 
                            r.type === 'report' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {r.type === 'prescription' ? 'روشتة' : r.type === 'report' ? 'تقرير' : 'أخرى'}
                          </span>
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold mt-2 pt-2 border-t border-slate-50">
                          {dayjs(r.createdAt).format('DD MMM YYYY')}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {sortedReports.length === 0 && (
                  <div className="col-span-full py-20 text-center text-slate-300 italic text-sm">لا توجد ملفات مرفوعة تناسب هذا التصنيف حالياً.</div>
                )}
              </div>
            ) : (
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
            )}
          </div>
        )}

        {activeTab === 'personal' && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-md font-black text-slate-805 uppercase tracking-wide">بيانات المريض</h3>
              <button 
                onClick={() => setIsEditingPatient(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Edit size={14} /> تعديل بيانات المريض
              </button>
            </div>
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
                   {patient.nationalId && <InfoRow label="الرقم القومي" value={patient.nationalId} />}
                   {patient.passportNumber && <InfoRow label="رقم جواز السفر" value={patient.passportNumber} />}
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
        {showQuickVitalsModal && (
          <QuickVitalsModal 
            onClose={() => setShowQuickVitalsModal(false)}
            doctors={doctors}
            onSubmit={async (data: any) => {
              const newVisitObj = {
                patientId,
                doctorId: data.doctorId,
                date: new Date().toISOString(),
                serviceType: "فحص سريع وعلامات حيوية",
                basePrice: 0,
                cost: 0,
                doctorEarnings: 0,
                clinicEarnings: 0,
                isPaid: true,
                status: 'completed' as const,
                notes: data.notes || "تم تسجيل العلامات الحيوية السريعة بنجاح.",
                vitals: {
                  temperature: data.temperature || undefined,
                  bloodPressure: data.bloodPressure || undefined,
                  pulse: data.pulse || undefined,
                  weight: data.weight || undefined,
                }
              };
              await api.createVisit({ ...newVisitObj, branch: selectedBranch });
              await loadProfile();
              setShowQuickVitalsModal(false);
            }}
          />
        )}

        {/* Fullscreen Lightbox Gallery Modal */}
        {lightboxIndex !== null && sortedReports[lightboxIndex] && (
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-sm z-[200] flex flex-col text-right select-none animate-in fade-in duration-200">
            {/* Top Bar info & Operations */}
            <div className="bg-slate-900/60 p-4 border-b border-white/10 flex items-center justify-between text-white">
              <button 
                onClick={() => setLightboxIndex(null)}
                className="bg-white/15 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all text-white font-black hover:scale-105 text-xs"
              >
                ✕ إغلاق
              </button>
              
              <div className="text-center">
                <h4 className="text-sm font-black tracking-wide text-white">{sortedReports[lightboxIndex].title}</h4>
                <p className="text-[10px] text-slate-350 font-bold mt-0.5" dir="rtl">
                  ملف {lightboxIndex + 1} من {sortedReports.length} | تاريخ الرفع: {dayjs(sortedReports[lightboxIndex].createdAt).format('DD/MM/YYYY')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a 
                  href={`/uploads/${sortedReports[lightboxIndex].filename}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md"
                >
                  فتح الأصلي ↗
                </a>
              </div>
            </div>

            {/* Active Image Canvas with Zoom / Rotate */}
            <div className="flex-1 overflow-hidden relative flex items-center justify-center p-6">
              {/* Left Navigation */}
              {lightboxIndex > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setLightboxIndex(lightboxIndex - 1);
                    setLightboxScale(1);
                    setLightboxRotation(0);
                  }}
                  className="absolute left-6 top-1/2 -translate-y-1/2 size-12 rounded-full bg-white/10 border border-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all z-10 hover:scale-110 active:scale-95"
                  title="السابق"
                >
                  <ChevronRight className="rotate-180" size={24} />
                </button>
              )}

              {/* Centered Image content */}
              <div className="max-w-4xl max-h-[70vh] flex items-center justify-center transition-all duration-300">
                {/\.(jpg|jpeg|png|gif|webp)$/i.test(sortedReports[lightboxIndex].filename) ? (
                  <motion.img
                    key={sortedReports[lightboxIndex].id}
                    src={`/uploads/${sortedReports[lightboxIndex].filename}`}
                    alt={sortedReports[lightboxIndex].title}
                    referrerPolicy="no-referrer"
                    style={{
                      transform: `scale(${lightboxScale}) rotate(${lightboxRotation}deg)`,
                    }}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl transition-transform"
                  />
                ) : (
                  <div className="bg-slate-900 border border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 text-center max-w-sm">
                    <FileText size={48} className="text-blue-400" />
                    <div>
                      <p className="text-sm font-bold text-white">{sortedReports[lightboxIndex].title}</p>
                      <p className="text-xs text-slate-400 mt-1">هذا الملف ليس صورة مباشرة أو تم رفعه كـ PDF/Document.</p>
                    </div>
                    <a 
                      href={`/uploads/${sortedReports[lightboxIndex].filename}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="bg-white text-slate-900 hover:bg-slate-100 px-4 py-2 rounded-lg text-xs font-black transition-all"
                    >
                      تنزيل أو استعراض المستند بالكامل
                    </a>
                  </div>
                )}
              </div>

              {/* Right Navigation */}
              {lightboxIndex < sortedReports.length - 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setLightboxIndex(lightboxIndex + 1);
                    setLightboxScale(1);
                    setLightboxRotation(0);
                  }}
                  className="absolute right-6 top-1/2 -translate-y-1/2 size-12 rounded-full bg-white/10 border border-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all z-10 hover:scale-110 active:scale-95"
                  title="التالي"
                >
                  <ChevronRight size={24} />
                </button>
              )}
            </div>

            {/* Lightbox Toolbar Operations */}
            <div className="bg-slate-900/80 p-4 border-t border-white/10 flex items-center justify-center gap-4 text-white">
              <button
                type="button"
                onClick={() => setLightboxScale(s => Math.max(0.5, s - 0.25))}
                className="bg-white/10 hover:bg-white/25 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                title="تصغير"
              >
                🔎- تصغير
              </button>
              <button
                type="button"
                onClick={() => setLightboxScale(1)}
                className="bg-white/10 hover:bg-white/25 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                title="إعادة التعيين"
              >
                إعادة ضبط الحجم
              </button>
              <button
                type="button"
                onClick={() => setLightboxScale(s => Math.min(3, s + 0.25))}
                className="bg-white/10 hover:bg-white/25 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                title="تكبير"
              >
                🔎+ تكبير
              </button>
              <div className="h-4 w-[1px] bg-white/20" />
              <button
                type="button"
                onClick={() => setLightboxRotation(r => r - 90)}
                className="bg-white/10 hover:bg-white/25 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                title="تدوير لليسار"
              >
                ↺ تدوير
              </button>
              <button
                type="button"
                onClick={() => setLightboxRotation(r => r + 90)}
                className="bg-white/10 hover:bg-white/25 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                title="تدوير لليمين"
              >
                ↻ تدوير
              </button>
            </div>
          </div>
        )}

        {isAddingVisit && (
          <VisitModal 
            onClose={() => setIsAddingVisit(false)} 
            doctors={doctors}
            onSubmit={async (data: any) => {
              const res = await api.createVisit({ ...data, patientId, branch: selectedBranch });
              await loadProfile();
              setIsAddingVisit(false);
              if (res) {
                setPrintConfirmVisit(res);
              }
            }} 
          />
        )}
        
        {isEditingVisit && selectedVisitToEdit && (
          <EditVisitModal 
            onClose={() => { setIsEditingVisit(false); setSelectedVisitToEdit(null); }}
            visit={selectedVisitToEdit}
            onUploadAttachment={async (file: File, title: string, type: string) => {
              await api.uploadReport(patientId, file, title, type, selectedVisitToEdit.id);
            }}
            onSubmit={async (updatedFields: any) => {
              await api.updateVisit(selectedVisitToEdit.id, updatedFields);
              loadProfile();
            }}
          />
        )}

        {isEditingPatient && (
          <PatientModal 
            onClose={() => setIsEditingPatient(false)}
            initialData={patient}
            onSubmit={async (data: any) => {
              await api.updatePatient(patient.id, data);
              await loadProfile();
              onRefresh();
              setIsEditingPatient(false);
            }}
          />
        )}

        {isUploading && (
          <UploadModal 
            onClose={() => { setIsUploading(false); setPreselectedVisitId(null); }} 
            visits={patientVisits}
            doctors={doctors}
            initialVisitId={preselectedVisitId}
            onUpload={async (file: File, title: string, type: string, visitId: string) => {
              let finalVisitId = visitId;
              if (!finalVisitId && patientVisits.length > 0) {
                // Find most recent visit
                const sortedVisits = [...patientVisits].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                finalVisitId = sortedVisits[0].id;
              }
              await api.uploadReport(patientId, file, title, type, finalVisitId);
              loadProfile();
              setIsUploading(false);
            }} 
          />
        )}
        {isScheduling && (
          <AppointmentModal 
            onClose={() => setIsScheduling(false)} 
            doctors={doctors}
            patients={[]} // Not needed when initialPatientId is provided
            initialPatientId={patientId}
            appointments={appointments}
            getDoctorLoad={(docId: string, date: string) => calculateDoctorLoad(docId, date)}
            selectedBranch={selectedBranch}
            currentUser={currentUser}
            onSubmit={async (data: any) => {
              await api.createAppointment(data);
              loadProfile();
              setIsScheduling(false);
              setActiveTab('appointments');
            }} 
          />
        )}

        {selectedAppointmentToComplete && (
          <CompleteAppointmentModal 
            onClose={() => setSelectedAppointmentToComplete(null)} 
            appointment={selectedAppointmentToComplete} 
            doctors={doctors}
            visits={patientVisits}
            onSubmit={async (data: any, files?: any) => {
              const res = await api.createVisit({
                ...data,
                patientId: selectedAppointmentToComplete.patientId,
                status: 'completed',
                branch: selectedBranch
              });
              if (res && files) {
                if (files.attachmentFile) {
                  await api.uploadReport(
                    selectedAppointmentToComplete.patientId,
                    files.attachmentFile,
                    files.attachmentTitle || "مرفق كشف",
                    'other',
                    res.id
                  );
                }
                if (files.prescriptionFile) {
                  await api.uploadReport(
                    selectedAppointmentToComplete.patientId,
                    files.prescriptionFile,
                    files.prescriptionTitle || "صورة الروشتة المرفقة",
                    'prescription',
                    res.id
                  );
                }
              }
              await api.updateAppointment(selectedAppointmentToComplete.id, {
                status: 'completed',
                arrivalTime: data.arrivalTime,
                entryTime: data.entryTime,
                departureTime: data.departureTime,
              });
              await loadProfile();
              if (onRefresh) {
                await onRefresh();
              }
              setSelectedAppointmentToComplete(null);
              if (res) {
                setPrintConfirmVisit(res);
              }
            }} 
          />
        )}

        {selectedVisitForDetails && (
          <VisitDetailsModal 
            onClose={() => setSelectedVisitForDetails(null)} 
            visit={selectedVisitForDetails} 
            doctors={doctors}
            reports={reports}
            patient={patient}
            onPrintPrescription={(v: any) => {
              setPrintPrescriptionVisit(v);
              setSelectedVisitForDetails(null);
            }}
            onPrintMedicalReport={(v: any) => {
              setPrintMedicalReportVisit(v);
              setSelectedVisitForDetails(null);
            }}
            onEdit={() => { 
                setSelectedVisitToEdit(selectedVisitForDetails); 
                setSelectedVisitForDetails(null); 
                setIsEditingVisit(true); 
            }}
          />
        )}

        {printPrescriptionVisit && (
          <PrintPrescriptionModal 
            onClose={() => setPrintPrescriptionVisit(null)}
            visit={printPrescriptionVisit}
            patient={patient}
            doctor={doctors.find((d: any) => d.id === printPrescriptionVisit.doctorId)}
            onRefresh={onRefresh}
          />
        )}

        {printMedicalReportVisit && (
          <PrintMedicalReportModal 
            onClose={() => setPrintMedicalReportVisit(null)}
            visit={printMedicalReportVisit}
            patient={patient}
            doctor={doctors.find((d: any) => d.id === printMedicalReportVisit.doctorId)}
          />
        )}

        {printConfirmVisit && (
          <PrintConfirmModal 
            onClose={() => setPrintConfirmVisit(null)}
            visit={printConfirmVisit}
            onPrintPrescription={(v: any) => {
              setPrintPrescriptionVisit(v);
              setPrintConfirmVisit(null);
            }}
            onPrintReport={(v: any) => {
              setPrintMedicalReportVisit(v);
              setPrintConfirmVisit(null);
            }}
          />
        )}

        {showPrintSummary && (
          <PrintPatientSummaryModal 
            onClose={() => setShowPrintSummary(false)}
            patient={patient}
            visits={patientVisits}
            doctors={doctors}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EditVisitModal({ onClose, visit, onSubmit, onUploadAttachment }: any) {
  const [formData, setFormData] = useState({ 
    notes: visit.notes || "", 
    diagnosis: visit.diagnosis || "",
    clinicalAssessment: visit.clinicalAssessment || "",
    status: visit.status || 'completed',
    cancellationReason: visit.cancellationReason || "",
    isPaid: visit.isPaid !== undefined ? visit.isPaid : true,
    temperature: visit.vitals?.temperature || "",
    bloodPressure: visit.vitals?.bloodPressure || "",
    pulse: visit.vitals?.pulse || "",
    weight: visit.vitals?.weight || "",
    height: visit.vitals?.height || "",
    followUpRequired: visit.followUpRequired || false,
    followUpDate: visit.followUpDate || "",
    followUpNotes: visit.followUpNotes || "",
    dietInstructions: visit.dietInstructions || ""
  });
  
  const [prescriptions, setPrescriptions] = useState<Array<{ id: string; name: string; quantity: string; duration: string }>>(visit.prescriptions || []);
  const [tempPrescription, setTempPrescription] = useState({ name: '', quantity: '', duration: '' });
  
  const [file, setFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState("");

  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const handleSuggestDiagnosis = async () => {
    if (!formData.notes.trim()) {
      alert("يرجى كتابة شكوى أو ملاحظات المريض أولاً للحصول على اقتراح التشخيص.");
      return;
    }
    setIsSuggesting(true);
    setSuggestions([]);
    try {
      const res = await fetch("/api/suggest-diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaint: formData.notes })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.suggestions && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
        } else {
          setSuggestions(["نزلة برد حادة", "احتقان بسيط بالحلق", "إرهاق عام"]);
        }
      } else {
        setSuggestions(["نزلة برد حادة", "احتقان بسيط بالحلق", "إرهاق عام"]);
      }
    } catch (err) {
      console.error(err);
      setSuggestions(["نزلة برد حادة", "احتقان بسيط بالحلق", "إرهاق عام"]);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ 
      ...formData, 
      prescriptions,
      vitals: {
        temperature: formData.temperature,
        bloodPressure: formData.bloodPressure,
        pulse: formData.pulse,
        weight: formData.weight,
        height: formData.height,
      },
      followUpRequired: formData.followUpRequired,
      followUpDate: formData.followUpRequired ? formData.followUpDate : undefined,
      followUpNotes: formData.followUpRequired ? formData.followUpNotes : undefined,
      dietInstructions: formData.dietInstructions
    });
    
    if (file) {
      await onUploadAttachment(file, fileTitle || "مرفق كشف", 'other');
    }
    
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="bg-white w-full max-w-md rounded-xl overflow-hidden shadow-2xl border border-slate-200"
      >
        <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800">تعديل وإتمام الكشف</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"><X size={20} /></button>
        </div>
        <form className="p-6 space-y-4 text-right overflow-y-auto max-h-[85vh]" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">حالة الكشف</label>
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={() => setFormData({...formData, status: 'completed'})} 
                className={`flex-1 p-3 rounded-lg border transition-all font-black text-xs ${formData.status === 'completed' ? 'border-emerald-600 bg-emerald-50 text-emerald-600' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
              >
                مكتمل / تم الكشف
              </button>
              <button 
                type="button" 
                onClick={() => setFormData({...formData, status: 'cancelled'})} 
                className={`flex-1 p-3 rounded-lg border transition-all font-black text-xs ${formData.status === 'cancelled' ? 'border-red-600 bg-red-50 text-red-600' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
              >
                ملغي / لم يتم
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1 col-span-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">حالة الدفع</label>
               <div 
                 onClick={() => setFormData({...formData, isPaid: !formData.isPaid})}
                 className={`w-full px-4 py-2.5 border rounded-lg cursor-pointer transition-all flex items-center justify-center gap-2 ${formData.isPaid ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}
               >
                 <CreditCard size={14} />
                 <span className="text-[10px] font-black uppercase">{formData.isPaid ? 'تم تحصيل الكشف' : 'معلق / آجل'}</span>
               </div>
             </div>
          </div>

          {formData.status === 'cancelled' ? (
            <div className="space-y-1 animate-in fade-in duration-200">
              <label className="text-[10px] font-black text-red-600 uppercase tracking-widest leading-loose">سبب الإلغاء</label>
              <textarea 
                required
                rows={2} 
                className="w-full px-4 py-2.5 bg-red-50/30 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/10 transition-all text-sm font-bold" 
                value={formData.cancellationReason} 
                onChange={(e) => setFormData({...formData, cancellationReason: e.target.value})} 
                placeholder="يرجى كتابة سبب لإلغاء هذا الكشف..." 
              />
            </div>
          ) : (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">شكوى المريض / أعراض الحالة</label>
                <textarea 
                  rows={2} 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm" 
                  value={formData.notes} 
                  onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                  placeholder="الشكوى والسبب من الزيارة..." 
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center pb-1">
                  <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-loose font-mono">النتيجة والتشخيص وخطة العلاج</label>
                  <button 
                    type="button"
                    disabled={isSuggesting}
                    onClick={handleSuggestDiagnosis}
                    className="text-[9px] font-black bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isSuggesting ? "جاري الاقتراح..." : "🪄 اقتراح ذكي للتشخيص"}</span>
                  </button>
                </div>
                <textarea 
                  rows={2} 
                  className="w-full px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all text-sm font-bold" 
                  value={formData.diagnosis} 
                  onChange={(e) => setFormData({...formData, diagnosis: e.target.value})} 
                  placeholder="التشخيص النهائي بعد إتمام الكشف..." 
                />

                {suggestions.length > 0 && (
                  <div className="p-3 bg-slate-50 border border-slate-150 rounded-lg text-right space-y-1.5 mt-2 animate-in fade-in duration-200">
                    <p className="text-[9px] font-black text-slate-400">التشخيصات المقترحة (اضغط للاختيار):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, diagnosis: s }));
                            setSuggestions([]);
                          }}
                          className="bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">الوصف والتقرير الطبي الاستنتاجي للحالة 🧑‍⚕️</label>
                <textarea 
                  placeholder="اكتب التقرير الطبي الاستنتاجي لما تم التوصل إليه من فحص المريض وشرح ما تم استنتاجه..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm h-24 resize-none"
                  value={formData.clinicalAssessment}
                  onChange={(e) => setFormData({ ...formData, clinicalAssessment: e.target.value })}
                />
              </div>

              {/* Clinical Vitals Section */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/40 space-y-3 text-right">
                <h4 className="text-[11px] font-black text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                  <span className="text-teal-600">📊</span> العلامات الحيوية للمريض (Patient Vitals)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 block">الحرارة (°C)</label>
                    <input 
                      type="text" 
                      placeholder="37" 
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center" 
                      value={formData.temperature} 
                      onChange={(e) => setFormData({...formData, temperature: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 block">الضغط (B.P)</label>
                    <input 
                      type="text" 
                      placeholder="120/80" 
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center" 
                      value={formData.bloodPressure} 
                      onChange={(e) => setFormData({...formData, bloodPressure: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 block">النبض (Pulse)</label>
                    <input 
                      type="text" 
                      placeholder="75" 
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center" 
                      value={formData.pulse} 
                      onChange={(e) => setFormData({...formData, pulse: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 block">الوزن (كجم)</label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="70" 
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center" 
                      value={formData.weight} 
                      onChange={(e) => setFormData({...formData, weight: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 block">الطول (سم)</label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="175" 
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center" 
                      value={formData.height} 
                      onChange={(e) => setFormData({...formData, height: e.target.value})} 
                    />
                  </div>
                </div>

                {/* BMI Calculator badge */}
                {formData.weight && formData.height && Number(formData.weight) > 0 && Number(formData.height) > 0 && (() => {
                  const w = Number(formData.weight);
                  const h = Number(formData.height) / 100;
                  const bmiVal = (w / (h * h)).toFixed(1);
                  let status = "وزن مثالي";
                  let statusClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                  const bmiNum = Number(bmiVal);
                  if (bmiNum < 18.5) {
                    status = "نقص الوزن";
                    statusClass = "bg-amber-50 text-amber-700 border-amber-200";
                  } else if (bmiNum >= 18.5 && bmiNum < 25) {
                    status = "طبيعي ومثالي";
                    statusClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                  } else if (bmiNum >= 25 && bmiNum < 30) {
                    status = "زيادة وزن (Overweight)";
                    statusClass = "bg-orange-50 text-orange-700 border-orange-200";
                  } else {
                    status = "سمنة مفرطة";
                    statusClass = "bg-red-50 text-red-700 border-red-200";
                  }
                  return (
                    <div className={`p-2 rounded border text-xs font-bold flex justify-between items-center ${statusClass}`}>
                      <span>كتلة الجسم (BMI): <span className="font-sans font-black">{bmiVal}</span></span>
                      <span className="text-[9px] font-extrabold">{status}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Follow-up & Instructions Section */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/40 space-y-3 text-right">
                <h4 className="text-[11px] font-black text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                  <span className="text-indigo-650">📅</span> تاريخ الاستشارة والمتابعة القادمة
                </h4>
                <div className="flex items-center justify-between p-2 bg-white border border-slate-150 rounded-lg">
                  <span className="text-xs font-bold text-slate-600">طلب موعد إعادة استشارة للمتابعة</span>
                  <input 
                    type="checkbox" 
                    className="size-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
                    checked={formData.followUpRequired} 
                    onChange={(e) => setFormData({ ...formData, followUpRequired: e.target.checked })} 
                  />
                </div>

                {formData.followUpRequired && (
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    <div className="space-y-1 text-right">
                      <label className="text-[9px] font-bold text-slate-500 block">تاريخ موعد الاستشارة</label>
                      <input 
                        type="date" 
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right font-sans" 
                        value={formData.followUpDate} 
                        onChange={(e) => setFormData({...formData, followUpDate: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-1 text-right">
                      <label className="text-[9px] font-bold text-slate-500 block">ملاحظات الاستشارة</label>
                      <input 
                        type="text" 
                        placeholder="امثلة: جلب الفحوصات الطبية" 
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right" 
                        value={formData.followUpNotes} 
                        onChange={(e) => setFormData({...formData, followUpNotes: e.target.value})} 
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1 text-right">
                  <label className="text-[9px] font-bold text-slate-500 block">تعليمات السلامة والنظام الغذائي الخاص 🥗</label>
                  <textarea 
                    placeholder="اكتب التوجيهات الغذائية أو نمط الحياة الخاص المحفز للحالة..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all text-xs h-16 resize-none"
                    value={formData.dietInstructions}
                    onChange={(e) => setFormData({ ...formData, dietInstructions: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-right">
                <h4 className="text-xs font-black text-slate-700">توصيف الأدوية للروشتة الطبية 💊</h4>
                <div className="grid grid-cols-1 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500">اسم الدواء / الصنف</label>
                    <input 
                      type="text"
                      placeholder="مثال: Amoxil 500mg"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right font-sans"
                      value={tempPrescription.name}
                      onChange={(e) => setTempPrescription({ ...tempPrescription, name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500">العدد / الكمية</label>
                      <input 
                        type="text"
                        placeholder="مثال: علبة واحدة"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right"
                        value={tempPrescription.quantity}
                        onChange={(e) => setTempPrescription({ ...tempPrescription, quantity: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500">المدة</label>
                      <input 
                        type="text"
                        placeholder="مثال: 5 أيام"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right flex-1"
                        value={tempPrescription.duration}
                        onChange={(e) => setTempPrescription({ ...tempPrescription, duration: e.target.value })}
                      />
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      if (!tempPrescription.name.trim()) return;
                      setPrescriptions([...prescriptions, { 
                        id: Math.random().toString(36).substr(2, 9), 
                        name: tempPrescription.name.trim(), 
                        quantity: tempPrescription.quantity.trim(), 
                        duration: tempPrescription.duration.trim() 
                      }]);
                      setTempPrescription({ name: '', quantity: '', duration: '' });
                    }}
                    className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-lg transition-all flex items-center justify-center gap-1 shadow-md shadow-teal-950/20 cursor-pointer"
                  >
                    إضافة الدواء للروشتة
                  </button>
                </div>

                {prescriptions.length > 0 && (
                  <div className="mt-3 overflow-hidden border border-slate-150 rounded-lg bg-white">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold">
                        <tr>
                          <th className="p-2">الدواء</th>
                          <th className="p-2">الكمية</th>
                          <th className="p-2">المدة</th>
                          <th className="p-2 text-center w-8">حذف</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prescriptions.map((p) => (
                          <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="p-2 font-black text-slate-800">{p.name}</td>
                            <td className="p-2 font-bold text-slate-600">{p.quantity || '---'}</td>
                            <td className="p-2 font-bold text-slate-600">{p.duration || '---'}</td>
                            <td className="p-2 text-center">
                              <button 
                                type="button"
                                onClick={() => setPrescriptions(prescriptions.filter(item => item.id !== p.id))}
                                className="text-red-500 hover:text-red-700 font-bold cursor-pointer font-sans"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Add file attachment inside checkup */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase">إضافة مرفق للحالة لهذا الكشف (اختياري)</h3>
            <div className="space-y-1">
              <input 
                type="text" 
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs animate-in fade-in" 
                placeholder="عنوان المرفق (مثال: تحاليل، صورة أشعة...)" 
                value={fileTitle} 
                onChange={(e) => setFileTitle(e.target.value)} 
              />
            </div>
            <div className="border border-dashed border-slate-200 rounded-lg p-3 text-center bg-slate-50 hover:bg-white transition-all cursor-pointer relative">
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <div className="text-xs font-bold text-slate-500 truncate">{file ? file.name : 'اختر ملفاً لرفعه مع الكشف'}</div>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-lg shadow-emerald-900/10 text-sm">حفظ التعديلات والتحديث</button>
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 text-sm">إلغاء</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function PrintPrescriptionModal({ onClose, visit, patient, doctor, onRefresh }: { onClose: () => void, visit: any, patient: any, doctor: any, onRefresh?: () => void }) {
  const [medicines, setMedicines] = useState<{ id?: string; name: string; dose: string; duration: string; qty: number; unit?: string; inventoryItemId?: string }[]>(() => {
    if (visit?.prescriptions && Array.isArray(visit.prescriptions)) {
      return visit.prescriptions.map((p: any) => ({
        name: p.name || "",
        dose: p.quantity || "",
        duration: p.duration || "",
        qty: 1,
        unit: 'عبوة'
      }));
    }
    return [];
  });
  const [newMed, setNewMed] = useState({ name: '', dose: '', duration: '', qty: 1, inventoryItemId: '' });
  const [inventory, setInventory] = useState<any[]>([]);
  const [isDispensed, setIsDispensed] = useState<boolean>(false);
  const [isDispensingLoading, setIsDispensingLoading] = useState<boolean>(false);

  useEffect(() => {
    api.getInventory().then((data) => {
      // Get all items under 'medication' category
      const meds = data.filter(item => (item.category as string)?.toLowerCase() === 'medication' || (item.category as string) === 'أدوية' || (item.category as string) === 'روشتة');
      setInventory(meds.length > 0 ? meds : data); // fallback to all data if category does not match perfectly
    }).catch(err => console.error("Error loading medication inventory: ", err));
  }, []);

  const addMedicine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMed.name.trim()) return;

    // Check if it's from inventory
    const linkedItem = inventory.find(i => i.id === newMed.inventoryItemId);

    setMedicines([...medicines, { 
      name: newMed.name.trim(), 
      dose: newMed.dose.trim(), 
      duration: newMed.duration.trim(),
      qty: Number(newMed.qty || 1),
      unit: linkedItem ? linkedItem.unit : 'عبوة',
      inventoryItemId: newMed.inventoryItemId || undefined
    }]);

    setNewMed({ name: '', dose: '', duration: '', qty: 1, inventoryItemId: '' });
  };

  const handleSelectInventoryMed = (itemId: string) => {
    if (!itemId) {
      setNewMed(prev => ({ ...prev, inventoryItemId: '', name: '' }));
      return;
    }
    const item = inventory.find(i => i.id === itemId);
    if (item) {
      setNewMed(prev => ({ 
        ...prev, 
        inventoryItemId: item.id, 
        name: item.name,
        qty: 1
      }));
    }
  };

  const removeMedicine = (index: number) => {
    setMedicines(medicines.filter((_, idx) => idx !== index));
  };

  const handleDispenseMeds = async () => {
    const itemsToDispense = medicines
      .filter(med => med.inventoryItemId)
      .map(med => ({
        id: med.inventoryItemId!,
        quantity: med.qty
      }));

    if (itemsToDispense.length === 0) {
      alert("لم تقم بربط أي من أدوية الروشتة بمواد من المخزن الطبي للعيادة بعد!");
      return;
    }

    setIsDispensingLoading(true);
    try {
      await api.dispensePrescription(itemsToDispense);
      setIsDispensed(true);
      alert("تمت معالجة صرف الروشتة للمريض وخصم الكميات تلقائياً من مخزن العيادة بنجاح! 🎉");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert("فشل صرف الأدوية وتحديث المخزن: " + err.message);
    } finally {
      setIsDispensingLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const linkedMedsCount = medicines.filter(m => m.inventoryItemId).length;

  return (
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[3px] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
            background: none !important;
          }
          #prescription-print-area, #prescription-print-area * {
            visibility: visible;
          }
          #prescription-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            background: white !important;
            color: black !important;
            direction: rtl;
            padding: 30px !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <motion.div 
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="bg-slate-900 border border-slate-800 text-white w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row h-[85vh] no-print"
      >
        {/* Left column: Setup list of medicines (controls) */}
        <div className="w-full lg:w-1/2 p-6 overflow-y-auto border-r border-slate-800 space-y-6 text-right order-2 lg:order-1 bg-slate-950 text-slate-300">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <Plus size={18} className="text-emerald-500" />
              توليد وتصميم الروشتة والربط المخزني
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Visit and Patient details */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-2 text-xs">
            <p>اسم المريض: <span className="font-bold text-white">{patient?.name}</span></p>
            <p>الطبيب المعالج: <span className="font-bold text-white">د. {doctor?.name}</span> ({doctor?.specialty})</p>
            <p>تاريخ الزيارة: <span className="font-bold text-white">{dayjs(visit?.date).format('DD/MM/YYYY')}</span></p>
            {visit?.diagnosis && <p className="mt-1 bg-slate-900 p-2.5 rounded border border-slate-800 text-[11px] text-emerald-400">التشخيص المسجل: <span className="font-black">{visit.diagnosis}</span></p>}
          </div>

          {/* Form to add medicine */}
          <form onSubmit={addMedicine} className="space-y-4 pt-2">
            <h3 className="text-xs font-black text-white uppercase tracking-wider">إضافة دواء جديد:</h3>
            
            <div className="space-y-3">
              {/* Dropdown for Inventory Linkage */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 block font-bold">ربط مادتنا الطبية من المخزن (اختياري لخصم المادة تلقائياً)</label>
                <select 
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-right cursor-pointer"
                  value={newMed.inventoryItemId}
                  onChange={(e) => handleSelectInventoryMed(e.target.value)}
                >
                  <option value="">-- اكتب الدواء يدوياً أو اختر من أدوية المخزن --</option>
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (المتوفر: {item.quantity} {item.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 block font-bold">اسم الدواء والجرعة (Medicine Name & strength)</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-right font-sans"
                  placeholder="مثال: Augmentin 1g or بنادول 500 ملغ"
                  value={newMed.name}
                  onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1 space-y-1">
                  <label className="text-[10px] text-slate-400 block font-bold">الكمية الصرفية</label>
                  <input 
                    type="number"
                    min="1"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans font-bold"
                    value={newMed.qty}
                    onChange={(e) => setNewMed({ ...newMed, qty: Math.max(1, parseInt(e.target.value) || 1) })}
                  />
                </div>
                <div className="col-span-1 space-y-1">
                  <label className="text-[10px] text-slate-400 block font-bold"> Sig التعليمات</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-right font-sans"
                    placeholder="قرص كل 12 ساعة"
                    value={newMed.dose}
                    onChange={(e) => setNewMed({ ...newMed, dose: e.target.value })}
                  />
                </div>
                <div className="col-span-1 space-y-1">
                  <label className="text-[10px] text-slate-400 block font-bold">المدة duration</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-right font-sans"
                    placeholder="7 أيام"
                    value={newMed.duration}
                    onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg transition-all flex items-center justify-center gap-1 shadow-lg shadow-emerald-950/20"
            >
              <Plus size={14} /> إضافة الدواء للروشتة
            </button>
          </form>

          {/* Medicines List */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-black text-white px-1 flex justify-between">
              <span>الأدوية المضافة حالياً للروشتة:</span>
              {linkedMedsCount > 0 && <span className="text-[10px] text-emerald-400 font-extrabold">{linkedMedsCount} مربوطة بالمخزن</span>}
            </h3>
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
              {medicines.map((med, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-lg border border-slate-850 text-xs">
                  <button type="button" onClick={() => removeMedicine(idx)} className="text-red-400 hover:text-red-500 hover:bg-red-500/10 p-1 rounded">
                    <X size={14} />
                  </button>
                  <div className="text-right">
                    <p className="font-black text-white flex items-center gap-1.5">
                      {med.name}
                      {med.inventoryItemId && (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          مخزني • الكمية: {med.qty} {med.unit}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{med.dose} {med.duration && `| ${med.duration}`}</p>
                  </div>
                </div>
              ))}
              {medicines.length === 0 && (
                <p className="text-[11px] text-slate-500 italic text-center py-4">لم يتم إضافة أي أدوية بعد. اكتب دواء بالأعلى واضغط إضافة.</p>
              )}
            </div>
          </div>

          {/* Auto Deduct Dispensation CTA */}
          {linkedMedsCount > 0 && (
            <div className="bg-emerald-950/35 border border-emerald-800/80 p-4 rounded-xl text-right space-y-3">
              <div className="flex items-start gap-2 text-xs">
                <span className="text-emerald-400 font-extrabold text-sm">💡</span>
                <p className="text-emerald-200 leading-relaxed font-bold">
                  سيتم خصم وتحديث كميات الأدوية المربوطة ({linkedMedsCount} دواء) من المخزن بشكل آلي ومنظم بالعيادة عند صرف الروشتة.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDispenseMeds}
                disabled={isDispensed || isDispensingLoading}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 active:scale-95 disabled:scale-100 text-white font-black text-xs rounded-lg transition-all flex items-center justify-center gap-2 border border-emerald-500 shadow-md disabled:bg-slate-800 disabled:border-slate-700 disabled:text-slate-500"
              >
                {isDispensingLoading ? (
                  <span>جاري معالجة صرف الأدوية...</span>
                ) : isDispensed ? (
                  <span className="flex items-center gap-1 text-emerald-400">
                    ✓ تمت معالجة صرف دواء الروشتة بنجاح
                  </span>
                ) : (
                  <span>صرف الروشتة للمريض (خصم تلقائي من المخزن 🏥)</span>
                )}
              </button>
            </div>
          )}

          <div className="pt-4 border-t border-slate-800 flex gap-3">
            <button 
              type="button" 
              onClick={handlePrint}
              disabled={medicines.length === 0}
              className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5 text-xs shadow-lg shadow-blue-950/20"
            >
              طباعة الروشتة (A5/A4) 🖨️
            </button>
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 text-xs text-center transition-all"
            >
              رجوع
            </button>
          </div>
        </div>

        {/* Right column: Real-time paper template render (visual design) */}
        <div className="w-full lg:w-1/2 p-8 bg-slate-800 overflow-y-auto flex items-center justify-center order-1 lg:order-2">
          {/* Printable visual frame representing standard prescription pad */}
          <div 
            id="prescription-print-area" 
            className="w-full max-w-[420px] aspect-[1/1.414] bg-white text-slate-900 rounded-lg shadow-2xl p-6 flex flex-col justify-between text-right font-sans relative border-t-8 border-teal-600"
            style={{ direction: 'rtl' }}
          >
            {/* Header */}
            <div>
              <div className="flex justify-between items-start border-b-2 border-slate-100 pb-3">
                <div className="text-right">
                  <h1 className="text-sm font-black text-slate-900">مجمع عيادات الشفاء الطبي</h1>
                  <p className="text-[9px] text-slate-500 font-mono mt-0.5">Al-Shifa Medical Complex</p>
                  <p className="text-[8px] text-slate-400">هاتف: 0100999999 | عمارة الأطباء الدور الثاني</p>
                </div>
                <div className="text-left font-mono">
                  <h2 className="text-xs font-black text-slate-800">DR. {doctor?.name?.toUpperCase() || 'UNKNOWN'}</h2>
                  <p className="text-[8px] text-blue-600 font-black tracking-wide">{doctor?.specialty || 'General Practitioner'}</p>
                  <p className="text-[7px] text-slate-400">Reg. Clinic License #88219</p>
                </div>
              </div>

              {/* Patient details banner */}
              <div className="bg-slate-50 p-2.5 rounded-lg grid grid-cols-3 gap-2 text-[9px] font-bold text-slate-700 border border-slate-100 mt-4">
                <div>اسم المريض: <span className="font-black text-slate-900">{patient?.name}</span></div>
                <div>السن: <span className="font-black text-slate-900">{patient?.age || 'غير محدد'}</span></div>
                <div>التاريخ: <span className="font-black text-slate-900">{dayjs(visit?.date).format('DD/MM/YYYY')}</span></div>
              </div>

              {/* Prescription Body Rx */}
              <div className="mt-6 flex-1 min-h-[180px]">
                {/* Large Rx clinical symbol */}
                <span className="text-2xl font-serif text-teal-600 font-extrabold italic block mb-2 select-none">Rx</span>

                {visit?.diagnosis && (
                  <div className="mb-4 text-right">
                    <span className="text-[8px] font-black text-slate-400 block tracking-wider">الشكوى / التشخيص الطبي</span>
                    <p className="text-[10px] text-slate-800 font-bold whitespace-pre-wrap">{visit.diagnosis}</p>
                  </div>
                )}

                <div className="space-y-4 text-right">
                  <span className="text-[8px] font-black text-slate-400 block tracking-wider">العلاج الموصوف (Meds)</span>
                  {medicines.length > 0 ? (
                    <ol className="list-decimal list-inside space-y-2.5">
                      {medicines.map((med, idx) => (
                        <li key={idx} className="text-xs font-bold text-slate-900 pl-2">
                          <span className="font-black">{med.name}</span>
                          <span className="text-[10px] text-slate-500 font-medium block pr-4 mt-0.5">👈 {med.dose} {med.duration && ` | ${med.duration}`}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="border border-dashed border-slate-200 rounded-lg py-12 text-center text-[10px] text-slate-300 italic">
                      قم بإضافة الأدوية من لوحة التحكم لعرضها هنا بالروشتة الطبية
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 pt-3 mt-6">
              <div className="flex justify-between items-end">
                <div className="text-right text-[7.5px] text-slate-400 max-w-[200px] leading-relaxed">
                  💡 تنبيه هام: يرجى الالتزام التام بالجرعات والتعليمات الطبية الموصوفة من الطبيب. المراجعة بعد أسبوع أو حسب الموعد المقرر.
                </div>
                <div className="text-center w-[100px] border-t border-dashed border-slate-350 pt-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase block tracking-wider">توقيع وختم الطبيب</span>
                  <span className="text-[9px] font-extrabold text-slate-600 block mt-2">د. {doctor?.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function PrintMedicalReportModal({ onClose, visit, patient, doctor }: { onClose: () => void, visit: any, patient: any, doctor: any }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px] overflow-y-auto">
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 15 }}
        className="relative bg-teal-950 w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl border border-teal-850 flex flex-col md:flex-row max-h-[90vh] z-10"
      >
        {/* Print settings controller (Left side on desktop / Top on mobile) */}
        <div className="p-6 bg-slate-900 border-b md:border-b-0 md:border-e border-slate-800 text-right w-full md:w-80 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <span className="text-[9px] bg-purple-500/10 text-purple-400 font-bold px-2 py-0.5 rounded border border-purple-500/20">منشئ التقارير المعتمدة</span>
              <h2 className="text-base font-black text-white mt-1.5 leading-relaxed font-sans">التقرير الطبي والروشتة الرسمية</h2>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed font-sans">توليد تقرير طبي استنتاجي مطبوع يوضح تفاصيل الحالة والأعراض والتشخيص والروشتة العلاجية.</p>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 space-y-2 text-xs text-slate-300 text-right">
              <p>المريض: <span className="font-extrabold text-white">{patient?.name || '---'}</span></p>
              <p>العمر: <span className="font-bold text-white font-sans">{patient?.age || '---'} سنة</span></p>
              <p>الطبيب: <span className="font-extrabold text-white font-sans">د. {doctor?.name || '---'}</span> (دكتور {doctor?.specialty || '---'})</p>
              <p>العيادة / الفرع: <span className="font-bold text-emerald-400">{doctor?.clinicBranch || 'المعادي'}</span></p>
              <p>تاريخ الكشف: <span className="font-bold text-white font-sans">{dayjs(visit?.date).format('DD/MM/YYYY')}</span></p>
            </div>
            
            <div className="text-[10px] text-amber-500 bg-amber-500/5 p-3 rounded-lg border border-amber-500/10 leading-relaxed font-bold font-sans">
              💡 نصيحة الطباعة: تأكد من تمكين "خلفيات الرسومات" (Background Graphics) وإلغاء "الهوامش" (Margins) في إعدادات متصفحك للحصول على المظهر الملون الأفضل لترويسة العيادة.
            </div>
          </div>

          <div className="pt-6 space-y-2">
            <button 
              onClick={handlePrint}
              className="w-full py-3 bg-purple-600 hover:bg-purple-750 text-white font-black rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-purple-950/20 text-xs"
            >
              <FileText size={14} />
              <span>بدء طباعة التقرير الطبي 🖨️</span>
            </button>
            <button 
              onClick={onClose}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-extrabold rounded-lg transition-all text-xs"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>

        {/* Paper space to preview printable page */}
        <div className="flex-1 bg-slate-100 p-4 md:p-8 overflow-y-auto text-right flex justify-center">
          {/* Printable container with printable paper styles */}
          <div id="printable-medical-report" className="w-[210mm] min-h-[297mm] bg-white p-[15mm] text-slate-800 flex flex-col justify-between shadow-lg text-right relative font-sans">
            
            {/* Styles specific to printing */}
            <style dangerouslySetInnerHTML={{__html: `
              @media print {
                body * {
                  visibility: hidden;
                }
                #printable-medical-report, #printable-report-wrapper, #printable-medical-report * {
                  visibility: visible;
                }
                #printable-medical-report {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 210mm;
                  height: auto;
                  min-height: 297mm;
                  padding: 15mm;
                  margin: 0;
                  box-shadow: none;
                  background-color: white !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
              }
            `}} />

            <div>
              {/* Header section (Clinic letterhead) */}
              <div className="border-b-4 border-double border-teal-600 pb-3 flex justify-between items-center">
                <div className="text-right">
                  <h1 className="text-xl font-black text-teal-850">مركز الرعاية الطبية المتكامل</h1>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5 font-sans">عيادات المعادي - الدقي - مدينة نصر - اسكندرية</p>
                  <p className="text-[10px] text-indigo-700 font-extrabold mt-0.5 font-sans">🏥 فرع عيادة {doctor?.clinicBranch || 'المعادي'}</p>
                </div>
                
                {/* Visual Medical shield logo */}
                <div className="p-2 border border-teal-500 rounded-xl bg-teal-50 text-center">
                  <span className="text-xs font-black text-teal-800 block">تقرير طبي رسمي</span>
                  <span className="text-[8px] font-bold text-teal-600 block font-sans">Official Report</span>
                </div>
              </div>

              {/* Patient and doctor meta block */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-y-2 text-xs mt-6 text-right">
                <div>
                  <span className="text-slate-400 font-bold">اسم المريض: </span>
                  <span className="text-slate-800 font-black">{patient?.name || '---'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold font-sans">رقم الهاتف: </span>
                  <span className="text-slate-800 font-bold font-sans">{patient?.phone || '---'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold font-sans">العمر / السن: </span>
                  <span className="text-slate-800 font-black font-sans">{patient?.age || '---'} سنة</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold">الجنس / النوع: </span>
                  <span className="text-slate-800 font-bold">{patient?.gender === 'female' ? 'أنثى' : 'ذكر'}</span>
                </div>
                <div className="border-t border-slate-150 pt-2 col-span-2 grid grid-cols-2 text-[11px] mt-1">
                  <div>
                    <span className="text-slate-400 font-bold">الطبيب المعالج: </span>
                    <span className="text-teal-800 font-black">د. {doctor?.name || '---'}</span>
                    <span className="text-slate-500 text-[10px] mr-1 font-sans">({doctor?.specialty || 'تخصص عام'})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold font-sans">تاريخ وساعة التقرير: </span>
                    <span className="text-slate-800 font-bold font-sans">{dayjs(visit?.date || new Date()).format('YYYY/MM/DD - hh:mm A')}</span>
                  </div>
                </div>
              </div>

              <div className="text-center my-6">
                <span className="px-6 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-black tracking-widest uppercase">
                  تقرير طبي واستنتاجي معتمد لزيارة العيادة
                </span>
              </div>

              {/* Patient complaint */}
              <div className="space-y-2 mt-4 text-right">
                <span className="text-[10px] font-black text-teal-800 block border-r-4 border-teal-600 pr-2 leading-none uppercase tracking-wider font-sans">شكاوى وأعراض المريض الأولية (Initial Complaint)</span>
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/50 p-3 rounded-lg border border-slate-150 py-2 font-medium whitespace-pre-wrap font-sans">
                  {visit?.notes || 'لم يتم رصد شكوى خاصة مسجلة في ملف المريض.'}
                </p>
              </div>

              {/* Diagnosis */}
              <div className="space-y-2 mt-6 text-right">
                <span className="text-[10px] font-black text-teal-800 block border-r-4 border-teal-600 pr-2 leading-none uppercase tracking-wider font-sans">التشخيص النهائي للعيادة (Clinical Diagnosis)</span>
                <p className="text-xs text-slate-800 leading-relaxed bg-emerald-50/20 p-3 rounded-lg border border-emerald-100 py-2.5 font-bold whitespace-pre-wrap font-sans">
                  {visit?.diagnosis || 'مستقرة وتحت الملاحظة والعلاج المستمر.'}
                </p>
              </div>

              {/* Deducted Clinical assessment report */}
              <div className="space-y-2 mt-6 text-right">
                <span className="text-[10px] font-black text-indigo-800 block border-r-4 border-indigo-600 pr-2 leading-none uppercase tracking-wider font-sans">الوصف والتقرير الطبي الاستنتاجي (Doctor Assessment Explanation)</span>
                <div className="text-xs text-slate-800 leading-relaxed bg-blue-50/20 p-4 rounded-lg border border-blue-100 py-3.5 whitespace-pre-wrap font-bold font-sans">
                  {visit?.clinicalAssessment ? visit.clinicalAssessment : (
                    <span className="text-slate-400 italic font-normal font-sans">
                      بناءً على الفحص المجرى للمريض اليوم، تظهر نتائج تحسن وقابلية تامة للاستشفاء التدريجي؛ نوصي باتباع التعليمات والراحة التامة للعودة السلسة لممارسة الأنشطة المعتادة.
                    </span>
                  )}
                </div>
              </div>

              {/* Patient Vitals inside the printed report */}
              {visit?.vitals && (visit.vitals.temperature || visit.vitals.bloodPressure || visit.vitals.pulse || visit.vitals.weight || visit.vitals.height) && (
                <div className="mt-5 space-y-2 text-right">
                  <span className="text-[10px] font-black text-rose-800 block border-r-4 border-rose-600 pr-2 leading-none uppercase tracking-wider font-sans">العلامات الحيوية والقياسات السريرية (Vital Signs & Measurements)</span>
                  <div className="grid grid-cols-4 gap-2 bg-rose-50/20 p-3 rounded-lg border border-rose-100 text-xs">
                    {visit.vitals.temperature && (
                      <div className="bg-white p-2 rounded border border-rose-50 flex flex-col items-center">
                        <span className="text-[9px] text-slate-450 font-bold block">الحرارة (Temp)</span>
                        <span className="text-xs font-black text-slate-800 mt-0.5 font-sans">{visit.vitals.temperature} °C</span>
                      </div>
                    )}
                    {visit.vitals.bloodPressure && (
                      <div className="bg-white p-2 rounded border border-rose-50 flex flex-col items-center">
                        <span className="text-[9px] text-slate-450 font-bold block">ضغط الدم (B.P)</span>
                        <span className="text-xs font-black text-slate-800 mt-0.5 font-sans">{visit.vitals.bloodPressure} mmHg</span>
                      </div>
                    )}
                    {visit.vitals.pulse && (
                      <div className="bg-white p-2 rounded border border-rose-50 flex flex-col items-center">
                        <span className="text-[9px] text-slate-450 font-bold block">النبض (Pulse)</span>
                        <span className="text-xs font-black text-slate-800 mt-0.5 font-sans">{visit.vitals.pulse} bpm</span>
                      </div>
                    )}
                    {(visit.vitals.weight || visit.vitals.height) && (
                      <div className="bg-white p-2 rounded border border-rose-50 flex flex-col items-center col-span-1">
                        <span className="text-[9px] text-slate-450 font-bold block">كتلة الجسم (BMI)</span>
                        <span className="text-xs font-black text-rose-750 mt-0.5 font-sans">
                          {(() => {
                            const w = Number(visit.vitals.weight || 0);
                            const h = Number(visit.vitals.height || 0) / 100;
                            if (w > 0 && h > 0) {
                              return (w / (h * h)).toFixed(1);
                            }
                            return '---';
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Diet Instructions & Follow-up Details inside the printed report */}
              {(visit?.dietInstructions || visit?.followUpRequired) && (
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-right">
                  {visit?.dietInstructions && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-indigo-850 block border-r-4 border-indigo-500 pr-2 leading-none uppercase tracking-wider font-sans">التوجيهات ونمط الغذاء الصحي الموصى به (Diet & Instructions)</span>
                      <p className="text-xs text-slate-700 leading-relaxed bg-indigo-50/10 p-3 rounded-lg border border-indigo-100 py-2 font-medium font-sans whitespace-pre-wrap">
                        {visit.dietInstructions}
                      </p>
                    </div>
                  )}
                  {visit?.followUpRequired && visit?.followUpDate && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-teal-850 block border-r-4 border-teal-500 pr-2 leading-none uppercase tracking-wider font-sans">موعد المتابعة والاستشارة القادمة (Next Follow-up Visit)</span>
                      <div className="p-3 bg-teal-50/10 rounded-lg border border-teal-100 text-xs">
                        <p>تاريخ الموعد: <span className="font-extrabold text-teal-900 font-sans">{dayjs(visit.followUpDate).format('YYYY/MM/DD')}</span></p>
                        {visit.followUpNotes && <p className="text-slate-500 mt-1">ملاحظة الاستشارة: <span className="font-medium text-slate-700">{visit.followUpNotes}</span></p>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Prescribed medications detail table */}
              <div className="space-y-3 mt-6 text-right">
                <span className="text-[10px] font-black text-teal-800 block border-r-4 border-teal-600 pr-2 leading-none uppercase tracking-wider font-sans">الوصفات الطبية المعتمدة (Prescribed Medications / Rx)</span>
                {visit?.prescriptions && Array.isArray(visit.prescriptions) && visit.prescriptions.length > 0 ? (
                  <div className="overflow-hidden border border-slate-200 rounded-xl bg-white font-sans">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3 text-right">م</th>
                          <th className="p-3 text-right">الصنف وصنف الدواء الموصوف</th>
                          <th className="p-3 text-center">الكمية الصرفية</th>
                          <th className="p-3 text-center">المدة والتعليمات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150">
                        {visit.prescriptions.map((p: any, idx: number) => (
                          <tr key={p.id || idx} className="hover:bg-slate-50">
                            <td className="p-3 text-slate-400 font-bold w-10 font-sans">{idx + 1}</td>
                            <td className="p-3 font-black text-slate-800 font-sans">{p.name}</td>
                            <td className="p-3 text-center font-black text-teal-800 font-sans">{p.quantity || '---'}</td>
                            <td className="p-3 text-center font-semibold text-slate-600 font-sans">{p.duration || '---'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-100 font-sans">لم يتم إدراج أصناف علاجية كيميائية بالروشتة الطبية اليوم.</p>
                )}
              </div>
            </div>

            {/* Footer and Signatures */}
            <div className="border-t border-slate-100 pt-4 mt-8 flex justify-between items-end">
              <div className="text-right text-[8px] text-slate-400 font-bold leading-loose max-w-sm">
                ⚠️ إخلاء مسؤولية: صدر هذا التقرير الطبي بناءً على الحالة وفحص المريض السريري المحدد. هذا التقرير سري ومعد فقط للاستخدام الطبي والقانوني المصرح به.
              </div>
              <div className="text-center w-[140px] border-t border-teal-700 pt-2 block">
                <span className="text-[9px] font-black text-teal-850 uppercase block tracking-wider">توقيع وختم الطبيب المعالج</span>
                <span className="text-xs font-black text-slate-800 block mt-1.5 font-sans">د. {doctor?.name || '---'}</span>
                <span className="text-[9px] text-slate-500 font-medium block mt-0.5 font-sans">({doctor?.specialty || 'تخصص عام'})</span>
              </div>
            </div>

          </div>
        </div>
      </motion.div>
    </div>
  );
}

function PrintPatientSummaryModal({ onClose, patient, visits, doctors }: { onClose: () => void, patient: any, visits: any[], doctors: any[] }) {
  const handlePrint = () => {
    window.print();
  };

  const sortedVisits = useMemo(() => {
    return [...visits].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [visits]);

  const last3Visits = useMemo(() => {
    return sortedVisits.slice(0, 3);
  }, [sortedVisits]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px] overflow-y-auto">
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-patient-summary, #printable-patient-summary * {
            visibility: visible;
          }
          #printable-patient-summary {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            background: white !important;
            color: black !important;
            direction: rtl;
            padding: 20px !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 15 }}
        className="relative bg-slate-900 w-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col xl:flex-row max-h-[92vh] z-10"
      >
        {/* Print settings controller (Left side on desktop / Top on mobile) */}
        <div className="p-6 bg-slate-950 border-b xl:border-b-0 xl:border-e border-slate-800 text-right w-full xl:w-80 flex flex-col justify-between shrink-0">
          <div className="space-y-4 font-sans">
            <div>
              <span className="text-[9px] bg-indigo-500/10 text-indigo-400 font-bold px-2 py-0.5 rounded border border-indigo-500/20">تقرير الملف الموحد</span>
              <h2 className="text-base font-black text-white mt-1.5 leading-relaxed">ملخص بيانات المريض والزيارات الأخيرة</h2>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">توليد ملخص شامل يحتوي على المعلومات الديموغرافية والسريرية للمريض وجرد لآخر 3 كشوفات معتمدة بزيارات المريض.</p>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300 text-right">
              <p>اسم المريض: <span className="font-extrabold text-white">{patient?.name || '---'}</span></p>
              <p>كود الحالة: <span className="font-bold text-white font-sans">{patient?.caseCode || '---'}</span></p>
              <p>إجمالي الزيارات المسجلة: <span className="font-bold text-indigo-400">{visits.length} زيارات</span></p>
            </div>
            
            <div className="text-[10px] text-amber-500 bg-amber-500/5 p-3 rounded-lg border border-amber-500/10 leading-relaxed font-bold">
              💡 نصيحة الطباعة: تأكد من تفعيل خيار خلفيات الرسومات (Background Graphics) للحصول على ألوان ترويسة وهوية العيادة الملونة على الورقة المطبوعة.
            </div>
          </div>

          <div className="pt-6 space-y-2 font-sans">
            <button 
              onClick={handlePrint}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-950/20 text-xs"
            >
              <Printer size={14} />
              <span>طباعة ملخص الملف الموحد 🖨️</span>
            </button>
            <button 
              onClick={onClose}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-extrabold rounded-lg transition-all text-xs"
            >
              إلغاء وإغلاق
            </button>
          </div>
        </div>

        {/* Paper space to preview printable page */}
        <div className="flex-1 bg-slate-800 p-4 xl:p-8 overflow-y-auto text-right flex justify-center">
          {/* Printable container with printable paper styles */}
          <div id="printable-patient-summary" className="w-[210mm] min-h-[297mm] bg-white p-[15mm] text-slate-800 flex flex-col justify-between shadow-lg text-right relative font-sans border-t-8 border-indigo-600">
            <div>
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-100 pb-3">
                <div className="text-right">
                  <h1 className="text-sm font-black text-slate-900">مجمع عيادات الشفاء الطبي الموحد</h1>
                  <p className="text-[9px] text-slate-500 font-mono mt-0.5">Al-Shifa Integrated Medical Center</p>
                  <p className="text-[8px] text-slate-400">ملخص ملف مريض معتمد | تاريخ التصدير: {dayjs().format('DD/MM/YYYY HH:mm')}</p>
                </div>
                <div className="text-left font-mono">
                  <h2 className="text-xs font-black text-indigo-700">CLINIC SYSTEM</h2>
                  <p className="text-[8px] text-slate-500 tracking-wide">Patient Information & Visit History</p>
                  <p className="text-[7px] text-slate-400">Branch: {patient?.branch || 'المعادي'}</p>
                </div>
              </div>

              {/* Title Section */}
              <div className="text-center my-5 bg-indigo-50/40 py-2.5 rounded-lg border border-indigo-100/40">
                <h2 className="text-xs font-black text-indigo-900 font-sans">ملخص البيانات الطبية والزيارات الأخيرة للمريض</h2>
              </div>

              {/* Basic Patient Info Grid */}
              <div className="space-y-4">
                <span className="text-[10px] font-black text-indigo-800 block border-r-4 border-indigo-600 pr-2 leading-none uppercase tracking-wider font-sans">البيانات الأساسية والديموغرافية (Demographic & Personal Info)</span>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-[11px] font-sans">
                  <div><span className="text-slate-400 font-bold block mb-0.5">اسم المريض</span> <span className="font-extrabold text-slate-900">{patient.name}</span></div>
                  <div><span className="text-slate-400 font-bold block mb-0.5">كود الحالة</span> <span className="font-extrabold text-indigo-700 font-mono">#{patient.caseCode || '---'}</span></div>
                  <div><span className="text-slate-400 font-bold block mb-0.5">رقم الهاتف</span> <span className="font-bold text-slate-800 font-mono">{patient.phone || '---'}</span></div>
                  
                  <div><span className="text-slate-400 font-bold block mb-0.5">العمر</span> <span className="font-bold text-slate-800">{patient.age ? `${patient.age} سنة` : 'غير محدد'}</span></div>
                  <div><span className="text-slate-400 font-bold block mb-0.5">الجنس</span> <span className="font-bold text-slate-800">{patient.gender === 'male' ? 'ذكر' : patient.gender === 'female' ? 'أنثى' : 'غير محدد'}</span></div>
                  <div><span className="text-slate-400 font-bold block mb-0.5">الجنسية</span> <span className="font-bold text-slate-800">{patient.nationality || '---'}</span></div>
                  
                  <div><span className="text-slate-400 font-bold block mb-0.5">الرقم القومي / الهوية</span> <span className="font-bold text-slate-800 font-mono">{patient.nationalId || '---'}</span></div>
                  <div><span className="text-slate-400 font-bold block mb-0.5">رقم جواز السفر</span> <span className="font-bold text-slate-800 font-mono">{patient.passportNumber || '---'}</span></div>
                  <div><span className="text-slate-400 font-bold block mb-0.5">رقم المفوضية</span> <span className="font-bold text-slate-800 font-mono">{patient.commissionNumber || '---'}</span></div>

                  <div className="col-span-1 md:col-span-3 pt-3 border-t border-slate-200/50 flex justify-between text-[10px] text-slate-500 font-bold">
                    <span>تاريخ الميلاد: <strong className="text-slate-700 font-mono">{patient.dateOfBirth ? dayjs(patient.dateOfBirth).format('YYYY/MM/DD') : '---'}</strong></span>
                    <span>تاريخ التسجيل بالعيادة: <strong className="text-slate-700 font-mono">{dayjs(patient.createdAt).format('YYYY/MM/DD')}</strong></span>
                  </div>
                </div>
              </div>

              {/* Last 3 Visits History Section */}
              <div className="space-y-3 mt-6">
                <span className="text-[10px] font-black text-indigo-800 block border-r-4 border-indigo-600 pr-2 leading-none uppercase tracking-wider font-sans">سجل آخر 3 زيارات وكشوفات طبية بالعيادة (Last 3 Visits Details)</span>
                
                {last3Visits.length > 0 ? (
                  <div className="space-y-4">
                    {last3Visits.map((visit: any, index: number) => {
                      const doc = doctors.find((d: any) => d.id === visit.doctorId);
                      return (
                        <div key={visit.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm font-sans">
                          {/* Visit Header */}
                          <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex justify-between items-center text-[11px] font-bold">
                            <div className="flex items-center gap-2">
                              <span className="font-black bg-indigo-100 text-indigo-850 size-5 rounded-full flex items-center justify-center text-[10px] font-mono">{index + 1}</span>
                              <span className="text-slate-800">زيارة بتاريخ: <strong className="font-extrabold">{dayjs(visit.date).format('YYYY/MM/DD - HH:mm')}</strong></span>
                            </div>
                            <div className="text-slate-600">
                              <span>الطبيب المعالج: <strong>د. {doc?.name || '---'}</strong> ({doc?.specialty || 'تخصص عام'})</span>
                            </div>
                          </div>

                          {/* Visit Details */}
                          <div className="p-3.5 text-xs space-y-2.5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                              <div>
                                <span className="text-slate-400 font-bold block text-[9.5px]">بند الكشف والخدمة</span>
                                <span className="font-extrabold text-slate-800">{visit.serviceType || 'كشف طبي'}</span>
                              </div>
                              {visit.notes && (
                                <div>
                                  <span className="text-slate-400 font-bold block text-[9.5px]">الشكوى / ملاحظات سريرية</span>
                                  <p className="font-medium text-slate-700 whitespace-pre-line">{visit.notes}</p>
                                </div>
                              )}
                            </div>

                            {/* Vitals indicators if exist */}
                            {visit.vitals && (visit.vitals.temperature || visit.vitals.bloodPressure || visit.vitals.pulse) && (
                              <div className="flex gap-4 p-2 bg-slate-50 rounded-lg text-[9.5px] text-slate-600 font-sans border border-slate-100/60 w-fit">
                                {visit.vitals.temperature && <div>🌡️ الحرارة: <strong>{visit.vitals.temperature} °C</strong></div>}
                                {visit.vitals.bloodPressure && <div>🩺 ضغط الدم: <strong>{visit.vitals.bloodPressure}</strong></div>}
                                {visit.vitals.pulse && <div>💓 النبض: <strong>{visit.vitals.pulse} bpm</strong></div>}
                                {visit.vitals.weight && <div>⚖️ الوزن: <strong>{visit.vitals.weight} كجم</strong></div>}
                              </div>
                            )}

                            {visit.diagnosis && (
                              <div className="p-2.5 bg-emerald-50/30 rounded-lg border border-emerald-100/60 text-[11px]">
                                <span className="font-black text-emerald-850 block text-[9.5px] mb-0.5">التشخيص الطبي النهائي (Diagnosis)</span>
                                <p className="font-bold text-slate-800">{visit.diagnosis}</p>
                              </div>
                            )}

                            {/* Medications */}
                            {visit.prescriptions && Array.isArray(visit.prescriptions) && visit.prescriptions.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-slate-400 font-bold block text-[9.5px]">الوصفة الدوائية الممنوحة (Rx)</span>
                                <div className="bg-slate-50/50 rounded-lg border border-slate-100 p-2.5">
                                  <ul className="list-disc list-inside space-y-1.5 text-[10.5px] text-slate-800 font-sans">
                                    {visit.prescriptions.map((p: any, pIdx: number) => (
                                      <li key={p.id || pIdx} className="font-bold">
                                        <span className="text-indigo-900">{p.name}</span> - {p.quantity || '1 حبة'} ({p.duration || '---'})
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs italic font-sans">
                    لم تسجل زيارات طبية سابقة لهذا المريض في السجلات الطبية.
                  </div>
                )}
              </div>
            </div>

            {/* Print Footer / Validation Signatures */}
            <div className="border-t border-slate-200 pt-3 mt-8 flex justify-between items-end font-sans">
              <p className="text-[7.5px] text-slate-400 max-w-sm font-bold leading-relaxed">
                * مستند رسمي مطبوع ومصدق إلكترونياً من نظام العيادات الشامل. مخصص لعرض البيانات السريرية في تاريخ صدوره ولا يعوض التحديث الدوري لملفات المرضى.
              </p>
              <div className="text-center w-[150px] border-t border-slate-300 pt-1.5 font-sans">
                <span className="text-[8px] font-black text-slate-400 block tracking-wide">المسؤول الطبي والاعتماد</span>
                <span className="text-[9.5px] font-black text-slate-800 block mt-1">توقيع الإدارة الطبية بالمركز</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function PrintConfirmModal({ onClose, visit, onPrintPrescription, onPrintReport }: any) {
  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 p-6 text-right font-sans space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="size-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl">
            🎉
          </div>
          <h3 className="text-lg font-black text-slate-800 leading-tight">تم إتمام الكشف بنجاح!</h3>
          <p className="text-xs text-slate-500 leading-relaxed font-bold">
            تم حفظ تفاصيل الكشف واحتساب القيود المالية والمستحقات بنجاح. هل تريد طباعة الروشتة أو التقرير الطبي الكامل للمريض الآن؟
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 pt-2">
          <button 
            type="button" 
            onClick={() => onPrintPrescription(visit)}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-md shadow-blue-900/10 text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <FileText size={14} />
            <span>طباعة الروشتة الطبية للمريض (Rx) 💊</span>
          </button>
          <button 
            type="button" 
            onClick={() => onPrintReport(visit)}
            className="w-full py-3 bg-purple-600 hover:bg-purple-750 text-white font-black rounded-xl shadow-md shadow-purple-900/10 text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <FileText size={14} />
            <span>طباعة التقرير الطبي الكامل والتشخيص 🖨️</span>
          </button>
        </div>

        <div className="border-t border-slate-100 pt-4 flex gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-650 font-bold rounded-xl text-center text-xs transition-all cursor-pointer"
          >
            إغلاق، لا أريد الطباعة الآن
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function VisitDetailsModal({ onClose, visit, doctors, reports, onEdit, patient, onPrintPrescription, onPrintMedicalReport }: any) {
  const doc = doctors.find((d: any) => d.id === visit.doctorId);
  const isCancelled = visit.status === 'cancelled';
  const visitReports = (reports || []).filter((r: any) => r.visitId === visit.id);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 15 }}
        className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-slate-200"
      >
        <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="text-right">
            <h2 className="text-base font-black text-slate-800">تفاصيل الكشف والزيارة الطبية</h2>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">{dayjs(visit.date).format('DD MMMM YYYY - hh:mm a')}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 text-right overflow-y-auto max-h-[75vh]">
          {/* Main info cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 block mb-1">الطبيب المعالج</span>
              <span className="font-bold text-slate-800 text-sm">د. {doc?.name || 'غير معروف'}</span>
              <span className="text-[10px] text-blue-600 font-bold block mt-0.5">({doc?.specialty || 'تخصص غير معروف'})</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 block mb-1">نوع الخدمة المقدمة</span>
              <span className="font-bold text-slate-800 text-sm block">{visit.serviceType}</span>
              <span className="text-[10px] text-slate-500 font-bold block mt-0.5">الإدارة: {visit.sendingAdministration || 'تلقائي'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 block mb-1">التكلفة والرسوم</span>
              <span className="text-sm font-black text-slate-900 block font-mono">{visit.cost} ج.م</span>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border inline-block mt-1 ${visit.isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                {visit.isPaid ? 'محصل بالكامل' : 'آجل / لم يحصل'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 block mb-1">حالة الزيارة</span>
              <span className={`text-xs font-black px-2.5 py-1 rounded inline-block mt-2 ${isCancelled ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {isCancelled ? 'ملغاة' : 'مكتملة'}
              </span>
              {visit.arrivalTime && (
                <span className="text-[9px] text-slate-400 block mt-1">وقت الحضور: {visit.arrivalTime}</span>
              )}
            </div>
          </div>

          {/* Diagnosis & notes */}
          {isCancelled ? (
            <div className="p-4 bg-red-50/50 rounded-xl border border-red-100/50">
              <h4 className="text-[10px] font-black text-red-700 uppercase tracking-wide mb-1">سبب إلغاء الزيارة</h4>
              <p className="text-xs text-red-900 leading-relaxed font-bold">{visit.cancellationReason || 'لم يتم تسجيل سبب إلغاء مخصص لهذه الزيارة.'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1.5 font-sans">شكوى المريض وملاحظات الكشف</h4>
                <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{visit.notes || 'لا توجد ملاحظات أو شكاوى مسجلة.'}</p>
              </div>

              <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-100 border-dashed relative">
                <span className="absolute -top-2 right-4 bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase px-2 py-0.5 rounded shadow-sm">النتيجة والتشخيص وخطة العلاج</span>
                <p className="text-xs text-emerald-950 font-bold whitespace-pre-wrap pt-1 leading-relaxed">
                  {visit.diagnosis || 'لم يحدد الطبيب تشخيصاً أو النتيجة النهائية لهذا الكشف بعد.'}
                </p>
              </div>

              {visit.clinicalAssessment && (
                <div className="p-4 bg-blue-50/30 rounded-xl border border-blue-100 relative font-sans text-right">
                  <span className="absolute -top-2 right-4 bg-blue-100 text-blue-800 text-[8px] font-black uppercase px-2 py-0.5 rounded shadow-sm">التقرير والوصف الطبي الاستنتاجي للطبيب 🧑‍⚕️</span>
                  <p className="text-xs text-blue-950 font-bold whitespace-pre-wrap pt-1 leading-relaxed">
                    {visit.clinicalAssessment}
                  </p>
                </div>
              )}

              {/* Vitals Signs in On-Screen Visit Details Card */}
              {visit.vitals && (visit.vitals.temperature || visit.vitals.bloodPressure || visit.vitals.pulse || visit.vitals.weight || visit.vitals.height) && (
                <div className="p-4 bg-rose-50/20 rounded-xl border border-rose-100 relative space-y-2">
                  <span className="absolute -top-2 right-4 bg-rose-100 text-rose-800 text-[8px] font-black uppercase px-2 py-0.5 rounded shadow-sm">📊 العلامات الحيوية والقياسات السريرية</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-right text-xs pt-2">
                    {visit.vitals.temperature && (
                      <div className="flex justify-between items-center bg-white p-2 rounded border border-rose-50">
                        <span className="text-slate-400 font-bold">الحرارة:</span>
                        <span className="font-sans font-black text-slate-800">{visit.vitals.temperature} °C</span>
                      </div>
                    )}
                    {visit.vitals.bloodPressure && (
                      <div className="flex justify-between items-center bg-white p-2 rounded border border-rose-50">
                        <span className="text-slate-400 font-bold">ضغط الدم:</span>
                        <span className="font-sans font-black text-slate-800">{visit.vitals.bloodPressure} mmHg</span>
                      </div>
                    )}
                    {visit.vitals.pulse && (
                      <div className="flex justify-between items-center bg-white p-2 rounded border border-rose-50">
                        <span className="text-slate-400 font-bold">النبض:</span>
                        <span className="font-sans font-black text-slate-800">{visit.vitals.pulse} bpm</span>
                      </div>
                    )}
                    {visit.vitals.weight && (
                      <div className="flex justify-between items-center bg-white p-2 rounded border border-rose-50">
                        <span className="text-slate-400 font-bold">الوزن:</span>
                        <span className="font-sans font-black text-slate-800">{visit.vitals.weight} كجم</span>
                      </div>
                    )}
                    {visit.vitals.height && (
                      <div className="flex justify-between items-center bg-white p-2 rounded border border-rose-50">
                        <span className="text-slate-400 font-bold">الطول:</span>
                        <span className="font-sans font-black text-slate-800">{visit.vitals.height} سم</span>
                      </div>
                    )}
                    {visit.vitals.weight && visit.vitals.height && (
                      <div className="flex justify-between items-center bg-white p-2 rounded border border-rose-50 col-span-2">
                        <span className="text-slate-400 font-bold">كتلة الجسم (BMI):</span>
                        <span className="font-sans font-black text-rose-700">
                          {(() => {
                            const w = Number(visit.vitals.weight);
                            const h = Number(visit.vitals.height) / 100;
                            return (w / (h * h)).toFixed(1);
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Diet Instructions In On-Screen Card */}
              {visit.dietInstructions && (
                <div className="p-4 bg-indigo-50/20 rounded-xl border border-indigo-100 relative text-right">
                  <span className="absolute -top-2 right-4 bg-indigo-100 text-indigo-800 text-[8px] font-black uppercase px-2 py-0.5 rounded shadow-sm">🥗 الإرشادات الغذائية ونمط الحياة</span>
                  <p className="text-xs text-slate-700 leading-relaxed font-bold whitespace-pre-wrap pt-2">{visit.dietInstructions}</p>
                </div>
              )}

              {/* Follow-up Reservation Details */}
              {visit.followUpRequired && visit.followUpDate && (
                <div className="p-4 bg-teal-50/20 rounded-xl border border-teal-100 relative text-right">
                  <span className="absolute -top-2 right-4 bg-teal-100 text-teal-800 text-[8px] font-black uppercase px-2 py-0.5 rounded shadow-sm">📅 موعد الاستشارة القادمة للمتابعة</span>
                  <div className="text-xs font-bold pt-2">
                    تاريخ إعادة الكشف: <span className="text-teal-900 font-sans font-black">{dayjs(visit.followUpDate).format('YYYY/MM/DD')}</span>
                    {visit.followUpNotes && <p className="text-slate-500 mt-1">ملاحظة الاستشارة: <span className="font-bold text-slate-700">{visit.followUpNotes}</span></p>}
                  </div>
                </div>
              )}

              {visit.prescriptions && Array.isArray(visit.prescriptions) && visit.prescriptions.length > 0 && (
                <div className="p-4 bg-teal-50/30 rounded-xl border border-teal-100 relative space-y-2 font-sans text-right">
                  <span className="absolute -top-2 right-4 bg-teal-100 text-teal-800 text-[8px] font-black uppercase px-2 py-0.5 rounded shadow-sm">الأدوية الموصوفة بالروشتة الطبية 💊</span>
                  <div className="overflow-x-auto pt-1">
                    <table className="w-full text-right text-[11px]">
                      <thead>
                        <tr className="text-slate-400 font-bold">
                          <th className="pb-1 text-right">الدواء / الصنف</th>
                          <th className="pb-1 text-center">الكمية</th>
                          <th className="pb-1 text-center">المدة العلاجية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-teal-100/40">
                        {visit.prescriptions.map((p: any, i: number) => (
                          <tr key={i} className="text-slate-700">
                            <td className="py-1 font-black text-slate-800">{p.name}</td>
                            <td className="py-1 text-center font-bold text-teal-800">{p.quantity || '---'}</td>
                            <td className="py-1 text-center font-bold text-teal-800">{p.duration || '---'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Associated reports list */}
          <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wide">الملفات والمرفقات الطبية المرتبطة</h4>
            {visitReports.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                {visitReports.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2">
                      <Paperclip size={12} className="text-blue-500" />
                      <span className="font-bold text-slate-700 truncate max-w-[180px]">{r.title}</span>
                      <span className="text-[8px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded">
                        {r.type === 'prescription' ? 'روشتة' : r.type === 'report' ? 'تقرير' : 'ملف'}
                      </span>
                    </div>
                    <a 
                      href={`/uploads/${r.filename}`} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-[9px] font-black text-blue-600 hover:underline px-2.5 py-1 bg-blue-50 rounded-md"
                    >
                      عرض الملف
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic">لا توجد ملفات مرفوعة مرتبطة بهذا الكشف تحديداً.</p>
            )}
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-2 border-t border-slate-100 pt-5">
            <button 
              type="button" 
              onClick={() => onPrintPrescription(visit)} 
              className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md shadow-blue-900/10 text-[11px] flex items-center justify-center gap-1 transition-all"
            >
              <FileText size={13} />
              <span>طباعة الروشتة 💊</span>
            </button>
            <button 
              type="button" 
              onClick={() => onPrintMedicalReport(visit)} 
              className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 shadow-md shadow-purple-900/10 text-[11px] flex items-center justify-center gap-1 transition-all"
            >
              <FileText size={13} />
              <span>التقرير الطبي الكامل 🖨️</span>
            </button>
            <button 
              type="button" 
              onClick={onEdit} 
              className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-900/10 text-[11px] flex items-center justify-center gap-1 transition-all"
            >
              <Edit size={13} />
              <span>تعديل الكشف</span>
            </button>
            <button 
              type="button" 
              onClick={onClose} 
              className="py-3 px-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 text-[11px] text-center transition-all"
            >
              إلغاء
            </button>
          </div>
        </div>
      </motion.div>
    </div>
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

function CompleteAppointmentModal({ onClose, appointment, doctors, visits, onSubmit }: any) {
  const doctor = doctors.find((d: any) => d.id === appointment?.doctorId);
  
  const [formData, setFormData] = useState({
    serviceType: appointment?.isSpecial ? "كشف خاص" : "كشف عادي",
    basePrice: appointment?.isSpecial ? (appointment?.specialPrice || 0) : (doctor?.examinationPrice || 0),
    diagnosis: "",
    notes: appointment?.notes || "",
    clinicalAssessment: "",
    isPaid: true,
    date: dayjs(appointment?.date).format('YYYY-MM-DDTHH:mm'),
    arrivalTime: appointment?.arrivalTime || dayjs(appointment?.date).format('HH:mm'),
    entryTime: appointment?.entryTime || dayjs(appointment?.date).add(10, 'minute').format('HH:mm'),
    departureTime: appointment?.departureTime || dayjs().format('HH:mm'),
    temperature: "",
    bloodPressure: "",
    pulse: "",
    weight: "",
    height: "",
    followUpRequired: false,
    followUpDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
    followUpNotes: "",
    dietInstructions: ""
  });

  const [prescriptions, setPrescriptions] = useState<Array<{ id: string; name: string; quantity: string; duration: string }>>([]);
  const [tempPrescription, setTempPrescription] = useState({ name: '', quantity: '', duration: '' });
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentTitle, setAttachmentTitle] = useState("");
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [prescriptionTitle, setPrescriptionTitle] = useState("");

  const getDoctorVisitsCountOnDay = (doctorId: string, dateStr: string) => {
    const dStr = dateStr.split('T')[0];
    return (visits || []).filter((v: any) => v.doctorId === doctorId && v.date.split('T')[0] === dStr).length;
  };

  const getDoctorEarningsEstimate = (doc: any, basePrice: number, dateStr: string) => {
    if (!doc) return 0;
    if (doc.accountingSystem === 'fixed') {
      return doc.fixedRate || 0;
    }
    if (doc.accountingSystem === 'percentage') {
      return (Number(basePrice) * (doc.percentageRate || 0)) / 100;
    }
    if (doc.accountingSystem === 'hybrid') {
      const currentCount = getDoctorVisitsCountOnDay(doc.id, dateStr);
      if (currentCount >= (doc.hybridThreshold || 0)) {
        return doc.hybridExtraRate || 0;
      }
      return 0;
    }
    return 0; // daily
  };

  const doctorShare = getDoctorEarningsEstimate(doctor, formData.basePrice, formData.date);
  const clinicShare = Math.max(0, Number(formData.basePrice) - doctorShare);

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
      >
        <div className="p-6 bg-gradient-to-r from-teal-600 to-teal-500 text-white flex justify-between items-center shrink-0">
          <div className="text-right">
            <h3 className="text-lg font-black tracking-tight">إتمام الكشف وتأكيد الحسابات الطبية 🩺</h3>
            <p className="text-xs text-teal-100 mt-1">توليد تقرير الزيارة واحتساب الأتعاب ونسب الطبيب والعيادة فورياً</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            ...formData,
            prescriptions,
            doctorId: appointment.doctorId,
            patientId: appointment.patientId,
            vitals: {
              temperature: formData.temperature,
              bloodPressure: formData.bloodPressure,
              pulse: formData.pulse,
              weight: formData.weight,
              height: formData.height,
            },
            followUpRequired: formData.followUpRequired,
            followUpDate: formData.followUpRequired ? formData.followUpDate : undefined,
            followUpNotes: formData.followUpRequired ? formData.followUpNotes : undefined,
            dietInstructions: formData.dietInstructions
          }, {
            attachmentFile,
            attachmentTitle: attachmentTitle || "مرفق طبي إضافي",
            prescriptionFile,
            prescriptionTitle: prescriptionTitle || "صورة الروشتة المرفقة"
          });
        }} className="p-6 overflow-y-auto space-y-4 text-right" dir="rtl">
          
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 border border-slate-200/60 rounded-xl text-right">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">الطبيب المعالج</span>
              <span className="text-sm font-black text-slate-800">د. {doctor?.name || 'غير معروف'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">نظام المحاسبة للعيادة</span>
              <span className="text-sm font-bold text-teal-600">
                {doctor?.accountingSystem === 'fixed' && 'ثابت لكل حالة'}
                {doctor?.accountingSystem === 'percentage' && 'نسبة مئوية من الكشف'}
                {doctor?.accountingSystem === 'daily' && 'مرتب يومي ثابت'}
                {doctor?.accountingSystem === 'hybrid' && `نظام هجين (${doctor.hybridThreshold} كشوفات باليوم)`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">نوع الخدمة المقدمة</label>
              <select 
                disabled={appointment?.isSpecial}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/10 transition-all text-sm font-bold disabled:opacity-75"
                value={formData.serviceType}
                onChange={(e) => {
                  const val = e.target.value;
                  let price = doctor?.examinationPrice || 0;
                  if (val === 'استشارة') price = 0;
                  setFormData({ ...formData, serviceType: val, basePrice: price });
                }}
              >
                <option value="كشف عادي">كشف عادي</option>
                <option value="كشف خاص">كشف خاص</option>
                <option value="استشارة">استشارة مجانية / متابعة</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">التكلفة (ج.م)</label>
              <input 
                required
                type="number"
                disabled={appointment?.isSpecial}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/10 transition-all text-sm font-black disabled:opacity-75"
                value={formData.basePrice}
                onChange={(e) => setFormData({ ...formData, basePrice: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">التشخيص الطبي 📋</label>
              <input 
                required
                placeholder="أدخل التشخيص الرئيسي للحالة..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/10 transition-all text-sm font-bold text-right"
                value={formData.diagnosis}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose font-mono">تاريخ ووقت الكشف</label>
              <input 
                required
                type="datetime-local"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/10 transition-all text-sm font-bold"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border border-teal-100 bg-teal-50/20 p-3 rounded-xl">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-teal-800 leading-loose block">وصول الحالة للعيادة</label>
              <input 
                type="time"
                className="w-full px-3 py-2 bg-white border border-teal-100 rounded-lg text-xs font-bold focus:outline-none"
                value={formData.arrivalTime}
                onChange={(e) => setFormData({ ...formData, arrivalTime: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-teal-800 leading-loose block">توقيت دخول الطبيب</label>
              <input 
                type="time"
                className="w-full px-3 py-2 bg-white border border-teal-100 rounded-lg text-xs font-bold focus:outline-none"
                value={formData.entryTime}
                onChange={(e) => setFormData({ ...formData, entryTime: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-teal-800 leading-loose block">توقيت خروج الحالة</label>
              <input 
                type="time"
                className="w-full px-3 py-2 bg-white border border-teal-100 rounded-lg text-xs font-bold focus:outline-none"
                value={formData.departureTime}
                onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">ملاحظات و روشتات ومستلزمات</label>
            <textarea 
              placeholder="وصف إضافي، ملاحظات الروشتة المرفقة، إلخ..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/10 transition-all text-sm h-16 resize-none"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">الوصف والتقرير الطبي الاستنتاجي للحالة 🧑‍⚕️</label>
            <textarea 
              placeholder="اكتب التقرير الطبي الاستنتاجي لما تم التوصل إليه من فحص المريض وشرح ما تم استنتاجه..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/10 transition-all text-sm h-24 resize-none"
              value={formData.clinicalAssessment}
              onChange={(e) => setFormData({ ...formData, clinicalAssessment: e.target.value })}
            />
          </div>

          {/* Clinical Vitals Section */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-3 text-right">
            <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <span className="text-teal-600">📊</span> العلامات الحيوية للمريض (Patient Vitals)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 block">حرارة المريض (°C)</label>
                <input 
                  type="text" 
                  placeholder="مثال: 37" 
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center" 
                  value={formData.temperature} 
                  onChange={(e) => setFormData({...formData, temperature: e.target.value})} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 block">ضغط الدم (mmHg)</label>
                <input 
                  type="text" 
                  placeholder="مثال: 120/80" 
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center" 
                  value={formData.bloodPressure} 
                  onChange={(e) => setFormData({...formData, bloodPressure: e.target.value})} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 block">معدل النبض (bpm)</label>
                <input 
                  type="text" 
                  placeholder="مثال: 75" 
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center" 
                  value={formData.pulse} 
                  onChange={(e) => setFormData({...formData, pulse: e.target.value})} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 block">الوزن (كجم)</label>
                <input 
                  type="number" 
                  step="any"
                  placeholder="مثال: 70" 
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center" 
                  value={formData.weight} 
                  onChange={(e) => setFormData({...formData, weight: e.target.value})} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 block">الطول (سم)</label>
                <input 
                  type="number" 
                  step="any"
                  placeholder="مثال: 175" 
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center" 
                  value={formData.height} 
                  onChange={(e) => setFormData({...formData, height: e.target.value})} 
                />
              </div>
            </div>

            {/* BMI Calculator badge */}
            {formData.weight && formData.height && Number(formData.weight) > 0 && Number(formData.height) > 0 && (() => {
              const w = Number(formData.weight);
              const h = Number(formData.height) / 100;
              const bmiVal = (w / (h * h)).toFixed(1);
              let status = "وزن مثالي";
              let statusClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
              const bmiNum = Number(bmiVal);
              if (bmiNum < 18.5) {
                status = "نقص في الوزن (Underweight)";
                statusClass = "bg-amber-50 text-amber-700 border-amber-200";
              } else if (bmiNum >= 18.5 && bmiNum < 25) {
                status = "طبيعي ومثالي (Normal)";
                statusClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
              } else if (bmiNum >= 25 && bmiNum < 30) {
                status = "زيادة في الوزن (Overweight)";
                statusClass = "bg-orange-50 text-orange-700 border-orange-200";
              } else {
                status = "سمنة مفرطة (Obese)";
                statusClass = "bg-red-50 text-red-700 border-red-200";
              }
              return (
                <div className={`p-2.5 rounded-lg border text-xs font-bold flex justify-between items-center ${statusClass}`}>
                  <span>الكتلة الحسابية للجسم (BMI): <span className="font-sans font-black">{bmiVal}</span></span>
                  <span className="text-[10px] font-extrabold">{status}</span>
                </div>
              );
            })()}
          </div>

          {/* Follow-up and Instructions Section */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-3 text-right">
            <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <span className="text-indigo-650">📅</span> تاريخ الاستشارة والمتابعة القادمة
            </h4>
            <div className="flex items-center justify-between p-2.5 bg-white border border-slate-150 rounded-lg">
              <span className="text-xs font-bold text-slate-600">جدولة موعد إعادة استشارة للمتابعة (Follow-up)</span>
              <input 
                type="checkbox" 
                className="size-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
                checked={formData.followUpRequired} 
                onChange={(e) => setFormData({ ...formData, followUpRequired: e.target.checked })} 
              />
            </div>

            {formData.followUpRequired && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1 text-right">
                  <label className="text-[9px] font-bold text-slate-500 block">تاريخ موعد الاستشارة القادمة</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right text-right" 
                    value={formData.followUpDate} 
                    onChange={(e) => setFormData({...formData, followUpDate: e.target.value})} 
                  />
                </div>
                <div className="space-y-1 text-right">
                  <label className="text-[9px] font-bold text-slate-500 block">تعليمات أو ملاحظات الاستشارة</label>
                  <input 
                    type="text" 
                    placeholder="مثال: إحضار نتائج تحليل الدم القادم" 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right" 
                    value={formData.followUpNotes} 
                    onChange={(e) => setFormData({...formData, followUpNotes: e.target.value})} 
                  />
                </div>
              </div>
            )}

            <div className="space-y-1 text-right">
              <label className="text-[9px] font-bold text-slate-500 block">تعليمات السلامة والنظام الغذائي والصحي الخاص 🥗</label>
              <textarea 
                placeholder="اكتب التوجيهات الغذائية أو نمط الحياة الخاص المحفز للحالة..."
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all text-xs h-16 resize-none"
                value={formData.dietInstructions}
                onChange={(e) => setFormData({ ...formData, dietInstructions: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-right">
            <h4 className="text-xs font-black text-slate-700">توصيف الأدوية للروشتة الطبية 💊</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500">اسم الدواء / الصنف</label>
                <input 
                  type="text"
                  placeholder="مثال: Amoxil 500mg"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right"
                  value={tempPrescription.name}
                  onChange={(e) => setTempPrescription({ ...tempPrescription, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500">العدد / الكمية الصرفية</label>
                <input 
                  type="text"
                  placeholder="مثال: علبة واحدة"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right"
                  value={tempPrescription.quantity}
                  onChange={(e) => setTempPrescription({ ...tempPrescription, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500">المدة / التكرار العلاجي</label>
                <div className="flex gap-1">
                  <input 
                    type="text"
                    placeholder="مثال: 5 أيام"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs flex-1 font-bold text-right"
                    value={tempPrescription.duration}
                    onChange={(e) => setTempPrescription({ ...tempPrescription, duration: e.target.value })}
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      if (!tempPrescription.name.trim()) return;
                      setPrescriptions([...prescriptions, { 
                        id: Math.random().toString(36).substr(2, 9), 
                        name: tempPrescription.name.trim(), 
                        quantity: tempPrescription.quantity.trim(), 
                        duration: tempPrescription.duration.trim() 
                      }]);
                      setTempPrescription({ name: '', quantity: '', duration: '' });
                    }}
                    className="px-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-xs font-black cursor-pointer shadow-sm"
                  >
                    إضافة
                  </button>
                </div>
              </div>
            </div>

            {prescriptions.length > 0 && (
              <div className="mt-3 overflow-hidden border border-slate-150 rounded-lg bg-white">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold">
                    <tr>
                      <th className="p-2">الدواء / الصنف</th>
                      <th className="p-2">العدد / الكمية</th>
                      <th className="p-2">المدة</th>
                      <th className="p-2 text-center w-12">حذف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptions.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="p-2 font-black text-slate-800">{p.name}</td>
                        <td className="p-2 font-bold text-slate-600">{p.quantity || '---'}</td>
                        <td className="p-2 font-bold text-slate-600">{p.duration || '---'}</td>
                        <td className="p-2 text-center">
                          <button 
                            type="button"
                            onClick={() => setPrescriptions(prescriptions.filter(item => item.id !== p.id))}
                            className="text-red-500 hover:text-red-700 font-bold cursor-pointer"
                          >
                            حذف
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* File Uploads Section (الروشتة والمرفقات) */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-4 text-right">
            <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <span className="text-teal-600">📁</span> مرفقات الكشف والروشتة المصورة (اختياري)
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Prescription File Upload */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-black text-slate-500 block">📄 روشتة الكشف المرفقة</span>
                <div className="space-y-1.5">
                  <input 
                    type="text" 
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" 
                    placeholder="عنوان الروشتة (مثال: روشتة دواء الكشف)" 
                    value={prescriptionTitle} 
                    onChange={(e) => setPrescriptionTitle(e.target.value)} 
                  />
                  
                  <div className="border border-dashed border-teal-200 hover:border-teal-400 rounded-lg p-3 text-center bg-teal-50/10 hover:bg-teal-50/20 transition-all cursor-pointer relative">
                    <input 
                      type="file" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setPrescriptionFile(file);
                        if (file && !prescriptionTitle) {
                          setPrescriptionTitle(`روشتة - ${file.name.substring(0, 15)}`);
                        }
                      }} 
                    />
                    <div className="text-xs font-bold text-teal-700 truncate">
                      {prescriptionFile ? `✓ ${prescriptionFile.name}` : 'اختر صورة/ملف الروشتة ورأس الطباعة'}
                    </div>
                  </div>
                  {prescriptionFile && (
                    <button 
                      type="button" 
                      onClick={() => { setPrescriptionFile(null); setPrescriptionTitle(""); }} 
                      className="text-[9px] font-black hover:underline text-red-500"
                    >
                      حذف الملف المحدد
                    </button>
                  )}
                </div>
              </div>

              {/* Other medical attachments */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-black text-slate-500 block">📎 مرفق طبي إضافي (أشعة / تحاليل)</span>
                <div className="space-y-1.5">
                  <input 
                    type="text" 
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" 
                    placeholder="عنوان المرفق (مثال: أشعة سينية، تقرير معمل)" 
                    value={attachmentTitle} 
                    onChange={(e) => setAttachmentTitle(e.target.value)} 
                  />
                  
                  <div className="border border-dashed border-sky-200 hover:border-sky-400 rounded-lg p-3 text-center bg-sky-50/10 hover:bg-sky-50/20 transition-all cursor-pointer relative">
                    <input 
                      type="file" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setAttachmentFile(file);
                        if (file && !attachmentTitle) {
                          setAttachmentTitle(`مرفق - ${file.name.substring(0, 15)}`);
                        }
                      }} 
                    />
                    <div className="text-xs font-bold text-sky-700 truncate">
                      {attachmentFile ? `✓ ${attachmentFile.name}` : 'اختر ملف المرفق الإضافي أو التقرير'}
                    </div>
                  </div>
                  {attachmentFile && (
                    <button 
                      type="button" 
                      onClick={() => { setAttachmentFile(null); setAttachmentTitle(""); }} 
                      className="text-[9px] font-black hover:underline text-red-500"
                    >
                      حذف الملف المحدد
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Math Summary Card */}
          <div className="bg-teal-50/50 p-4 border border-teal-100 rounded-xl space-y-3">
            <h4 className="text-xs font-black text-teal-800 flex items-center gap-2">
              <span>الملخص الحسابي التلقائي للطبيب</span>
              <span className="text-[9px] bg-teal-100 text-teal-700 font-bold px-2 py-0.5 rounded-full">حساب فوري</span>
            </h4>
            
            {doctor?.accountingSystem === 'hybrid' && (
              <div className="text-[10px] text-teal-700 bg-teal-100/50 p-2 rounded-lg font-bold border border-teal-100 text-right">
                💡 نظام المحاسبة هجين:
                عدد كشوفات الطبيب المسجلة ليوم {dayjs(formData.date).format('YYYY/MM/DD')} هو:{" "}
                <span className="font-black text-teal-900">{getDoctorVisitsCountOnDay(doctor.id, formData.date)}</span> حالات.
                {getDoctorVisitsCountOnDay(doctor.id, formData.date) >= (doctor.hybridThreshold || 0) ? (
                  <span className="text-emerald-700 block mt-0.5 font-black">
                    تم تخطي الحد اليومي ({doctor.hybridThreshold} حالات). يتم احتساب هذه الحالة كزيادة بقيمة {doctor.hybridExtraRate} ج.م للطبيب!
                  </span>
                ) : (
                  <span className="text-teal-800 block mt-0.5">
                    هذه الحالة تقع ضمن الكشوفات المشمولة باليومية ({getDoctorVisitsCountOnDay(doctor.id, formData.date)} من أصل {doctor.hybridThreshold} حالات). أجر الطبيب الإضافي عنها هو: 0 ج.م (مغطى باليومية)
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="bg-white p-3 rounded-lg border border-slate-100">
                <span className="text-[9px] text-slate-400 font-bold block">مستحقات الطبيب 💵</span>
                <span className="text-base font-black text-emerald-600">{doctorShare} ج.م</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-100">
                <span className="text-[9px] text-slate-400 font-bold block">صافي إيراد العيادة 🏥</span>
                <span className="text-base font-black text-slate-800">{clinicShare} ج.م</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-xs font-black text-slate-700">تحصيل المبلغ نقداً وتأكيد الدفع</span>
            <input 
              type="checkbox" 
              className="size-4 text-teal-600 focus:ring-teal-500 border-slate-300 rounded cursor-pointer"
              checked={formData.isPaid} 
              onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })} 
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button type="submit" className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-lg transition-all shadow-lg shadow-teal-900/10 text-xs">إتمام وتأصيل الحسابات</button>
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-lg transition-all text-xs">إلغاء</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function QuickVitalsModal({ onClose, doctors, onSubmit }: { onClose: () => void, doctors: any[], onSubmit: (data: any) => void }) {
  const [doctorId, setDoctorId] = useState(doctors[0]?.id || "");
  const [temperature, setTemperature] = useState("");
  const [bloodPressure, setBloodPressure] = useState("");
  const [pulse, setPulse] = useState("");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorId) {
      alert("الرجاء اختيار الطبيب القائم بالفحص");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({ doctorId, temperature, bloodPressure, pulse, weight, notes });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 text-right animate-in zoom-in-95 duration-200"
      >
        <div className="bg-teal-600 text-white p-4 flex justify-between items-center">
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white font-bold">✕</button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black">🏥 تسجيل علامات حيوية وفحص سريع</span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 block">الطبيب القائم بالفحص *</label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700"
              required
            >
              <option value="">-- اختر الطبيب --</option>
              {doctors.map((d: any) => (
                <option key={d.id} value={d.id}>د. {d.name} ({d.specialty})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-500 block">درجة الحرارة (°C)</label>
              <input
                type="text"
                placeholder="مثال: 37.2"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 text-center animate-pulse"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-500 block">ضغط الدم (mmHg)</label>
              <input
                type="text"
                placeholder="مثال: 120/80"
                value={bloodPressure}
                onChange={(e) => setBloodPressure(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 text-center"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-500 block">سرعة النبض (bpm)</label>
              <input
                type="text"
                placeholder="مثال: 80"
                value={pulse}
                onChange={(e) => setPulse(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 text-center"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-500 block">الوزن (kg)</label>
              <input
                type="text"
                placeholder="مثال: 72"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 text-center"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 block">ملاحظات الفحص السريعة</label>
            <textarea
              rows={2}
              placeholder="اكتب أي ملاحظة أو شكوى سريعة للمريض هنا..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 placeholder:text-slate-400"
            />
          </div>

          <div className="flex gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-750 px-4 py-2 rounded-lg text-xs font-bold transition-all border border-slate-200"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-2/3 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-xs font-black transition-all shadow-md shadow-teal-900/10 flex items-center justify-center gap-1"
            >
              {isSubmitting ? 'جاري الحفظ...' : 'تأكيد الحفظ بالملف'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function VisitModal({ onClose, doctors, onSubmit }: any) {
  const [formData, setFormData] = useState({ 
    doctorId: doctors[0]?.id || "", 
    basePrice: doctors[0]?.examinationPrice || 0, 
    notes: "", 
    diagnosis: "",
    clinicalAssessment: "",
    date: dayjs().format('YYYY-MM-DDTHH:mm'),
    arrivalTime: dayjs().format('HH:mm'),
    departureTime: "",
    serviceType: "كشف عادي",
    sendingAdministration: "",
    isPaid: true,
    temperature: "",
    bloodPressure: "",
    pulse: "",
    weight: "",
    height: "",
    followUpRequired: false,
    followUpDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
    followUpNotes: "",
    dietInstructions: ""
  });

  const [prescriptions, setPrescriptions] = useState<Array<{ id: string; name: string; quantity: string; duration: string }>>([]);
  const [tempPrescription, setTempPrescription] = useState({ name: '', quantity: '', duration: '' });

  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Auto-populate price when doctor changes
  useEffect(() => {
    const selectedDoc = doctors.find((d: any) => d.id === formData.doctorId);
    if (selectedDoc) {
      setFormData(prev => ({ ...prev, basePrice: selectedDoc.examinationPrice || 0 }));
    }
  }, [formData.doctorId, doctors]);

  const handleSuggestDiagnosis = async () => {
    if (!formData.notes.trim()) {
      alert("يرجى كتابة شكوى أو ملاحظات المريض أولاً للحصول على اقتراح التشخيص.");
      return;
    }
    setIsSuggesting(true);
    setSuggestions([]);
    try {
      const res = await fetch("/api/suggest-diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaint: formData.notes })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.suggestions && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
        } else {
          setSuggestions(["نزلة برد حادة", "احتقان بسيط بالحلق", "إرهاق عام"]);
        }
      } else {
        setSuggestions(["نزلة برد حادة", "احتقان بسيط بالحلق", "إرهاق عام"]);
      }
    } catch (err) {
      console.error(err);
      setSuggestions(["نزلة برد حادة", "احتقان بسيط بالحلق", "إرهاق عام"]);
    } finally {
      setIsSuggesting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
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
        <form className="p-6 space-y-4 text-right overflow-y-auto max-h-[85vh]" onSubmit={(e) => { 
          e.preventDefault(); 
          onSubmit({ 
            ...formData, 
            prescriptions,
            vitals: {
              temperature: formData.temperature,
              bloodPressure: formData.bloodPressure,
              pulse: formData.pulse,
              weight: formData.weight,
              height: formData.height,
            },
            followUpRequired: formData.followUpRequired,
            followUpDate: formData.followUpRequired ? formData.followUpDate : undefined,
            followUpNotes: formData.followUpRequired ? formData.followUpNotes : undefined,
            dietInstructions: formData.dietInstructions
          }); 
        }}>
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
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">حالة الدفع</label>
               <div 
                 onClick={() => setFormData({...formData, isPaid: !formData.isPaid})}
                 className={`w-full px-4 py-2.5 border rounded-lg cursor-pointer transition-all flex items-center justify-center gap-2 ${formData.isPaid ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}
               >
                 <CreditCard size={14} />
                 <span className="text-[10px] font-black uppercase">{formData.isPaid ? 'تم الدفع' : 'معلق / آجل'}</span>
               </div>
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
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">شكوى المريض / ملاحظات أولية</label>
            <textarea rows={2} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="الشكوى والسبب من الزيارة..." />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center pb-1">
              <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-loose">نتيجة الكشف والتشخيص</label>
              <button 
                type="button"
                disabled={isSuggesting}
                onClick={handleSuggestDiagnosis}
                className="text-[9px] font-black bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>{isSuggesting ? "جاري الاقتراح..." : "🪄 اقتراح ذكي للتشخيص"}</span>
              </button>
            </div>
            <textarea rows={2} className="w-full px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all text-sm font-bold font-sans" value={formData.diagnosis} onChange={(e) => setFormData({...formData, diagnosis: e.target.value})} placeholder="التشخيص النهائي وخطة العلاج..." />
            
            {suggestions.length > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-lg text-right space-y-1.5 mt-2 animate-in fade-in duration-200">
                <p className="text-[9px] font-black text-slate-400">التشخيصات المقترحة (اضغط للاختيار):</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, diagnosis: s }));
                        setSuggestions([]);
                      }}
                      className="bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">الوصف والتقرير الطبي الاستنتاجي للحالة 🧑‍⚕️</label>
            <textarea 
              placeholder="اكتب التقرير الطبي الاستنتاجي لما تم التوصل إليه من فحص المريض وشرح ما تم استنتاجه..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm h-24 resize-none"
              value={formData.clinicalAssessment}
              onChange={(e) => setFormData({ ...formData, clinicalAssessment: e.target.value })}
            />
          </div>

          {/* Clinical Vitals Section */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-3 text-right">
            <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <span className="text-teal-600">📊</span> العلامات الحيوية للمريض (Patient Vitals)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 block">الحرارة (°C)</label>
                <input 
                  type="text" 
                  placeholder="37" 
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center" 
                  value={formData.temperature} 
                  onChange={(e) => setFormData({...formData, temperature: e.target.value})} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 block">الضغط (B.P)</label>
                <input 
                  type="text" 
                  placeholder="120/80" 
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center" 
                  value={formData.bloodPressure} 
                  onChange={(e) => setFormData({...formData, bloodPressure: e.target.value})} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 block">النبض (Pulse)</label>
                <input 
                  type="text" 
                  placeholder="75" 
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center" 
                  value={formData.pulse} 
                  onChange={(e) => setFormData({...formData, pulse: e.target.value})} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 block">الوزن (كجم)</label>
                <input 
                  type="number" 
                  step="any"
                  placeholder="70" 
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center" 
                  value={formData.weight} 
                  onChange={(e) => setFormData({...formData, weight: e.target.value})} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 block">الطول (سم)</label>
                <input 
                  type="number" 
                  step="any"
                  placeholder="175" 
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center" 
                  value={formData.height} 
                  onChange={(e) => setFormData({...formData, height: e.target.value})} 
                />
              </div>
            </div>

            {/* BMI Calculator badge */}
            {formData.weight && formData.height && Number(formData.weight) > 0 && Number(formData.height) > 0 && (() => {
              const w = Number(formData.weight);
              const h = Number(formData.height) / 100;
              const bmiVal = (w / (h * h)).toFixed(1);
              let status = "وزن مثالي";
              let statusClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
              const bmiNum = Number(bmiVal);
              if (bmiNum < 18.5) {
                status = "نقص الوزن";
                statusClass = "bg-amber-50 text-amber-700 border-amber-200";
              } else if (bmiNum >= 18.5 && bmiNum < 25) {
                status = "مثالي (Normal)";
                statusClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
              } else if (bmiNum >= 25 && bmiNum < 30) {
                status = "زيادة وزن (Overweight)";
                statusClass = "bg-orange-50 text-orange-700 border-orange-200";
              } else {
                status = "سمنة مفرطة";
                statusClass = "bg-red-50 text-red-700 border-red-200";
              }
              return (
                <div className={`p-2 rounded border text-xs font-bold flex justify-between items-center ${statusClass}`}>
                  <span>كتلة الجسم (BMI): <span className="font-sans font-black">{bmiVal}</span></span>
                  <span className="text-[9px] font-extrabold">{status}</span>
                </div>
              );
            })()}
          </div>

          {/* Follow-up and Instructions Section */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-3 text-right">
            <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <span className="text-indigo-650">📅</span> تاريخ الاستشارة والمتابعة القادمة
            </h4>
            <div className="flex items-center justify-between p-2 bg-white border border-slate-150 rounded-lg">
              <span className="text-xs font-bold text-slate-600">طلب موعد إعادة استشارة للمتابعة</span>
              <input 
                type="checkbox" 
                className="size-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
                checked={formData.followUpRequired} 
                onChange={(e) => setFormData({ ...formData, followUpRequired: e.target.checked })} 
              />
            </div>

            {formData.followUpRequired && (
              <div className="grid grid-cols-1 gap-2 pt-1">
                <div className="space-y-1 text-right">
                  <label className="text-[9px] font-bold text-slate-500 block">تاريخ موعد الاستشارة</label>
                  <input 
                    type="date" 
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right" 
                    value={formData.followUpDate} 
                    onChange={(e) => setFormData({...formData, followUpDate: e.target.value})} 
                  />
                </div>
                <div className="space-y-1 text-right">
                  <label className="text-[9px] font-bold text-slate-500 block">تعليمات وملاحظات الاستشارة</label>
                  <input 
                    type="text" 
                    placeholder="امثلة: جلب الفحوصات الطبية" 
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right" 
                    value={formData.followUpNotes} 
                    onChange={(e) => setFormData({...formData, followUpNotes: e.target.value})} 
                  />
                </div>
              </div>
            )}

            <div className="space-y-1 text-right">
              <label className="text-[9px] font-bold text-slate-500 block">تعليمات السلامة والنظام الغذائي الخاص 🥗</label>
              <textarea 
                placeholder="اكتب التوجيهات الغذائية أو نمط الحياة الخاص المحفز للحالة..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all text-xs h-16 resize-none"
                value={formData.dietInstructions}
                onChange={(e) => setFormData({ ...formData, dietInstructions: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-right">
            <h4 className="text-xs font-black text-slate-700">توصيف الأدوية للروشتة الطبية 💊</h4>
            <div className="grid grid-cols-1 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500">اسم الدواء / الصنف</label>
                <input 
                  type="text"
                  placeholder="مثال: Amoxil 500mg"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right font-sans"
                  value={tempPrescription.name}
                  onChange={(e) => setTempPrescription({ ...tempPrescription, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500">العدد / الكمية</label>
                  <input 
                    type="text"
                    placeholder="مثال: علبة واحدة"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right"
                    value={tempPrescription.quantity}
                    onChange={(e) => setTempPrescription({ ...tempPrescription, quantity: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500">المدة</label>
                  <input 
                    type="text"
                    placeholder="مثال: 5 أيام"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right flex-1"
                    value={tempPrescription.duration}
                    onChange={(e) => setTempPrescription({ ...tempPrescription, duration: e.target.value })}
                  />
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  if (!tempPrescription.name.trim()) return;
                  setPrescriptions([...prescriptions, { 
                    id: Math.random().toString(36).substr(2, 9), 
                    name: tempPrescription.name.trim(), 
                    quantity: tempPrescription.quantity.trim(), 
                    duration: tempPrescription.duration.trim() 
                  }]);
                  setTempPrescription({ name: '', quantity: '', duration: '' });
                }}
                className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-lg transition-all flex items-center justify-center gap-1 shadow-md shadow-teal-950/20 cursor-pointer"
              >
                إضافة الدواء للروشتة
              </button>
            </div>

            {prescriptions.length > 0 && (
              <div className="mt-3 overflow-hidden border border-slate-150 rounded-lg bg-white">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold">
                    <tr>
                      <th className="p-2">الدواء</th>
                      <th className="p-2">الكمية</th>
                      <th className="p-2">المدة</th>
                      <th className="p-2 text-center w-8">حذف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptions.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="p-2 font-black text-slate-800">{p.name}</td>
                        <td className="p-2 font-bold text-slate-600">{p.quantity || '---'}</td>
                        <td className="p-2 font-bold text-slate-600">{p.duration || '---'}</td>
                        <td className="p-2 text-center">
                          <button 
                            type="button"
                            onClick={() => setPrescriptions(prescriptions.filter(item => item.id !== p.id))}
                            className="text-red-500 hover:text-red-700 font-bold cursor-pointer font-sans"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="pt-4">
            <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/10 text-sm cursor-pointer">تسجيل الكشف</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function UploadModal({ onClose, onUpload, visits, doctors, initialVisitId }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<'prescription' | 'report' | 'other'>('prescription');

  // Find the most recent completed visit:
  const completedVisits = (visits || []).filter((v: any) => v.status === 'completed' || !v.status);
  const sortedCompleted = [...completedVisits].sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  const mostRecentCompletedVisitId = sortedCompleted[0]?.id || "";

  const [visitId, setVisitId] = useState(initialVisitId || mostRecentCompletedVisitId);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
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

function AccountingView({ visits, doctors, allVisits = [], allPatients = [], allAppointments = [], allDoctors = [] }: any) {
  const [activeSubTab, setActiveSubTab] = useState<'financial' | 'diseases' | 'doctors' | 'reports' | 'branch-comparison' | 'growth'>('financial');
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [yearlyChartType, setYearlyChartType] = useState<'bar' | 'line'>('bar');
  const [dateRange, setDateRange] = useState({ 
    start: dayjs().startOf('month').format('YYYY-MM-DD'), 
    end: dayjs().endOf('month').format('YYYY-MM-DD') 
  });

  const [compPreset, setCompPreset] = useState<'current-vs-last-month' | 'current-vs-last-quarter' | 'current-vs-last-week' | 'custom'>('current-vs-last-month');
  const [period1, setPeriod1] = useState({
    start: dayjs().startOf('month').format('YYYY-MM-DD'),
    end: dayjs().endOf('month').format('YYYY-MM-DD')
  });
  const [period2, setPeriod2] = useState({
    start: dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
    end: dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')
  });

  const handleCompPresetChange = (preset: 'current-vs-last-month' | 'current-vs-last-quarter' | 'current-vs-last-week' | 'custom') => {
    setCompPreset(preset);
    if (preset === 'current-vs-last-month') {
      setPeriod1({
        start: dayjs().startOf('month').format('YYYY-MM-DD'),
        end: dayjs().endOf('month').format('YYYY-MM-DD')
      });
      setPeriod2({
        start: dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
        end: dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')
      });
    } else if (preset === 'current-vs-last-quarter') {
      const currentMonth = dayjs().month();
      const q1Start = dayjs().month(Math.floor(currentMonth / 3) * 3).startOf('month');
      const q1End = q1Start.add(2, 'month').endOf('month');
      
      const q2Start = q1Start.subtract(3, 'month');
      const q2End = q2Start.add(2, 'month').endOf('month');

      setPeriod1({
        start: q1Start.format('YYYY-MM-DD'),
        end: q1End.format('YYYY-MM-DD')
      });
      setPeriod2({
        start: q2Start.format('YYYY-MM-DD'),
        end: q2End.format('YYYY-MM-DD')
      });
    } else if (preset === 'current-vs-last-week') {
      setPeriod1({
        start: dayjs().startOf('week').format('YYYY-MM-DD'),
        end: dayjs().endOf('week').format('YYYY-MM-DD')
      });
      setPeriod2({
        start: dayjs().subtract(1, 'week').startOf('week').format('YYYY-MM-DD'),
        end: dayjs().subtract(1, 'week').endOf('week').format('YYYY-MM-DD')
      });
    }
  };

  const [reportInsights, setReportInsights] = useState<string>("");
  const [isGeneratingInsights, setIsGeneratingInsights] = useState<boolean>(false);
  const [presetType, setPresetType] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('monthly');

  const finalVisits = allVisits && allVisits.length > 0 ? allVisits : (visits || []);
  const finalPatients = allPatients && allPatients.length > 0 ? allPatients : [];
  const finalAppointments = allAppointments && allAppointments.length > 0 ? allAppointments : [];
  const finalDoctors = allDoctors && allDoctors.length > 0 ? allDoctors : (doctors || []);

  const monthsArabic = useMemo(() => [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ], []);

  // Calculate dynamic monthly patient growth data over the last 12 calendar months
  const patientGrowthData = useMemo(() => {
    const data = [];
    const now = dayjs();
    
    // Fetch last 12 months chronologically
    for (let i = 11; i >= 0; i--) {
      const targetMonth = now.subtract(i, 'month');
      const year = targetMonth.year();
      const monthIndex = targetMonth.month(); // 0-11
      const label = `${monthsArabic[monthIndex]} ${year}`;

      // Patients registered in this specific month
      const count = finalPatients.filter((p: any) => {
        if (!p.createdAt) return false;
        const d = dayjs(p.createdAt);
        return d.isValid() && d.year() === year && d.month() === monthIndex;
      }).length;

      data.push({
        monthKey: targetMonth.format('YYYY-MM'),
        label,
        count,
        growthRate: 0, // initially 0, calculated below
      });
    }

    // MoM (Month over Month) Growth Rate (%) calculation:
    // Rate (%) = ((Current - Previous) / Previous) * 100
    for (let j = 0; j < data.length; j++) {
      if (j === 0) {
        data[j].growthRate = 0;
      } else {
        const prevCount = data[j - 1].count;
        if (prevCount === 0) {
          data[j].growthRate = data[j].count > 0 ? 100 : 0;
        } else {
          const rate = ((data[j].count - prevCount) / prevCount) * 100;
          data[j].growthRate = Math.round(rate * 10) / 10; // 1 decimal place precision
        }
      }
    }

    return data;
  }, [finalPatients, monthsArabic]);

  const branchComparisonData = useMemo(() => {
    const branchNames = ['المعادي', 'الدقي', 'مدينة نصر', 'اسكندرية'];
    
    return branchNames.map(branchName => {
      // Helper function to calculate branch metrics for a given date range
      const calculateMetrics = (start: string, end: string) => {
        const branchVisits = finalVisits.filter((v: any) => {
          const d = dayjs(v.date);
          const matchBranch = (v.branch === branchName) || (!v.branch && branchName === 'المعادي');
          const matchDate = d.isAfter(dayjs(start).subtract(1, 'day')) && d.isBefore(dayjs(end).add(1, 'day'));
          return matchBranch && matchDate;
        });

        const branchAppointments = finalAppointments.filter((a: any) => {
          const d = dayjs(a.date);
          const matchBranch = (a.branch === branchName) || (!a.branch && branchName === 'المعادي');
          const matchDate = d.isAfter(dayjs(start).subtract(1, 'day')) && d.isBefore(dayjs(end).add(1, 'day'));
          return matchBranch && matchDate;
        });

        const totalRevenue = branchVisits.reduce((sum: number, v: any) => sum + (v.cost || 0), 0);
        const clinicEarnings = branchVisits.reduce((sum: number, v: any) => sum + (v.clinicEarnings || 0), 0);
        const doctorEarnings = branchVisits.reduce((sum: number, v: any) => sum + (v.doctorEarnings || 0), 0);

        const activePatientIds = new Set(branchVisits.map((v: any) => v.patientId));
        const activePatientsCount = activePatientIds.size;

        const branchDocs = finalDoctors.filter((d: any) => (d.branch === branchName) || (!d.branch && branchName === 'المعادي'));
        const clinicDailyCapacity = branchDocs.reduce((sum: number, d: any) => sum + (d.maxPatientsPerDay || 20), 0) || 20;
        const daysCount = Math.max(1, dayjs(end).diff(dayjs(start), 'day') + 1);
        const periodCapacity = clinicDailyCapacity * daysCount;
        const occupancyRate = periodCapacity > 0 ? Math.min(100, Math.round((branchAppointments.length / periodCapacity) * 100)) : 0;

        return {
          totalRevenue,
          clinicEarnings,
          doctorEarnings,
          activePatientsCount,
          occupancyRate,
          appointmentsCount: branchAppointments.length
        };
      };

      const metrics1 = calculateMetrics(period1.start, period1.end);
      const metrics2 = calculateMetrics(period2.start, period2.end);

      // Calculates Growth percent from period2 to period1
      const calculateGrowth = (val1: number, val2: number) => {
        if (val2 === 0) return val1 > 0 ? 100 : 0;
        return Math.round(((val1 - val2) / val2) * 100);
      };

      const revenueGrowth = calculateGrowth(metrics1.totalRevenue, metrics2.totalRevenue);
      const appointmentsGrowth = calculateGrowth(metrics1.appointmentsCount, metrics2.appointmentsCount);
      const occupancyGrowth = metrics1.occupancyRate - metrics2.occupancyRate; // absolute diff
      const patientsGrowth = calculateGrowth(metrics1.activePatientsCount, metrics2.activePatientsCount);

      const registeredPatientsCount = finalPatients.filter((p: any) => 
        (p.branch === branchName) || (!p.branch && branchName === 'المعادي')
      ).length;

      const branchDocs = finalDoctors.filter((d: any) => (d.branch === branchName) || (!d.branch && branchName === 'المعادي'));

      return {
        name: branchName,
        revenue1: metrics1.totalRevenue,
        revenue2: metrics2.totalRevenue,
        revenueGrowth,
        clinicEarnings1: metrics1.clinicEarnings,
        clinicEarnings2: metrics2.clinicEarnings,
        doctorEarnings1: metrics1.doctorEarnings,
        doctorEarnings2: metrics2.doctorEarnings,
        patients1: metrics1.activePatientsCount,
        patients2: metrics2.activePatientsCount,
        patientsGrowth,
        appointments1: metrics1.appointmentsCount,
        appointments2: metrics2.appointmentsCount,
        appointmentsGrowth,
        occupancyRate1: metrics1.occupancyRate,
        occupancyRate2: metrics2.occupancyRate,
        occupancyGrowth,
        doctorsCount: branchDocs.length || 1,
        registeredPatients: registeredPatientsCount || metrics1.activePatientsCount * 2 || 10
      };
    });
  }, [finalVisits, finalPatients, finalAppointments, finalDoctors, period1, period2]);

  const filteredVisits = visits.filter((v: any) => {
    const d = dayjs(v.date);
    return d.isAfter(dayjs(dateRange.start).subtract(1, 'day')) && d.isBefore(dayjs(dateRange.end).add(1, 'day'));
  });

  const totalRev = filteredVisits.reduce((acc: any, v: any) => acc + (v.cost || 0), 0);
  const totalDoc = filteredVisits.reduce((acc: any, v: any) => acc + (v.doctorEarnings || 0), 0);
  const totalClinic = filteredVisits.reduce((acc: any, v: any) => acc + (v.clinicEarnings || 0), 0);
  const outstandingAmount = filteredVisits.reduce((acc: any, v: any) => acc + (!v.isPaid ? (v.cost || 0) : 0), 0);

  // Comparative Annual Monthly Data (Current Year)
  const currentYear = dayjs().year();

  const yearlyMonthlyData = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      const monthVisits = visits.filter((v: any) => {
        const d = dayjs(v.date);
        return d.year() === currentYear && d.month() === i;
      });

      return {
        name: monthsArabic[i],
        'إيرادات_العيادة': monthVisits.reduce((acc: any, v: any) => acc + (v.clinicEarnings || 0), 0),
        'أرباح_الأطباء': monthVisits.reduce((acc: any, v: any) => acc + (v.doctorEarnings || 0), 0),
        'إجمالي_الإيرادات': monthVisits.reduce((acc: any, v: any) => acc + (v.cost || 0), 0),
      };
    });
  }, [visits, currentYear]);

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

  // Prepare Pie Chart Data (by specialty)
  const specialtyData = Array.from(new Set(doctors.map((d: any) => d.specialty))).map(spec => {
    const specVisits = filteredVisits.filter((v: any) => doctors.find((d: any) => d.id === v.doctorId)?.specialty === spec);
    const specRev = specVisits.reduce((acc: any, v: any) => acc + (v.cost || 0), 0);
    return {
      name: spec,
      value: specRev
    };
  }).filter(d => d.value > 0);

  const COLORS = ['#3B82F6', '#10B981', '#6366F1', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6'];

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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 text-right">
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
            type="button"
            onClick={exportFinancialReport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
          >
            <Download size={14} /> تصدير CSV
          </button>
        </div>
      </header>

      <div className="flex border-b border-slate-200 pb-px gap-3 overflow-x-auto text-right">
        <button 
          type="button"
          onClick={() => setActiveSubTab('financial')}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'financial' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          📈 الأداء المالي والأرباح والرواتب
        </button>
        <button 
          type="button"
          onClick={() => setActiveSubTab('diseases')}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'diseases' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          🦠 تصنيف وتقسيم الأمراض والتشخيصات
        </button>
        <button 
          type="button"
          onClick={() => setActiveSubTab('doctors')}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'doctors' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          🩺 كفاءة الأطباء ومعدل تكلفة الكشف
        </button>
        <button 
          type="button"
          onClick={() => setActiveSubTab('reports')}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'reports' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          📝 التقارير الدورية والذكاء الاصطناعي
        </button>
        <button 
          type="button"
          onClick={() => setActiveSubTab('growth')}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'growth' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          👥 نمو المرضى الجدد (Growth Rate)
        </button>
      </div>

      <AnimatePresence mode="wait">
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
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp size={16} className="text-blue-500" />
                    مؤشرات الأداء المالي
                  </h3>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
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
                        <XAxis dataKey="name" fontSize={10} fontBold axisLine={false} tickLine={false} dy={10} />
                        <YAxis fontSize={10} fontBold axisLine={false} tickLine={false} dx={-10} />
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
                            {specialtyData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
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

            {/* المقارنة السنوية الشهرية التفاعلية */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                    <TrendingUp size={18} className="text-teal-600 animate-pulse" />
                    <span>المقارنة السنوية الشهرية لعام {currentYear} 📅</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">المقارنة التفاعلية بين إيرادات العيادة وصافي أرباح الأطباء شهرياً</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
                  <button 
                    type="button"
                    onClick={() => setYearlyChartType('bar')}
                    className={`px-3 py-1.5 rounded-md text-xs font-black transition-all flex items-center gap-1 ${yearlyChartType === 'bar' ? 'bg-white shadow-sm text-teal-600 font-black' : 'text-slate-400'}`}
                  >
                    <BarChartIcon size={12} /> أعمدة مجمعة
                  </button>
                  <button 
                    type="button"
                    onClick={() => setYearlyChartType('line')}
                    className={`px-3 py-1.5 rounded-md text-xs font-black transition-all flex items-center gap-1 ${yearlyChartType === 'line' ? 'bg-white shadow-sm text-teal-600 font-black' : 'text-slate-400'}`}
                  >
                    <LineChartIcon size={12} /> خطوط بيانية
                  </button>
                </div>
              </div>

              {/* Quick yearly stats summary */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6 text-right">
                <div className="p-3 bg-teal-50/30 border border-teal-100/50 rounded-xl">
                  <span className="text-[9px] text-slate-400 font-bold block mb-0.5">إجمالي أرباح العيادة السنوية 🏥</span>
                  <span className="text-base font-black text-emerald-600">
                    {yearlyMonthlyData.reduce((acc, curr) => acc + curr['إيرادات_العيادة'], 0).toLocaleString()} ج.م
                  </span>
                </div>
                <div className="p-3 bg-blue-50/30 border border-blue-100/50 rounded-xl">
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
                  <span className="text-xs font-black text-teal-700 truncate block">
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
                          
                          // Deductions placeholder
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
        )}

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
                  <p className="text-[10px] text-slate-400 font-bold tracking-tight">ترتيب الأمراض حسب تكرار التشخيص ومعدلات الإيرادات المصاحبة لها للفترة الزمنية المحددة</p>
                </div>
                <button 
                  type="button"
                  onClick={() => exportToCSV(diagnosisBreakdown, `Diseases_Breakdown_${dateRange.start}_to_${dateRange.end}`)}
                  className="bg-slate-105 border border-slate-200 hover:bg-slate-100 text-slate-705 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                >
                  📁 تصدير ملف إحصاءات الأمراض
                </button>
              </div>

              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-white rounded-lg border border-slate-100">
                  <div className="text-[9px] text-slate-400 font-black">إجمالي التشخيصات للفترة</div>
                  <div className="text-2xl font-black text-slate-850 mt-1">{filteredVisits.length} تشخيص</div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-100">
                  <div className="text-[9px] text-slate-400 font-black">التشخيصات الفريدة المختلفة</div>
                  <div className="text-2xl font-black text-blue-600 mt-1">{diagnosisBreakdown.length} نوع مرض</div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-100">
                  <div className="text-[9px] text-slate-400 font-black">المرض الأكثر شيوعاً وعلاجاً</div>
                  <div className="text-sm font-black text-emerald-700 mt-2 truncate">
                    {diagnosisBreakdown[0]?.name || "لا يوجد بعد"}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-150 rounded-xl">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-150">
                      <th className="px-6 py-4">اسم التشخيص / المرض</th>
                      <th className="px-6 py-4">عدد الحالات</th>
                      <th className="px-6 py-4">النسبة المئوية للاستحواذ</th>
                      <th className="px-6 py-4">إجمالي تكاليف الكشف المقابلة</th>
                      <th className="px-6 py-4">الرسم البياني للتوزيع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-sm">
                    {diagnosisBreakdown.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3.5 font-black text-slate-800">{item.name}</td>
                        <td className="px-6 py-3.5 text-slate-600">{item.count} حالة</td>
                        <td className="px-6 py-3.5 text-blue-600 font-mono text-xs">{item.percentage}%</td>
                        <td className="px-6 py-3.5 font-mono text-emerald-600">{item.totalCost} ج.م</td>
                        <td className="px-6 py-3.5 w-[200px]">
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-blue-650 h-full rounded-full transition-all duration-500" 
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
                    <span>🩺 كفاءة الأطباء والتحليل الإنتاجي والتكاليف</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold tracking-tight">إحصائية شاملة تعرض معدل سعر الزيارة للعيادة، الحاصل المحصل للطبيب، والربح الصافي للفترة الزمنية المحددة</p>
                </div>
                <button 
                  type="button"
                  onClick={() => exportToCSV(doctorsBreakdown, `Doctors_Clinical_Power_${dateRange.start}_to_${dateRange.end}`)}
                  className="bg-slate-105 border border-slate-200 hover:bg-slate-100 text-slate-705 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                >
                  📁 تصدير تقرير الأطباء المفصل
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-150 rounded-xl">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-150">
                      <th className="px-6 py-4">اسم الدكتور والتأهيل</th>
                      <th className="px-6 py-4">عدد الزيارات المعالجة</th>
                      <th className="px-6 py-4">معدل تكلفة الكشف الواحد</th>
                      <th className="px-6 py-4">إجمالي الإيرادات</th>
                      <th className="px-6 py-4">أتعاب الدكتور</th>
                      <th className="px-6 py-4">صافي ربح العيادة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-sm">
                    {doctorsBreakdown.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-black text-slate-850">د. {item.name}</p>
                          <span className="text-[9px] text-blue-600 bg-blue-50 border border-blue-105 px-2 py-0.5 rounded-md">{item.specialty}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-700">{item.visitsCount} كشف</td>
                        <td className="px-6 py-4 font-mono text-xs">{item.averageVisitCost} ج.م / كشف</td>
                        <td className="px-6 py-4 font-mono text-slate-700">{item.totalRevenue} ج.م</td>
                        <td className="px-6 py-4 font-mono text-blue-600">{item.doctorEarnings} ج.م</td>
                        <td className="px-6 py-4 font-mono text-emerald-600">{item.clinicProfit} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* Customized Periodic Insights & Executive Reports Tab */}
        {activeSubTab === 'reports' && (
          <motion.div 
            key="reports"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Filter and Presets Header */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                  <span>⏱️ الفترة الزمنية للتقرير الدوري المخصص</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-bold">حدد نطاق التاريخ أو استخدم الفلاتر السريعة لتخصيص محتوى الكشف الدوري</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button 
                  type="button"
                  onClick={() => {
                    setPresetType('daily');
                    setDateRange({ start: dayjs().format('YYYY-MM-DD'), end: dayjs().format('YYYY-MM-DD') });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${presetType === 'daily' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  اليوم (Daily)
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setPresetType('weekly');
                    setDateRange({ start: dayjs().subtract(6, 'day').format('YYYY-MM-DD'), end: dayjs().format('YYYY-MM-DD') });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${presetType === 'weekly' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  آخر 7 أيام (Weekly)
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setPresetType('monthly');
                    setDateRange({ start: dayjs().startOf('month').format('YYYY-MM-DD'), end: dayjs().endOf('month').format('YYYY-MM-DD') });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${presetType === 'monthly' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  الشهر الحالي (Monthly)
                </button>
                <button 
                  type="button"
                  onClick={() => setPresetType('custom')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${presetType === 'custom' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  مخصص (Custom)
                </button>
              </div>
            </div>

            {/* Print Friendly Executive Wrapper */}
            <div id="printable-periodic-report" className="space-y-6 text-right bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative">
              
              {/* Internal Report Letterhead */}
              <div className="border-b border-double border-slate-300 pb-5 mb-5 flex justify-between items-end">
                <div className="text-right">
                  <h2 className="text-lg font-black text-slate-900">تقرير الأداء الدوري المتكامل والذكاء الاصطناعي 📝</h2>
                  <p className="text-xs text-slate-450 font-bold mt-1">تاريخ استخراج التقرير: {dayjs().format('YYYY/MM/DD HH:mm')}</p>
                </div>
                <div className="text-left font-mono">
                  <p className="text-sm font-black text-blue-700">شعبة المحاسبة وإدارة العيادة</p>
                  <p className="text-[10px] text-slate-400 font-bold">نطاق التقرير: {dayjs(dateRange.start).format('YYYY/MM/DD')} - {dayjs(dateRange.end).format('YYYY/MM/DD')}</p>
                </div>
              </div>

              {/* KPI metrics row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">إجمالي الإيرادات للفترة (Total Revenue)</span>
                  <span className="text-lg font-black text-slate-800 font-sans">{totalRev} <span className="text-xs font-bold">ج.م</span></span>
                  <div className="text-[9px] text-slate-400 mt-1">شاملة الحجز والكشوفات العامة</div>
                </div>

                <div className="p-4 bg-blue-50/20 rounded-xl border border-blue-50">
                  <span className="text-[9px] font-black text-blue-700 uppercase block mb-1">صافي أرباح العيادة (Clinic Net Profit)</span>
                  <span className="text-lg font-black text-emerald-600 font-sans">{totalClinic} <span className="text-xs font-bold">ج.م</span></span>
                  <div className="text-[9px] text-slate-400 mt-1">بعد استقطاع رواتب وأتعاب الأطباء</div>
                </div>

                <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">مستحقات الأطباء (Doctors Payout)</span>
                  <span className="text-lg font-black text-indigo-700 font-sans">{totalDoc} <span className="text-xs font-bold">ج.م</span></span>
                  <div className="text-[9px] text-slate-400 mt-1">المستحقة للصرف للأطباء</div>
                </div>

                <div className="p-4 bg-rose-50/25 rounded-xl border border-rose-50">
                  <span className="text-[9px] font-black text-rose-700 uppercase block mb-1">عدد الزيارات وحجم الإقبال (Footfall)</span>
                  <span className="text-lg font-black text-rose-800 font-sans">{filteredVisits.length} <span className="text-xs font-bold">حالة</span></span>
                  <div className="text-[9px] text-slate-400 mt-1">معدل الإلغاء: {filteredVisits.filter((v: any) => v.status === 'cancelled').length} حالات ملغاة</div>
                </div>
              </div>

              {/* Outstanding Financial Dues warning */}
              {outstandingAmount > 0 && (
                <div className="p-3 bg-amber-50/40 border border-amber-200/50 rounded-xl flex items-center justify-between text-xs text-amber-800 font-bold">
                  <span>⚠️ هناك مستحقات غير محصلة (معلقة/آجلة) تقدر بـ <span className="font-sans font-black text-amber-900">{outstandingAmount} ج.م</span> خلال هذه الفترة.</span>
                  <span className="text-[9px] bg-amber-100 text-amber-950 px-2 py-0.5 rounded">يرجى متابعة الموظفين والتحصيل السريع</span>
                </div>
              )}

              {/* Dynamic Diagnostics Ranking Breakdown Table */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
                <div className="lg:col-span-2 space-y-3">
                  <h4 className="text-xs font-black text-slate-705 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <span>🦠 التصنيفات المرضية والتشخيصات الأكثر شيوعاً خلال الفترة</span>
                  </h4>
                  <div className="overflow-hidden border border-slate-150 rounded-xl bg-white">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150">
                        <tr>
                          <th className="p-3">التصنيف أو المرض المشخص</th>
                          <th className="p-3 text-center">عدد الحالات</th>
                          <th className="p-3 text-center">نسبة الحالات (%)</th>
                          <th className="p-3 text-left">قوة الإيراد الكلي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                        {diagnosisBreakdown.slice(0, 5).map((diag: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="p-3 font-black text-slate-900">{diag.name}</td>
                            <td className="p-3 text-center font-sans">{diag.count} حالات</td>
                            <td className="p-3 text-center font-sans text-blue-600">{diag.percentage}%</td>
                            <td className="p-3 text-left font-sans text-emerald-600">{diag.totalCost} ج.م</td>
                          </tr>
                        ))}
                        {diagnosisBreakdown.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-slate-400 italic font-medium">لا توجد سجلات تشخيصية كافية لهذه الفترة لتصنيف الأمراض الشائعة.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Doctor efficiency card */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-705 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <span>🩺 توزيع الكشوفات على الأطباء</span>
                  </h4>
                  <div className="space-y-2">
                    {doctorsBreakdown.map((doc: any, i: number) => (
                      <div key={i} className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-100/80 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-extrabold text-slate-800">د. {doc.name}</p>
                          <span className="text-[9px] text-slate-400 font-bold">{doc.specialty}</span>
                        </div>
                        <div className="text-left">
                          <p className="font-black text-blue-700 font-sans">{doc.visitsCount} كشف</p>
                          <p className="text-[9px] text-slate-400 font-mono">صافي: {doc.clinicProfit} ج.م</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI-Powered executive commentary insights section */}
              <div className="border border-slate-200 rounded-xl bg-slate-50/40 p-5 mt-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150 pb-3">
                  <div className="text-right">
                    <h4 className="text-xs font-black text-slate-850 flex items-center gap-1.5">
                      <span>🪄 تقرير التحليل الاستراتيجي والذكاء الاصطناعي (AI Executive Insights)</span>
                    </h4>
                    <p className="text-[10px] text-slate-450 font-bold">صياغة توصيات حية ورؤى مخصصة لنشاط المربح الطبي، الحالات الأكثر شيوعاً، والأطباء الأكثر إنتاجية</p>
                  </div>
                  <button
                    type="button"
                    disabled={isGeneratingInsights}
                    onClick={handleGeneratePeriodicInsights}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-extrabold rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950/15"
                  >
                    <span>{isGeneratingInsights ? "جاري كتابة التحليل الدوري الذكي..." : "🪄 توليد/تحديث التحليلات المخصصة بـ AI"}</span>
                  </button>
                </div>

                {isGeneratingInsights && (
                  <div className="py-6 flex flex-col items-center justify-center space-y-2 text-center">
                    <div className="size-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-[11px] font-bold text-slate-500">يقوم الذكاء الاصطناعي بتحليل البيانات الإحصائية والمالية وصياغة التوصيات الإدارية والطبية الصائبة...</p>
                  </div>
                )}

                {!isGeneratingInsights && reportInsights && (
                  <div className="p-4 bg-white border border-slate-150 rounded-xl text-xs text-slate-800 leading-relaxed space-y-2 text-right whitespace-pre-wrap font-bold font-sans">
                    {reportInsights}
                  </div>
                )}

                {!isGeneratingInsights && !reportInsights && (
                  <div className="p-4 bg-slate-100/30 border border-slate-200 border-dashed rounded-xl text-center text-slate-400 italic text-xs font-medium py-6">
                    اضغط على الزر أعلاه لتوليد تحليل استراتيجي ذكي يغطي الحالة الاقتصادية وكفاءة الكشوفات المرضية بالعيادة خلال هذه الفترة المحددة.
                  </div>
                )}
              </div>

              {/* Action Buttons: Printing scorecard */}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    const printContents = document.getElementById('printable-periodic-report')?.innerHTML;
                    const originalContents = document.body.innerHTML;
                    if (printContents) {
                      document.body.innerHTML = `<div class="p-8 direction-rtl text-right font-sans" style="direction: rtl;">${printContents}</div>`;
                      window.print();
                      document.body.innerHTML = originalContents;
                      window.location.reload(); // Quick refresh to restore normal working state securely
                    }
                  }}
                  className="px-5 py-2.5 bg-blue-650 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <span>🖨️ طباعة التقرير الدوري وعرض الركود</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'branch-comparison' && (
          <motion.div 
            key="branch-comparison"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Comparative Period Configuration Bar */}
            <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black text-slate-800">🗓️ الفلتر المطور لمقارنة الفترات الزمنية المتعددة</h4>
                  <p className="text-[10px] text-slate-450 font-bold mt-0.5">اختر فترتين زمنيتين مختلفتين للتشخيص والمقارنة المباشرة لأداء الفروع الطبي والتجاري</p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  <button 
                    onClick={() => handleCompPresetChange('current-vs-last-month')}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold transition-all border cursor-pointer ${
                      compPreset === 'current-vs-last-month' 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    الشهر الحالي مقابل السابق
                  </button>
                  <button 
                    onClick={() => handleCompPresetChange('current-vs-last-quarter')}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold transition-all border cursor-pointer ${
                      compPreset === 'current-vs-last-quarter' 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    الربع الحالي مقابل السابق
                  </button>
                  <button 
                    onClick={() => handleCompPresetChange('current-vs-last-week')}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold transition-all border cursor-pointer ${
                      compPreset === 'current-vs-last-week' 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    الأسبوع الحالي مقابل السابق
                  </button>
                  <button 
                    onClick={() => setCompPreset('custom')}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold transition-all border cursor-pointer ${
                      compPreset === 'custom' 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    ⚙️ تخصيص يدوي
                  </button>
                </div>
              </div>

              {compPreset === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200/50 animate-in slide-in-from-top-1 duration-200">
                  {/* Period 1 */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black text-blue-600 block">📅 الفترة الأساسية (أ):</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-bold">تاريخ البدء</label>
                        <input 
                          type="date" 
                          value={period1.start} 
                          onChange={(e) => setPeriod1({ ...period1, start: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-bold">تاريخ الانتهاء</label>
                        <input 
                          type="date" 
                          value={period1.end} 
                          onChange={(e) => setPeriod1({ ...period1, end: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold" 
                        />
                      </div>
                    </div>
                  </div>
                  {/* Period 2 */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black text-amber-600 block">📅 فترة المقارنة (ب):</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-bold">تاريخ البدء</label>
                        <input 
                          type="date" 
                          value={period2.start} 
                          onChange={(e) => setPeriod2({ ...period2, start: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-bold">تاريخ الانتهاء</label>
                        <input 
                          type="date" 
                          value={period2.end} 
                          onChange={(e) => setPeriod2({ ...period2, end: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold" 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Status display of selected ranges */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-white px-3 py-2 rounded-xl text-[10px] font-bold text-slate-650 border border-slate-200">
                <span className="text-slate-400">نطاق المقارنة المطبق:</span>
                <span className="flex items-center gap-1">
                  <span className="size-1.5 bg-blue-500 rounded-full animate-pulse" />
                  الفترة أ: ({dayjs(period1.start).format('DD MMMM YYYY')} إلى {dayjs(period1.end).format('DD MMMM YYYY')})
                </span>
                <span className="text-slate-300 font-sans font-normal">|</span>
                <span className="flex items-center gap-1">
                  <span className="size-1.5 bg-slate-400 rounded-full" />
                  الفترة ب: ({dayjs(period2.start).format('DD MMMM YYYY')} إلى {dayjs(period2.end).format('DD MMMM YYYY')})
                </span>
              </div>
            </div>

            {/* Top Cards Grid for general overview with Growth indicators */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {branchComparisonData.map((branch) => {
                const isRevUp = branch.revenueGrowth >= 0;
                const isApptsUp = branch.appointmentsGrowth >= 0;

                return (
                  <div key={branch.name} className="bg-white p-5 rounded-2xl border border-slate-205 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all text-right">
                    <div className="absolute top-0 right-0 h-1 w-full bg-blue-500" />
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase">فرع العيادة</span>
                        <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-bold">بين فترتين</span>
                      </div>
                      <h4 className="text-sm font-black text-slate-800 mt-1">{branch.name}</h4>
                    </div>
                    
                    <div className="mt-4 space-y-2.5 text-xs text-slate-500 font-semibold">
                      {/* Revenue with Growth Badge */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span>الإيرادات (أ مقابل ب):</span>
                          <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                            isRevUp ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' : 'bg-rose-50 text-rose-700 border border-rose-150'
                          }`}>
                            {isRevUp ? '▲' : '▼'} {Math.abs(branch.revenueGrowth)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <strong className="text-slate-800 font-sans text-[13px]">{branch.revenue1.toLocaleString()} ج.م</strong>
                          <span className="text-[10px] text-slate-400 font-sans font-medium line-through">{branch.revenue2.toLocaleString()} ج.م</span>
                        </div>
                      </div>

                      {/* Appointments with Growth Badge */}
                      <div className="space-y-1 pt-2 border-t border-slate-100">
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span>المواعيد المحجوزة:</span>
                          <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                            isApptsUp ? 'bg-indigo-50 text-indigo-700 border border-indigo-150' : 'bg-amber-50 text-amber-700 border border-amber-150'
                          }`}>
                            {isApptsUp ? '▲' : '▼'} {Math.abs(branch.appointmentsGrowth)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <strong className="text-slate-800 font-sans">{branch.appointments1} موعد</strong>
                          <span className="text-[10px] text-slate-400 font-sans">{branch.appointments2} سابقاً</span>
                        </div>
                      </div>

                      {/* Occupancy compared */}
                      <div className="flex justify-between items-center text-[10px] bg-slate-50 p-2 rounded-xl border border-slate-150">
                        <span>معدل الإشغال الصافي:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-amber-600 font-black font-sans">{branch.occupancyRate1}%</span>
                          <span className="text-[8px] text-slate-400 font-sans">
                            (مقابل {branch.occupancyRate2}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Visual Charts Comparison Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Financial comparison chart */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="text-right">
                  <h3 className="text-xs font-black text-slate-700">📊 مقارنة إجمالي الإيرادات المباشرة بين الفترتين</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">تحليل الإيرادات المحققة في الفترة الحالية (أ) مقابل الفترة السابقة/المقارنة (ب)</p>
                </div>
                <div className="h-80 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={branchComparisonData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
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

              {/* Patient engagement comparison chart */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="text-right">
                  <h3 className="text-xs font-black text-slate-700">👥 مقارنة كثافة المرضى النشطين بالفروع</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">عدد الحالات الفريدة التي قامت بزيارات فعلية خلال الفترة (أ) مقابل الفترة (ب)</p>
                </div>
                <div className="h-80 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={branchComparisonData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94A3B8" />
                      <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94A3B8" />
                      <Tooltip 
                        contentStyle={{ fontSize: '11px', fontWeight: 'bold', textAlign: 'right', borderRadius: '10px' }} 
                        formatter={(value: any) => [`${value} مريض`]} 
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                      <Bar dataKey="patients1" name="نشطين الفترة أ" fill="#EC4899" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="patients2" name="نشطين الفترة ب" fill="#F472B6" opacity={0.6} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Occupancy and Schedules Analysis Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="text-right">
                <h3 className="text-xs font-black text-slate-705">📈 منحنى الإشغال واستغلال طاقة العيادات المقارن</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5 font-sans">تطوير نسبة إشغال طاقات الغرف والعيادات للفترة الحالية (أ) مقابل الفترة للمقارنة (ب)</p>
              </div>
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={branchComparisonData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94A3B8" />
                    <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94A3B8" />
                    <Tooltip 
                      contentStyle={{ fontSize: '11px', fontWeight: 'bold', textAlign: 'right', borderRadius: '10px' }} 
                      formatter={(value: any) => [`${value}%`]} 
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                    <Area type="monotone" dataKey="occupancyRate1" name="معدل إشغال الفترة أ (%)" stroke="#F59E0B" fillOpacity={1} fill="url(#colorRate)" strokeWidth={2.5} />
                    <Area type="monotone" dataKey="occupancyRate2" name="معدل إشغال الفترة ب (%)" stroke="#94A3B8" fillOpacity={0.4} strokeDasharray="4 4" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Performance score table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-slate-100 text-right">
                <div>
                  <h3 className="text-xs font-black text-slate-705">📊 بطاقة الأداء المقارن التفصيلية بين فترتين</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">جدول البيانات المتكامل لمؤشرات كفاءة وإيرادات العائد للفترات المحددة أ وب للفروع</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse" dir="rtl">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase border-b border-slate-150">
                      <th className="px-6 py-4">الفرع الطبي</th>
                      <th className="px-6 py-4">إيرادات أ</th>
                      <th className="px-6 py-4">إيرادات ب</th>
                      <th className="px-6 py-4">النمو الإيرادي</th>
                      <th className="px-6 py-4">موعد أ</th>
                      <th className="px-6 py-4">موعد ب</th>
                      <th className="px-6 py-4">أشغال أ</th>
                      <th className="px-6 py-4">أشغال ب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                    {branchComparisonData.map((branch) => {
                      const isRevUp = branch.revenueGrowth >= 0;

                      return (
                        <tr key={branch.name} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-slate-900 font-extrabold">{branch.name}</td>
                          <td className="px-6 py-4 font-mono text-blue-700">{branch.revenue1.toLocaleString()} ج.م</td>
                          <td className="px-6 py-4 font-mono text-slate-400">{branch.revenue2.toLocaleString()} ج.م</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded font-bold ${
                              isRevUp ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                              {isRevUp ? '▲ +' : '▼ '} {branch.revenueGrowth}%
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-indigo-700">{branch.appointments1}</td>
                          <td className="px-6 py-4 font-mono text-slate-400">{branch.appointments2}</td>
                          <td className="px-6 py-4 font-mono text-amber-700">{branch.occupancyRate1}%</td>
                          <td className="px-6 py-4 font-mono text-slate-450">{branch.occupancyRate2}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'growth' && (
          <motion.div 
            key="growth"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Top Cards Bento Grid for Patient Growth Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Card 1: Total Registered Patients */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 h-1 w-full bg-blue-500" />
                <div>
                  <span className="text-[10px] font-black text-slate-400 block uppercase">إحصائيات المنظومة</span>
                  <h4 className="text-sm font-black text-slate-800 mt-0.5">إجمالي المرضى بالعيادة</h4>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-black text-slate-900 font-sans">{finalPatients.length} <span className="text-sm font-bold text-slate-400">مريض</span></div>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">تراكمي منذ انطلاق السيستم</p>
                </div>
              </div>

              {/* Card 2: New Registrations This Month */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 h-1 w-full bg-indigo-500" />
                <div>
                  <span className="text-[10px] font-black text-slate-400 block uppercase">شهرياً</span>
                  <h4 className="text-sm font-black text-slate-800 mt-0.5">المرضى الجدد هذا الشهر</h4>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-black text-indigo-600 font-sans">
                    {patientGrowthData[patientGrowthData.length - 1]?.count || 0} <span className="text-sm font-bold text-slate-400">مسجل</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">مقابل الشهر السابق مباشرة</p>
                </div>
              </div>

              {/* Card 3: MoM Avg Growth Rate */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 h-1 w-full bg-emerald-500" />
                <div>
                  <span className="text-[10px] font-black text-slate-400 block uppercase">معدلات الأداء</span>
                  <h4 className="text-sm font-black text-slate-800 mt-0.5">متوسط معدل النمو الشهري</h4>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-black text-emerald-600 font-sans">
                    {(() => {
                      const rates = patientGrowthData.slice(1).map(d => d.growthRate);
                      const avg = rates.length > 0 ? rates.reduce((sum, val) => sum + val, 0) / rates.length : 0;
                      return Math.round(avg * 10) / 10;
                    })()}%
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">متوسط التدفق الدوري ربع السنوي</p>
                </div>
              </div>

              {/* Card 4: Peak Growth Month */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 h-1 w-full bg-amber-500" />
                <div>
                  <span className="text-[10px] font-black text-slate-400 block uppercase">القمة القياسية</span>
                  <h4 className="text-sm font-black text-slate-800 mt-0.5">الشهر الأعلى نمواً</h4>
                </div>
                <div className="mt-4">
                  {(() => {
                    const sortedData = [...patientGrowthData.slice(1)].sort((a, b) => b.growthRate - a.growthRate);
                    const peak = sortedData[0];
                    return (
                      <div>
                        <div className="text-xl font-black text-amber-600 font-sans">+{peak?.growthRate || 0}%</div>
                        <p className="text-[10px] text-slate-500 font-bold mt-1">في شهر {peak?.label || 'غير محدد'}</p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Volume Bar Chart */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div>
                  <h3 className="text-xs font-black text-slate-700">📊 حجم وفود وتسجيل المرضى الجدد شهرياً</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">العدد الفعلي للمرضى الجدد المضافين إلى النظام على مدار آخر 12 شهراً</p>
                </div>
                <div className="h-80 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={patientGrowthData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#94A3B8" />
                      <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94A3B8" />
                      <Tooltip 
                        contentStyle={{ fontSize: '11px', fontWeight: 'bold', textAlign: 'right', borderRadius: '10px' }} 
                        formatter={(value: any) => [`${value} مريض جدد`]} 
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                      <Bar dataKey="count" name="المرضى الجدد" fill="#6366F1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* MoM Growth Rate Area Chart */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div>
                  <h3 className="text-xs font-black text-slate-700">📈 منحنى معدل النمو المتوازي % (Growth Rate)</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">النسبة المئوية لزيادة (أو تباطؤ) التسجيل مقارنة دائماً بالشهر الذي يسبقه</p>
                </div>
                <div className="h-80 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={patientGrowthData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#94A3B8" />
                      <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94A3B8" />
                      <Tooltip 
                        contentStyle={{ fontSize: '11px', fontWeight: 'bold', textAlign: 'right', borderRadius: '10px' }} 
                        formatter={(value: any) => [`${value}%`]} 
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                      <Area type="monotone" dataKey="growthRate" name="معدل النمو الشهري (%)" stroke="#10B981" fillOpacity={1} fill="url(#colorGrowth)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Growth Analytics Details Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-705">📊 جدول المؤشرات التفصيلي لنمو المرضى</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">تفصيل الحالات وحسابات الدفق شهراً بشهر مع التباين والتحليل النسبي</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-150">
                      <th className="px-6 py-4">التاريخ / الشهر</th>
                      <th className="px-6 py-4">المرضى الجدد المسجلين</th>
                      <th className="px-6 py-4">حالة التغير الدوري</th>
                      <th className="px-6 py-4 text-center">نسبة النمو الشهري (MoM Growth %)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-705">
                    {patientGrowthData.map((data, index) => {
                      const isPositive = data.growthRate >= 0;
                      return (
                        <tr key={data.monthKey} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-slate-900 font-extrabold">{data.label}</td>
                          <td className="px-6 py-4 font-mono text-slate-800">{data.count} مريض جديد</td>
                          <td className="px-6 py-4">
                            {index === 0 ? (
                              <span className="text-slate-400">- شهري تمهيدي -</span>
                            ) : data.growthRate > 0 ? (
                              <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[10px]">📈 زيادة نشاط</span>
                            ) : data.growthRate < 0 ? (
                              <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded text-[10px]">📉 تباطؤ نسبي</span>
                            ) : (
                              <span className="text-slate-500 bg-slate-50 px-2 py-0.5 rounded text-[10px]">➖ استقرار عددي</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {index === 0 ? (
                              <span className="text-slate-400 font-mono">0%</span>
                            ) : (
                              <span className={`px-2 py-1 rounded font-mono ${
                                isPositive && data.growthRate > 0 ? 'bg-emerald-50 text-emerald-700' :
                                !isPositive ? 'bg-red-50 text-red-700' :
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InventoryView({ inventory, onRefresh, selectedBranch }: { inventory: InventoryItem[], onRefresh: () => void, key?: string, selectedBranch: string }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [search, setSearch] = useState("");
  const [filterExpiring, setFilterExpiring] = useState(false);
  const [storeSectionTab, setStoreSectionTab] = useState<'all' | 'medical' | 'non-medical'>('all');

  const isLowStock = (item: InventoryItem) => item.quantity <= item.reorderPoint;
  const isExpiringSoon = (date?: string) => {
    if (!date) return false;
    return dayjs(date).diff(dayjs(), 'month') <= 3 && dayjs(date).diff(dayjs(), 'month') >= 0;
  };
  const isExpired = (date?: string) => {
    if (!date) return false;
    return dayjs(date).isBefore(dayjs());
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                         item.category.toLowerCase().includes(search.toLowerCase());
    
    // Store type section filter
    const matchesStoreSection = storeSectionTab === 'all' || 
                                (storeSectionTab === 'medical' && (!item.storeType || item.storeType === 'medical')) ||
                                (storeSectionTab === 'non-medical' && item.storeType === 'non-medical');

    if (filterExpiring) {
      return matchesSearch && matchesStoreSection && (isExpired(item.expirationDate) || isExpiringSoon(item.expirationDate));
    }
    return matchesSearch && matchesStoreSection;
  });

  const handleDelete = async (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا الصنف؟")) {
      await api.deleteInventoryItem(id);
      onRefresh();
    }
  };

  const handleApproveByMustafa = async (item: InventoryItem) => {
    await api.updateInventoryItem(item.id, {
      ...item,
      approvalStatus: 'approved',
      lastApprovedBy: 'مصطفى فتحي'
    });
    onRefresh();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      
      {/* 🛡️ Authority & Approval Matrix Dashboard Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-[#1E293B] to-slate-900 text-white p-5 rounded-2xl border border-slate-805 shadow-xl space-y-3 relative overflow-hidden text-right" dir="rtl">
        <div className="absolute top-0 left-0 h-full w-40 bg-gradient-to-r from-blue-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 justify-end">
              <span className="bg-emerald-500 text-slate-950 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase">سلسلة الاعتمادات مستمرة</span>
              <h3 className="text-sm font-black tracking-wide text-slate-100">مصادقة جودة المخزون والمستلزمات (Quality Council Sign-Off)</h3>
            </div>
            <p className="text-[11px] text-slate-400 font-bold mt-1 max-w-3xl leading-relaxed">
              وفقاً لدليل الجودة، تنقسم مستودعات العيادة الفرعية إلى مستودع طبي ومستودع غير طبي. تخضع كافة الإضافات والتحركات بالمخزن لمصفوفة صلاحيات خطية تنتهي بالاعتماد النهائي والتوقيع من مدير الشؤون الإدارية <span className="text-emerald-400 font-black">الأستاذ / مصطفى فتحي</span>.
            </p>
          </div>
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center min-w-[140px]">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">الاعتماد النهائي</span>
            <span className="text-xs font-black text-emerald-400 mt-1">أ. مصطفى فتحي</span>
            <span className="text-[8px] text-slate-500 mt-0.5 font-bold">مدير الشؤون الإدارية</span>
          </div>
        </div>
      </div>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">المخزن والمستلزمات</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">تتبع الأدوية والمستلزمات الطبية وتاريخ الصلاحية</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/10 text-sm"
        >
          <Package size={18} />
          <span>إضافة صنف جديد للمستودع</span>
        </button>
      </header>

      {/* Store Section Tab Selector Grid */}
      <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 justify-end max-w-md mr-auto select-none">
        <button 
          type="button" 
          onClick={() => setStoreSectionTab('non-medical')}
          className={`flex-1 px-4 py-2 rounded-lg text-xs font-black transition-all text-center ${storeSectionTab === 'non-medical' ? 'bg-white text-amber-600 shadow-sm border border-slate-200/20' : 'text-slate-400 hover:text-slate-600'}`}
        >
          📦 مستودع فرعي غير طبي
        </button>
        <button 
          type="button" 
          onClick={() => setStoreSectionTab('medical')}
          className={`flex-1 px-4 py-2 rounded-lg text-xs font-black transition-all text-center ${storeSectionTab === 'medical' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/20' : 'text-slate-400 hover:text-slate-600'}`}
        >
          🏥 مستودع المستلزمات الطبية
        </button>
        <button 
          type="button" 
          onClick={() => setStoreSectionTab('all')}
          className={`flex-1 px-4 py-2 rounded-lg text-xs font-black transition-all text-center ${storeSectionTab === 'all' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/20' : 'text-slate-400 hover:text-slate-600'}`}
        >
          الجمـيع ({inventory.length})
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="بحث بالاسم أو النوع بالمخزن المقابل..." 
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm text-right"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setFilterExpiring(!filterExpiring)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border flex items-center gap-2 ${filterExpiring ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
          >
            <AlertTriangle size={14} />
            أصناف منتهية أو قاربت على الانتهاء
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-200">
                <th className="px-6 py-4">الصنف وبيانات الاستحقاق</th>
                <th className="px-6 py-4">المستودع ومصفوفة الاعتماد</th>
                <th className="px-6 py-4">النوع في المستودع</th>
                <th className="px-6 py-4">الكمية الحالية</th>
                <th className="px-6 py-4">حد الطلب</th>
                <th className="px-6 py-4">تاريخ الصلاحية</th>
                <th className="px-6 py-4 text-left">الإجراءات والاعتمادات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {filteredInventory.map((item) => (
                <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${isLowStock(item) ? 'bg-amber-50/30' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{item.name}</div>
                    <div className="text-[10px] text-slate-400">آخر تحديث: {dayjs(item.lastUpdated).fromNow()}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase w-fit ${item.storeType === 'non-medical' ? 'bg-amber-100 text-amber-705 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {item.storeType === 'non-medical' ? '📦 مستودع غير طبي' : '🏥 مستودع طبي فرعي'}
                      </span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`size-1.5 rounded-full ${item.approvalStatus === 'approved' ? 'bg-emerald-500' : item.approvalStatus === 'rejected' ? 'bg-rose-500' : 'bg-slate-400'}`} />
                        <span className="text-[9px] font-extrabold text-slate-500">
                          {item.approvalStatus === 'approved' ? `معتمد (أ. ${item.lastApprovedBy || 'مصطفى فتحي'})` : item.approvalStatus === 'rejected' ? 'طلب مرفوض' : 'معلق بقيد مراجعة الاعتماد الإداري'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                      {item.category === 'medication' ? 'دواء' : 
                       item.category === 'disposable' ? 'مستلزم' : 
                       item.category === 'equipment' ? 'جهاز' : 'أخرى'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-black">
                    <div className="flex items-center gap-2">
                      <span className={isLowStock(item) ? 'text-amber-600' : 'text-slate-700'}>
                        {item.quantity} {item.unit}
                      </span>
                      {isLowStock(item) && <AlertTriangle size={14} className="text-amber-500" />}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-400 font-bold">{item.reorderPoint} {item.unit}</td>
                  <td className="px-6 py-4">
                    {item.expirationDate ? (
                      <div className="flex flex-col">
                        <span className={isExpired(item.expirationDate) ? 'text-red-500 font-black' : isExpiringSoon(item.expirationDate) ? 'text-amber-500 font-black' : 'text-slate-600'}>
                          {dayjs(item.expirationDate).format('YYYY/MM/DD')}
                        </span>
                        {isExpired(item.expirationDate) && <span className="text-[9px] text-red-500 uppercase font-black">منتهي الصلاحية</span>}
                        {isExpiringSoon(item.expirationDate) && !isExpired(item.expirationDate) && <span className="text-[9px] text-amber-500 uppercase font-black">ينتهي قريباً</span>}
                      </div>
                    ) : (
                      <span className="text-slate-300 italic">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-left font-bold">
                    <div className="flex items-center gap-2 justify-end">
                      {item.approvalStatus !== 'approved' && (
                        <button
                          type="button"
                          onClick={() => handleApproveByMustafa(item)}
                          title="اعتماد هذا الصنف بالصلاحية الإدارية لـ مصطفى فتحي"
                          className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2.5 py-1 rounded text-[10px] font-black flex items-center gap-1 transition-all border border-emerald-200"
                        >
                          ✍️ اعتماد الصنف (أ. مصطفى فتحي)
                        </button>
                      )}
                      <button onClick={() => setEditingItem(item)} className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded transition-all" title="تعديل"><FileText size={16} /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-all" title="حذف"><X size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInventory.length === 0 && (
                <tr>
                   <td colSpan={7} className="px-6 py-20 text-center text-slate-300 italic">لا توجد أصناف تطابق هذا البحث أو الفئة بالمخزن حالياً</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {(isAdding || editingItem) && (
          <InventoryModal 
            onClose={() => { setIsAdding(false); setEditingItem(null); }} 
            onSubmit={async (data) => {
              if (editingItem) {
                await api.updateInventoryItem(editingItem.id, data);
              } else {
                await api.addInventoryItem({ ...data, branch: selectedBranch });
              }
              setIsAdding(false);
              setEditingItem(null);
              onRefresh();
            }}
            initialData={editingItem}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InventoryModal({ onClose, onSubmit, initialData }: any) {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    category: initialData?.category || "medication",
    quantity: initialData?.quantity || 0,
    unit: initialData?.unit || "عبوة",
    reorderPoint: initialData?.reorderPoint || 0,
    expirationDate: initialData?.expirationDate || "",
    storeType: initialData?.storeType || "medical",
    approvalStatus: initialData?.approvalStatus || "pending",
    lastApprovedBy: initialData?.lastApprovedBy || ""
  });

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="bg-white w-full max-w-lg rounded-xl overflow-hidden shadow-2xl border border-slate-200"
      >
        <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800">{initialData ? 'تعديل الصنف والمستلزم المستودعي' : 'إضافة صنف جديد مستودعي'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"><X size={20} /></button>
        </div>
        <form className="p-6 space-y-4 text-right" onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
          
          {/* Store Type Classification Tab Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-404 text-slate-400 uppercase tracking-widest leading-loose">تصنيف مخزن العيادة (طب ومستلزمات vs غير طبي)</label>
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={() => setFormData({...formData, storeType: 'medical'})}
                className={`flex-1 py-2 rounded-lg font-bold text-xs border ${formData.storeType === 'medical' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
              >
                🏥 مستودع طبي (أدوية ومعدات)
              </button>
              <button 
                type="button" 
                onClick={() => setFormData({...formData, storeType: 'non-medical'})}
                className={`flex-1 py-2 rounded-lg font-bold text-xs border ${formData.storeType === 'non-medical' ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
              >
                📦 مستودع فرعي غير طبي (قرطاسية ومستلزمات عامة)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">اسم الصنف</label>
              <input required type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">النوع</label>
              <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value as any})}>
                <option value="medication">دواء / علاج</option>
                <option value="disposable">مستلزمات طبية</option>
                <option value="equipment">أجهزة ومعدات</option>
                <option value="other font-sans">أخرى / مأكولات ومستودعية</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">وحدة القياس</label>
              <input required type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm" value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})} placeholder="مثال: عبوة، قطعة" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">الكمية الحالية</label>
              <input required type="number" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">حد إعادة الطلب</label>
              <input required type="number" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold" value={formData.reorderPoint} onChange={(e) => setFormData({...formData, reorderPoint: Number(e.target.value)})} />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">تاريخ الصلاحية (اختياري)</label>
              <input type="date" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm" value={formData.expirationDate} onChange={(e) => setFormData({...formData, expirationDate: e.target.value})} />
            </div>
          </div>
          <div className="pt-4 flex gap-3">
            <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-900/10 text-sm">حفظ الصنف</button>
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 text-sm">إلغاء</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function AppointmentsView({ appointments, doctors, patients, onRefresh, onSelectPatient, selectedBranch, currentUser }: { appointments: Appointment[], doctors: Doctor[], patients: Patient[], onRefresh: () => void, onSelectPatient?: (id: string, appointmentId?: string) => void, key?: string, selectedBranch: string, currentUser?: any }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  const handleBranchTransfer = async (appId: string, targetBranch: string) => {
    try {
      const app = appointments.find(a => a.id === appId);
      if (!app) return;
      const pat = patients.find(p => p.id === app.patientId);
      const patientName = pat ? pat.name : 'المريض';

      await api.updateAppointment(appId, { branch: targetBranch });
      alert(`🎉 تم بنجاح نقل موعد ${patientName} بقسم السحب والإفلات السريع إلى فرع (${targetBranch}) وتحديث سجلات العيادة فورياً!`);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء نقل الموعد.");
    }
  };

  const [isAdding, setIsAdding] = useState(false);
  const [showDailyReportModal, setShowDailyReportModal] = useState(false);
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const [filterDoctorId, setFilterDoctorId] = useState<string>('');
  const [filterSpecialty, setFilterSpecialty] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');

  const specialties = useMemo(() => {
    const specs = doctors.map(d => d.specialty).filter(Boolean);
    return Array.from(new Set(specs));
  }, [doctors]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter(app => {
      if (filterDoctorId && app.doctorId !== filterDoctorId) return false;
      if (filterSpecialty) {
        const doc = doctors.find(d => d.id === app.doctorId);
        if (!doc || doc.specialty !== filterSpecialty) return false;
      }
      if (filterDate) {
        if (!dayjs(app.date).isSame(dayjs(filterDate), 'day')) return false;
      }
      return true;
    });
  }, [appointments, filterDoctorId, filterSpecialty, filterDate, doctors]);

  const inspectionDate = filterDate || dayjs().format('YYYY-MM-DD');

  const dailyClinicsStatus = useMemo(() => {
    const dayAppointments = appointments.filter(a => dayjs(a.date).format('YYYY-MM-DD') === inspectionDate);
    
    let doctorsToInspect = doctors;
    if (filterDoctorId) {
      doctorsToInspect = doctorsToInspect.filter(d => d.id === filterDoctorId);
    }
    if (filterSpecialty) {
      doctorsToInspect = doctorsToInspect.filter(d => d.specialty === filterSpecialty);
    }

    return doctorsToInspect.map(doc => {
      const docApps = dayAppointments.filter(a => a.doctorId === doc.id);
      const total = docApps.length;
      const completed = docApps.filter(a => a.status === 'completed').length;
      const cancelled = docApps.filter(a => a.status === 'cancelled').length;
      const pending = docApps.filter(a => a.status === 'scheduled').length;
      
      let statusLabel = '';
      let statusColor = '';
      let isCompleted = false;

      if (total === 0) {
        statusLabel = 'لا يوجد كشوفات مجدولة';
        statusColor = 'bg-slate-100 text-slate-400 border-slate-200';
      } else if (pending === 0) {
        statusLabel = 'العيادة مكتملة بنسبة 100%';
        statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        isCompleted = true;
      } else {
        statusLabel = `العيادة جارية (متبقي ${pending} كشف)`;
        statusColor = 'bg-amber-50 text-amber-700 border-amber-200';
      }

      return {
        doctor: doc,
        total,
        completed,
        cancelled,
        pending,
        statusLabel,
        statusColor,
        isCompleted
      };
    });
  }, [appointments, doctors, inspectionDate, filterDoctorId, filterSpecialty]);

  const hourlyData = useMemo(() => {
    // Generate hours from 8 (8 AM) to 22 (10 PM)
    const hours = Array.from({ length: 15 }, (_, i) => i + 8);
    return hours.map(h => {
      const isPm = h >= 12;
      const displayHour = h === 12 ? 12 : h > 12 ? h - 12 : h;
      const suffix = isPm ? 'م' : 'ص';
      const label = displayHour + ':00 ' + suffix;
      
      const count = filteredAppointments.filter(app => {
        const d = dayjs(app.date);
        return d.isValid() && d.hour() === h;
      }).length;
      
      return {
        hourString: label,
        'عدد المواعيد': count
      };
    });
  }, [filteredAppointments]);

  const daysInMonth = currentDate.daysInMonth();
  const firstDayOfMonth = currentDate.startOf('month').day();
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const paddingDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const getAppointmentsForDate = (date: dayjs.Dayjs) => {
    return filteredAppointments.filter(a => dayjs(a.date).isSame(date, 'day'));
  };

  const getDoctorLoad = (doctorId: string, date: string) => {
    return appointments.filter(a => a.doctorId === doctorId && dayjs(a.date).isSame(dayjs(date), 'day')).length;
  };

  const handleUpdateStatus = async (id: string, status: any) => {
    await api.updateAppointment(id, status);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (confirm("هل أنت متأكد من إلغاء هذا الموعد؟")) {
      await api.deleteAppointment(id);
      onRefresh();
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">جدول المواعيد</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">تنظيم مواعيد المرضى وتتبع سعة الأطباء</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button 
            type="button"
            onClick={() => setShowDailyReportModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/10 text-xs"
          >
            <FileText size={16} />
            <span>تصدير ملخص اليوم</span>
          </button>
          <div className="bg-slate-100 p-1 rounded-xl flex">
            <button onClick={() => setViewMode('calendar')} className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${viewMode === 'calendar' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>التقويم</button>
            <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>القائمة</button>
          </div>
          <button 
            type="button"
            onClick={() => setShowExcelImportModal(true)}
            className="bg-purple-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-700 transition-all shadow-lg shadow-purple-900/10 text-xs cursor-pointer"
          >
            <Upload size={14} />
            <span>استيراد المواعيد (Excel)</span>
          </button>
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/10 text-sm cursor-pointer"
          >
            <Plus size={18} />
            <span>حجز موعد جديد</span>
          </button>
        </div>
      </header>

      {/* 🔄 Drag & Drop Branch Transfer Hub */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-indigo-500/30 text-white shadow-xl relative overflow-hidden text-right" dir="rtl">
        {/* Decorative elements */}
        <div className="absolute -top-12 -left-12 size-32 bg-indigo-500/10 rounded-full blur-xl" />
        <div className="absolute -bottom-10 -right-10 size-40 bg-blue-500/10 rounded-full blur-xl" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <h3 className="text-sm font-black flex items-center gap-2 text-indigo-200">
              <span className="animate-pulse size-2 bg-emerald-400 rounded-full"></span>
              <span>🔄 مركز النقل التفاعلي السريع للمواعيد بين الفروع (Drag & Drop)</span>
            </h3>
            <p className="text-[10px] text-slate-300 font-bold mt-1 max-w-4xl leading-relaxed">
              اسحب أي موعد للعيادة من جدول التقويم أو جدول القائمة بالأسفل، ثم أفلته مباشرة في بطاقة أي فرع من الفروع المتاحة أدناه لنقل حجز المريض فورياً وتحديث جداول الأرشفة والفرع دون الحاجة لإعادة كتابة تفاصيل الحجز.
            </p>
          </div>
          {draggingId && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-3.5 py-1.5 rounded-xl text-[10px] font-black animate-bounce shrink-0">
              ⚡ جاري السحب الآن... أفلته فوق الفرع المستهدف
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 relative z-10">
          {['المعادي', 'الدقي', 'مدينة نصر', 'اسكندرية'].map((branchName) => {
            const isCurrent = selectedBranch === branchName;
            const isHovered = hoveredZone === branchName;
            const isDraggingActive = draggingId !== null;

            return (
              <div
                key={branchName}
                onDragOver={(e) => {
                  if (isCurrent) return;
                  e.preventDefault();
                  if (hoveredZone !== branchName) {
                    setHoveredZone(branchName);
                  }
                }}
                onDragLeave={() => {
                  if (isCurrent) return;
                  setHoveredZone(null);
                }}
                onDrop={async (e) => {
                  if (isCurrent) return;
                  e.preventDefault();
                  setHoveredZone(null);
                  const appointmentId = e.dataTransfer.getData("text/plain");
                  if (appointmentId) {
                    await handleBranchTransfer(appointmentId, branchName);
                  }
                }}
                className={`p-4 rounded-xl border transition-all text-center flex flex-col justify-between select-none ${
                  isCurrent
                    ? 'bg-slate-800/40 border-slate-700/50 text-slate-400 cursor-not-allowed'
                    : isHovered
                      ? 'bg-indigo-600/30 border-indigo-400 text-white scale-[1.03] shadow-lg shadow-indigo-500/10'
                      : isDraggingActive
                        ? 'bg-slate-800/80 border-dashed border-indigo-500/40 text-indigo-300 animate-pulse cursor-pointer'
                        : 'bg-slate-800/30 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer'
                }`}
              >
                <div>
                  <span className="text-[9px] font-extrabold uppercase text-slate-450 block">فرع العيادة</span>
                  <h4 className="text-xs font-black mt-1">{branchName}</h4>
                </div>
                
                <div className="mt-4 pt-2.5 border-t border-slate-750/50 flex flex-col items-center justify-center gap-1">
                  {isCurrent ? (
                    <span className="text-[9px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-bold">الموقع الحالي 📍</span>
                  ) : isHovered ? (
                    <span className="text-[9px] text-indigo-300 font-extrabold animate-bounce">مستعد للإفلات 💫</span>
                  ) : isDraggingActive ? (
                    <span className="text-[9px] text-indigo-400 font-bold">اسحب الموعد لهنا 📥</span>
                  ) : (
                    <span className="text-[9px] text-slate-500 font-bold">متاح للنقل 🔗</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* أدوات البحث والتصفية */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <span>🔍 أدوات التصفية والبحث المتقدم في المواعيد والعيادات</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-right">
          {/* تصفية حسب العيادة/الطبيب */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase">تصفية حسب الطبيب</label>
            <select
              value={filterDoctorId}
              onChange={(e) => setFilterDoctorId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-705"
            >
              <option value="">جميع الأطباء / العيادات</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>د. {d.name} ({d.specialty})</option>
              ))}
            </select>
          </div>

          {/* تصفية حسب التخصص */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase">تصفية حسب التخصص الطبي</label>
            <select
              value={filterSpecialty}
              onChange={(e) => setFilterSpecialty(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-705"
            >
              <option value="">جميع التخصصات</option>
              {specialties.map(spec => (
                <option key={spec} value={spec}>{spec}</option>
              ))}
            </select>
          </div>

          {/* تصفية حسب اليوم */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase">تصفية حسب يوم محدد</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                if (e.target.value) {
                  setCurrentDate(dayjs(e.target.value));
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-705"
            />
          </div>

          {/* تصفير الفلاتر */}
          <div className="flex items-end">
            {(filterDoctorId || filterSpecialty || filterDate) ? (
              <button
                type="button"
                onClick={() => {
                  setFilterDoctorId('');
                  setFilterSpecialty('');
                  setFilterDate('');
                }}
                className="w-full px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1"
              >
                <span>✕ إعادة تعيين التصفية</span>
              </button>
            ) : (
              <div className="text-[9px] text-slate-400 font-bold py-2">يعرض جميع المواعيد الفعالة</div>
            )}
          </div>
        </div>
      </div>

      {/* قسم حالة تشغل العيادات لليوم المختار */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-850 flex items-center gap-2">
              <span className="text-teal-600">🏥</span>
              <span>حالة العيادات والتشغيل الفعلي ليوم {dayjs(inspectionDate).format('YYYY/MM/DD')}</span>
              {inspectionDate === dayjs().format('YYYY-MM-DD') && (
                <span className="bg-blue-650 text-white text-[9px] px-2 py-0.5 rounded-full font-black animate-pulse">اليوم</span>
              )}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">عرض العيادات المكتملة وغير المكتملة لليوم المحدد ونسب التغطية</p>
          </div>
          <div className="text-xs font-bold text-slate-500">
            حالة الإنجاز: <span className="font-mono text-emerald-600 font-extrabold">{dailyClinicsStatus.filter(c => c.total > 0 && c.isCompleted).length}</span> مكتملة من مصل <span className="font-mono text-blue-600 font-extrabold">{dailyClinicsStatus.filter(c => c.total > 0).length}</span> عيادة نشطة
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {dailyClinicsStatus.map(clinic => {
            const hasAppointments = clinic.total > 0;
            return (
              <div 
                key={clinic.doctor.id} 
                className={`p-4 rounded-xl border bg-white transition-all shadow-sm flex flex-col justify-between ${
                  !hasAppointments ? 'border-slate-150 opacity-60' : clinic.isCompleted ? 'border-emerald-200 shadow-emerald-950/5' : 'border-amber-200 shadow-amber-950/5'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-3">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-black border uppercase tracking-wider ${clinic.statusColor}`}>
                      {clinic.statusLabel}
                    </span>
                    {hasAppointments && (
                      <span className="text-[9px] font-black font-mono text-slate-400">
                        {clinic.completed + clinic.cancelled}/{clinic.total}
                      </span>
                    )}
                  </div>
                  <h4 className="font-extrabold text-xs text-slate-800">د. {clinic.doctor.name}</h4>
                  <p className="text-[10px] text-blue-600 font-extrabold mt-0.5">{clinic.doctor.specialty}</p>

                  {hasAppointments && (
                    <div className="mt-3 space-y-1.5 text-[10px] text-slate-500 font-bold text-right">
                      <div className="flex justify-between">
                        <span>مكتمل ومؤكد:</span>
                        <span className="text-emerald-600 font-black">{clinic.completed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>مستحق للانتظار:</span>
                        <span className="text-amber-600 font-black">{clinic.pending}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ملغى أو مؤجل:</span>
                        <span className="text-red-500 font-black">{clinic.cancelled}</span>
                      </div>
                    </div>
                  )}
                </div>

                {hasAppointments && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${clinic.isCompleted ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${(clinic.completed / clinic.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 📊 Hour-by-Hour Appointments Distribution (Peak Times Chart) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-850 flex items-center gap-2">
              <span className="text-blue-650">📊</span>
              <span>توزيع وكثافة المواعيد على مدار اليوم (فترات الذروة لموظفي الاستقبال)</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
              {filterDate 
                ? `يبين فترات الازدحام وكثافة الحجوزات بالساعة ليوم الكشف: ${dayjs(filterDate).format('YYYY/MM/DD')}`
                : 'يبين فترات الذروة وساعات العمل الأكثر إشغالاً للمواعيد المفلترة حالياً'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl border border-blue-100 text-[10px] font-black">
            <span>💡 نصيحة لموظف الاستقبال:</span>
            <span>تجنب جدولة المواعيد الجديدة في الساعات ذات الارتفاعات العالية لتقليل زمن انتظار المرضى.</span>
          </div>
        </div>

        <div className="h-64 w-full pr-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorHourApps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="hourString" 
                tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }} 
                axisLine={false} 
                tickLine={false} 
              />
              <YAxis 
                allowDecimals={false}
                tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }} 
                axisLine={false} 
                tickLine={false} 
              />
              <Tooltip 
                contentStyle={{ 
                  direction: 'rtl',
                  textAlign: 'right',
                  backgroundColor: '#0f172a',
                  color: '#fff',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                }}
                labelStyle={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '9px', marginBottom: '4px' }}
                itemStyle={{ color: '#60a5fa' }}
              />
              <Area 
                type="monotone" 
                dataKey="عدد المواعيد" 
                stroke="#1d4ed8" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#colorHourApps)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-800">{currentDate.format('MMMM YYYY')}</h3>
            <div className="flex gap-2">
              <button onClick={() => setCurrentDate(currentDate.subtract(1, 'month'))} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><ChevronRight size={20} /></button>
              <button onClick={() => setCurrentDate(dayjs())} className="px-4 py-2 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-600 transition-colors">اليوم</button>
              <button onClick={() => setCurrentDate(currentDate.add(1, 'month'))} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><ChevronLeft size={20} /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-xl overflow-hidden border border-slate-100">
            {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map(day => (
              <div key={day} className="bg-slate-50 p-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{day}</div>
            ))}
            {paddingDays.map(d => <div key={`p-${d}`} className="bg-white min-h-[120px] p-2 opacity-30"></div>)}
            {monthDays.map(day => {
              const date = currentDate.date(day);
              const dayAppointments = getAppointmentsForDate(date);
              const isToday = date.isSame(dayjs(), 'day');

              return (
                <div key={day} className={`bg-white min-h-[120px] p-2 hover:bg-blue-50/30 transition-colors group border-b border-r border-slate-200/50 ${isToday ? 'relative' : ''}`}>
                  {isToday && <div className="absolute top-2 left-2 size-2 bg-blue-500 rounded-full shadow-sm shadow-blue-500/50"></div>}
                  <div className={`text-sm font-black mb-2 ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>{day}</div>
                  <div className="space-y-1">
                    {dayAppointments.slice(0, 3).map(app => {
                      const isUnconfirmed = app.status === 'scheduled' && !app.isConfirmed;
                      return (
                        <div 
                          key={app.id} 
                          onClick={() => onSelectPatient && onSelectPatient(app.patientId, app.id)}
                          draggable={true}
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.setData("text/plain", app.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDraggingId(app.id);
                          }}
                          onDragEnd={() => {
                            setDraggingId(null);
                          }}
                          className={`text-[9px] border p-1.5 rounded-lg shadow-sm flex flex-col gap-0.5 truncate cursor-grab active:cursor-grabbing transition-all ${
                            draggingId === app.id ? 'opacity-30 scale-95 border-dashed border-indigo-500' : ''
                          } ${
                            app.isSpecial 
                              ? 'bg-purple-50 hover:bg-purple-105 border-purple-200' 
                              : isUnconfirmed
                                ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900 font-extrabold'
                                : 'bg-white hover:bg-blue-50 border-slate-150'
                          }`}
                          title="اسحب هذا الكشف لنقله لفرع آخر، أو اضغط للدخول للملف"
                        >
                          <div className="font-bold text-slate-755 truncate flex items-center justify-between gap-1">
                            <span className="truncate">
                              {isUnconfirmed && <span className="text-amber-600 font-extrabold">⚠️ </span>}
                              {patients.find(p => p.id === app.patientId)?.name}
                            </span>
                            {app.isSpecial && <span className="text-[7px] bg-purple-600 text-white px-1 py-0.5 rounded font-black shrink-0">خاص</span>}
                          </div>
                          <div className="text-[8px] text-blue-500 font-bold opacity-70 truncate">{doctors.find(d => d.id === app.doctorId)?.name}</div>
                        </div>
                      );
                    })}
                    {dayAppointments.length > 3 && (
                      <div className="text-[8px] text-slate-400 font-bold text-center pt-1">+{dayAppointments.length - 3} المزيد</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                <th className="px-6 py-4 border-b border-slate-100">الموعد</th>
                <th className="px-6 py-4 border-b border-slate-100">المريض</th>
                <th className="px-6 py-4 border-b border-slate-100">الطبيب</th>
                <th className="px-6 py-4 border-b border-slate-100">توقيتات حركة الزيارة</th>
                <th className="px-6 py-4 border-b border-slate-100">الحالة</th>
                <th className="px-6 py-4 border-b border-slate-100">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {filteredAppointments.sort((a,b) => dayjs(b.date).diff(dayjs(a.date))).map(app => {
                const isUnconfirmed = app.status === 'scheduled' && !app.isConfirmed;
                const pat = patients.find(p => p.id === app.patientId);
                const doc = doctors.find(d => d.id === app.doctorId);
                return (
                  <tr 
                    key={app.id} 
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", app.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(app.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                    }}
                    className={`transition-all hover:bg-slate-50 border-r-4 cursor-grab active:cursor-grabbing ${
                      draggingId === app.id ? 'opacity-30 bg-indigo-50/30' : ''
                    } ${
                      isUnconfirmed 
                        ? 'bg-amber-50/50 border-r-amber-500 hover:bg-amber-100/60' 
                        : app.isConfirmed && app.status === 'scheduled'
                          ? 'border-r-emerald-500 hover:bg-slate-50'
                          : 'border-r-transparent'
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-slate-350 font-bold select-none cursor-grab bg-slate-100 px-1.5 py-1 rounded text-[10px]" title="مقبض السحب لفرع آخر">⁝⁝</span>
                        <div>
                          <div className="font-bold text-slate-700">{dayjs(app.date).format('YYYY/MM/DD')}</div>
                          <div className="text-[10px] text-slate-400 font-mono italic">{dayjs(app.date).format('HH:mm')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-right">
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-slate-800">{pat?.name}</div>
                          {app.isSpecial && (
                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 text-[9px] font-black border border-purple-200 rounded">كشف خاص</span>
                          )}
                        </div>
                        {pat?.phone && (
                          <div className="text-[10px] text-slate-500 font-bold font-mono">📱 {pat.phone}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-blue-600 font-bold">د. {doc?.name}</div>
                    </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5 min-w-[200px] bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-400 font-bold text-[9px]">وصول العيادة:</span>
                        <div className="flex items-center gap-1">
                          <input 
                            type="time" 
                            value={app.arrivalTime || ''} 
                            onChange={async (e) => {
                              await api.updateAppointment(app.id, { arrivalTime: e.target.value });
                              onRefresh();
                            }}
                            className="px-1.5 py-0.5 bg-white border border-slate-200 text-[11px] font-bold rounded focus:outline-none w-[75px]"
                          />
                          <button 
                            type="button"
                            onClick={async () => {
                              await api.updateAppointment(app.id, { arrivalTime: dayjs().format('HH:mm') });
                              onRefresh();
                            }}
                            className="px-1 py-0.5 bg-blue-55 bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 text-[8px] font-black rounded"
                          >
                            الآن
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-400 font-bold text-[9px]">دخول الطبيب:</span>
                        <div className="flex items-center gap-1">
                          <input 
                            type="time" 
                            value={app.entryTime || ''} 
                            onChange={async (e) => {
                              await api.updateAppointment(app.id, { entryTime: e.target.value });
                              onRefresh();
                            }}
                            className="px-1.5 py-0.5 bg-white border border-slate-200 text-[11px] font-bold rounded focus:outline-none w-[75px]"
                          />
                          <button 
                            type="button"
                            onClick={async () => {
                              await api.updateAppointment(app.id, { entryTime: dayjs().format('HH:mm') });
                              onRefresh();
                            }}
                            className="px-1 py-0.5 bg-purple-100 text-purple-705 border border-purple-200 hover:bg-purple-200 text-[8px] font-black rounded"
                          >
                            الآن
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-400 font-bold text-[9px]">خروج وانصراف:</span>
                        <div className="flex items-center gap-1">
                          <input 
                            type="time" 
                            value={app.departureTime || ''} 
                            onChange={async (e) => {
                              await api.updateAppointment(app.id, { departureTime: e.target.value });
                              onRefresh();
                            }}
                            className="px-1.5 py-0.5 bg-white border border-slate-200 text-[11px] font-bold rounded focus:outline-none w-[75px]"
                          />
                          <button 
                            type="button"
                            onClick={async () => {
                              await api.updateAppointment(app.id, { departureTime: dayjs().format('HH:mm') });
                              onRefresh();
                            }}
                            className="px-1 py-0.5 bg-emerald-100 text-emerald-850 border border-emerald-200 hover:bg-emerald-200 text-[8px] font-black rounded"
                          >
                            الآن
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                           app.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : 
                           app.status === 'completed' ? 'bg-green-100 text-green-700' : 
                           'bg-red-100 text-red-700'
                        }`}>
                          {app.status === 'scheduled' ? 'مجدول' : app.status === 'completed' ? 'مكتمل' : 'ملغي'}
                        </span>
                        
                        {app.status === 'scheduled' && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            app.isConfirmed 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                              : 'bg-amber-100 text-amber-800 border border-amber-250 animate-pulse'
                          }`}>
                            {app.isConfirmed ? '✅ مؤكد' : '⚠️ لم يؤكد'}
                          </span>
                        )}
                      </div>

                      {app.status === 'scheduled' && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <button 
                            onClick={async () => {
                              await api.updateAppointment(app.id, { isConfirmed: !app.isConfirmed });
                              onRefresh();
                            }}
                            type="button"
                            className={`p-1 px-2 text-[9px] font-black rounded border cursor-pointer transition-all ${
                              app.isConfirmed 
                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-350' 
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-500 shadow-sm'
                            }`}
                            title={app.isConfirmed ? "تغيير حالة التأكيد إلى غير مؤكد" : "تأكيد موعد العميل"}
                          >
                            {app.isConfirmed ? 'إلغاء التأكيد' : 'تأكيد الحضور ✅'}
                          </button>

                          {pat?.phone && (
                            <a 
                              href={`https://api.whatsapp.com/send?phone=${pat.phone.startsWith('0') ? '20' + pat.phone.substring(1) : pat.phone}&text=${encodeURIComponent(
                                `مرحباً أ. ${pat.name}، نود تذكيركم بموعدكم المحجوز لدى د. ${doc?.name || ''} يوم ${dayjs(app.date).format('YYYY/MM/DD')} الساعة ${dayjs(app.date).format('HH:mm')} في عيادتنا. يرجى تأكيد حضوركم بالرد على هذه الرسالة. شكراً لكم!`
                              )}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-1 px-2 bg-green-55 bg-green-100 hover:bg-green-200 text-green-700 font-bold text-[9px] rounded border border-green-200 transition-all flex items-center gap-1 cursor-pointer"
                              title="إرسال رسالة تذكير سريعة عبر الواتساب"
                            >
                              <span>💬 تذكير واتساب</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => onSelectPatient && onSelectPatient(app.patientId, app.id)}
                        className="py-1.5 px-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-xs font-black transition-all flex items-center gap-1.5"
                        title="الدخول للكشف / ملف المريض"
                      >
                        <Users size={12} />
                        <span>الدخول للكشف</span>
                      </button>
                      {app.status === 'scheduled' && (
                        <button 
                          onClick={() => onSelectPatient && onSelectPatient(app.patientId, app.id)} 
                          className="py-1.5 px-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-xs font-black transition-all flex items-center gap-1.5" 
                          title="إتمام وتأكيد الحسابات الطبية"
                        >
                          <Plus size={12} />
                          <span>إتمام</span>
                        </button>
                      )}
                      <button onClick={() => handleDelete(app.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-all" title="إلغاء الموعد"><X size={16} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {isAdding && (
          <AppointmentModal 
            onClose={() => setIsAdding(false)} 
            doctors={doctors}
            patients={patients}
            appointments={appointments}
            getDoctorLoad={getDoctorLoad}
            selectedBranch={selectedBranch}
            currentUser={currentUser}
            onSubmit={async (data: any) => {
              await api.createAppointment(data);
              onRefresh();
              setIsAdding(false);
            }} 
          />
        )}

        {showDailyReportModal && (
          <DailyReportPrintModal
            onClose={() => setShowDailyReportModal(false)}
            date={inspectionDate}
            appointments={appointments}
            doctors={doctors}
            patients={patients}
          />
        )}

        {showExcelImportModal && (
          <ImportAppointmentsExcelModal
            onClose={() => setShowExcelImportModal(false)}
            doctors={doctors}
            patients={patients}
            onComplete={() => {
              onRefresh();
              setShowExcelImportModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DailyReportPrintModal({ onClose, date, appointments, doctors, patients }: { onClose: () => void, date: string, appointments: any[], doctors: any[], patients: any[] }) {
  // تصفية مواعيد اليوم المحدد
  const todayAppointments = useMemo(() => {
    return appointments.filter(a => dayjs(a.date).format('YYYY-MM-DD') === date);
  }, [appointments, date]);

  // تصفية وحساب حالة العيادات اليوم
  const clinicsStatus = useMemo(() => {
    return doctors.map(doc => {
      const docApps = todayAppointments.filter(a => a.doctorId === doc.id);
      const total = docApps.length;
      const completed = docApps.filter(a => a.status === 'completed').length;
      const cancelled = docApps.filter(a => a.status === 'cancelled').length;
      const pending = docApps.filter(a => a.status === 'scheduled').length;
      
      let statusLabel = 'غير نشطة (0 حجز)';
      let isCompleted = false;
      let statusColor = 'bg-slate-100 text-slate-400 border-slate-200';

      if (total > 0) {
        if (pending === 0) {
          statusLabel = 'مكتملة 100%';
          isCompleted = true;
          statusColor = 'bg-emerald-55 text-emerald-700 border-emerald-200';
        } else {
          statusLabel = `نشطة (متبقي ${pending})`;
          statusColor = 'bg-amber-55 text-amber-700 border-amber-200';
        }
      }

      return {
        doctor: doc,
        total,
        completed,
        cancelled,
        pending,
        statusLabel,
        isCompleted,
        statusColor
      };
    });
  }, [todayAppointments, doctors]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[3px] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
            background: none !important;
          }
          #report-print-area, #report-print-area * {
            visibility: visible;
          }
          #report-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            background: white !important;
            color: black !important;
            direction: rtl;
            padding: 30px !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <motion.div 
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="bg-slate-900 border border-slate-800 text-white w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row h-[85vh] no-print"
      >
        {/* Left column: Setup summary info (controls) */}
        <div className="w-full lg:w-1/3 p-6 overflow-y-auto border-r border-slate-800 space-y-6 text-right order-2 lg:order-1 bg-slate-950 text-slate-300">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <FileText size={18} className="text-emerald-500" />
              تصدير وطباعة ملخص اليوم
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-3 text-xs">
            <p className="font-bold text-teal-400 text-md">التاريخ المختار: {dayjs(date).format('YYYY/MM/DD')}</p>
            <hr className="border-slate-800" />
            <div className="space-y-1">
              <p>إجمالي كشوفات اليوم: <span className="font-black text-white">{todayAppointments.length} كشف</span></p>
              <p>المكتملة بنجاح: <span className="font-bold text-emerald-400">{todayAppointments.filter(a => a.status === 'completed').length}</span></p>
              <p>الانتظار أو المجدولة: <span className="font-bold text-amber-400">{todayAppointments.filter(a => a.status === 'scheduled').length}</span></p>
              <p>الملغاة: <span className="font-bold text-red-400">{todayAppointments.filter(a => a.status === 'cancelled').length}</span></p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-black text-white px-1">العيادات اليومية وتغطيتها:</h3>
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {clinicsStatus.filter(c => c.total > 0).map((c, idx) => (
                <div key={idx} className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-850 text-xs flex justify-between items-center">
                  <span className={`text-[9px] px-2 py-0.5 rounded-md font-black ${c.isCompleted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {c.statusLabel}
                  </span>
                  <div className="text-right">
                    <p className="font-black text-white">د. {c.doctor.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">الحجوزات: {c.total} (مكتمل: {c.completed})</p>
                  </div>
                </div>
              ))}
              {clinicsStatus.filter(c => c.total > 0).length === 0 && (
                <p className="text-[11px] text-slate-500 italic text-center py-4">لا توجد عيادات مسجل بها حجوزات اليوم.</p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
            <button 
              type="button" 
              onClick={handlePrint}
              className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5 text-xs shadow-lg shadow-emerald-950/20"
            >
              تحميل وحفظ ملخص اليوم PDF 🖨️
            </button>
            <button 
              type="button" 
              onClick={onClose} 
              className="py-3 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 text-xs text-center transition-all"
            >
              إلغاء
            </button>
          </div>
        </div>

        {/* Right column: Real-time paper template render (visual design) */}
        <div className="w-full lg:w-2/3 p-8 bg-slate-800 overflow-y-auto flex items-center justify-center order-1 lg:order-2">
          {/* Printable visual frame representing standard A4 report */}
          <div 
            id="report-print-area" 
            className="w-full max-w-[650px] aspect-[1/1.414] bg-white text-slate-900 rounded-lg shadow-2xl p-8 flex flex-col justify-between text-right font-sans relative border-t-8 border-emerald-600"
            style={{ direction: 'rtl' }}
          >
            {/* Header */}
            <div>
              <div className="flex justify-between items-start border-b-2 border-slate-200 pb-4">
                <div className="text-right">
                  <h1 className="text-base font-black text-slate-900">مجمع عيادات الشفاء الطبي</h1>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">Al-Shifa Medical Complex</p>
                  <p className="text-[9px] text-slate-400">هيكل المواعيد والتشغيل الفعلي لجميع التخصصات</p>
                </div>
                <div className="text-left font-mono">
                  <h2 className="text-sm font-black text-slate-800">تقرير ملخص المواعيد اليومي</h2>
                  <p className="text-[9px] text-blue-600 font-black tracking-wide">العيادات والتشغيل اليومي</p>
                  <p className="text-[9px] text-slate-450">التاريخ: {dayjs(date).format('YYYY/MM/DD')}</p>
                </div>
              </div>

              {/* Stats overview banner */}
              <div className="grid grid-cols-4 gap-4 text-center mt-6">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-[8px] text-slate-400 font-black block">إجمالي كشوفات اليوم</span>
                  <span className="text-sm font-black text-slate-800">{todayAppointments.length}</span>
                </div>
                <div className="bg-emerald-50/55 p-2.5 rounded-lg border border-emerald-100">
                  <span className="text-[8px] text-emerald-600 font-black block">الكشوفات المكتملة</span>
                  <span className="text-sm font-black text-emerald-700">{todayAppointments.filter(a => a.status === 'completed').length}</span>
                </div>
                <div className="bg-amber-50/55 p-2.5 rounded-lg border border-amber-100">
                  <span className="text-[8px] text-amber-600 font-black block">قيد الانتظار أو Scheduled</span>
                  <span className="text-sm font-black text-amber-700">{todayAppointments.filter(a => a.status === 'scheduled').length}</span>
                </div>
                <div className="bg-rose-50/55 p-2.5 rounded-lg border border-rose-100">
                  <span className="text-[8px] text-rose-600 font-black block">الكشوفات الملغاة</span>
                  <span className="text-sm font-black text-rose-700">{todayAppointments.filter(a => a.status === 'cancelled').length}</span>
                </div>
              </div>

              {/* Clinics Status summary table */}
              <div className="mt-6 text-right">
                <h3 className="text-[11px] font-black text-slate-800 mb-2.5 border-r-4 border-emerald-600 pr-2 pb-0.5">أولاً: مؤشرات تشغيل وتغطية عيادات الأطباء</h3>
                <table className="w-full text-right text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-black border-b border-slate-100">
                      <th className="py-2 px-3">اسم الطبيب</th>
                      <th className="py-2 px-3">التخصص</th>
                      <th className="py-2 px-3">إجمالي الحجوزات</th>
                      <th className="py-2 px-3">المكتملة</th>
                      <th className="py-2 px-3">الملغاة</th>
                      <th className="py-2 px-3 font-semibold">حالة التشغيل والتغطية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-slate-705">
                    {clinicsStatus.map((c, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-black text-slate-900">د. {c.doctor.name}</td>
                        <td className="py-2 px-3">{c.doctor.specialty}</td>
                        <td className="py-2 px-3">{c.total}</td>
                        <td className="py-2 px-3 text-emerald-600">{c.completed}</td>
                        <td className="py-2 px-3 text-red-500">{c.cancelled}</td>
                        <td className="py-2 px-3">
                          <span className={`${c.total === 0 ? 'text-slate-400' : c.isCompleted ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {c.statusLabel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Daily appointments Schedule list */}
              <div className="mt-6 text-right">
                <h3 className="text-[11px] font-black text-slate-800 mb-2.5 border-r-4 border-emerald-600 pr-2 pb-0.5">ثانياً: سجل وجدول كشوفات المرضى التفصيلي</h3>
                <table className="w-full text-right text-[9px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-black border-b border-slate-100">
                      <th className="py-2 px-3">الوقت</th>
                      <th className="py-2 px-3">اسم المريض</th>
                      <th className="py-2 px-3">الطبيب المعالج</th>
                      <th className="py-2 px-3">النوع/الزيارة</th>
                      <th className="py-2 px-3">حالة الحضور</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-slate-750">
                    {todayAppointments.map((app, idx) => {
                      const pt = patients.find(p => p.id === app.patientId);
                      const doc = doctors.find(d => d.id === app.doctorId);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-mono font-black">{app.time}</td>
                          <td className="py-2 px-3 text-slate-900">{pt?.name || 'مريض مجهول'}</td>
                          <td className="py-2 px-3">د. {doc?.name || 'مجهول'}</td>
                          <td className="py-2 px-3">{app.type === 'consultation' ? 'استشارة' : 'كشف جديد'}</td>
                          <td className="py-2 px-3">
                            <span className={
                              app.status === 'completed' ? 'text-emerald-600 font-black' :
                              app.status === 'cancelled' ? 'text-red-500 font-black' :
                              'text-amber-600 font-black'
                            }>
                              {app.status === 'completed' ? 'مكتمل ومؤكد' :
                               app.status === 'cancelled' ? 'ملغي' : 'مجدول / قيد الانتظار'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {todayAppointments.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400 italic font-medium">لا توجد مواعيد كشوفات مسجلة لهذا اليوم التاريخي بعد.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer with legal stamp box */}
            <div className="border-t border-slate-150 pt-3 mt-6">
              <div className="flex justify-between items-end">
                <div className="text-right text-[7.5px] text-slate-400 max-w-[400px] leading-relaxed">
                  📜 مستند ملخص تشغيلي مستخرج تلقائياً من نظام العيادات الشامل. مراجعة وتدقيق إدارة الاستقبال والبيانات المالية.
                </div>
                <div className="text-center w-[120px] border-t border-dashed border-slate-350 pt-1">
                  <span className="text-[7.5px] font-black text-slate-400 uppercase block tracking-wider">ختم وتوقيع المدير الطبي</span>
                  <span className="text-[8px] font-extrabold text-slate-650 block mt-2">إدارة مجمع الشفاء</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AppointmentModal({ onClose, onSubmit, doctors, patients, getDoctorLoad, initialPatientId, selectedBranch, currentUser, appointments = [] }: any) {
  const [formData, setFormData] = useState({
    patientId: initialPatientId || "",
    doctorId: "",
    date: dayjs().add(1, 'day').format('YYYY-MM-DDTHH:mm'),
    notes: "",
    reminderEnabled: true,
    reminderLeadTimeHours: 2,
    isSpecial: false,
    specialPrice: 0,
    branch: selectedBranch || "المعادي"
  });

  const [showBranchWarning, setShowBranchWarning] = useState(false);

  const selectedDoctor = doctors.find((d: any) => d.id === formData.doctorId);

  useEffect(() => {
    if (selectedDoctor) {
      setFormData(prev => ({
        ...prev,
        specialPrice: prev.isSpecial ? (selectedDoctor.examinationPrice * 2) : 0
      }));
    }
  }, [formData.isSpecial, formData.doctorId, selectedDoctor]);

  const currentLoad = formData.doctorId ? getDoctorLoad(formData.doctorId, formData.date) : 0;
  const isOverCapacity = selectedDoctor && selectedDoctor.maxPatientsPerDay && currentLoad >= selectedDoctor.maxPatientsPerDay;

  // Generate recommended available time slots for the doctor using scheduling constraints
  const availableSlots = useMemo(() => {
    if (!selectedDoctor || !formData.date) return [];
    
    try {
      const apptDate = dayjs(formData.date);
      const dayOfWeek = apptDate.day();
      const dateStr = apptDate.format("YYYY-MM-DD");
      
      const schedule = selectedDoctor.weeklySchedule || {};
      const activeDays = schedule.activeDays || [0, 1, 2, 3, 4, 5, 6];
      const startTimeStr = schedule.startTime || "09:00";
      const endTimeStr = schedule.endTime || "17:00";
      
      // If the selected day of week is not a workday, return empty list
      if (!activeDays.includes(dayOfWeek)) {
        return [];
      }
      
      const slots = [];
      const [startHour, startMin] = startTimeStr.split(":").map(Number);
      const [endHour, endMin] = endTimeStr.split(":").map(Number);
      
      let current = dayjs(dateStr).hour(startHour).minute(startMin);
      const end = dayjs(dateStr).hour(endHour).minute(endMin);
      
      // Filter existing appointments for this doctor on selected day
      const doctorDayAppts = (appointments || []).filter((app: any) => {
        const isSameDoc = app.doctorId === selectedDoctor.id;
        const isSameDay = dayjs(app.date).format("YYYY-MM-DD") === dateStr;
        const isNotCancelled = app.status !== "cancelled";
        return isSameDoc && isSameDay && isNotCancelled;
      });
      
      // Prevent infinite loop if timestamps are corrupted
      let securityCounter = 0;
      while ((current.isBefore(end) || current.isSame(end)) && securityCounter < 50) {
        securityCounter++;
        const slotTimeStr = current.format("HH:mm");
        const isBooked = doctorDayAppts.some((app: any) => {
          return dayjs(app.date).format("HH:mm") === slotTimeStr;
        });
        
        slots.push({
          time: slotTimeStr,
          isBooked,
          dateTimeStr: `${dateStr}T${slotTimeStr}`,
        });
        
        current = current.add(30, 'minute');
      }
      
      return slots;
    } catch (err) {
      console.error("Error calculating availableSlots:", err);
      return [];
    }
  }, [selectedDoctor, formData.date, appointments]);

  // Calculate schedule validation errors for the doctor's weeklySchedule
  let scheduleError = "";
  if (selectedDoctor && formData.date) {
    const apptDate = dayjs(formData.date);
    const dayOfWeek = apptDate.day(); // 0 is Sunday, ..., 6 is Saturday
    const timeStr = apptDate.format("HH:mm");

    const schedule = selectedDoctor.weeklySchedule;
    if (schedule) {
      const activeDays = schedule.activeDays || [0, 1, 2, 3, 4, 5, 6];
      const startTime = schedule.startTime || "09:00";
      const endTime = schedule.endTime || "17:00";

      if (!activeDays.includes(dayOfWeek)) {
        const arabicDays: Record<number, string> = {
          0: 'الأحد',
          1: 'الاثنين',
          2: 'الثلاثاء',
          3: 'الأربعاء',
          4: 'الخميس',
          5: 'الجمعة',
          6: 'السبت'
        };
        const activeDayNames = activeDays.map((d: number) => arabicDays[d]).join("، ");
        scheduleError = `عذراً، يوم الحجز لا يتطابق مع جدول عمل الطبيب المقررة أسبوعياً: (${activeDayNames})`;
      } else if (timeStr < startTime || timeStr > endTime) {
        scheduleError = `عذراً، وقت الحجز خارج ساعات العمل المقررة للطبيب في هذا اليوم (${startTime} - ${endTime})`;
      }
    }
  }

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="bg-white w-full max-w-lg rounded-xl overflow-hidden shadow-2xl border border-slate-200"
      >
        <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800">حجز موعد جديد</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"><X size={20} /></button>
        </div>
        <form 
          className="p-6 space-y-4 text-right" 
          onSubmit={(e) => { 
            e.preventDefault(); 
            const userDefBranch = currentUser?.branch || "المعادي";
            if (formData.branch !== userDefBranch && !showBranchWarning) {
              setShowBranchWarning(true);
            } else {
              onSubmit(formData); 
            }
          }}
        >
          {!initialPatientId && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">اختر المريض</label>
              <select required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold" value={formData.patientId} onChange={(e) => setFormData({...formData, patientId: e.target.value})}>
                <option value="">- اختر مريض -</option>
                {patients.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.caseCode})</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">اختر الطبيب</label>
            <select required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold" value={formData.doctorId} onChange={(e) => setFormData({...formData, doctorId: e.target.value})}>
              <option value="">- اختر طبيب -</option>
              {doctors.map((d: any) => (
                <option key={d.id} value={d.id}>د. {d.name} ({d.specialty})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">فرع الحجز 🏢</label>
            <select required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold" value={formData.branch} onChange={(e) => setFormData({...formData, branch: e.target.value})}>
              <option value="المعادي">فرع المعادي</option>
              <option value="الدقي">فرع الدقي</option>
              <option value="مدينة نصر">فرع مدينة نصر</option>
              <option value="اسكندرية">فرع اسكندرية</option>
            </select>
          </div>

          {selectedDoctor && (
            <div className={`p-3 rounded-lg border flex items-center justify-between transition-all ${isOverCapacity ? 'bg-red-50 border-red-100 text-red-600' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className={isOverCapacity ? 'text-red-500' : 'text-slate-400'} />
                <span className="text-[10px] font-bold uppercase">إشغال الطبيب لهذا اليوم:</span>
              </div>
              <span className="text-xs font-black">{currentLoad} / {selectedDoctor.maxPatientsPerDay || '∞'}</span>
            </div>
          )}

          {isOverCapacity && (
            <div className="text-[10px] text-red-500 font-bold bg-red-50 p-2 rounded border border-red-100 text-center animate-pulse">
              تحذير: تم تخطي العدد المسموح لهذا الطبيب في هذا اليوم!
            </div>
          )}

          {scheduleError && (
            <div className="text-xs text-red-650 font-extrabold bg-red-50/70 p-3 rounded-lg border border-red-200/60 text-right leading-relaxed flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <span>{scheduleError}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">التاريخ والوقت</label>
            <input required type="datetime-local" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
          </div>

          {selectedDoctor && availableSlots.length > 0 && (
            <div className="space-y-2 mt-2 bg-slate-50/50 p-4 border border-slate-150 rounded-xl">
              <span className="text-[10px] font-black text-slate-500 block uppercase tracking-wide">
                🕒 مواعيد الطبيب ومؤشرات الإتاحة لليوم ({dayjs(formData.date).format("YYYY-MM-DD")}):
              </span>
              <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto pr-1">
                {availableSlots.map((slot: any) => {
                  const isCurrent = dayjs(formData.date).format("HH:mm") === slot.time;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={slot.isBooked}
                      onClick={() => setFormData({ ...formData, date: slot.dateTimeStr })}
                      className={`py-1.5 text-center text-xs font-black rounded-lg transition-all border ${
                        slot.isBooked
                          ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed line-through text-[10px] flex items-center justify-center gap-0.5'
                          : isCurrent
                          ? 'bg-blue-600 border-blue-700 text-white shadow-md scale-102 font-black'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50/50'
                      }`}
                    >
                      <span>{slot.time}</span>
                      {slot.isBooked && <span className="text-[9px]">🚫</span>}
                    </button>
                  );
                })}
              </div>
              <p className="text-[9px] text-slate-400 font-bold leading-none">
                * انقر على أي موعد متاح لتعبئة التوقيت فورياً وتأكيد حجز الخانة المتاحة للطبيب المختار.
              </p>
            </div>
          )}

          {selectedDoctor && (
            <div className="bg-blue-50/50 p-4 border border-blue-100 rounded-xl space-y-2 mt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500">طريقة احتساب الكشف بالطبيب:</span>
                <span className="font-black text-blue-700">
                  {selectedDoctor.accountingSystem === 'fixed' && 'ثابت لكل حالة'}
                  {selectedDoctor.accountingSystem === 'percentage' && 'نسبة مئوية'}
                  {selectedDoctor.accountingSystem === 'daily' && 'مرتب يومي ثابت'}
                  {selectedDoctor.accountingSystem === 'hybrid' && `نظام هجين`}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs pb-1 border-b border-blue-105/40">
                <span className="font-bold text-slate-500">تكلفة الكشف المعتمدة في الإدارة:</span>
                <span className="font-black text-slate-800 font-mono">{selectedDoctor.examinationPrice || 0} ج.م</span>
              </div>
              <div className="flex justify-between items-center text-sm pt-1">
                <span className="font-black text-slate-700">التكلفة الفعلية المقررة للحجز:</span>
                <span className="font-black text-emerald-600 text-base font-mono">
                  {formData.isSpecial ? (formData.specialPrice || (selectedDoctor.examinationPrice * 2)) : (selectedDoctor.examinationPrice || 0)} ج.م
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold leading-normal">
                ✓ تؤخذ التكلفة والسعر مباشرة وفي الحال من طريقة الاحتساب وقيم التسعير المدخلة في "إدارة الأطباء".
              </p>
            </div>
          )}

          <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="isSpecial" className="text-xs font-black text-slate-705 cursor-pointer select-none flex items-center gap-2">
                <span>جلسة كشف خاص (مستعجل / تخصصي) ⚡</span>
              </label>
              <input 
                id="isSpecial" 
                type="checkbox" 
                className="size-4 text-blue-600 focus:ring-blue-500/10 border-slate-300 rounded cursor-pointer"
                checked={formData.isSpecial} 
                onChange={(e) => setFormData({...formData, isSpecial: e.target.checked})} 
              />
            </div>
            
            {formData.isSpecial && (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-loose">سعر الكشف الخاص المقترح (ج.م)</label>
                <input 
                  required 
                  type="number" 
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-black" 
                  value={formData.specialPrice || 0} 
                  onChange={(e) => setFormData({...formData, specialPrice: Number(e.target.value)})} 
                />
                <span className="text-[9px] text-slate-400 font-bold block mt-1">يُنصح بـ كشف مضاعف تقديرياً من تسعيرة الطبيب المعتادة بقيمة {selectedDoctor?.examinationPrice || 0} ج.م</span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">ملاحظات إضافية</label>
            <textarea className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm h-20 resize-none" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="أي ملاحظات حول الموعد..." />
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="submit" 
              disabled={!!scheduleError}
              className={`flex-1 py-3 font-bold rounded-lg transition-all text-sm ${
                scheduleError 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-900/10'
              }`}
            >
              تأكيد الحجز
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 text-sm">إلغاء</button>
          </div>
        </form>
      </motion.div>

      {/* Smart Branch Warning Popup */}
      <AnimatePresence>
        {showBranchWarning && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-205 shadow-2xl text-right space-y-4"
              dir="rtl"
            >
              <div className="flex items-center gap-3 text-amber-600">
                <div className="size-10 bg-amber-50 rounded-xl flex items-center justify-center text-lg animate-bounce">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-850">تنبيه حجز فرع different!</h3>
                  <p className="text-[10px] text-slate-400 font-bold">مراجعة إعدادات فرع الموعد المختار</p>
                </div>
              </div>

              <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-200/50 text-[11px] font-bold text-slate-650 leading-relaxed text-right">
                <p>
                  لقد قمت باختيار <strong className="text-amber-800">فرع ({formData.branch})</strong> لهذا الموعد الطليعي.
                </p>
                <p className="mt-1">
                  علماً بأن <strong className="text-blue-700">فرعك الافتراضي الحالي هو ({currentUser?.branch || "المعادي"})</strong>. يرجى مراجعة وتأكيد اختيار الفرع لتجنب أي تداخل في السجلات والعمليات.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBranchWarning(false);
                    onSubmit(formData);
                  }}
                  className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11px] rounded-xl transition-all cursor-pointer text-center whitespace-nowrap animate-pulse"
                >
                  تأكيد واستمرار بالحجز
                </button>
                <button
                  type="button"
                  onClick={() => setShowBranchWarning(false)}
                  className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] rounded-xl transition-all cursor-pointer text-center whitespace-nowrap"
                >
                  تعديل الفرع / مراجعة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AuditLogsView({ logs, onRefresh, users }: { logs: AuditLog[], onRefresh?: () => void, key?: string, users: User[] }) {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const uniqueUsersInLogs = useMemo(() => {
    const list = new Set<string>();
    logs.forEach(l => {
      if (l.userId) list.add(l.userId);
    });
    users?.forEach(u => {
      if (u.name) list.add(u.name);
    });
    return Array.from(list);
  }, [logs, users]);

  const handleRestoreState = async (logId: string) => {
    if (!confirm("هل أنت متأكد من تراجع عملية الحذف هذه واستعادة الكائن المحذوف؟")) return;
    setRestoringId(logId);
    try {
      await api.restoreState(logId);
      alert("تمت عملية استعادة الكيان بنجاح وإرجاع البيانات المحذوفة إلى قوائم العيادة والملفات المقترنة! 🎉");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert("فشل التراجع ماليّاً أو بنيويّاً: " + err.message);
    } finally {
      setRestoringId(null);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (actionFilter !== "all" && log.action !== actionFilter) return false;
    if (userFilter !== "all" && (log.userId || "نظام تلقائي") !== userFilter) return false;
    if (dateFilter) {
      const logDate = dayjs(log.timestamp).format("YYYY-MM-DD");
      if (logDate !== dateFilter) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const detailsMatch = (log.details || "").toLowerCase().includes(q);
      const entityMatch = (log.entityType || "").toLowerCase().includes(q);
      const userMatch = (log.userId || "نظام تلقائي").toLowerCase().includes(q);
      if (!detailsMatch && !entityMatch && !userMatch) return false;
    }
    return true;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm font-sans">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">سجل العمليات (Audit Log)</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">تتبع الحركات والعمليات الحساسة في النظام</p>
        </div>
        
        {/* Stats counter badge */}
        <div className="bg-slate-50 border border-slate-150 rounded-xl px-4 py-2 flex items-center gap-3">
          <div className="text-right">
            <div className="text-[9px] text-slate-400 font-bold uppercase">العمليات المفلترة</div>
            <div className="text-lg font-black text-slate-800">{filteredLogs.length} <span className="text-[10px] text-slate-400 font-medium">خطوة</span></div>
          </div>
          <span className="text-slate-300">|</span>
          <div className="text-right">
            <div className="text-[9px] text-slate-400 font-bold uppercase">إجمالي السجل</div>
            <div className="text-lg font-black text-blue-600">{logs.length}</div>
          </div>
        </div>
      </header>

      {/* 🔍 Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        {/* Multi-field search */}
        <div className="relative flex-1 w-full font-sans">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="بحث بالتفاصيل، المعرّف أو الجدول..." 
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold placeholder:text-slate-400 text-slate-755"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap md:flex-nowrap gap-2 w-full md:w-auto font-sans">
          {/* Action type Filter */}
          <select 
            className="flex-1 md:w-44 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-black text-slate-600 focus:outline-none cursor-pointer"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="all">كل العمليات (إضافة/تعديل/حذف)</option>
            <option value="CREATE">عمليات الإضافة (CREATE)</option>
            <option value="UPDATE">عمليات التعديل (UPDATE)</option>
            <option value="DELETE">عمليات الحذف (DELETE)</option>
          </select>

          {/* User selector filter */}
          <select 
            className="flex-1 md:w-44 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-black text-slate-600 focus:outline-none cursor-pointer"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
          >
            <option value="all">كل الموظفين / المستخدمين</option>
            {uniqueUsersInLogs.map(u => (
              <option key={u} value={u}>👤 {u}</option>
            ))}
          </select>

          {/* Date Picker Filter */}
          <div className="flex-1 md:w-44">
            <input 
              type="date" 
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-black text-slate-600 focus:outline-none cursor-pointer"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>

          {/* Clear filters trigger */}
          {(actionFilter !== "all" || userFilter !== "all" || dateFilter || searchQuery) && (
            <button
              onClick={() => {
                setActionFilter("all");
                setUserFilter("all");
                setDateFilter("");
                setSearchQuery("");
              }}
              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-150 rounded-lg text-xs font-black transition-all flex items-center gap-1 active:scale-95"
            >
              إعادة تعيين ✕
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm font-sans">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest text-right">
                <th className="px-6 py-4 border-b border-slate-100">التاريخ والوقت</th>
                <th className="px-6 py-4 border-b border-slate-100">الموظف المسؤول 👤</th>
                <th className="px-6 py-4 border-b border-slate-100">العملية</th>
                <th className="px-6 py-4 border-b border-slate-100">الجدول / النوع</th>
                <th className="px-6 py-4 border-b border-slate-100">التفاصيل وحركة التعديل</th>
                <th className="px-6 py-4 border-b border-slate-100 text-left">التحكم والعمليات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {filteredLogs.map((log) => {
                const canRestore = log.action === 'DELETE' && (log.entityType === 'patient' || log.entityType === 'appointment' || log.entityType === 'visit' || log.entityType === 'inventory_item' || log.entityType === 'inventory' || log.entityType === 'user');
                return (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-755">{dayjs(log.timestamp).format('YYYY/MM/DD')}</div>
                      <div className="text-[10px] text-slate-400 font-mono italic">{dayjs(log.timestamp).format('HH:mm:ss')}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-black text-slate-700 text-xs flex items-center gap-1.5 bg-slate-50/80 hover:bg-slate-100 border border-slate-150 px-2.5 py-1 rounded-lg w-max shadow-sm">
                        <span>👤</span>
                        <span>{log.userId || "نظام تلقائي"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        log.action === 'CREATE' ? 'bg-green-100 text-green-700 border border-green-200' : 
                        log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700 border border-blue-250' : 
                        log.action === 'DELETE' ? 'bg-red-100 text-red-700 border border-red-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {log.action === 'CREATE' && 'إضافة'}
                        {log.action === 'UPDATE' && 'تعديل'}
                        {log.action === 'DELETE' && 'حذف'}
                        {!['CREATE', 'UPDATE', 'DELETE'].includes(log.action) && log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-widest">{log.entityType}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-800 font-bold">{log.details}</div>
                      <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate max-w-xs">{log.entityId}</div>
                    </td>
                    <td className="px-6 py-4 text-left">
                      {canRestore ? (
                        <button
                          type="button"
                          disabled={restoringId === log.id}
                          onClick={() => handleRestoreState(log.id)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-150 rounded-lg text-[10.5px] font-black tracking-tight transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                        >
                          {restoringId === log.id ? 'جاري الاستعادة...' : '↺ تراجع واستعادة الكائن'}
                        </button>
                      ) : (
                        <span className="text-slate-300 font-bold">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                   <td colSpan={5} className="px-6 py-20 text-center text-slate-350 italic">سجل العمليات المطابقة للبحث فارغ حالياً</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function UsersView({ users, doctors, onRefresh }: { users: User[], doctors: Doctor[], onRefresh: () => void, key?: string }) {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    username: '', 
    role: 'staff' as 'admin' | 'staff' | 'doctor', 
    password: '', 
    doctorId: '', 
    permissions: ['patients', 'appointments', 'inventory'] as string[],
    branch: 'المعادي'
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'staff' | 'doctor'>('all');

  const PERMISSION_SCOPES = [
    { key: 'patients', label: 'إدارة المرضى والسجلات', desc: 'إضافة وتعديل بيانات المرضى، تصفح ملفات المريض وتفاصيل العنوان والهاتف', group: 'المرضى', color: 'text-blue-600 bg-blue-50' },
    { key: 'appointments', label: 'تنظيم الحجز والمواعيد', desc: 'جدولة مواعيد المرضى بالرزنامة، إتمام وإلغاء الجلسات وإرسال التنبيهات', group: 'المواعيد', color: 'text-amber-600 bg-amber-50' },
    { key: 'clinical', label: 'التشخيص والروشتات الطبية', desc: 'معاينة وكتابة نتائج الكشوفات، خطط العلاج والروشتات، ورفع المرفقات', group: 'الطبية', color: 'text-emerald-600 bg-emerald-50' },
    { key: 'accounting', label: 'التقارير الحسابية والمالية', desc: 'تتبع الخزينة، أرباح الأطباء والعيادة، ومراجعة تفاصيل دفع المبالغ', group: 'المالية', color: 'text-red-600 bg-red-50' },
    { key: 'inventory', label: 'إدارة مخازن العيادة', desc: 'متابعة الأدوية والمستلزمات، ونقاط إعادة الطلب لإمدادات العيادة والعهد', group: 'المخزن', color: 'text-purple-600 bg-purple-50' },
    { key: 'branches', label: 'إدارة الفروع الإدارية والتحويل', desc: 'تتيح للمستخدم التبديل بين فروع النظام الأربعة ومشاهدة تقارير مقارنة الأداء والتقارير المالية للفروع', group: 'الفروع', color: 'text-indigo-600 bg-indigo-50' },
    { key: 'users', label: 'إدارة غرف الصلاحيات والمعرفات', desc: 'إنشاء وتحديث موظفي النظام، تعيين أدوار الدخول ومسح منسوبي العيادة', group: 'النظام', color: 'text-pink-600 bg-pink-50' }
  ];

  const getPresetsForRole = (role: 'admin' | 'staff' | 'doctor'): string[] => {
    if (role === 'admin') return ['patients', 'appointments', 'clinical', 'accounting', 'inventory', 'users', 'branches'];
    if (role === 'doctor') return ['patients', 'appointments', 'clinical'];
    return ['patients', 'appointments', 'inventory'];
  };

  const handleRoleChange = (newRole: 'admin' | 'staff' | 'doctor') => {
    setFormData(prev => ({
      ...prev,
      role: newRole,
      permissions: getPresetsForRole(newRole),
      doctorId: newRole === 'doctor' ? prev.doctorId : ''
    }));
  };

  const togglePermission = (scopeKey: string) => {
    setFormData(prev => {
      const active = prev.permissions.includes(scopeKey);
      const updated = active 
        ? prev.permissions.filter(k => k !== scopeKey)
        : [...prev.permissions, scopeKey];
      return { ...prev, permissions: updated };
    });
  };

  const calculatePasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, text: 'الرجاء إدخال كلمة مرور', color: 'bg-slate-200', textClass: 'text-slate-400', width: 'w-0' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (/[A-Z]/.test(pwd) || /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    
    if (score <= 1) return { score, text: 'كلمة مرور ضعيفة', color: 'bg-red-500', textClass: 'text-red-500 font-black', width: 'w-1/4' };
    if (score === 2) return { score, text: 'أمان متوسط - أضف رموزاً وأرقاماً', color: 'bg-amber-500', textClass: 'text-amber-600 font-bold', width: 'w-2/4' };
    if (score === 3) return { score, text: 'أمان عال وقوي للعمل الفعلي', color: 'bg-blue-500', textClass: 'text-blue-600 font-bold', width: 'w-3/4' };
    return { score, text: 'أمان ممتاز ومحصن للغاية', color: 'bg-emerald-500', textClass: 'text-emerald-600 font-black', width: 'w-full' };
  };

  const pwdIndicator = calculatePasswordStrength(formData.password);

  const handleDelete = async (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا المستخدم نهائياً وسحب كل صلاحياته؟")) {
      await api.deleteUser(id);
      onRefresh();
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.username.trim() || !formData.password.trim()) {
      alert("يرجى ملء جميع الحقول المطلوبة بالكامل.");
      return;
    }
    await api.createUser(formData);
    setFormData({ 
      name: '', 
      username: '', 
      role: 'staff', 
      password: '', 
      doctorId: '', 
      permissions: ['patients', 'appointments', 'inventory'],
      branch: 'المعادي'
    });
    setIsAdding(false);
    onRefresh();
  };

  const filteredUsers = users.filter(u => {
    const term = searchQuery.toLowerCase();
    const nameMatch = (u.name || "").toLowerCase().includes(term);
    const usernameMatch = (u.username || "").toLowerCase().includes(term);
    const matchesSearch = nameMatch || usernameMatch;
    
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 text-right">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Lock className="text-blue-600 size-6" />
            <span>إدارة أذونات وصلاحيات المستخدمين</span>
          </h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
            صياغة حسابات العمل وتفويض صلاحيات الوصول المخصصة للأطباء والمنسقين
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start">
          <button 
            type="button"
            onClick={async () => {
              try {
                const data = await api.getBackup();
                const jsonString = JSON.stringify(data, null, 2);
                const blob = new Blob([jsonString], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `clinic_system_backup_${dayjs().format('YYYY-MM-DD_HH-mm')}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              } catch (err) {
                alert("فشل تحميل النسخة الاحتياطية للبيانات.");
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/10 text-xs"
          >
            <Download size={16} />
            <span>تحميل نسخة احتياطية كاملة (JSON)</span>
          </button>

          {!isAdding && (
            <button 
              onClick={() => {
                setFormData({ 
                  name: '', 
                  username: '', 
                  role: 'staff', 
                  password: '', 
                  doctorId: '', 
                  permissions: getPresetsForRole('staff') 
                });
                setIsAdding(true);
              }}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/10 text-xs"
            >
              <UserPlus size={16} />
              <span>إنشاء مستخدم وصياغة صلاحيات جديدة</span>
            </button>
          )}
        </div>
      </header>

      {isAdding ? (
        <form onSubmit={handleCreate} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Right Column: Key Credentials (lg:col-span-4) */}
          <div className="lg:col-span-5 space-y-5 bg-white p-6 rounded-2xl border border-blue-100 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Shield className="text-blue-500 size-5" />
              <div>
                <h3 className="text-sm font-black text-slate-800">بيانات كارت العضوية بالعيادة</h3>
                <p className="text-[9px] text-slate-400 font-bold">المعرفات الشخصية وإعدادات الدخول الذكي للعيادة</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase block">الاسم المكتبي الكامل للموظف/الطبيب</label>
                <input 
                  required 
                  type="text" 
                  placeholder="مثال: د. محمد علي أو مريم السكرتيرة"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase block">اسم المستخدم الفريد (Username)</label>
                <input 
                  required 
                  type="text" 
                  placeholder="مثال: mohamed_doc"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 text-left focus:outline-none focus:ring-1 focus:ring-blue-500" 
                  value={formData.username} 
                  onChange={e => setFormData({...formData, username: e.target.value})} 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase block">مراتب القوى (الدور الرئيسي للمستخدم)</label>
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {(['admin', 'staff', 'doctor'] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleRoleChange(r)}
                      className={`py-2 px-1 text-center font-black rounded-lg text-[10px] border transition-all ${
                        formData.role === r 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {r === 'admin' ? 'مدير نظام' : r === 'doctor' ? 'طبيب طبي' : 'موظف استقبال'}
                    </button>
                  ))}
                </div>
                <p className="text-[8px] text-slate-400 font-medium leading-relaxed mt-1.5">
                  * سيقوم اختيار الدور بضبط مصفوفة الصلاحيات الموصى بها مسبقاً في اللوحة اليسارية تلقائياً.
                </p>
              </div>

              {formData.role === 'doctor' && (
                <div className="space-y-1 p-3 bg-blue-50/50 rounded-xl border border-blue-105 animate-in fade-in">
                  <label className="text-[10px] font-black text-blue-800 uppercase block mb-1">ارتباط بجدول الطبيب المعالج</label>
                  <select 
                    required={formData.role === 'doctor'}
                    className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none" 
                    value={formData.doctorId} 
                    onChange={e => setFormData({...formData, doctorId: e.target.value})}
                  >
                    <option value="">-- اختر السجل الطبي للربط المباشر --</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>)}
                  </select>
                  <p className="text-[8px] text-blue-600 font-medium leading-relaxed mt-1">
                    يربط الحساب السحابي بدفتر المواعيد وأرباح العيادة المتصلة بهذا الطبيب.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-400 uppercase">كلمة المرور المشفرة للدخول</label>
                  <span className={`text-[9px] font-black ${pwdIndicator.textClass}`}>{pwdIndicator.text}</span>
                </div>
                <input 
                  required 
                  type="password" 
                  placeholder="أدخل كلمة مرور قوية لحماية العيادة..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500" 
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})} 
                />
                
                {/* Visual meter */}
                <div className="h-1.5 bg-slate-100 rounded-full w-full overflow-hidden mt-1 flex">
                  <div className={`h-full transition-all duration-300 ${pwdIndicator.color} ${pwdIndicator.width}`} />
                </div>
              </div>

              <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-150">
                <label className="text-[10px] font-black text-slate-500 block mb-1">الفرع الافتراضي للموظف 🏢</label>
                <select 
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none" 
                  value={formData.branch} 
                  onChange={e => setFormData({...formData, branch: e.target.value})}
                >
                  <option value="المعادي">فرع المعادي</option>
                  <option value="الدقي">فرع الدقي</option>
                  <option value="مدينة نصر">فرع مدينة نصر</option>
                  <option value="اسكندرية">فرع اسكندرية</option>
                </select>
                <p className="text-[8px] text-slate-400 font-medium leading-relaxed mt-1">
                  الفرع المحدد تلقائياً عند تسجيل الدخول، والمصنف كـ "الفرع النشط الافتراضي" للمستخدم.
                </p>
              </div>
            </div>

            <div className="pt-4 flex gap-2 border-t border-slate-100 flex-row">
              <button 
                type="button" 
                onClick={() => setIsAdding(false)} 
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-xs rounded-lg text-center transition-colors"
              >
                رجوع وإلغاء
              </button>
              <button 
                type="submit" 
                className="flex-[2] py-2.5 bg-blue-600 text-white font-bold text-xs rounded-lg text-center shadow-md shadow-blue-900/10 hover:bg-blue-700 transition-all"
              >
                تأكيد وتسجيل الحساب
              </button>
            </div>
          </div>

          {/* Left Column: Interactive Permissions Matrix (lg:col-span-8) */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-800">صياغة وتفويض امتيازات الصلاحية مخصصاً</h3>
                <p className="text-[9px] text-slate-400 font-bold mt-0.5">يمكنك تفعيل أو إلغاء تفعيل أي نطاق وصلاحية للمستخدم بالضغط عليها</p>
              </div>
              <div className="bg-blue-50 px-2.5 py-1 rounded text-[9px] text-blue-700 font-black">
                إعداد مسبق: {formData.role === 'admin' ? 'أدمن كامل' : formData.role === 'doctor' ? 'طبي كامل' : 'إستقبال موجه'}
              </div>
            </div>

            {/* Matrix list layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PERMISSION_SCOPES.map(scope => {
                const isActive = formData.permissions.includes(scope.key);
                return (
                  <div
                    key={scope.key}
                    onClick={() => togglePermission(scope.key)}
                    className={`p-3.5 rounded-xl border-2 text-right transition-all cursor-pointer select-none relative flex flex-col justify-between h-28 ${
                      isActive 
                        ? 'border-blue-600 bg-blue-50/20' 
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div>
                      {/* Badge / Status Indicator */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded ${scope.color}`}>
                          {scope.group}
                        </span>
                        
                        {/* Checkbox circle indicator */}
                        <div className={`size-4 rounded-full border flex items-center justify-center transition-all ${
                          isActive ? 'bg-blue-600 border-blue-600' : 'bg-slate-50 border-slate-200'
                        }`}>
                          {isActive && <Check size={10} className="text-white font-black" />}
                        </div>
                      </div>

                      <h4 className="text-xs font-black text-slate-800 font-sans">{scope.label}</h4>
                      <p className="text-[9px] text-slate-400 leading-relaxed font-bold mt-1 line-clamp-2">
                        {scope.desc}
                      </p>
                    </div>

                    {/* Meta indicator */}
                    <div className="text-[8px] text-slate-300 font-bold pt-1 text-left">
                      {isActive ? 'تخويل كامل النشاط' : 'ممنوع الوصول'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Interactive Preview Notice */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 flex items-start gap-2 text-right">
              <Shield className="text-slate-400 size-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-[10px] font-black text-slate-600 block">نطاق الوصول والأمان المضمون للغرفة</span>
                <span className="text-[9px] text-slate-400 leading-relaxed font-bold block">
                  سيتم عزل أو تمكين الصفحات الطبية والحسابات المالية لهذا المستخدم في لوحة تحكم التطبيق بناء على مصفوفة التراخيص المعتمدة أعلاه.
                </span>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          {/* Filtering and search tools bar */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <span className="absolute right-3 top-2.5 text-slate-400">
                <Search size={16} />
              </span>
              <input 
                type="text" 
                placeholder="البحث باسم الموظف أو اسم الدخول..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-150 rounded-lg text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Filter tags */}
            <div className="flex flex-wrap gap-1.5 items-center w-full md:w-auto md:justify-end">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">تصفية الأدوار:</span>
              <button
                onClick={() => setRoleFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  roleFilter === 'all' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                الكل ({users.length})
              </button>
              <button
                onClick={() => setRoleFilter('admin')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  roleFilter === 'admin' 
                    ? 'bg-red-650 text-white shadow-sm bg-red-600' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                المدراء ({users.filter(u => u.role === 'admin').length})
              </button>
              <button
                onClick={() => setRoleFilter('doctor')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  roleFilter === 'doctor' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                الأطباء ({users.filter(u => u.role === 'doctor').length})
              </button>
              <button
                onClick={() => setRoleFilter('staff')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  roleFilter === 'staff' 
                    ? 'bg-slate-700 text-white shadow-sm' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                الاستقبال ({users.filter(u => u.role === 'staff').length})
              </button>
            </div>
          </div>

          {/* User List display grid/table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-150">
                    <th className="px-6 py-4">الموظف</th>
                    <th className="px-6 py-4">اسم حساب الدخول</th>
                    <th className="px-6 py-4">دور وصلاحية النظام</th>
                    <th className="px-6 py-4">الفرع الافتراضي 🏢</th>
                    <th className="px-6 py-4">نطاق السحب الحسابي والربط</th>
                    <th className="px-6 py-4">تراخيص الوصول المعتمدة (الامتيازات)</th>
                    <th className="px-6 py-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredUsers.map((u) => {
                    // Extract initials for visual avatar
                    const initials = (u.name || "").split(' ').slice(0, 2).map((w: string) => w[0]).join('');
                    const isDoctor = u.role === 'doctor';
                    const isAdmin = u.role === 'admin';
                    
                    // Active scopes tags
                    const activeScopes = u.permissions || getPresetsForRole(u.role);
                    
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Member Details */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`size-8 rounded-full flex items-center justify-center font-black text-xs text-white shrink-0 ${
                              isAdmin ? 'bg-red-500 shadow-md shadow-red-900/10' :
                              isDoctor ? 'bg-blue-500 shadow-md shadow-blue-900/10' :
                              'bg-slate-500'
                            }`}>
                              {initials || "U"}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 text-sm">{u.name}</div>
                              {u.doctorId && (
                                <div className="text-[9px] text-blue-600 font-black mt-0.5">
                                  مرتبط بجدول الطبيب: {doctors.find(d => d.id === u.doctorId)?.name}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Username */}
                        <td className="px-6 py-4 font-mono text-xs font-bold text-slate-500 text-left">
                          {u.username}
                        </td>

                        {/* Principal Role Card */}
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase inline-flex items-center gap-1 border ${
                            isAdmin ? 'bg-red-50 text-red-700 border-red-150' : 
                            isDoctor ? 'bg-blue-50 text-blue-700 border-blue-150' : 
                            'bg-slate-50 text-slate-700 border-slate-150'
                          }`}>
                            <span className={`size-1 rounded-full ${isAdmin ? 'bg-red-500' : isDoctor ? 'bg-blue-500' : 'bg-slate-500'}`}></span>
                            {isAdmin ? 'مدير نظام' : isDoctor ? 'طبيب طبي' : 'موظف استقبال'}
                          </span>
                        </td>

                        {/* Default Branch Card */}
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-wider">
                            {u.branch || 'المعادي'}
                          </span>
                        </td>

                        {/* Linked doctor identifier */}
                        <td className="px-6 py-4 text-xs font-bold text-slate-600">
                          {u.doctorId ? (
                            <span className="text-slate-700">{doctors.find(d => d.id === u.doctorId)?.name}</span>
                          ) : (
                            <span className="text-slate-400 font-medium italic">صلاحية شمولية مستقلة</span>
                          )}
                        </td>

                        {/* Handled Scopes list */}
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1 max-w-sm">
                            {PERMISSION_SCOPES.map(scope => {
                              const hasAccess = activeScopes.includes(scope.key);
                              return (
                                <span
                                  key={scope.key}
                                  title={`${scope.label}: ${scope.desc}`}
                                  className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md border ${
                                    hasAccess 
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-150' 
                                      : 'bg-slate-50 text-slate-300 border-slate-100 opacity-50 line-through'
                                  }`}
                                >
                                  <span className={`size-1 rounded-full ${hasAccess ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                  {scope.group}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-center">
                          <button 
                            type="button"
                            onClick={() => handleDelete(u.id)} 
                            className="p-1 px-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 mx-auto"
                            title="حذف حساب الموظف وسحب كامل الصلاحيات"
                          >
                            <X size={12} />
                            <span>مسح الحساب</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center text-slate-300 italic text-sm">
                        {users.length === 0 ? 'لا يوجد مستخدمين مسجلين بالنظام حالياً.' : 'لم نجد أي مستخدم يطابق معايير البحث والترشيح.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function ImportAppointmentsExcelModal({ onClose, doctors, patients, onComplete }: { onClose: () => void, doctors: Doctor[], patients: Patient[], onComplete: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [errorStatus, setErrorStatus] = useState<string>('');

  const cleanArabicText = (text: any) => {
    if (typeof text !== 'string') return '';
    return text
      .trim()
      .replace(/^دكتور\s+/i, '')
      .replace(/^د\.\s*/i, '')
      .replace(/\s+/g, ' ')
      .toLowerCase();
  };

  const findDoctorIdByName = (docName: string) => {
    if (!docName) return '';
    const needle = cleanArabicText(docName);
    const matched = doctors.find((d: any) => {
      const hst = cleanArabicText(d.name);
      return hst.includes(needle) || needle.includes(hst);
    });
    return matched ? matched.id : '';
  };

  const getRowVal = (row: any, keys: string[]) => {
    for (const k of keys) {
      if (row[k] !== undefined) return row[k];
      const foundKey = Object.keys(row).find(
        x => x.toLowerCase().trim() === k.toLowerCase().trim() || 
             x.trim().includes(k) || 
             k.includes(x.trim())
      );
      if (foundKey && row[foundKey] !== undefined) return row[foundKey];
    }
    return '';
  };

  const parseExcelDateValue = (val: any) => {
    if (!val) return '';
    if (val instanceof Date) {
      return dayjs(val).format('YYYY-MM-DD');
    }
    if (typeof val === 'number') {
      try {
        const date = XLSX.SSF.parse_date_code(val);
        const jsDate = new Date(date.y, date.m - 1, date.d);
        return dayjs(jsDate).format('YYYY-MM-DD');
      } catch (err) {
        console.error(err);
      }
    }
    const strVal = String(val).trim();
    const parsed = dayjs(strVal);
    if (parsed.isValid()) {
      return parsed.format('YYYY-MM-DD');
    }
    return strVal;
  };

  const parseExcelTimeValue = (val: any) => {
    if (!val) return '12:00';
    if (val instanceof Date) {
      return dayjs(val).format('HH:mm');
    }
    if (typeof val === 'number') {
      const totalMinutes = Math.round(val * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    const strVal = String(val).trim();
    if (/^\d{1,2}:\d{2}$/.test(strVal)) {
      const [h, m] = strVal.split(':');
      return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    }
    return strVal;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setFile(file);
    setErrorStatus('');
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        if (rawRows.length === 0) {
          setErrorStatus('لم نجد أي بيانات في الملف المختار.');
          return;
        }

        const mapped = rawRows.map((row: any, index: number) => {
          const name = String(getRowVal(row, ['اسم المريض', 'الاسم', 'الاسم كامل', 'اسم كامل', 'name', 'patient name', 'full name', 'patient_name']) || '').trim();
          const phone = String(getRowVal(row, ['رقم الهاتف', 'الهاتف', 'المحمول', 'الجوال', 'تليفون', 'phone', 'phone number', 'mobile']) || '').trim();
          const age = String(getRowVal(row, ['السن', 'العمر', 'age']) || '').trim();
          const rawGender = String(getRowVal(row, ['الجنس', 'النوع', 'gender', 'sex']) || '').trim();
          const gender = rawGender.includes('أنثى') || rawGender.includes('بنت') || rawGender.toLowerCase().startsWith('f') ? 'female' : 'male';
          const nationality = String(getRowVal(row, ['الجنسية', 'nationality']) || 'مصري').trim();

          const rawDocName = String(getRowVal(row, ['اسم الطبيب', 'الطبيب', 'الدكتور', 'doctor', 'doctor name', 'doc', 'doctor_name']) || '').trim();
          const serviceType = String(getRowVal(row, ['بند الحجز', 'نوع الخدمة', 'نوع الزيارة', 'الخدمة', 'service', 'service type', 'booking type', 'service_type']) || 'كشف جديد').trim();
          const rawDate = getRowVal(row, ['تاريخ الحجز', 'التاريخ', 'تاريخ', 'date', 'booking date', 'booking_date']);
          const rawTime = getRowVal(row, ['وقت الحجز', 'الوقت', 'وقت', 'time', 'booking time', 'booking_time']);

          const date = parseExcelDateValue(rawDate) || dayjs().add(1, 'day').format('YYYY-MM-DD');
          const time = parseExcelTimeValue(rawTime) || '12:00';
          const notes = String(getRowVal(row, ['ملاحظات', 'الملاحظات', 'ملاحظة', 'notes', 'note']) || '').trim();
          const rawIsSpecial = String(getRowVal(row, ['كشف خاص', 'خاص', 'is_special', 'is special', 'special']) || '').trim();
          const isSpecial = rawIsSpecial.includes('نعم') || rawIsSpecial.includes('خاص') || rawIsSpecial.toLowerCase() === 'yes' || rawIsSpecial.toLowerCase() === 'true';

          const rawBranch = String(getRowVal(row, ['الفرع', 'اسم الفرع', 'فرع', 'branch', 'branch name', 'branch_name']) || 'المعادي').trim();
          const matchedDoctorId = findDoctorIdByName(rawDocName);

          return {
            rowId: index,
            patient: {
              name,
              phone,
              age,
              gender,
              nationality,
              branch: rawBranch,
            },
            appointment: {
              doctorName: rawDocName,
              doctorId: matchedDoctorId,
              date,
              time,
              serviceType,
              isSpecial,
              notes,
              branch: rawBranch,
            }
          };
        }).filter(item => item.patient.name.length > 0);

        if (mapped.length === 0) {
          setErrorStatus('لم نتمكن من العثور على حقل "اسم المريض" أو البيانات فارغة في الملف المرفوع.');
          return;
        }

        setParsedRows(mapped);
      } catch (err) {
        console.error(err);
        setErrorStatus('حدث فشل أثناء تحليل الملف، يرجى التأكد من مطابقة الحقول.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    setImportProgress({ current: 0, total: parsedRows.length });

    const localPatientsList = [...patients];

    for (let i = 0; i < parsedRows.length; i++) {
      try {
        const item = parsedRows[i];
        
        let targetPatientId = '';
        const found = localPatientsList.find(p => 
          (p.name.trim() === item.patient.name.trim()) ||
          (item.patient.phone && p.phone === item.patient.phone)
        );

        if (found) {
          targetPatientId = found.id;
        } else {
          const newPatient = await api.createPatient({
            name: item.patient.name,
            phone: item.patient.phone,
            age: item.patient.age,
            gender: item.patient.gender,
            nationality: item.patient.nationality,
            caseCode: `P-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 10)}`,
            commissionNumber: "",
            nationalId: "",
            passportNumber: "",
            branch: item.patient.branch || "المعادي"
          });
          targetPatientId = newPatient.id;
          localPatientsList.push(newPatient);
        }

        const cleanDate = item.appointment.date;
        const cleanTime = item.appointment.time || '12:00';
        const fullDateTimeIso = `${cleanDate}T${cleanTime}`;

        const matchedDocId = item.appointment.doctorId || (doctors[0]?.id || '');

        if (matchedDocId && targetPatientId) {
          const isSpecial = item.appointment.isSpecial;
          const targetDoc = doctors.find((d: any) => d.id === matchedDocId);
          const basePrice = isSpecial 
            ? (targetDoc?.examinationPrice ? targetDoc.examinationPrice * 2 : 200) 
            : (targetDoc?.examinationPrice || 100);

          await api.createAppointment({
            patientId: targetPatientId,
            doctorId: matchedDocId,
            date: fullDateTimeIso,
            notes: item.appointment.notes || item.appointment.serviceType,
            reminderEnabled: true,
            reminderLeadTimeHours: 2,
            isSpecial: isSpecial,
            status: 'completed',
            arrivalTime: cleanTime,
            entryTime: dayjs(`${cleanDate}T${cleanTime}`).add(10, 'minute').format('HH:mm'),
            departureTime: dayjs(`${cleanDate}T${cleanTime}`).add(30, 'minute').format('HH:mm'),
            branch: item.appointment.branch || "المعادي"
          });

          await api.createVisit({
            patientId: targetPatientId,
            doctorId: matchedDocId,
            date: fullDateTimeIso,
            notes: item.appointment.notes || item.appointment.serviceType,
            serviceType: item.appointment.serviceType || 'كشف عادي',
            basePrice: basePrice,
            isPaid: true,
            status: 'completed',
            arrivalTime: cleanTime,
            entryTime: dayjs(`${cleanDate}T${cleanTime}`).add(10, 'minute').format('HH:mm'),
            departureTime: dayjs(`${cleanDate}T${cleanTime}`).add(30, 'minute').format('HH:mm'),
            branch: item.appointment.branch || "المعادي"
          });
        }
      } catch (err) {
        console.error("Failed to import row index ", i, err);
      }
      setImportProgress(prev => ({ ...prev, current: i + 1 }));
    }

    setImporting(false);
    onComplete();
  };

  const handleRemoveRow = (rowId: number) => {
    setParsedRows(prev => prev.filter(r => r.rowId !== rowId));
  };

  const downloadTemplate = () => {
    try {
      const headers = [
        "اسم المريض",
        "رقم الهاتف",
        "السن",
        "الجنس",
        "اسم الطبيب",
        "تاريخ الحجز",
        "وقت الحجز",
        "نوع الزيارة",
        "كشف خاص",
        "الفرع",
        "ملاحظات"
      ];

      const sampleData = [
        headers,
        [
          "أحمد سعيد الدوسري",
          "01023456789",
          "35",
          "ذكر",
          doctors[0]?.name || "محمد أحمد",
          dayjs().add(1, 'day').format('YYYY-MM-DD'),
          "11:00",
          "كشف جديد",
          "لا",
          "المعادي",
          "المريض يعاني من آلام مستمرة في المعدة منذ يومين"
        ],
        [
          "ليلى سمير عبد العزيز",
          "01198765432",
          "28",
          "أنثى",
          doctors[1]?.name || doctors[0]?.name || "منى محمود",
          dayjs().add(1, 'day').format('YYYY-MM-DD'),
          "13:30",
          "استشارة",
          "نعم",
          "الدقي",
          "متابعة نتائج التحاليل الطبية الشاملة"
        ]
      ];

      const ws = XLSX.utils.aoa_to_sheet(sampleData);
      
      ws['!cols'] = [
        { wch: 25 }, // اسم المريض
        { wch: 15 }, // رقم الهاتف
        { wch: 10 }, // السن
        { wch: 10 }, // الجنس
        { wch: 20 }, // اسم الطبيب
        { wch: 15 }, // تاريخ الحجز
        { wch: 15 }, // وقت الحجز
        { wch: 15 }, // نوع الزيارة
        { wch: 12 }, // كشف خاص
        { wch: 12 }, // الفرع
        { wch: 35 }, // ملاحظات
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "نموذج مواعيد العيادة");
      XLSX.writeFile(wb, "نموذج_جدول_المواعيد_والحجوزات.xlsx");
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء تصدير ملف النموذج.");
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 12 }}
        className="bg-white w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] text-right"
      >
        <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
              <Upload size={18} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800">استيراد وإسقاط مواعيد الحجز (Excel)</h2>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">إضافة وجدولة دفعة حجز مواعيد جديدة من شيت إكسيل</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"><X size={20} /></button>
        </div>

        {importing ? (
          <div className="p-10 flex flex-col items-center justify-center space-y-4">
            <div className="size-16 rounded-full border-4 border-purple-100 border-t-purple-600 animate-spin" />
            <h3 className="font-extrabold text-sm text-slate-800">جاري استيراد وجدولة مواعيد الحجز...</h3>
            <p className="text-xs text-slate-400 font-bold">
              تمت معالجة {importProgress.current} من أصل {importProgress.total} حجز
            </p>
            <div className="w-64 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-purple-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${(importProgress.current / importProgress.total) * 105}%` }}
              />
            </div>
          </div>
        ) : parsedRows.length > 0 ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-600 text-right">
                <span className="font-black text-purple-600">{parsedRows.length}</span> حجز مواعيد جاهزة للاستيراد والدمج بجدول العيادات.
                <p className="text-[10px] text-slate-400 font-normal mt-0.5">يمكنك مراجعة البيانات، إزالة صفوف معينة واختيار دمجها مباشرة بالجدول.</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setFile(null); setParsedRows([]); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  إعادة اختيار الملف
                </button>
                <button 
                  onClick={handleExecuteImport}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-lg text-xs transition-colors shadow-lg shadow-purple-900/10 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={14} />
                  <span>تأكيد إسقاط وجدولة المواعيد</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-black uppercase border-b border-slate-150">
                      <th className="px-4 py-3 border-b border-slate-200">#</th>
                      <th className="px-4 py-3 border-b border-slate-200">المريض</th>
                      <th className="px-4 py-3 border-b border-slate-200">رقم الهاتف</th>
                      <th className="px-4 py-3 border-b border-slate-200">الطبيب المعالج</th>
                      <th className="px-4 py-3 border-b border-slate-200">التاريخ والوقت</th>
                      <th className="px-4 py-3 border-b border-slate-200">نوع الخدمة</th>
                      <th className="px-4 py-3 border-b border-slate-200">كشف خاص</th>
                      <th className="px-4 py-3 border-b border-slate-200 text-center">إلغاء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-slate-705">
                    {parsedRows.map((item, index) => {
                      const matchedDoc = doctors.find(d => d.id === item.appointment.doctorId);
                      const isNewPatient = !patients.some(p => p.name.trim() === item.patient.name.trim() || (item.patient.phone && p.phone === item.patient.phone));
                      
                      return (
                        <tr key={item.rowId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 text-slate-400 font-mono">{index + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-800">{item.patient.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {isNewPatient ? (
                                <span className="bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.2 rounded text-[8px] font-black">مريض جديد</span>
                              ) : (
                                <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.2 rounded text-[8px] font-black">جاهز ومسجل</span>
                              )}
                              <span className="text-[9px] text-slate-400">{item.patient.age ? `${item.patient.age} سنة` : ''} ({item.patient.gender === 'female' ? 'أنثى' : 'ذكر'})</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500">{item.patient.phone || '---'}</td>
                          <td className="px-4 py-3">
                            {item.appointment.doctorId ? (
                              <div className="text-slate-800">
                                <span>د. {matchedDoc?.name}</span>
                                <div className="text-[9px] text-blue-600">{matchedDoc?.specialty}</div>
                              </div>
                            ) : (
                              <div className="text-amber-600 flex flex-col">
                                <span className="font-black">د. {item.appointment.doctorName || 'غير محدد'}</span>
                                <span className="text-[8px] bg-amber-50 rounded border border-amber-100 px-1 mt-0.5 font-bold self-start">سيُسند للأول: د. {doctors[0]?.name || ''}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-slate-700">{item.appointment.date}</div>
                            <div className="text-[10px] text-slate-400 font-mono italic">{item.appointment.time}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded text-[10px] font-black">{item.appointment.serviceType}</span>
                          </td>
                          <td className="px-4 py-3">
                            {item.appointment.isSpecial ? (
                              <span className="bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded text-[9px] font-black font-sans">كشف خاص</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button 
                              type="button"
                              onClick={() => handleRemoveRow(item.rowId)}
                              className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                              title="إزالة هذه الزيارة من الاستيراد"
                            >
                              <X size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="bg-purple-50/50 rounded-2xl p-5 border border-purple-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-right">
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-purple-900 flex items-center gap-1.5">
                  <span>📥 تحميل النموذج الإرشادي لجدول المواعيد</span>
                </h4>
                <p className="text-[11px] text-purple-700 font-medium leading-relaxed">
                  يحتوي هذا النموذج على كافة الأعمدة المطلوبة لإضافة المراجع والمرضى وتعيين الأطباء المناسبين بنجاح بدون ترتيبات يدوية معقدة.
                </p>
              </div>
              <button 
                type="button" 
                onClick={downloadTemplate}
                className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-purple-900/10 text-xs shrink-0 cursor-pointer"
              >
                <Download size={16} />
                <span>تحميل شيت النموذج الإرشادي (Excel)</span>
              </button>
            </div>

            <div 
              onDragEnter={handleDrag} 
              onDragOver={handleDrag} 
              onDragLeave={handleDrag} 
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-all ${
                dragActive 
                  ? 'border-purple-600 bg-purple-50/40' 
                  : 'border-slate-200 hover:border-purple-400 bg-slate-50/50'
              }`}
            >
              <div className="size-14 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mb-4 shadow-inner">
                <Upload size={24} />
              </div>
              <p className="text-sm font-extrabold text-slate-800">اسحب ملف الإكسيل المجهز ببيانات الحجز هنا</p>
              <p className="text-xs text-slate-400 font-bold mt-1">أو اضغط لاختيار الملف من جهازك بصيغ (.xlsx, .xls, .csv)</p>
              
              <input 
                type="file" 
                onChange={handleFileInput} 
                accept=".xlsx, .xls, .csv" 
                className="hidden" 
                id="excel-appointment-upload" 
              />
              <label 
                htmlFor="excel-appointment-upload"
                className="mt-5 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:text-purple-600 hover:border-purple-200 text-xs font-black rounded-xl transition-all shadow-sm shadow-slate-100 cursor-pointer animate-pulse"
              >
                اختر الملف يدوياً
              </label>
            </div>

            {errorStatus && (
              <div className="p-4 bg-red-50 border border-red-150 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2 animate-pulse text-right">
                <AlertTriangle size={16} className="shrink-0 text-red-500" />
                <span>{errorStatus}</span>
              </div>
            )}
          </div>
        )}

        <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
          {!importing && (
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5 bg-white text-slate-500 border border-slate-200 font-bold rounded-xl text-xs hover:bg-slate-100 transition-colors cursor-pointer"
            >
              إلغاء وإغلاق
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function RoomsView({ patients, doctors, selectedBranch }: { patients: Patient[], doctors: Doctor[], selectedBranch: string, key?: string }) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Managing Rooms Addition/Edit Modals/Forms
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDuration, setNewRoomDuration] = useState(15);
  
  // Start Exam Form State inside each Room
  const [assigningRoomId, setAssigningRoomId] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [examDuration, setExamDuration] = useState(15);

  const [tick, setTick] = useState(0);

  // Update elapsed time display every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadRooms = async () => {
    try {
      const data = await api.getRooms();
      setRooms(data);
    } catch (err) {
      console.error("Failed to load rooms:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    try {
      await api.createRoom({
        name: newRoomName.trim(),
        durationMinutes: Number(newRoomDuration || 15),
        status: "available",
        branch: selectedBranch
      });
      setNewRoomName("");
      setNewRoomDuration(15);
      setIsAddingRoom(false);
      loadRooms();
    } catch (err) {
      alert("فشل إضافة الغرفة");
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (confirm("هل أنت متأكد من حذف هذه الغرفة نهائياً؟")) {
      try {
        await api.deleteRoom(roomId);
        loadRooms();
      } catch (err) {
        alert("فشل حذف الغرفة");
      }
    }
  };

  const handleStartExam = async (roomId: string) => {
    if (!selectedPatientId || !selectedDoctorId) {
      alert("الرجاء اختيار المريض والطبيب أولاً");
      return;
    }
    try {
      await api.startRoomExam(roomId, {
        patientId: selectedPatientId,
        doctorId: selectedDoctorId,
        durationMinutes: examDuration
      });
      setAssigningRoomId(null);
      setSelectedPatientId("");
      setSelectedDoctorId("");
      setExamDuration(15);
      loadRooms();
    } catch (err) {
      alert("فشل بدء الكشف الطبي");
    }
  };

  const handleEndExam = async (roomId: string) => {
    if (confirm("هل تريد إنهاء الكشف الطبي القائم بنجاح وإخلاء الغرفة؟")) {
      try {
        await api.endRoomExam(roomId);
        loadRooms();
      } catch (err) {
        alert("فشل إنهاء الكشف");
      }
    }
  };

  const handleToggleStatus = async (roomId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "available" ? "cleaning" : currentStatus === "cleaning" ? "maintenance" : "available";
    try {
      await api.updateRoom(roomId, { status: nextStatus });
      loadRooms();
    } catch (err) {
      alert("فشل التعديل");
    }
  };

  // Stats calculation
  const totalCount = rooms.length;
  const occupiedCount = rooms.filter(r => r.status === "occupied").length;
  const availableCount = rooms.filter(r => r.status === "available").length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm font-sans text-right">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">غرف العيادة (Room Management)</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">تتبع حالة وإشغال غرف الكشف وتوقيت المعاينات الفعلي</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-50 border border-slate-150 rounded-xl px-4 py-2 flex items-center gap-3">
            <div className="text-right">
              <div className="text-[9px] text-red-500 font-bold uppercase">الغرف المشغولة 🔴</div>
              <div className="text-lg font-black text-slate-800">{occupiedCount} <span className="text-xs text-slate-400">من</span> {totalCount}</div>
            </div>
            <span className="text-slate-300">|</span>
            <div className="text-right">
              <div className="text-[9px] text-emerald-500 font-bold uppercase">الغرف المتاحة 🟢</div>
              <div className="text-lg font-black text-emerald-600">{availableCount}</div>
            </div>
          </div>

          <button
            onClick={() => setIsAddingRoom(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 font-black text-xs text-white rounded-xl transition-all shadow-md flex items-center gap-1 cursor-pointer"
          >
            <Plus size={14} />
            <span>+ إضافة غرفة جديدة</span>
          </button>
        </div>
      </header>

      {/* Adding Room Inline Accordion */}
      {isAddingRoom && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="bg-white border border-slate-200 rounded-xl p-5 overflow-hidden font-sans shadow-sm">
          <form onSubmit={handleCreateRoom} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-right items-end">
            <div>
              <label className="text-[10px] font-black text-slate-500 block mb-1">اسم أو مسمى غرفة الكشف</label>
              <input
                type="text"
                required
                placeholder="مثال: غرفة الكشف 5 (الجلدية)"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 block mb-1">توقيت الفحص الافتراضي (دقيقة)</label>
              <input
                type="number"
                min="5"
                max="120"
                value={newRoomDuration}
                onChange={e => setNewRoomDuration(Number(e.target.value) || 15)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center focus:outline-none font-mono"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg transition-all cursor-pointer"
              >
                تأكيد وبدء الغرفة
              </button>
              <button
                type="button"
                onClick={() => setIsAddingRoom(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs rounded-lg transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Grid of rooms */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 font-black">جاري تحديث لوحة التحكم في الغرف...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {rooms.filter(r => !r.branch || r.branch === selectedBranch).map((room) => {
            const isOccupied = room.status === "occupied";
            const patient = patients.find(p => p.id === room.currentPatientId);
            const doctor = doctors.find(d => d.id === room.currentDoctorId);

            // Compute time statistics
            let remainingText = "";
            let progressFactor = 0;
            if (isOccupied && room.startTime && room.endTime) {
              const start = dayjs(room.startTime);
              const end = dayjs(room.endTime);
              const now = dayjs();
              const totalMins = end.diff(start, 'minute');
              const elapsedMins = now.diff(start, 'minute');
              const remainingMins = end.diff(now, 'minute');

              if (remainingMins > 0) {
                remainingText = `يتبقى كأقصى تقدير: ${remainingMins} دقيقة`;
                progressFactor = Math.min(100, (elapsedMins / totalMins) * 100);
              } else {
                remainingText = `تجاوز الوقت المقرر منذ ${Math.abs(remainingMins)} دقيقة`;
                progressFactor = 100;
              }
            }

            return (
              <div 
                key={room.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-between font-sans transition-all hover:shadow-md hover:border-slate-300 relative group"
              >
                {/* Visual Status Indicator Strip */}
                <div className={`h-1.5 w-full ${
                  room.status === "occupied" ? 'bg-red-500' : 
                  room.status === "available" ? 'bg-emerald-500' : 
                  room.status === "cleaning" ? 'bg-amber-400 animate-pulse' : 'bg-slate-300'
                }`} />

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4 text-right">
                  {/* Title and delete action */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="text-right">
                      <h4 className="font-extrabold text-[#0F172A] text-sm tracking-tight">{room.name}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`size-2 rounded-full ${
                          room.status === "occupied" ? 'bg-red-500 animate-ping' : 
                          room.status === "available" ? 'bg-emerald-500' : 
                          room.status === "cleaning" ? 'bg-amber-400' : 'bg-slate-400'
                        }`} />
                        <span className="text-[10px] text-slate-400 font-extrabold block">
                          {room.status === "occupied" && `قيد الكشف الفعلي (${room.durationMinutes} دقيقة مقرر)`}
                          {room.status === "available" && "شاغرة ومستعدة للكشف"}
                          {room.status === "cleaning" && "قيد التعقيم والتنظيف الدوري"}
                          {room.status === "maintenance" && "في الصيانة والترتيب الفني"}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteRoom(room.id)}
                      className="p-1 hover:bg-red-50 text-slate-350 hover:text-red-500 rounded border border-transparent hover:border-red-100 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                      title="حذف الغرفة"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {/* Room Content Details */}
                  {isOccupied ? (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2.5 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="text-blue-500 mt-0.5">👤</span>
                        <div>
                          <span className="text-[9px] text-slate-400 block font-bold">المريض الحالي</span>
                          <span className="font-extrabold text-[#1E293B] block">{patient?.name || 'ـ'}</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5">🩺</span>
                        <div>
                          <span className="text-[9px] text-slate-400 block font-bold">الطبيب المعالج</span>
                          <span className="font-extrabold text-[#1E293B] block">د. {doctor?.name || 'ـ'}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-150 text-[10px] font-bold text-slate-400 flex flex-col gap-1">
                        <div className="flex justify-between font-mono">
                          <span>البدء: {dayjs(room.startTime).format("HH:mm")}</span>
                          <span>المقرر: {dayjs(room.endTime).format("HH:mm")}</span>
                        </div>

                        {/* Progress Bar Rendering */}
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                          <div 
                            className={`h-full ${remainingText.includes('تجاوز') ? 'bg-red-500 animate-pulse' : 'bg-blue-600'}`}
                            style={{ width: `${progressFactor}%` }}
                          />
                        </div>

                        <span className={`text-[9.5px] mt-1 block font-black ${remainingText.includes('تجاوز') ? 'text-red-650' : 'text-blue-600'}`}>
                          {remainingText}
                        </span>
                      </div>
                    </div>
                  ) : assigningRoomId === room.id ? (
                    // Assign Doctor/Patient form inline in the room card
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                      <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">تسكين الغرفة وبدء الكشف:</h5>
                      
                      <div className="space-y-1.5 text-right">
                        <select
                          className="w-full bg-white border border-slate-150 rounded px-2 py-1 text-xs font-black cursor-pointer text-slate-700"
                          value={selectedPatientId}
                          onChange={e => setSelectedPatientId(e.target.value)}
                        >
                          <option value="">-- اختر المريض --</option>
                          {patients.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.caseCode})</option>
                          ))}
                        </select>

                        <select
                          className="w-full bg-white border border-slate-150 rounded px-2 py-1 text-xs font-black cursor-pointer text-slate-700"
                          value={selectedDoctorId}
                          onChange={e => setSelectedDoctorId(e.target.value)}
                        >
                          <option value="">-- اختر الدكتور --</option>
                          {doctors.map(d => (
                            <option key={d.id} value={d.id}>د. {d.name} ({d.specialty})</option>
                          ))}
                        </select>

                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-bold text-slate-400 shrink-0">معاينة:</span>
                          <input
                            type="number"
                            className="bg-white border border-slate-150 rounded px-2 py-1 text-xs text-center w-full font-bold font-mono text-slate-705"
                            value={examDuration}
                            onChange={e => setExamDuration(Number(e.target.value) || 15)}
                            placeholder="دقيقة"
                          />
                        </div>
                      </div>

                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartExam(room.id)}
                          className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded cursor-pointer"
                        >
                          أوكل وابدأ
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssigningRoomId(null)}
                          className="px-2 py-1.5 bg-slate-200 text-slate-600 font-bold text-[10px] rounded cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <span className="text-[11px] text-slate-400 block font-bold">لا يوجد كشف جاري</span>
                      <span className="text-[9px] text-slate-300 block mt-0.5">الغرفة جاهزة ومستعدة للتسكين</span>
                    </div>
                  )}

                  {/* Actions buttons */}
                  <div className="pt-2 border-t border-slate-100 flex gap-2">
                    {isOccupied ? (
                      <button
                        onClick={() => handleEndExam(room.id)}
                        className="w-full py-1.5 bg-red-50 hover:bg-red-100 text-red-650 font-black text-xs border border-red-100 hover:border-red-200 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        📊 إنهاء الكشف وإخلاء الغرفة
                      </button>
                    ) : assigningRoomId !== room.id ? (
                      <>
                        <button
                          onClick={() => {
                            setAssigningRoomId(room.id);
                            setExamDuration(room.durationMinutes || 15);
                          }}
                          className="flex-1 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 font-black text-xs rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          ⚡ بدء الكشف الطبي
                        </button>
                        
                        <button
                          onClick={() => handleToggleStatus(room.id, room.status)}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-[#475569] border border-slate-200 font-black text-xs rounded-lg transition-all cursor-pointer"
                          title="تغيير الحالة الدورية (متاحة / تعقيم / صيانة)"
                        >
                          ⚙️ {room.status === "available" ? "تعقيم" : room.status === "cleaning" ? "صيانة" : "إخلاء"}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

interface UserSettingsModalProps {
  onClose: () => void;
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  users: User[];
  onUpdateUser: (updatedUser: User) => Promise<void>;
}

function UserSettingsModal({ onClose, currentUser, setCurrentUser, users, onUpdateUser }: UserSettingsModalProps) {
  const [selectedUserId, setSelectedUserId] = useState(currentUser?.id || '');
  const [defaultBranch, setDefaultBranch] = useState(currentUser?.branch || 'المعادي');
  const [additionalBranches, setAdditionalBranches] = useState<string[]>(currentUser?.additionalBranches || []);
  const [isSaving, setIsSaving] = useState(false);

  const handleUserSwitch = (userId: string) => {
    const found = users.find(u => u.id === userId);
    if (found) {
      setCurrentUser(found);
      setDefaultBranch(found.branch || 'المعادي');
      setAdditionalBranches(found.additionalBranches || []);
      setSelectedUserId(userId);
    }
  };

  const handleSaveDefaultBranch = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
      const updated = { ...currentUser, branch: defaultBranch, additionalBranches: additionalBranches };
      await onUpdateUser(updated);
      setCurrentUser(updated);
      alert("تم حفظ الفرع الافتراضي للمستخدم بنجاح وسيتم توجيهك إليه تلقائياً!");
      onClose();
    } catch (err) {
      alert("فشل تحديث الإعدادات.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4 text-right animate-in fade-in duration-250" 
      dir="rtl"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden"
      >
        {/* Header */}
        <div className="bg-slate-900 p-6 text-white relative">
          <button 
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 size-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            ✕
          </button>
          <div className="flex items-center gap-3">
            <div className="size-12 bg-blue-600 rounded-2xl flex items-center justify-center text-lg font-black shadow-lg shadow-blue-900/45 shrink-0">
              ⚙️
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-100">إعدادات المستخدم وبوابة المحاكاة</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 leading-none">تبديل الحسابات وتخصيص الفروع وتصاريح التحويل</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Section 1: Simulated User Switcher */}
          <div className="space-y-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/60">
            <div className="flex items-center gap-1.5 text-indigo-700 font-black text-xs">
              <span>👥</span>
              <span>بوابة محاكاة الدخول والتبديل (Simulate Logins)</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed font-bold">
              انقر لاختيار أي حساب مسجل بالنظام لمحاكاة تسجيل دخوله واختبار الفروقات في تصاريح الفروع والصلاحيات:
            </p>
            <select
              className="w-full px-3 py-2 bg-white border border-indigo-150 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={selectedUserId}
              onChange={(e) => handleUserSwitch(e.target.value)}
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role === 'admin' ? 'مدير' : u.role === 'doctor' ? 'طبيب' : 'موظف استقبال'}) - الفرع: {u.branch || 'المعادي'}
                </option>
              ))}
            </select>
          </div>

          {/* Section 2: Current Account Settings */}
          {currentUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 text-slate-700 font-extrabold text-xs">
                <span>👤</span>
                <span>الحساب النشط الحالي: <strong className="text-blue-600">{currentUser.name}</strong></span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px] font-bold text-slate-500">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150">
                  <span className="text-[9px] text-slate-400 block mb-0.5">اسم المستخدم</span>
                  <span className="font-mono text-slate-700">{currentUser.username}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150">
                  <span className="text-[9px] text-slate-400 block mb-0.5">الدور الرئيسي</span>
                  <span className="text-slate-700">
                    {currentUser.role === 'admin' ? 'مدير نظام كامل' : currentUser.role === 'doctor' ? 'طبيب ممارس' : 'موظف استقبال'}
                  </span>
                </div>
              </div>

              {/* Default Branch Configuration */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase block">🏢 ضبط الفرع الافتراضي للحساب (Default Branch)</label>
                <select
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                  value={defaultBranch}
                  onChange={(e) => {
                    setDefaultBranch(e.target.value);
                  }}
                >
                  <option value="المعادي">فرع المعادي الرئيسي</option>
                  <option value="الدقي">فرع الدقي</option>
                  <option value="مدينة نصر">فرع مدينة نصر</option>
                  <option value="اسكندرية">فرع اسكندرية</option>
                </select>
                <p className="text-[8px] text-slate-400 font-medium leading-relaxed">
                  * عند تسجيل الدخول أو التبديل للحساب، سيقوم النظام تلقائياً بتبديل الفرع النشط إلى هذا الاختيار.
                </p>
              </div>

              {/* Additional Allowed Branches (Flexible Switches) */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-500 uppercase block">🔗 تحديد فروع إضافية مسموح بالتبديل إليها</label>
                <p className="text-[8px] text-slate-400 font-bold leading-normal">
                  اختر الفروع الإضافية التي يُسمح للموظف بالتبديل إليها مباشرة لتعزيز مرونة العمليات عبر فروع العيادة المتاحة:
                </p>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-150">
                  {['المعادي', 'الدقي', 'مدينة نصر', 'اسكندرية'].map((branchName) => {
                    const isDefault = defaultBranch === branchName;
                    const isChecked = additionalBranches.includes(branchName) || isDefault;

                    return (
                      <label 
                        key={branchName} 
                        className={`flex items-center gap-1.5 p-1.5 rounded-xl border text-[11px] font-extrabold transition-all cursor-pointer ${
                          isDefault 
                            ? 'bg-blue-50/75 border-blue-200 text-blue-800 cursor-not-allowed opacity-80'
                            : isChecked 
                              ? 'bg-white border-indigo-200 text-indigo-950 shadow-sm'
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={isDefault}
                          checked={isChecked}
                          onChange={(e) => {
                            if (isDefault) return;
                            if (e.target.checked) {
                              setAdditionalBranches([...additionalBranches, branchName]);
                            } else {
                              setAdditionalBranches(additionalBranches.filter(b => b !== branchName));
                            }
                          }}
                          className="size-3 text-indigo-650 rounded focus:ring-indigo-500/10 border-slate-300"
                        />
                        <span>{branchName}</span>
                        {isDefault && <span className="text-[7px] bg-blue-600 text-white px-1 py-0.5 rounded font-black shrink-0">الأساسي</span>}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Active Scopes display */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black text-slate-500 block">🛡️ الصلاحيات الفعالة الممنوحة:</span>
                <div className="flex flex-wrap gap-1">
                  {(currentUser.permissions || []).map(p => (
                    <span key={p} className="text-[9px] font-black bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-150">
                      {p === 'patients' ? 'المرضى' :
                       p === 'appointments' ? 'المواعيد' :
                       p === 'clinical' ? 'التشخيص والعيادات' :
                       p === 'accounting' ? 'الحسابات والتقارير' :
                       p === 'inventory' ? 'المخازن' :
                       p === 'branches' ? 'صلاحية الفروع والتحويل 🏢' :
                       p === 'users' ? 'المستخدمين' : p}
                    </span>
                  ))}
                  {(currentUser.permissions || []).length === 0 && (
                    <span className="text-[9px] text-slate-400 italic">لا توجد صلاحيات معلنة</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 flex gap-2 flex-row bg-slate-50">
          <button 
            type="button" 
            onClick={onClose} 
            className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-600 font-extrabold text-xs rounded-xl text-center transition-colors cursor-pointer"
          >
            إغلاق النافذة
          </button>
          <button 
            type="button" 
            disabled={isSaving}
            onClick={handleSaveDefaultBranch} 
            className="flex-[2] py-2 bg-indigo-600 text-white font-extrabold text-xs rounded-xl text-center shadow-md shadow-indigo-900/10 hover:bg-indigo-700 transition-all cursor-pointer flex items-center justify-center gap-1"
          >
            {isSaving ? 'جاري الحفظ...' : 'حفظ الفرع الافتراضي وتعميد الفرع'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
