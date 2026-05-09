"use client";

import { useState } from 'react';
import { ShieldAlert, Download, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';

function daysSince(isoDate: string): number {
  if (!isoDate) return Infinity;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
}

export function BackupBanner() {
  const ctx = useAppContext();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);

  const days = daysSince(ctx.lastExportDate);
  const isOverdue = days >= 7;

  if (!isOverdue || dismissed) return null;

  const handleExportNow = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      assets: ctx.assets,
      liabilities: ctx.liabilities,
      stakingItems: ctx.stakingItems,
      loans: ctx.loans,
      stockItems: ctx.stockItems,
      incomeItems: ctx.incomeItems,
      expenseItems: ctx.expenseItems,
      annualEntries: ctx.annualEntries,
      snapshots: ctx.snapshots,
      borrowingLimit: ctx.borrowingLimit,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assetdash-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    ctx.setLastExportDate(new Date().toISOString());
    toast('資料已匯出備份');
    setDismissed(true);
  };

  const neverExported = !ctx.lastExportDate;
  const label = neverExported
    ? '您尚未備份過資料'
    : `距上次備份已 ${days} 天`;

  return (
    <div className="mx-4 sm:mx-6 lg:mx-8 mt-3 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 max-w-7xl mx-auto">
      <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
      <p className="flex-1 text-sm text-amber-800 font-medium">
        {label}，建議立即備份以避免資料遺失。
      </p>
      <button
        onClick={handleExportNow}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        立即備份
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 text-amber-400 hover:text-amber-600 transition-colors shrink-0"
        title="暫時忽略"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
