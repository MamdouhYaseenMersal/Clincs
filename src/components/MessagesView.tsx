import React, { useState, useEffect, useMemo } from 'react';
import { 
  MessageCircle, 
  Send, 
  Trash2, 
  Check, 
  Users, 
  Search, 
  User as UserIcon, 
  FileText, 
  RefreshCw,
  Bell,
  CheckCircle,
  Clock,
  Briefcase,
  AlertCircle,
  ChevronLeft,
  Filter,
  Layers,
  Sparkles,
  Link,
  Shield,
  CornerDownLeft,
  CheckCheck,
  UserCheck
} from 'lucide-react';
import { api } from '../lib/api';
import { Patient, Doctor, Visit, Appointment, User, Message } from '../types';
import dayjs from 'dayjs';

interface MessagesViewProps {
  key?: string;
  doctors: Doctor[];
  patients: Patient[];
  onRefreshAllData?: () => void;
  preselectedPatientId?: string;
  onClearPreselect?: () => void;
  currentUser?: User;
}

export default function MessagesView({ 
  doctors, 
  patients, 
  onRefreshAllData, 
  preselectedPatientId,
  onClearPreselect,
  currentUser
}: MessagesViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Channels and threading selectors
  // 'all' | 'doctors' | 'staff' | 'patient-threads' | 'direct'
  const [activeChannelType, setActiveChannelType] = useState<string>('all');
  const [selectedThreadPatientId, setSelectedThreadPatientId] = useState<string>("");
  const [selectedDirectUserId, setSelectedDirectUserId] = useState<string>("");

  const [refreshInterval, setRefreshInterval] = useState<number>(8); // auto-refresh polling every 8 seconds
  const [isPolling, setIsPolling] = useState(true);

  // Form states
  const [messageText, setMessageText] = useState("");
  const [receiverRole, setReceiverRole] = useState<'doctor' | 'staff' | 'all'>('all');
  const [targetUserId, setTargetUserId] = useState<string>(""); // optional specific user
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);

  // Users in the system to simulate switching persona
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [simulatedUser, setSimulatedUser] = useState<User | null>(null);

  // Query search count for list filter
  const [patientFilterSearch, setPatientFilterSearch] = useState("");

  // Load backend data (users & messages)
  const loadMessagesAndUsers = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [allMsgs, allUsers] = await Promise.all([
        api.getMessages(),
        api.getUsers()
      ]);
      setMessages(allMsgs.sort((a, b) => dayjs(b.createdAt).diff(dayjs(a.createdAt))));
      setSystemUsers(allUsers);
      
      // Default to currentUser if found (by ID/username), or fall back to first user
      if (!simulatedUser && allUsers.length > 0) {
        const matched = currentUser ? allUsers.find(u => u.id === currentUser.id || u.username === currentUser.username) : null;
        setSimulatedUser(matched || allUsers[0]);
      }
    } catch (err) {
      console.error("Failed to fetch messages or users", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadMessagesAndUsers(true);
  }, []);

  // Set selected patient from props
  useEffect(() => {
    if (preselectedPatientId) {
      setSelectedPatientId(preselectedPatientId);
      setSelectedThreadPatientId(preselectedPatientId);
      setActiveChannelType('patient-threads');
      const p = patients.find(item => item.id === preselectedPatientId);
      if (p) {
        setPatientSearchQuery(p.name);
      }
    }
  }, [preselectedPatientId, patients]);

  // Polling for real-time live simulation
  useEffect(() => {
    if (!isPolling) return;
    const interval = setInterval(() => {
      loadMessagesAndUsers(false);
    }, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [isPolling, refreshInterval, simulatedUser]);

  // Autocomplete patient search
  const filteredPatients = useMemo(() => {
    if (!patientSearchQuery) return [];
    return patients.filter(p => 
      p.name.toLowerCase().includes(patientSearchQuery.toLowerCase()) ||
      p.caseCode.toLowerCase().includes(patientSearchQuery.toLowerCase())
    ).slice(0, 5);
  }, [patients, patientSearchQuery]);

  // Patients who actually have active message threads
  const patientsWithThreads = useMemo(() => {
    const ids = Array.from(new Set(messages.filter(m => m.patientId).map(m => m.patientId)));
    return patients.filter(p => ids.includes(p.id) || p.id === preselectedPatientId);
  }, [patients, messages, preselectedPatientId]);

  // Filter patients listed on the thread list sidebar
  const searchedPatientsInSidebar = useMemo(() => {
    if (!patientFilterSearch) return patientsWithThreads;
    return patients.filter(p => 
      p.name.toLowerCase().includes(patientFilterSearch.toLowerCase()) ||
      p.caseCode.toLowerCase().includes(patientFilterSearch.toLowerCase())
    ).slice(0, 8);
  }, [patients, patientsWithThreads, patientFilterSearch]);

  // Quick message presets depending on the current role
  const quickPresets = useMemo(() => {
    if (!simulatedUser) return [];
    if (simulatedUser.role === 'staff') {
      return [
        { label: "📍 وصول الحالة للعيادة", text: "تنبيه: لقد وصلت الحالة ومسجلة حالياً بانتظار الدخول لغرفة الطبيب." },
        { label: "💳 تسوية مادية", text: "تم سداد واستلام قيمة تذكرة الكشف بالكامل وبطاقة المريض جاهزة." },
        { label: "🚨 حالة عاجلة جداً", text: "الحالة تستدعي الدخول العاجل للأهمية الطبية القصوى، برجاء استقبال المريض فوراً!" },
        { label: "⏱️ استفسار الانتظار", text: "المريض يستعلم عن الوقت المتوقع للدخول لوجود موعد طارئ خارجي لديه." },
        { label: "📁 تحاليل/أشعة جديدة", text: "تم تحديث ورفع نتائج الفحوصات الطبية الجديدة بنجاح للمريض الحالي." },
      ];
    } else if (simulatedUser.role === 'doctor') {
      return [
        { label: "🟢 إدخال المريض التالي", text: "الرجاء إدخال الحالة الموالية فورا لمطبخ العيادة." },
        { label: "☕ طوارئ داخلية", text: "العيادة متأخرة لبضع دقائق لتواجد مراجعة جراحية/علاجية متقدمة داخل الغرفة." },
        { label: "💊 توجيه الصيدلية", text: "تم توجيه المريض للصيدلية المعتمدة لصرف بروتوكول العلاج الجديد." },
        { label: "🔬 تحصيل فحوصات إضافية", text: "يرجى توجيه المريض لإجراء الفحوصات الطبية الموصوفة قبل استكمال الزيارة." },
        { label: "🛑 إنهاء الكشوفات اليومية", text: "تم الانتهاء من نوبة الكشوفات المجدولة حالياً، يرجى غلق الصندوق وحساب الوردية." },
      ];
    } else {
      // Admin presets
      return [
        { label: "📢 تعميم أمن وسلامة", text: "تعليمات إدارية: يرجى التأكد من مطابقة التاريخ والاسم مع الهوية الوطنية عند الكشف المالي." },
        { label: "⚙️ صيانة المنظومة", text: "تنبيه: سيتم إيقاف خادم قاعدة البيانات للصيانة الوقائية غداً في الثامنة صباحاً." },
        { label: "💡 تذكير غلق اليومية", text: "تذكير لكافة الزملاء: يرجى تسليم الموازنة الختامية وجرد الصيدلية قبل الثامنة مساءً." },
      ];
    }
  }, [simulatedUser]);

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageText.trim() || !simulatedUser) return;

    try {
      let linkedPatient = null;
      let finalPatientId = selectedPatientId;
      
      // If we are currently inside a specific patient thread view, associate with it!
      if (!finalPatientId && activeChannelType === 'patient-threads' && selectedThreadPatientId) {
        finalPatientId = selectedThreadPatientId;
      }

      if (finalPatientId) {
        linkedPatient = patients.find(p => p.id === finalPatientId);
      }

      // Automatically determine receiver fields depending on parameters
      let finalReceiverRole = receiverRole;
      let finalReceiverId = targetUserId || undefined;

      // If active page is direct, override targets to the active private user chat
      if (activeChannelType === 'direct' && selectedDirectUserId) {
        finalReceiverId = selectedDirectUserId;
        finalReceiverRole = 'all';
      } else if (activeChannelType === 'doctors') {
        finalReceiverRole = 'doctor';
        finalReceiverId = undefined;
      } else if (activeChannelType === 'staff') {
        finalReceiverRole = 'staff';
        finalReceiverId = undefined;
      }

      await api.sendMessage({
        senderId: simulatedUser.id,
        senderName: simulatedUser.name,
        senderRole: simulatedUser.role,
        receiverId: finalReceiverId,
        receiverRole: finalReceiverId ? undefined : finalReceiverRole,
        patientId: finalPatientId || undefined,
        patientName: linkedPatient ? linkedPatient.name : undefined,
        content: messageText
      });

      setMessageText("");
      setSelectedPatientId("");
      setPatientSearchQuery("");
      
      // Clear props callback if present to refresh
      if (onClearPreselect) onClearPreselect();

      // Reaload messages
      await loadMessagesAndUsers(false);
      if (onRefreshAllData) onRefreshAllData();
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  // Mark message as read
  const handleMarkAsRead = async (id: string) => {
    try {
      await api.markMessageAsRead(id);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m));
    } catch (err) {
      console.error("Failed to mark message as read", err);
    }
  };

  // Delete message
  const handleDeleteMessage = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الرسالة/الملاحظة؟")) return;
    try {
      await api.deleteMessage(id);
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error("Failed to delete message", err);
    }
  };

  // Filter messages based on active side navigation
  const filteredMessages = useMemo(() => {
    return messages.filter(m => {
      // Direct messaging filter
      if (activeChannelType === 'direct') {
        if (!selectedDirectUserId || !simulatedUser) return false;
        // Either: Sender is simulated and receiver is target
        // OR: Sender is target and receiver is simulated
        const isOneWay = m.senderId === simulatedUser.id && m.receiverId === selectedDirectUserId;
        const isOtherWay = m.senderId === selectedDirectUserId && m.receiverId === simulatedUser.id;
        return isOneWay || isOtherWay;
      }

      // Patient specific threads filter
      if (activeChannelType === 'patient-threads') {
        if (!selectedThreadPatientId) return !!m.patientId; // all patient linked
        return m.patientId === selectedThreadPatientId;
      }

      // Role broadcasts
      if (activeChannelType === 'doctors') {
        return m.receiverRole === 'doctor' && !m.patientId && !m.receiverId;
      }
      if (activeChannelType === 'staff') {
        return m.receiverRole === 'staff' && !m.patientId && !m.receiverId;
      }

      // All Messages logic
      return true;
    });
  }, [messages, activeChannelType, selectedThreadPatientId, selectedDirectUserId, simulatedUser]);

  // Calculate unread message badge count relative to current simulator user
  const unreadMessageCountForSelf = useMemo(() => {
    if (!simulatedUser) return 0;
    return messages.filter(m => {
      // Sent to me specifically, or sent to my role, and is not read, and is not by me
      if (m.isRead) return false;
      if (m.senderId === simulatedUser.id) return false;
      
      const isPrivateToMe = m.receiverId === simulatedUser.id;
      const isRoleToMe = m.receiverRole === simulatedUser.role || m.receiverRole === 'all';
      return isPrivateToMe || isRoleToMe;
    }).length;
  }, [messages, simulatedUser]);

  return (
    <div className="space-y-6">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-teal-700 via-indigo-800 to-blue-900 text-white p-6 rounded-2xl shadow-md border border-indigo-950/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-black uppercase">
              الربط الموحد لجهات العيادة 🔬
            </span>
          </div>
          <h1 className="text-xl font-black flex items-center gap-2 mt-1.5">
            <MessageCircle size={24} className="animate-pulse text-indigo-200" />
            <span>نظام التنسيق ومظلة المراسلات الداخلية 💬</span>
          </h1>
          <p className="text-xs text-indigo-100 font-medium mt-1 leading-relaxed">
            ربط لحظي تفاعلي بين مكاتب استقبال العيادات وغرف الأطباء لربط وتنسيق ملاحظات الحالات بالمرضى، الأطباء والمستخدمين.
          </p>
        </div>
        
        {/* Real-time status */}
        <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
          <button 
            type="button" 
            onClick={() => loadMessagesAndUsers(true)}
            disabled={loading}
            className={`p-1.5 hover:bg-white/15 rounded-lg transition-all ${loading ? 'animate-spin text-blue-200' : 'text-white'}`}
            title="تحديث لحظي"
          >
            <RefreshCw size={15} />
          </button>
          <div className="text-right text-[10px] font-bold">
            <div className="flex items-center gap-1.5 justify-end">
              <span className={`size-2 rounded-full ${isPolling ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>{isPolling ? 'المزامنة الفعالة نشطة' : 'المزامنة معطلة'}</span>
            </div>
            <select 
              className="bg-transparent text-white text-[10px] font-black focus:outline-none mt-0.5 pointer-events-auto cursor-pointer" 
              value={refreshInterval}
              onChange={(e) => {
                const val = Number(e.target.value);
                setRefreshInterval(val);
                setIsPolling(val > 0);
              }}
            >
              <option value="4" className="text-slate-900 font-bold">تحديث كل 4 ثواني</option>
              <option value="8" className="text-slate-900 font-bold">تحديث كل 8 ثواني</option>
              <option value="15" className="text-slate-900 font-bold">تحديث كل 15 ثانية</option>
              <option value="0" className="text-slate-900 font-bold">إيقاف التحديث التلقائي</option>
            </select>
          </div>
        </div>
      </div>

      {/* Identity Control Simulation Panel */}
      <div className="bg-gradient-to-br from-slate-50 to-blue-50/20 border border-blue-100 shadow-sm rounded-2xl p-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-blue-600/10 text-blue-700 px-2 py-0.5 rounded text-[9px] font-black leading-none">
                لوحة محاكاة الهوية النشطة (تبديل صفة المستخدم) 🧪
              </span>
              {unreadMessageCountForSelf > 0 && (
                <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1 animate-bounce">
                  <Bell size={10} />
                  <span>{unreadMessageCountForSelf} رسائل واردة جديدة غير مقروءة بانتظارك</span>
                </span>
              )}
            </div>
            <h2 className="text-xs font-black text-slate-800">
              اختر المستخدم الحالي لمحاكاة استلام وقراءة الردود من منظوره بالعيادة:
            </h2>
            <p className="text-[10px] text-slate-400 font-bold">
              ✓ بمجرد النقر على المستخدم، ستتحرك الصلاحيات لمشاهدة رسائله الخاصة وتعميمات دوره الفعلي بالعيادة.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            {systemUsers.map((u) => {
              const isActive = simulatedUser?.id === u.id;
              // Calculate unread messages count specifically targeting this user
              const unreadForUser = messages.filter(m => 
                !m.isRead && 
                m.senderId !== u.id && 
                (m.receiverId === u.id || m.receiverRole === u.role || m.receiverRole === 'all')
              ).length;

              return (
                <button
                  key={u.id}
                  onClick={() => {
                    setSimulatedUser(u);
                    // Reset direct target user if it happens to be me, to prevent texting myself
                    if (selectedDirectUserId === u.id) {
                      setSelectedDirectUserId("");
                    }
                  }}
                  type="button"
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border font-black text-xs transition-all relative ${
                    isActive 
                      ? 'bg-blue-600 border-blue-700 text-white shadow-md shadow-blue-500/10 scale-[1.03]' 
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className={`size-2 rounded-full ${
                    u.role === 'admin' ? 'bg-amber-400' :
                    u.role === 'doctor' ? 'bg-indigo-500 animate-pulse' : 'bg-teal-400'
                  }`} />
                  <span>{u.name}</span>
                  <span className={`text-[9px] px-1 rounded ${isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-500'}`}>
                    {u.role === 'admin' && 'أدمن'}
                    {u.role === 'doctor' && 'طبيب'}
                    {u.role === 'staff' && 'استقبال'}
                  </span>

                  {unreadForUser > 0 && (
                    <span className="absolute -top-1.5 -left-1 px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-black rounded-full shadow-sm border border-white">
                      {unreadForUser}
                    </span>
                  )}

                  {isActive && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                  )}
                </button>
              );
            })}
            {systemUsers.length === 0 && (
              <div className="text-xs text-slate-400 italic font-medium">جاري سحب موظفي العيادة ومستخدمي البرنامج من السيرفر...</div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid Wrapper */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* RIGHT COLUMN: Slack/Teams-like Workspace channels & Active Patients Threads (Cols 4) */}
        <div className="xl:col-span-4 space-y-4">
          
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            
            <div className="border-b border-slate-150 pb-3 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Layers className="text-indigo-600" size={16} />
                <span>قنوات النقاش وغرف التنسيق</span>
              </span>
              <span className="text-[9px] bg-slate-100 text-slate-650 px-1.5 py-0.5 rounded font-bold">
                تصفية القنوات
              </span>
            </div>

            {/* General Channels List */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setActiveChannelType('all');
                  setSelectedThreadPatientId("");
                  setSelectedDirectUserId("");
                }}
                className={`w-full text-right px-3.5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-between ${
                  activeChannelType === 'all' 
                    ? 'bg-slate-800 text-white shadow-sm' 
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Users size={14} className={activeChannelType === 'all' ? 'text-amber-300' : 'text-slate-400'} />
                  <span>📢 لوحة التعميمات العامة والكل</span>
                </span>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${activeChannelType === 'all' ? 'bg-slate-700 text-slate-100' : 'bg-slate-200 text-slate-600'}`}>
                  {messages.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveChannelType('doctors');
                  setSelectedThreadPatientId("");
                  setSelectedDirectUserId("");
                }}
                className={`w-full text-right px-3.5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-between ${
                  activeChannelType === 'doctors' 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/15' 
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <UserIcon size={14} className={activeChannelType === 'doctors' ? 'text-indigo-200' : 'text-indigo-505 text-indigo-400'} />
                  <span>🩺 مستشاري وأقسام الأطباء</span>
                </span>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${activeChannelType === 'doctors' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-600'}`}>
                  {messages.filter(m => m.receiverRole === 'doctor' && !m.patientId).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveChannelType('staff');
                  setSelectedThreadPatientId("");
                  setSelectedDirectUserId("");
                }}
                className={`w-full text-right px-3.5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-between ${
                  activeChannelType === 'staff' 
                    ? 'bg-teal-700 text-white shadow-md shadow-teal-500/15' 
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Briefcase size={14} className={activeChannelType === 'staff' ? 'text-teal-200' : 'text-teal-500'} />
                  <span>💻 مكاتب الاستقبال والتنسيق</span>
                </span>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${activeChannelType === 'staff' ? 'bg-teal-900 text-teal-100' : 'bg-slate-200 text-slate-600'}`}>
                  {messages.filter(m => m.receiverRole === 'staff' && !m.patientId).length}
                </span>
              </button>
            </div>

            {/* Active Clinical Patient Case threads selector with search input */}
            <div className="space-y-2.5 pt-2 border-t border-slate-150">
              <span className="text-xs font-black text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Briefcase className="text-purple-600 animate-pulse" size={15} />
                  <span>👥 ربط وتنسيق الحالات (المرضى)</span>
                </span>
                <span className="text-[9px] bg-purple-50 text-purple-750 border border-purple-100 px-1.5 py-0.5 rounded font-black">
                  مواضيع الحالات
                </span>
              </span>

              {/* Instant Search Patients Sidebar Filter */}
              <div className="flex bg-slate-50 items-center border border-slate-200 rounded-xl px-2 py-0.5 text-xs">
                <Search size={12} className="text-slate-400 mr-1" />
                <input
                  type="text"
                  placeholder="ابحث عن مريض بالاسم للربط..."
                  value={patientFilterSearch}
                  onChange={(e) => setPatientFilterSearch(e.target.value)}
                  className="w-full focus:outline-none bg-transparent py-1 font-bold text-slate-700 placeholder:text-slate-400"
                />
                {patientFilterSearch && (
                  <button 
                    onClick={() => setPatientFilterSearch("")} 
                    className="text-[10px] text-slate-400 font-bold px-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Patient list stream */}
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {searchedPatientsInSidebar.map((p) => {
                  const isSelected = activeChannelType === 'patient-threads' && selectedThreadPatientId === p.id;
                  const countForPatient = messages.filter(m => m.patientId === p.id).length;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setActiveChannelType('patient-threads');
                        setSelectedThreadPatientId(p.id);
                        setSelectedDirectUserId("");
                        // Also pre-check is select in compose form to streamline linking
                        setSelectedPatientId(p.id);
                        setPatientSearchQuery(p.name);
                      }}
                      className={`w-full text-right px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-between ${
                        isSelected 
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-500/10' 
                          : 'bg-slate-50/50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="text-right truncate flex-1 min-w-0 pr-1">
                        <div className="truncate">{p.name}</div>
                        <div className={`text-[9px] mt-0.5 font-mono ${isSelected ? 'text-purple-100' : 'text-slate-400'}`}>
                          كود الملف: {p.caseCode}
                        </div>
                      </div>
                      
                      {countForPatient > 0 && (
                        <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-purple-800 text-purple-100' : 'bg-purple-150 bg-purple-50 text-purple-700 border border-purple-100'
                        }`}>
                          {countForPatient} ملاحظات
                        </span>
                      )}
                    </button>
                  );
                })}

                {searchedPatientsInSidebar.length === 0 && (
                  <div className="text-center py-4 text-slate-350 italic text-[11px]">
                    لا توجد برقيات جارية للحالة. ابحث عن مريض بالريد أعلاه لإدراج ملاحظة جديدة بخصوصه.
                  </div>
                )}
              </div>
            </div>

            {/* Direct Users messaging links (Private Chat simulation) */}
            <div className="space-y-2 pt-2 border-t border-slate-150">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <UserCheck className="text-teal-600" size={15} />
                <span>👥 الزملاء ومراسلات خاصة 🔒</span>
              </span>

              <div className="space-y-1">
                {systemUsers
                  .filter(u => u.id !== simulatedUser?.id)
                  .map((u) => {
                    const isSelected = activeChannelType === 'direct' && selectedDirectUserId === u.id;
                    const unreadPrivate = messages.filter(m => !m.isRead && m.senderId === u.id && m.receiverId === simulatedUser?.id).length;

                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setActiveChannelType('direct');
                          setSelectedDirectUserId(u.id);
                          setSelectedThreadPatientId("");
                        }}
                        className={`w-full text-right px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-between ${
                          isSelected 
                            ? 'bg-teal-700 text-white shadow-md' 
                            : 'bg-slate-50/50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`size-2.5 rounded-full ${u.role === 'doctor' ? 'bg-indigo-400' : 'bg-teal-400'}`} />
                          <div className="text-right">
                            <span className="truncate">{u.name}</span>
                            <span className={`text-[8.5px] font-medium mr-1.5 px-1 py-0.2 rounded ${
                              isSelected ? 'bg-teal-850 text-teal-100' : 'bg-slate-200 text-slate-500'
                            }`}>
                              {u.role === 'doctor' ? 'طبيب' : u.role === 'staff' ? 'استقبال' : 'مدير'}
                            </span>
                          </div>
                        </div>

                        {unreadPrivate > 0 ? (
                          <span className="bg-red-500 text-white text-[9px] font-black rounded-full px-1.5 py-0.5 shadow-sm">
                            {unreadPrivate} جديد
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
              </div>
            </div>

          </div>
        </div>

        {/* LEFT COLUMN: Conversation thread display & Instant note composer (Cols 8) */}
        <div className="xl:col-span-8 flex flex-col space-y-6">
          
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex-1 flex flex-col min-h-[550px]">
            
            {/* Header of Active workspace view */}
            <div className="border-b border-slate-150 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/40 p-4 -mt-6 -mx-6 rounded-t-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-100 text-indigo-850 text-[10px] font-black px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1.5">
                    <Sparkles size={11} className="text-indigo-600 animate-spin" />
                    <span>الجهة النشطة:</span>
                  </span>
                  {activeChannelType === 'all' && (
                    <span className="text-xs font-black text-slate-800">اللوحة والتعميمات العامة لجميع المنسوبين</span>
                  )}
                  {activeChannelType === 'doctors' && (
                    <span className="text-xs font-black text-indigo-750">غرفة كادر الأطباء وطاقم الكشف</span>
                  )}
                  {activeChannelType === 'staff' && (
                    <span className="text-xs font-black text-teal-800">مكتب الاستقبال وإفادات الحركة</span>
                  )}
                  {activeChannelType === 'patient-threads' && (
                    <span className="text-xs font-black text-purple-800 flex items-center gap-1">
                      <span>ملاحظات ملف المريض:</span>
                      <span className="underline decoration-purple-400">
                        {patients.find(p => p.id === selectedThreadPatientId)?.name || 'كل كروت المرضي'}
                      </span>
                    </span>
                  )}
                  {activeChannelType === 'direct' && (
                    <span className="text-xs font-black text-teal-700 flex items-center gap-1">
                      <span>محادثة سرية وثنائية مغلقة مع:</span>
                      <span className="underline">
                        {systemUsers.find(u => u.id === selectedDirectUserId)?.name || 'الزميل المستهدف'}
                      </span>
                    </span>
                  )}
                </div>
                
                <p className="text-[10px] text-slate-400 font-bold mt-1">
                  ✓ يعرض هذا الفيد الرسائل التي تندرج تحت الفئة المحددة لتأمين توازن تبادل كروت الحالات.
                </p>
              </div>

              {/* Reset view if showing preselected state */}
              {(preselectedPatientId || selectedThreadPatientId || selectedDirectUserId || activeChannelType !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveChannelType('all');
                    setSelectedThreadPatientId("");
                    setSelectedDirectUserId("");
                    setSelectedPatientId("");
                    setPatientSearchQuery("");
                    if (onClearPreselect) onClearPreselect();
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-black px-2.5 py-1.5 rounded-lg border border-slate-200 transition-all flex items-center gap-1 self-start md:self-auto"
                >
                  ✕ إلغاء التصفية (الكل)
                </button>
              )}
            </div>

            {/* Messaging Streams Area */}
            <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto pr-2 flex-1 mt-4 space-y-4">
              
              {filteredMessages.map((msg) => {
                const isSentByMe = simulatedUser && msg.senderId === simulatedUser.id;
                
                // Recipient category text
                let targetBadge = null;
                if (msg.receiverId) {
                  const targetName = systemUsers.find(u => u.id === msg.receiverId)?.name || 'زميل';
                  targetBadge = (
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 text-[9px] font-black px-1.5 py-0.2 rounded">
                      رسالة خاصة لـ د. {targetName} 🔒
                    </span>
                  );
                } else if (msg.receiverRole === 'doctor') {
                  targetBadge = (
                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-black px-1.5 py-0.2 rounded">
                      إلى: كادر الأطباء 🩺
                    </span>
                  );
                } else if (msg.receiverRole === 'staff') {
                  targetBadge = (
                    <span className="bg-teal-50 text-teal-800 border border-teal-100 text-[9px] font-black px-1.5 py-0.2 rounded">
                      إلى: موظفي الاستقبال 💻
                    </span>
                  );
                } else {
                  targetBadge = (
                    <span className="bg-slate-100 text-slate-600 border border-slate-150 text-[9px] font-black px-1.5 py-0.2 rounded">
                      عموم العيادة 📢
                    </span>
                  );
                }

                const canMarkAsRead = !msg.isRead && !isSentByMe && simulatedUser && (
                  !msg.receiverId || msg.receiverId === simulatedUser.id
                );

                return (
                  <div 
                    key={msg.id} 
                    className={`p-3.5 rounded-xl border transition-all ${
                      isSentByMe 
                        ? 'bg-blue-50/10 border-blue-200/55' 
                        : !msg.isRead 
                        ? 'bg-amber-50/10 border-amber-200' 
                        : 'bg-slate-50/30 border-slate-150'
                    } hover:border-blue-300 hover:bg-slate-50/40`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      
                      <div className="flex items-center gap-2">
                        {/* Custom visual avatar helper */}
                        <div className={`size-8 rounded-full flex items-center justify-center font-extrabold text-[11px] border shadow-sm ${
                          msg.senderRole === 'admin' ? 'bg-amber-100 text-amber-850 border-amber-200' :
                          msg.senderRole === 'doctor' ? 'bg-indigo-100 text-indigo-850 border-indigo-200' : 
                          'bg-teal-100 text-teal-900 border-teal-200'
                        }`}>
                          {msg.senderRole === 'admin' ? 'مدير' : msg.senderRole === 'doctor' ? 'طبيب' : 'مكتب'}
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-800">{msg.senderName}</span>
                            <span className={`text-[8.5px] font-bold px-1 rounded ${
                              msg.senderRole === 'admin' ? 'bg-amber-100 text-amber-800' :
                              msg.senderRole === 'doctor' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'
                            }`}>
                              {msg.senderRole === 'admin' ? 'مدير نظام' : msg.senderRole === 'doctor' ? 'طبيب العيادة' : 'موظف استقبال'}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {targetBadge}
                            <span className="text-[9px] text-slate-400 font-bold flex items-center gap-1">
                              <Clock size={10} />
                              {dayjs(msg.createdAt).fromNow()} ({dayjs(msg.createdAt).format('HH:mm')})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Top Operations */}
                      <div className="flex items-center gap-1.5">
                        {!msg.isRead ? (
                          <span className="bg-amber-100 text-amber-800 text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                            جديد
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[9px] font-bold flex items-center gap-0.5" title="تم القراءة والاطلاع">
                            <CheckCheck size={11} className="text-emerald-500" />
                            اطلاع
                          </span>
                        )}

                        {canMarkAsRead && (
                          <button
                            type="button"
                            onClick={() => handleMarkAsRead(msg.id)}
                            className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-250 px-2 py-0.5 rounded text-[10px] font-black transition-all"
                          >
                            مألوف (قرأت) ✓
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="p-1 text-slate-350 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all"
                          title="حذف الملاحظة"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                    </div>

                    {/* Content Section */}
                    <div className="mt-3 bg-white p-3.5 rounded-xl border border-slate-150 text-xs font-bold text-slate-750 leading-relaxed whitespace-pre-wrap select-text selection:bg-blue-100">
                      {msg.content}
                    </div>

                    {/* Patient Card Link Row */}
                    {msg.patientId && (
                      <div className="mt-2.5 flex items-center justify-between bg-purple-50/50 p-2 rounded-xl border border-purple-100 text-[10.5px] font-black text-purple-900">
                        <div className="flex items-center gap-1.5">
                          <Briefcase size={12} className="text-purple-600 animate-bounce" />
                          <span>مرتبط بملف المريض: {msg.patientName || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9.5px] font-mono bg-white text-purple-850 px-1.5 py-0.5 rounded border border-purple-200">
                            كود: {patients.find(p => p.id === msg.patientId)?.caseCode || '-'}
                          </span>
                          
                          {/* If inside another channel, user can click to thread of patient */}
                          {activeChannelType !== 'patient-threads' && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveChannelType('patient-threads');
                                setSelectedThreadPatientId(msg.patientId || "");
                              }}
                              className="text-[9px] bg-purple-600 hover:bg-purple-700 text-white px-2 py-0.5 rounded transition-all"
                            >
                              عرض سلسلة الحالة ←
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}

              {filteredMessages.length === 0 && (
                <div className="text-center py-20 text-slate-350 italic text-xs space-y-3">
                  <MessageCircle size={36} className="mx-auto text-slate-200 animate-pulse" />
                  <div>لا توجد مراسلات أو ملاحظات تناسب تصفية هذه الجهة حالياً.</div>
                  <div className="text-[10px] text-slate-400 font-bold max-w-md mx-auto leading-relaxed">
                    ✓ يمكنك إنشاء رسالة جديدة بخصوص أي حالة في العيادة باستخدام النموذج بالأسفل لتبادل البيانات فوراً وتحديث الزملاء.
                  </div>
                </div>
              )}

            </div>

            {/* Compose area directly inside the same component block */}
            <form onSubmit={handleSendMessage} className="mt-6 border-t border-slate-150 pt-5 space-y-4">
              
              <div className="space-y-3">
                
                {/* Linked Patient Selection (If not preselected by thread or props) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  
                  {/* Select target of the message */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 block">من فضلك حدد جهة استلام الرسالة:</label>
                    
                    {activeChannelType === 'direct' && selectedDirectUserId ? (
                      <div className="bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold px-3 py-2 rounded-lg flex items-center justify-between">
                        <span>محادثة ثنائية مغلقة 🔒 (تلقائي)</span>
                        <span className="text-[10px] bg-teal-100 px-1.5 py-0.5 rounded">
                          إلى: {systemUsers.find(u => u.id === selectedDirectUserId)?.name}
                        </span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() => { setReceiverRole('all'); setTargetUserId(""); }}
                          className={`py-1.5 text-center text-[11px] font-black border rounded-lg transition-all ${
                            receiverRole === 'all' && !targetUserId 
                              ? 'bg-slate-800 border-slate-900 text-white' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          للجميع 📢
                        </button>
                        <button
                          type="button"
                          onClick={() => { setReceiverRole('doctor'); setTargetUserId(""); }}
                          className={`py-1.5 text-center text-[11px] font-black border rounded-lg transition-all ${
                            receiverRole === 'doctor' && !targetUserId 
                              ? 'bg-indigo-600 border-indigo-700 text-white' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          للأطباء 🩺
                        </button>
                        <button
                          type="button"
                          onClick={() => { setReceiverRole('staff'); setTargetUserId(""); }}
                          className={`py-1.5 text-center text-[11px] font-black border rounded-lg transition-all ${
                            receiverRole === 'staff' && !targetUserId 
                              ? 'bg-teal-700 border-teal-800 text-white' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          للاستقبال 💻
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Link block to patient (Streamlined) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-500 block">
                        ربط الملاحظة بملف المريض (اختياري):
                      </label>
                      {selectedPatientId && (
                        <button
                          type="button"
                          onClick={() => { setSelectedPatientId(""); setPatientSearchQuery(""); }}
                          className="text-[9px] text-red-600 font-bold hover:underline"
                        >
                          إلغاء الربط ✕
                        </button>
                      )}
                    </div>

                    {!selectedPatientId ? (
                      <div className="relative">
                        <div className="flex bg-slate-50 items-center border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                          <Search size={13} className="text-slate-400 mr-1.5" />
                          <input 
                            type="text"
                            placeholder="ابحث بالاسم لربط بطاقة الحالة..."
                            value={patientSearchQuery}
                            onChange={(e) => {
                              setPatientSearchQuery(e.target.value);
                              setIsPatientDropdownOpen(true);
                            }}
                            onFocus={() => setIsPatientDropdownOpen(true)}
                            className="w-full focus:outline-none bg-transparent font-bold text-slate-700"
                          />
                        </div>

                        {isPatientDropdownOpen && filteredPatients.length > 0 && (
                          <div className="absolute top-11 right-0 left-0 bg-white border border-slate-200 rounded-lg shadow-xl z-20 max-h-44 overflow-y-auto divide-y divide-slate-100">
                            {filteredPatients.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setSelectedPatientId(p.id);
                                  setPatientSearchQuery(p.name);
                                  setIsPatientDropdownOpen(false);
                                }}
                                className="w-full text-right px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex justify-between items-center"
                              >
                                <span>{p.name}</span>
                                <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono">
                                  {p.caseCode}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-purple-50/50 border border-purple-100 p-1.5 rounded-lg flex items-center justify-between text-xs font-semibold text-purple-900 leading-none">
                        <div className="flex items-center gap-1.5">
                          <Link size={12} className="text-purple-600" />
                          <span className="truncate max-w-[140px] font-bold">{patients.find(p => p.id === selectedPatientId)?.name}</span>
                        </div>
                        <span className="text-[8px] bg-purple-100 px-1.5 py-0.5 rounded">كود: {patients.find(p => p.id === selectedPatientId)?.caseCode}</span>
                      </div>
                    )}
                  </div>

                </div>

                {/* Text input with Send Button row inside a streamlined container */}
                <div className="flex items-start gap-2.5">
                  <div className="flex-1">
                    <textarea
                      required
                      rows={2}
                      className="w-full px-4 py-2 text-xs font-bold text-slate-750 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                      placeholder="اكتب تفاصيل الملاحظة أو التعليمات الإدارية/الطبية للمريض هنا لإفادة الزملاء..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={!messageText.trim() || !simulatedUser}
                    className="px-5 py-4 bg-indigo-650 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl font-black text-xs shadow-md shadow-indigo-600/10 flex items-center gap-1.5 self-center transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Send size={14} />
                    <span>تأكيد الإرسال</span>
                  </button>
                </div>

                {/* Presets shortcut buttons */}
                {quickPresets.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[9.5px] font-black text-slate-400 block uppercase tracking-wide">
                      ⚡ اختصارات تبادل سريع (كليك للإرسال المسودة):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {quickPresets.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setMessageText(preset.text)}
                          className="text-[10px] font-black px-2.5 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-800 transition-all"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>

            </form>

          </div>
        </div>

      </div>

    </div>
  );
}
