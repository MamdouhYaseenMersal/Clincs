import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash, 
  Check, 
  AlertCircle, 
  Calendar, 
  Clock, 
  Edit, 
  Heart, 
  Activity, 
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import dayjs from 'dayjs';
import { Patient, LongTermTreatmentPlan, ChronicMedication } from '../types';
import { api } from '../lib/api';

interface TreatmentPlanViewProps {
  patient: Patient;
  loadProfile: () => Promise<void>;
}

export function TreatmentPlanView({ patient, loadProfile }: TreatmentPlanViewProps) {
  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [planName, setPlanName] = useState('');
  const [frequencyMonths, setFrequencyMonths] = useState<number>(3);
  const [notes, setNotes] = useState('');
  const [medications, setMedications] = useState<Array<{ name: string; dosage: string; frequency: string; startedAt: string }>>([
    { name: '', dosage: '', frequency: '', startedAt: dayjs().format('YYYY-MM-DD') }
  ]);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  const handleAddMedicationRow = () => {
    setMedications(prev => [
      ...prev,
      { name: '', dosage: '', frequency: '', startedAt: dayjs().format('YYYY-MM-DD') }
    ]);
  };

  const handleRemoveMedicationRow = (index: number) => {
    setMedications(prev => prev.filter((_, i) => i !== index));
  };

  const handleMedicationChange = (index: number, field: string, value: string) => {
    setMedications(prev => prev.map((med, i) => {
      if (i === index) {
        return { ...med, [field]: value };
      }
      return med;
    }));
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim()) {
      alert('يرجى تحديد اسم خطة العلاج أولاً');
      return;
    }

    const filteredMeds: ChronicMedication[] = medications
      .filter(m => m.name.trim() !== '')
      .map((m, idx) => ({
        id: String(idx + 1),
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        startedAt: m.startedAt
      }));

    const todayStr = dayjs().format('YYYY-MM-DD');
    const nextReviewStr = dayjs().add(frequencyMonths, 'month').format('YYYY-MM-DD');

    const newPlan: LongTermTreatmentPlan = {
      id: editingPlanId || Math.random().toString(36).substr(2, 9),
      planName,
      medications: filteredMeds,
      frequencyMonths,
      lastReviewDate: todayStr,
      nextReviewDate: nextReviewStr,
      notes,
      status: 'active'
    };

    let updatedPlans = patient.longTermTreatmentPlans ? [...patient.longTermTreatmentPlans] : [];

    if (editingPlanId) {
      updatedPlans = updatedPlans.map(p => p.id === editingPlanId ? newPlan : p);
    } else {
      updatedPlans.push(newPlan);
    }

    try {
      await api.updatePatient(patient.id, {
        longTermTreatmentPlans: updatedPlans
      });
      await loadProfile();
      
      // Reset State
      setIsAddingPlan(false);
      setEditingPlanId(null);
      setPlanName('');
      setFrequencyMonths(3);
      setNotes('');
      setMedications([{ name: '', dosage: '', frequency: '', startedAt: dayjs().format('YYYY-MM-DD') }]);
      
      alert('تم حفظ خطة العلاج والتأصيل الطبي للمريض بنجاح! 📋');
    } catch (err: any) {
      alert('فشل حفظ خطة العلاج: ' + err.message);
    }
  };

  const handleMarkAsReviewed = async (plan: LongTermTreatmentPlan) => {
    if (!patient.longTermTreatmentPlans) return;
    
    const todayStr = dayjs().format('YYYY-MM-DD');
    const nextDateStr = dayjs().add(plan.frequencyMonths, 'month').format('YYYY-MM-DD');

    const updatedPlans = patient.longTermTreatmentPlans.map((p) => {
      if (p.id === plan.id) {
        return {
          ...p,
          lastReviewDate: todayStr,
          nextReviewDate: nextDateStr
        };
      }
      return p;
    });

    try {
      await api.updatePatient(patient.id, { longTermTreatmentPlans: updatedPlans });
      await loadProfile();
      alert(`تم تسجيل المراجعة بنجاح! تم تجديد تفعيل الخطة، يستحق التقييم القادم في: ${dayjs(nextDateStr).format('YYYY/MM/DD')}`);
    } catch (err: any) {
      alert('فشل تحديث تاريخ المراجعة: ' + err.message);
    }
  };

  const handleTogglePlanStatus = async (plan: LongTermTreatmentPlan, nextStatus: 'active' | 'completed' | 'suspended') => {
    if (!patient.longTermTreatmentPlans) return;

    const updatedPlans = patient.longTermTreatmentPlans.map((p) => {
      if (p.id === plan.id) {
        return {
          ...p,
          status: nextStatus
        };
      }
      return p;
    });

    try {
      await api.updatePatient(patient.id, { longTermTreatmentPlans: updatedPlans });
      await loadProfile();
      alert('تم تحديث حالة خطة العلاج للمريض.');
    } catch (err: any) {
      alert('فشل تحديث حالة الخطة: ' + err.message);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('هل أنت متأكد من حذف خطة العلاج هذه نهائياً بكل الأدوية المزمنة المرتبطة بها؟')) return;
    if (!patient.longTermTreatmentPlans) return;

    const updatedPlans = patient.longTermTreatmentPlans.filter(p => p.id !== planId);

    try {
      await api.updatePatient(patient.id, { longTermTreatmentPlans: updatedPlans });
      await loadProfile();
    } catch (err: any) {
      alert('فشل حذف الخطة: ' + err.message);
    }
  };

  const handleEditPlanClick = (plan: LongTermTreatmentPlan) => {
    setEditingPlanId(plan.id);
    setPlanName(plan.planName);
    setFrequencyMonths(plan.frequencyMonths);
    setNotes(plan.notes || '');
    if (plan.medications && plan.medications.length > 0) {
      setMedications(plan.medications.map(m => ({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        startedAt: m.startedAt
      })));
    } else {
      setMedications([{ name: '', dosage: '', frequency: '', startedAt: dayjs().format('YYYY-MM-DD') }]);
    }
    setIsAddingPlan(true);
  };

  const getPlanReviewStatusBadge = (plan: LongTermTreatmentPlan) => {
    if (plan.status !== 'active') {
      return (
        <span className="px-2.5 py-1 text-[10px] bg-slate-100 text-slate-500 rounded border border-slate-200">
          {plan.status === 'suspended' ? 'متوقفة مؤقتاً' : 'مكتملة'}
        </span>
      );
    }

    const today = dayjs();
    const nextReview = dayjs(plan.nextReviewDate);
    const diffDays = nextReview.diff(today, 'day');

    if (diffDays < 0) {
      return (
        <span className="px-2.5 py-1 text-[10px] font-black bg-rose-150 text-rose-800 rounded border border-rose-300 animate-pulse flex items-center gap-1">
          <AlertCircle size={10} /> متأخرة عن المراجعة ({Math.abs(diffDays)} يوم) ⚠️
        </span>
      );
    } else if (diffDays <= 14) {
      return (
        <span className="px-2.5 py-1 text-[10px] font-black bg-amber-100 text-amber-800 rounded border border-amber-300 flex items-center gap-1">
          <Clock size={10} /> يستحق المراجعة قريباً (خلال {diffDays} يوم) 🔔
        </span>
      );
    } else {
      return (
        <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded border border-emerald-200 flex items-center gap-1">
          <ShieldCheck size={10} /> مستقرة وآمنة (المراجعة قريباً)
        </span>
      );
    }
  };

  return (
    <div className="p-6 space-y-6 text-right" dir="rtl">
      
      {/* Tab Header Banner */}
      <div className="bg-gradient-to-l from-blue-50/50 to-indigo-50/20 border border-blue-200/50 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 justify-end md:justify-start">
            <Heart className="text-rose-500 fill-rose-500 animate-pulse" size={16} />
            <span>🎯 إدارة خطط العلاج طويلة المدى للأمراض المزمنة</span>
          </h3>
          <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
            تثبيت الأدوية الدورية والبروتوكولات طويلة المدى، مع إصدار تنبيهات للطبيب بضرورة المعاينة وإجراء المراجعات الطبية للحماية من المخاطر الدوائية.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsAddingPlan(!isAddingPlan);
            setEditingPlanId(null);
            setPlanName('');
            setFrequencyMonths(3);
            setNotes('');
            setMedications([{ name: '', dosage: '', frequency: '', startedAt: dayjs().format('YYYY-MM-DD') }]);
          }}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 self-end md:self-auto"
        >
          {isAddingPlan ? (
            <span>إغلاق النموذج ✕</span>
          ) : (
            <>
              <Plus size={14} />
              <span>إنشاء خطة علاج جديدة 📝</span>
            </>
          )}
        </button>
      </div>

      {/* FORM: Add/Edit Plan */}
      <AnimatePresence>
        {isAddingPlan && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-slate-50 border border-slate-250 p-6 rounded-2xl space-y-5 overflow-hidden shadow-xs"
            onSubmit={handleSavePlan}
          >
            <div className="border-b border-slate-200 pb-2">
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-1">
                <span>{editingPlanId ? '📝 تعديل تفاصيل خطة العلاج' : '✨ صياغة بروتوكول علاجي وقائي جديد'}</span>
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Plan Name */}
              <div className="space-y-1">
                <label className="block text-[11px] font-black text-slate-600">اسم خطة العلاج (مثل: بروتوكول السكر والضغط والقلب) <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="مثال: بروتوكول السكري واعتلال الكلى المزمن"
                  className="w-full px-3.5 py-2 hover:bg-white bg-slate-100 border border-slate-250 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                />
              </div>

              {/* Review Frequency */}
              <div className="space-y-1">
                <label className="block text-[11px] font-black text-slate-600">دورية المراجعة الإكلينيكية للخطة <span className="text-red-500">*</span></label>
                <select
                  required
                  className="w-full px-3.5 py-2 bg-slate-100 hover:bg-white border border-slate-250 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  value={frequencyMonths}
                  onChange={(e) => setFrequencyMonths(Number(e.target.value))}
                >
                  <option value={1}>كل شهر واحد (مراجعة شهريّة للعهد)</option>
                  <option value={3}>كل 3 أشهر (ربع سنوي - للأمراض المزمنة المستقرة)</option>
                  <option value={6}>كل 6 أشهر (نصف سنوي - كشف وقائي)</option>
                  <option value={12}>كل سنة (متابعة سنوية شاملة)</option>
                </select>
              </div>
            </div>

            {/* Chronic Medications rows */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="text-[11px] font-black text-slate-700">💊 قائمة الأدوية والعقاقير المزمنة المقررة:</span>
                <button
                  type="button"
                  onClick={handleAddMedicationRow}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[10px] font-black rounded-lg transition-all flex items-center gap-1"
                >
                  <Plus size={12} /> أضف دواءً إضافياً
                </button>
              </div>

              <div className="space-y-2">
                {medications.map((m, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end bg-white p-3 rounded-lg border border-slate-150 relative">
                    {/* Medication Name */}
                    <div className="space-y-1">
                      <label className="block text-[9px] font-extrabold text-slate-400">اسم الحبة الطبي / المادة الفعّالة</label>
                      <input
                        type="text"
                        placeholder="مثل: Metformin 500mg"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold focus:outline-none"
                        value={m.name}
                        onChange={(e) => handleMedicationChange(idx, 'name', e.target.value)}
                      />
                    </div>
                    {/* Dosage */}
                    <div className="space-y-1">
                      <label className="block text-[9px] font-extrabold text-slate-400">الجرعة المحددة</label>
                      <input
                        type="text"
                        placeholder="مثل: قرص واحد، أو 5 مل"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold focus:outline-none"
                        value={m.dosage}
                        onChange={(e) => handleMedicationChange(idx, 'dosage', e.target.value)}
                      />
                    </div>
                    {/* Frequency */}
                    <div className="space-y-1">
                      <label className="block text-[9px] font-extrabold text-slate-400">تكرار التناول الدائم</label>
                      <input
                        type="text"
                        placeholder="مثل: مرتين يومياً بعد الأكل"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold focus:outline-none"
                        value={m.frequency}
                        onChange={(e) => handleMedicationChange(idx, 'frequency', e.target.value)}
                      />
                    </div>
                    {/* Started date and delete action */}
                    <div className="flex gap-2 items-center">
                      <div className="space-y-1 flex-1">
                        <label className="block text-[9px] font-extrabold text-slate-400">تاريخ بدء الفاعلية</label>
                        <input
                          type="date"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold focus:outline-none"
                          value={m.startedAt}
                          onChange={(e) => handleMedicationChange(idx, 'startedAt', e.target.value)}
                        />
                      </div>
                      {medications.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMedicationRow(idx)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-650 rounded-lg hover:text-red-700 transition-colors mt-4 self-end shrink-0"
                          title="مسح الدواء"
                        >
                          <Trash size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="block text-[11px] font-black text-slate-600">توجيهات فحص المختبر، ملاحظات الرعاية أو التحاليل الدورية المستهدفة</label>
              <textarea
                placeholder="توجيهات للطبيب المعالج حول الفحوصات الدورية اللازمة مع هذه الخطة مثل: قياس وظائف الكبد والكلى والتحليل التراكمي للسكر كل 3 أشهر."
                className="w-full px-3.5 py-2 hover:bg-white bg-slate-100 border border-slate-250 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Save Buttons */}
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => setIsAddingPlan(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md"
              >
                حفظ بروتوكول العلاج 💾
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* PLANS LIST */}
      <div className="space-y-4">
        {!patient.longTermTreatmentPlans || patient.longTermTreatmentPlans.length === 0 ? (
          <div className="p-12 border border-slate-150 border-dashed rounded-2xl text-center text-slate-450 italic text-xs font-bold bg-slate-50/50">
            لا توجد خطط علاجية مسجلة حالياً لملف هذا المريض.
            <button
              onClick={() => setIsAddingPlan(true)}
              className="mt-3 block mx-auto px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-black rounded-lg transition-all"
            >
              انقر لإنشاء أول خطة وبدء حماية المريض 🛡️
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {patient.longTermTreatmentPlans.map((plan) => {
              const overdueAlert = dayjs(plan.nextReviewDate).isBefore(dayjs());
              
              return (
                <div 
                  key={plan.id}
                  className={`border rounded-2xl bg-white shadow-xs overflow-hidden transition-all ${
                    overdueAlert && plan.status === 'active' 
                      ? 'border-red-300 ring-1 ring-red-100' 
                      : 'border-slate-200 hover:border-slate-350'
                  }`}
                >
                  {/* Card Header Info */}
                  <div className="p-4 bg-slate-50 border-b border-slate-205 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`size-2.5 rounded-full ${
                          plan.status === 'active' ? 'bg-emerald-500 animate-pulse' : 
                          plan.status === 'suspended' ? 'bg-amber-500' : 'bg-slate-400'
                        }`} />
                        <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm">{plan.planName}</h4>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold">تواتر السجل: مراجعة كاملة دورية كل {plan.frequencyMonths} أشهر</p>
                    </div>

                    {/* Left Badges & Quick Action */}
                    <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                      {getPlanReviewStatusBadge(plan)}
                      
                      {/* Dropdown status update */}
                      <select
                        className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] font-black hover:border-slate-350 cursor-pointer text-slate-655 focus:outline-none"
                        value={plan.status}
                        onChange={(e) => handleTogglePlanStatus(plan, e.target.value as any)}
                      >
                        <option value="active">نظام دائم / مستمر</option>
                        <option value="suspended">موقوف مؤقتاً</option>
                        <option value="completed">منتهي ومكتمل</option>
                      </select>
                    </div>
                  </div>

                  {/* Medications list */}
                  <div className="p-4 space-y-3">
                    <div className="text-[11px] font-black text-slate-500">الأدوية المزمنة النشطة المدرجة:</div>
                    
                    {plan.medications && plan.medications.length > 0 ? (
                      <div className="overflow-x-auto border border-slate-100 rounded-lg">
                        <table className="w-full text-xs font-bold border-collapse text-right">
                          <thead>
                            <tr className="bg-slate-50 text-slate-450 border-b border-slate-100 text-[10px]">
                              <th className="py-2 px-3 text-right">الدواء والجرعة المزمنة</th>
                              <th className="py-2 px-3 text-right">تكرار ومواعيد التناول</th>
                              <th className="py-2 px-3 text-center">تاريخ تثبيت الجرعة</th>
                              <th className="py-2 px-3 text-center">مدة الاستمرارية</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {plan.medications.map((m) => {
                              const daysStarted = dayjs().diff(dayjs(m.startedAt), 'day');
                              return (
                                <tr key={m.id} className="hover:bg-slate-50/20 text-slate-800 text-right">
                                  <td className="py-2 px-3 text-right">
                                    <p className="font-bold text-slate-900">{m.name}</p>
                                    <p className="text-[9px] text-slate-400 mt-0.5">{m.dosage || 'بدون تحديد جرعة تفصيلية'}</p>
                                  </td>
                                  <td className="py-2 px-3 text-right text-emerald-800 text-[10.5px] font-black">
                                    🔄 {m.frequency || 'حسب الإرشاد'}
                                  </td>
                                  <td className="py-2 px-3 text-center text-slate-400 font-mono text-[10px]">
                                    {m.startedAt ? dayjs(m.startedAt).format('YYYY/MM/DD') : '---'}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span className="text-[10px] bg-sky-50 text-sky-800 border border-sky-100 px-2 py-0.5 rounded font-mono">
                                      مستقر منذ {daysStarted} يوم
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 bg-amber-50/40 border-amber-100 text-amber-800 border rounded-lg text-center text-[11px] font-black">
                        لا توجد أدوية مزمنة مدرجة مع هذا البروتوكول. يمكنك إضافتها بالنقر على زر تعديل الخطة.
                      </div>
                    )}

                    {/* Clinical notes */}
                    {plan.notes && (
                      <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1 text-slate-700">
                        <strong className="text-[10px] text-slate-450 block font-black">📋 توجيهات لمزودي الرعاية والمستشارين:</strong>
                        <p className="text-xs leading-relaxed font-bold">{plan.notes}</p>
                      </div>
                    )}

                    {/* Plan Review Tracker */}
                    <div className="p-3.5 bg-indigo-50/20 border border-slate-200/50 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                        <div>
                          <strong className="text-slate-450 text-[10px] block">آخر معاينة إكلينيكية:</strong>
                          <span className="font-mono text-slate-700 font-black">{plan.lastReviewDate ? dayjs(plan.lastReviewDate).format('YYYY/MM/DD') : 'غير مسجلة'}</span>
                        </div>
                        <div>
                          <strong className="text-slate-450 text-[10px] block font-black">المراجعة الدورية القادمة:</strong>
                          <span className={`${overdueAlert ? 'text-red-600 font-black' : 'text-slate-700 font-black'} font-mono`}>
                            {plan.nextReviewDate ? dayjs(plan.nextReviewDate).format('YYYY/MM/DD') : 'غير محددة'}
                          </span>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <strong className="text-slate-450 text-[10px] block pb-0.5">تجديد الفعالية تلقائيا:</strong>
                          <span className="text-[9px] text-blue-800 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded font-bold">
                            كل +{plan.frequencyMonths} شهر
                          </span>
                        </div>
                      </div>

                      {/* Review Trigger and Controls */}
                      <div className="flex gap-2 self-end sm:self-auto pt-1 sm:pt-0">
                        {plan.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => handleMarkAsReviewed(plan)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                          >
                            <ShieldCheck size={14} />
                            <span>تأكيد المراجعة الدورية وتمديد الصلاحية ⟳</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleEditPlanClick(plan)}
                          className="p-2 bg-blue-50 border border-blue-150 text-blue-600 hover:bg-blue-100 rounded-lg hover:text-blue-700 transition"
                          title="تعديل خطة العلاج"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePlan(plan.id)}
                          className="p-2 bg-red-50 border border-red-150 text-red-600 hover:bg-red-100 rounded-lg hover:text-red-700 transition"
                          title="حذف الخطة نهائياً"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
