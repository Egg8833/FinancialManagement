"use client";
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Check } from 'lucide-react';
import { useAppContext, type LoanItem } from '../../context/AppContext';

export function PaymentDueDialog({ loans, onRecord, onClose }: {
  loans: LoanItem[];
  onRecord: (id: string) => void;
  onClose: () => void;
}) {
  const { showValues } = useAppContext();
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());

  const handleConfirm = (id: string) => {
    onRecord(id);
    setConfirmed(prev => {
      const next = new Set(prev);
      next.add(id);
      if (next.size >= loans.length) setTimeout(onClose, 600);
      return next;
    });
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-linear-to-r from-amber-500 to-orange-500 px-6 py-5">
          <div className="flex items-center gap-3 text-white">
            <RefreshCw className="w-5 h-5 shrink-0" />
            <div>
              <h3 className="font-bold text-lg">還款提醒</h3>
              <p className="text-sm text-white/80 mt-0.5">以下信貸的還款日已到，請確認是否已還款</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-3 max-h-80 overflow-y-auto">
          {loans.map(loan => {
            const isDone = confirmed.has(loan.id);
            return (
              <div
                key={loan.id}
                className={`flex items-center justify-between gap-3 p-4 rounded-xl border transition-all duration-300 ${
                  isDone ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-100'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm">{loan.name}</span>
                    <span className="text-xs text-gray-400">{loan.bank}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    還款日 <span className="font-medium text-amber-600">{loan.nextPaymentDate}</span>
                    <span className="mx-1.5 text-gray-300">·</span>
                    每月還款 <span className="font-semibold text-gray-700">{showValues ? loan.monthlyPayment.toLocaleString('en-US') : '****'}</span>
                  </div>
                </div>
                {isDone ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold shrink-0">
                    <Check className="w-4 h-4" /> 已記錄
                  </span>
                ) : (
                  <button
                    onClick={() => handleConfirm(loan.id)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" /> 確認已還款
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-6 pb-5 pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            稍後再說
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
