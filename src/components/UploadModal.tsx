import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Loader2 } from 'lucide-react';
import dayjs from 'dayjs';

interface UploadModalProps {
  onClose: () => void;
  onUpload: (file: File, title: string, type: string, visitId: string) => void;
  visits: any[];
  doctors: any[];
  initialVisitId?: string;
}

export default function UploadModal({ onClose, onUpload, visits, doctors, initialVisitId }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>('prescription');
  const [visitId, setVisitId] = useState(initialVisitId || (visits[0]?.id || ""));
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim() || !visitId) return;
    setIsUploading(true);
    try {
      await onUpload(file, title, type, visitId);
      onClose();
    } catch (err) {
      console.error(err);
      alert("عذراً، فشل رفع الملف الطبي المطلوب.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-right"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="bg-white w-full max-w-md rounded-xl overflow-hidden shadow-2xl border border-slate-205 flex flex-col justify-between"
        dir="rtl"
      >
        <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800">رفع ملف طبي وتوثيقه 📑</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 cursor-pointer"><X size={20} /></button>
        </div>

        <form className="p-6 space-y-4 text-right" onSubmit={handleSubmit}>
          {/* Document Type buttons */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">نوع الملف المستهدف</label>
            <div className="flex gap-2 font-sans">
              <button 
                type="button" 
                onClick={() => setType('prescription')} 
                className={`flex-1 p-3 rounded-lg border transition-all font-black text-[10px] uppercase tracking-widest cursor-pointer ${type === 'prescription' ? 'border-emerald-600 bg-emerald-50 text-emerald-700 font-extrabold' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
              >
                روشتة طبية
              </button>
              <button 
                type="button" 
                onClick={() => setType('report')} 
                className={`flex-1 p-3 rounded-lg border transition-all font-black text-[10px] uppercase tracking-widest cursor-pointer ${type === 'report' ? 'border-emerald-600 bg-emerald-50 text-emerald-700 font-extrabold' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
              >
                تقرير تشخيصي
              </button>
              <button 
                type="button" 
                onClick={() => setType('other')} 
                className={`flex-1 p-3 rounded-lg border transition-all font-black text-[10px] uppercase tracking-widest cursor-pointer ${type === 'other' ? 'border-emerald-600 bg-emerald-50 text-emerald-700 font-extrabold' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
              >
                مستندات أخرى
              </button>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">عنوان أو وصف المسمّى للتقرير</label>
            <input 
              type="text" 
              required
              placeholder="مثال: روشتة الرمد، تقرير القلب والأوعية الدموية..."
              className="w-full p-2.5 bg-slate-55 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-350 transition-all text-right"
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
            />
          </div>

          {/* Visit association */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">ربط الملف بالزيارة السريرية للمريض</label>
            <select 
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-205 rounded-lg text-xs font-bold text-slate-800 focus:outline-none text-right"
              value={visitId} 
              onChange={(e) => setVisitId(e.target.value)}
            >
              {visits.map((v: any) => {
                const doc = doctors.find((d: any) => d.id === v.doctorId);
                return (
                  <option key={v.id} value={v.id}>
                    زيارة يوم {dayjs(v.date).format('YYYY/MM/DD')} - مع د. {doc?.name || '---'}
                  </option>
                );
              })}
              {visits.length === 0 && (
                <option value="">لا توجد زيارات سابقة لهذا المريض لربطها</option>
              )}
            </select>
          </div>

          {/* File select */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">تحميل الملف المباشر (PDF / صور)</label>
            <input 
              type="file" 
              required
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-805 text-right focus:outline-none"
              onChange={(e) => setFile(e.target.files?.[0] || null)} 
            />
          </div>

          {/* Submit button */}
          <button 
            type="submit" 
            disabled={!file || !title.trim() || !visitId || isUploading}
            className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs uppercase tracking-widest rounded-lg transition-all shadow-md disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>جاري تحميل الملف وتأمين التخزين...</span>
              </>
            ) : (
              <span>تأكيد ورفع المستند الطبي وحفظه</span>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
