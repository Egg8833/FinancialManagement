"use client";

import { useRef, useState } from 'react';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';

export function DataManager() {
  const ctx = useAppContext();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleExport = () => {
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
    toast('資料已匯出');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.assets)        ctx.setAssets(data.assets);
        if (data.liabilities)   ctx.setLiabilities(data.liabilities);
        if (data.stakingItems)  ctx.setStakingItems(data.stakingItems);
        if (data.loans)         ctx.setLoans(data.loans);
        if (data.stockItems)    ctx.setStockItems(data.stockItems);
        if (data.incomeItems)   ctx.setIncomeItems(data.incomeItems);
        if (data.expenseItems)  ctx.setExpenseItems(data.expenseItems);
        if (data.annualEntries) ctx.setAnnualEntries(data.annualEntries);
        if (data.snapshots)     ctx.setSnapshots(data.snapshots);
        if (data.borrowingLimit != null) ctx.setBorrowingLimit(data.borrowingLimit);
        toast('資料匯入成功');
      } catch {
        toast('匯入失敗：檔案格式不正確', 'error');
      } finally {
        setImporting(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExport}
        title="匯出資料"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">匯出</span>
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        title="匯入資料"
        disabled={importing}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
      >
        <Upload className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">匯入</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />
    </div>
  );
}
