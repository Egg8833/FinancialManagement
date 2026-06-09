"use client";
import { useState, memo } from 'react';
import { CreditCard, Pencil, Trash2, Check, X } from 'lucide-react';
import { useAppContext, type LoanItem } from '../../context/AppContext';

export const RevolvingLoanCard = memo(function RevolvingLoanCard({ loan, onDelete, onUpdate }: {
  loan: LoanItem; onDelete: () => void; onUpdate: (d: Partial<LoanItem>) => void;
}) {
  const { showValues } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [ep, setEp] = useState(loan.principal.toString());
  const [er, setEr] = useState(loan.interestRate.toString());
  const [em, setEm] = useState(loan.monthlyPayment.toString());

  const handleSave = () => {
    onUpdate({ principal: Number(ep) || 0, interestRate: Number(er) || 0, monthlyPayment: Number(em) || 0 });
    setIsEditing(false);
  };

  if (isEditing) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex justify-between items-center mb-3">
        <span className="font-bold text-gray-800">{loan.name}（{loan.bank}）</span>
        <button onClick={onDelete} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="block text-xs text-gray-500 mb-1">目前借款餘額</label><input type="number" value={ep} onChange={e => setEp(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">年利率 (%)</label><input type="number" step="0.01" value={er} onChange={e => setEr(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">每月扣息</label><input type="number" value={em} onChange={e => setEm(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 flex items-center gap-1"><Check className="w-4 h-4" /> 儲存</button>
        <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm flex items-center gap-1"><X className="w-4 h-4" /> 取消</button>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center shrink-0">
          <CreditCard className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900">{loan.name}</span>
            <span className="text-xs text-gray-400">{loan.bank}</span>
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full">循環</span>
          </div>
          <div className="flex flex-wrap gap-3 mt-1.5 text-sm">
            <span className="text-gray-500">借款餘額 <b className="text-gray-900">{showValues ? loan.principal.toLocaleString('en-US') : '****'}</b></span>
            <span className="text-gray-500">利率 <b className="text-amber-600">{loan.interestRate}%</b></span>
            <span className="text-gray-500">每月扣息 <b className="text-rose-600">{showValues ? loan.monthlyPayment.toLocaleString('en-US') : '****'}</b></span>
          </div>
          <p className="mt-1 text-xs text-gray-400">循環利息，本金不自動調降。如有還本請點編輯手動修改餘額。</p>
        </div>
      </div>
      <button onClick={() => setIsEditing(true)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg self-start lg:self-auto">
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  );
});
