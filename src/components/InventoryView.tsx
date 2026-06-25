import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import dayjs from 'dayjs';
import { 
  Plus, Search, Trash2, Edit, Check, AlertCircle, Filter, Calendar, X, Loader2, BookOpen 
} from 'lucide-react';
import { api } from '../lib/api';
import { InventoryItem } from '../types';

interface InventoryViewProps {
  key?: string;
  inventory: InventoryItem[];
  onRefresh: () => void;
  selectedBranch: string;
  onOpenHelp?: (step: any) => void;
}

export default function InventoryView({ inventory, onRefresh, selectedBranch, onOpenHelp }: InventoryViewProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [search, setSearch] = useState("");
  const [filterExpiring, setFilterExpiring] = useState(false);
  const [storeSectionTab, setStoreSectionTab] = useState<'all' | 'medical' | 'non-medical'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for add/edit modal
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<'medication' | 'disposable' | 'equipment' | 'other'>('medication');
  const [formStoreType, setFormStoreType] = useState<'medical' | 'non-medical'>('medical');
  const [formQuantity, setFormQuantity] = useState(0);
  const [formUnit, setFormUnit] = useState("عبوة");
  const [formReorderPoint, setFormReorderPoint] = useState(5);
  const [formExpirationDate, setFormExpirationDate] = useState("");

  const isLowStock = (item: InventoryItem) => item.quantity <= item.reorderPoint;
  
  const isExpiringSoon = (date?: string) => {
    if (!date) return false;
    const diff = dayjs(date).diff(dayjs(), 'month');
    return diff <= 3 && diff >= 0;
  };

  const isExpired = (date?: string) => {
    if (!date) return false;
    return dayjs(date).isBefore(dayjs());
  };

  // 1. Locally filter inventory based on searches and section filters
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      // Branch filter (if branch is selected, match it, otherwise match all)
      const matchesBranch = !item.branch || !selectedBranch || item.branch === selectedBranch;
      if (!matchesBranch) return false;

      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                            item.category.toLowerCase().includes(search.toLowerCase());
      
      const matchesStoreSection = storeSectionTab === 'all' || 
                                  (storeSectionTab === 'medical' && (!item.storeType || item.storeType === 'medical')) ||
                                  (storeSectionTab === 'non-medical' && item.storeType === 'non-medical');

      if (filterExpiring) {
        return matchesSearch && matchesStoreSection && (isExpired(item.expirationDate) || isExpiringSoon(item.expirationDate) || isLowStock(item));
      }
      return matchesSearch && matchesStoreSection;
    });
  }, [inventory, selectedBranch, search, storeSectionTab, filterExpiring]);

  // Handle deletions
  const handleDelete = async (id: string) => {
    if (confirm("هل أنت متأكد من رغبتك في حذف هذا الصنف الإمدادي نهائياً؟")) {
      try {
        await api.deleteInventoryItem(id);
        onRefresh();
      } catch (err) {
        console.error(err);
        alert("عذراً، تعذّر إكمال طلب الحذف.");
      }
    }
  };

  // Mustafa's approval flow implementation
  const handleApproveByMustafa = async (item: InventoryItem) => {
    try {
      await api.updateInventoryItem(item.id, { 
        approvalStatus: 'approved', 
        lastApprovedBy: 'مدير الصيدلية مصطفى' 
      });
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("فشل توثيق الاعتماد للمستلزم.");
    }
  };

  // Open edit modal helper
  const startEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormStoreType(item.storeType || 'medical');
    setFormQuantity(item.quantity);
    setFormUnit(item.unit || "عبوة");
    setFormReorderPoint(item.reorderPoint);
    setFormExpirationDate(item.expirationDate || "");
    setIsAdding(true);
  };

  // Reset form helper
  const resetForm = () => {
    setIsAdding(false);
    setEditingItem(null);
    setFormName("");
    setFormCategory('medication');
    setFormStoreType('medical');
    setFormQuantity(0);
    setFormUnit("عبوة");
    setFormReorderPoint(5);
    setFormExpirationDate("");
  };

  // Submit flow
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setIsSubmitting(true);
    try {
      const payload: any = {
        name: formName,
        category: formCategory,
        quantity: Number(formQuantity),
        unit: formUnit,
        reorderPoint: Number(formReorderPoint),
        expirationDate: formExpirationDate || undefined,
        branch: selectedBranch || 'المعادي',
        storeType: formStoreType,
      };

      if (editingItem) {
        await api.updateInventoryItem(editingItem.id, payload);
      } else {
        await api.addInventoryItem({
          ...payload,
          approvalStatus: 'pending'
        });
      }
      resetForm();
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("عذراً، فشل تسجيل العنصر في قاعدة البيانات.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stat computations
  const totalItemsCount = filteredInventory.length;
  const criticalItemsCount = useMemo(() => filteredInventory.filter(isLowStock).length, [filteredInventory]);
  const expiringSoonCount = useMemo(() => filteredInventory.filter(i => isExpiringSoon(i.expirationDate)).length, [filteredInventory]);
  const expiredCount = useMemo(() => filteredInventory.filter(i => isExpired(i.expirationDate)).length, [filteredInventory]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 text-right" dir="rtl">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">مخازن الأدوية والمستلزمات الطبية</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">إدارة العهد والمعدات، ومراقبة الصلاحية والنواقص في فرع: {selectedBranch || "جميع الفروع"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {onOpenHelp && (
            <button
              type="button"
              onClick={() => onOpenHelp('inventory')}
              className="px-4 py-2.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
            >
              <BookOpen size={14} className="text-blue-600" /> عرض شرح هذه القائمة
            </button>
          )}
          <button 
            onClick={() => { resetForm(); setIsAdding(true); }}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 self-start md:self-auto cursor-pointer"
          >
            <Plus size={14} /> إضافة صنف إمدادي جديد
          </button>
        </div>
      </header>

      {/* KPI Metric Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">إجمالي الأصناف بالمخزن</span>
            <span className="bg-slate-100 text-slate-600 rounded-full text-[10px] px-2 py-0.5 font-bold">الكل</span>
          </div>
          <h3 className="text-2xl font-black text-slate-800 font-sans mt-3">{totalItemsCount} <span className="text-xs font-bold text-slate-405">صنف صيدلي</span></h3>
          <p className="text-[9px] text-slate-400 font-bold mt-3 pt-2.5 border-t border-slate-50">إجمالي الأصناف النشطة ضمن تصفية الفرع الحالي</p>
        </div>

        {/* KPI 2 */}
        <div className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-between ${criticalItemsCount > 0 ? 'bg-amber-50/20 border-amber-205' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-black text-slate-400 Ltr tracking-wider">نواقص عاجلة (Low Stock)</span>
            <AlertCircle size={16} className={criticalItemsCount > 0 ? "text-amber-500 animate-pulse" : "text-slate-350"} />
          </div>
          <h3 className={`text-2xl font-black mt-3 font-sans ${criticalItemsCount > 0 ? 'text-amber-700' : 'text-slate-800'}`}>{criticalItemsCount} <span className="text-xs font-bold text-slate-405">تنبيه حرج</span></h3>
          <p className="text-[9px] text-slate-400 font-bold mt-3 pt-2.5 border-t border-slate-50">أصناف قاربت كميتها على الانتهاء دون تغطية الطلب</p>
        </div>

        {/* KPI 3 */}
        <div className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-between ${expiringSoonCount > 0 ? 'bg-rose-50/20 border-rose-205' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-black text-slate-400 Ltr tracking-wider">أوشكت على الانتهاء (&lt;3 أشهـر)</span>
            <Calendar size={16} className={expiringSoonCount > 0 ? "text-rose-500 animate-pulse" : "text-slate-350"} />
          </div>
          <h3 className={`text-2xl font-black mt-3 font-sans ${expiringSoonCount > 0 ? 'text-rose-700' : 'text-slate-800'}`}>{expiringSoonCount} <span className="text-xs font-bold text-slate-455">صنف مهدد</span></h3>
          <p className="text-[9px] text-slate-405 font-bold mt-3 pt-2.5 border-t border-slate-50">صلاحيات الأدوية المقرّرة بفترة أقل من 90 يوماً</p>
        </div>

        {/* KPI 4 */}
        <div className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-between ${expiredCount > 0 ? 'bg-red-50/40 border-red-200' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-black text-red-700 tracking-wider">منتهية الصلاحية تماماً ⚠️</span>
            <AlertCircle size={16} className={expiredCount > 0 ? "text-red-600 animate-bounce" : "text-slate-350"} />
          </div>
          <h3 className={`text-2xl font-black mt-3 font-sans ${expiredCount > 0 ? 'text-red-750' : 'text-slate-800'}`}>{expiredCount} <span className="text-xs font-bold text-red-500">ممنوع صرفه</span></h3>
          <p className="text-[9px] text-red-650/70 font-semibold mt-3 pt-2.5 border-t border-slate-53 flex items-center gap-1 bg-red-50/50 -mx-5 px-5 -mb-5 pb-3">
             يتوجب إهلاكها واستبدالها لتفادي الخطر الصحي
          </p>
        </div>
      </div>

      {/* Sub-tab selections & filters panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-250 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1 shrink-0 font-sans font-bold w-fit">
          <button 
            type="button"
            onClick={() => setStoreSectionTab('all')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${storeSectionTab === 'all' ? 'bg-white shadow-sm text-slate-800 font-extrabold' : 'text-slate-405'}`}
          >
            الكل ({inventory.filter(i => !selectedBranch || i.branch === selectedBranch).length})
          </button>
          <button 
            type="button"
            onClick={() => setStoreSectionTab('medical')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${storeSectionTab === 'medical' ? 'bg-white shadow-sm text-slate-800 font-extrabold' : 'text-slate-405'}`}
          >
            💊 الأدوية والمستلزمات الطبية
          </button>
          <button 
            type="button"
            onClick={() => setStoreSectionTab('non-medical')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${storeSectionTab === 'non-medical' ? 'bg-white shadow-sm text-slate-800 font-extrabold' : 'text-slate-405'}`}
          >
            🛠️ الأجهزة والعهد غير الطبية
          </button>
        </div>

        {/* Searching Inputs */}
        <div className="flex flex-wrap items-center gap-4 flex-1 justify-end">
          <div className="relative w-full max-w-xs">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="البحث بالاسم أو الفئة..." 
              className="w-full pl-3.5 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-350 transition-all text-right"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-black text-rose-800 bg-rose-50/50 hover:bg-rose-50 border border-rose-100/70 px-3 py-2 rounded-xl transition-all cursor-pointer">
            <input 
              type="checkbox" 
              className="accent-rose-700 cursor-pointer w-4 h-4" 
              checked={filterExpiring}
              onChange={(e) => setFilterExpiring(e.target.checked)}
            />
            <span>⚠️ تصفية عاجلة (نقص الإمداد / الصلاحية)</span>
          </label>
        </div>
      </div>

      {/* Main Inventory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-right">
        <div className="p-5 border-b border-slate-100 bg-white">
          <h3 className="font-black text-xs text-slate-500 uppercase tracking-widest flex items-center gap-1">
            <span>📋 قائمة الأصناف والخصائص الإمدادية النشطة</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-150">
                <th className="px-6 py-4">اسم المادة الطبية / الصنف</th>
                <th className="px-6 py-4">القسم / التصنيف</th>
                <th className="px-6 py-4">الرصيد الفعلي الحالي</th>
                <th className="px-6 py-4">الحد الأدنى للطلب (نقطة النقص)</th>
                <th className="px-6 py-4">تاريخ انتهاء الصلاحية</th>
                <th className="px-6 py-4">حالة الاعتماد والنقابة</th>
                <th className="px-6 py-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-705">
              {filteredInventory.map((item) => {
                const low = isLowStock(item);
                const expiring = isExpiringSoon(item.expirationDate);
                const expired = isExpired(item.expirationDate);
                const isApproved = item.approvalStatus === 'approved';

                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-all text-right">
                    {/* Name */}
                    <td className="px-6 py-4">
                      <p className="font-extrabold text-slate-850 text-sm">{item.name}</p>
                      <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider font-mono">الفرع: {item.branch || 'رئيسي المعادي'}</p>
                    </td>

                    {/* Category */}
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded text-[10.5px] font-black">
                        {item.category === 'medication' ? '🔬 دواء / علاج' :
                         item.category === 'disposable' ? '💉 مستلزم طبي' :
                         item.category === 'equipment' ? '🛠️ جهاز / عهدة' : '📦 صنف آخر'}
                      </span>
                    </td>

                    {/* Quantity */}
                    <td className="px-6 py-4">
                      <span className={`h-fit w-fit font-mono text-sm px-2.5 py-1 rounded-md font-bold ${
                        low ? 'bg-amber-50 text-amber-700 animate-pulse border border-amber-200' : 'text-slate-800'
                      }`}>
                        {item.quantity} {item.unit || 'وحدة'}
                      </span>
                    </td>

                    {/* Reorder point */}
                    <td className="px-6 py-4 font-mono text-slate-500 text-xs">{item.reorderPoint} {item.unit || 'وحدة'}</td>

                    {/* Expiration date */}
                    <td className="px-6 py-4">
                      {item.expirationDate ? (
                        <p className={`font-mono text-xs ${
                          expired ? 'text-red-650 bg-red-50 border border-red-100 px-2 py-0.5 rounded w-fit font-extrabold' :
                          expiring ? 'text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded w-fit font-extrabold animate-pulse' :
                          'text-slate-600'
                        }`}>
                          {item.expirationDate}
                          {expired && <span className="text-[9px] block font-black text-red-750 mt-0.5">⚠️ منتهى الصلاحية</span>}
                          {expiring && !expired && <span className="text-[9px] block font-black text-amber-650 mt-0.5">⏱️ تنبيه: يوشك على الانتهاء</span>}
                        </p>
                      ) : (
                        <span className="text-slate-400 italic font-medium">غير قابل للتلف</span>
                      )}
                    </td>

                    {/* Approval Status */}
                    <td className="px-6 py-4">
                      {isApproved ? (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-110 px-2 py-1 rounded text-[10px] font-black flex items-center gap-1 w-fit">
                          <span>✓ معتمد تماماً</span>
                          {item.lastApprovedBy && <span className="text-[8px] text-emerald-600 font-bold block"> بواسطة: مصطفى</span>}
                        </span>
                      ) : (
                        <span className="text-amber-700 bg-amber-50 border border-amber-110 px-2 py-1 rounded text-[10px] font-black w-fit block animate-pulse">
                          ⏳ قيد مراجعة الصيدلية
                        </span>
                      )}
                    </td>

                    {/* Action buttons */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2 w-full">
                        {!isApproved && (
                          <button
                            type="button"
                            onClick={() => handleApproveByMustafa(item)}
                            className="bg-emerald-650 hover:bg-emerald-700 text-white p-1.5 rounded-lg transition-all shadow-sm flex items-center gap-1 text-[10px] font-black border border-emerald-700 cursor-pointer"
                          >
                            <Check size={12} /> اعتماد الصيدلي مصطفى
                          </button>
                        )}
                        <button 
                          type="button"
                          onClick={() => startEdit(item)}
                          className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 p-1.5 rounded-lg transition-all cursor-pointer"
                        >
                          <Edit size={12} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-650 p-1.5 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-350 italic">لا توجد إمدادات أو مستودعات أدوية مطابقة للتصفية</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Inventory Item Popup Form Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-right">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="bg-white w-full max-w-md rounded-xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col justify-between"
            >
              <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-800">{editingItem ? "تعديل تفاصيل الصنف الإمدادي" : "إضافة صنف طبي أو مادة جديدة بالمخزن"}</h2>
                <button onClick={resetForm} className="p-1 hover:bg-slate-150 rounded-lg text-slate-400 transition-colors cursor-pointer"><X size={20} /></button>
              </div>

              <form className="p-6 space-y-4 text-right" onSubmit={handleSubmit}>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">قطاع المخزن المستهدف (Store Section)</label>
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={() => setFormStoreType('medical')} 
                      className={`flex-1 p-2.5 rounded-lg border transition-all font-black text-[10px] uppercase tracking-widest ${formStoreType === 'medical' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
                    >
                      💊 مستلزم / دواء طبي
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setFormStoreType('non-medical')} 
                      className={`flex-1 p-2.5 rounded-lg border transition-all font-black text-[10px] uppercase tracking-widest ${formStoreType === 'non-medical' ? 'border-slate-600 bg-slate-50 text-slate-500' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
                    >
                      🛠️ عهدة / أجهزة غير طبية
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">اسم الصنف الإمدادي</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="مثال: روشتة علاج ضغط كوفيد، شاش معقم، ميزان حراري..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">تصنيف الصنف</label>
                    <select
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as any)}
                    >
                      <option value="medication">🔬 أدوية وعقاقير</option>
                      <option value="disposable">💉 مستهلكات حقن وشاش</option>
                      <option value="equipment">🛠️ أجهزة طبية ثابتة</option>
                      <option value="other">📦 أصناف ومعدات أخرى</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">وحدة القياس / العبوة</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="امثلة: شريط، عبوة، قرص، لتر"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-850 text-right focus:outline-none"
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">القدر أو الرصيد المتاح</label>
                    <input 
                      type="number" 
                      required 
                      min={0}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-850 text-right focus:outline-none"
                      value={formQuantity}
                      onChange={(e) => setFormQuantity(Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">نقطة إعادة الطلب للنقص</label>
                    <input 
                      type="number" 
                      required 
                      min={0}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-850 text-right focus:outline-none"
                      value={formReorderPoint}
                      onChange={(e) => setFormReorderPoint(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">تاريخ انتهاء الصلاحية (يمكن تركها فارغة)</label>
                  <input 
                    type="date" 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-850 focus:outline-none"
                    value={formExpirationDate}
                    onChange={(e) => setFormExpirationDate(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs uppercase tracking-widest rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5 disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>جاري الحفظ والتوثيق بالتأكيد...</span>
                    </>
                  ) : (
                    <span>تأكيد وحفظ بيانات الصنف المرفقة</span>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
