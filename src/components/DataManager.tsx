"use client";

import { useRef, useState } from 'react';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { ImportModal } from './ImportModal';

export function DataManager() {
  const ctx = useAppContext();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const handleExport = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      assets: ctx.assets,
      liabilities: ctx.liabilities,
      stakingItems: ctx.stakingItems,
      loans: ctx.loans,
      stockItems: ctx.stockItems,
      monthlyRecords: ctx.monthlyRecords,
      cashflowTemplate: ctx.cashflowTemplate,
      incomeItems: ctx.cashflowTemplate.income,
      expenseItems: ctx.cashflowTemplate.expense,
      annualEntries: ctx.annualEntries,
      snapshots: ctx.snapshots,
      borrowingLimits: ctx.borrowingLimits,
      customCategories: ctx.customCategories,
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
        if (data.assets)      void ctx.replaceAssets(data.assets).catch(() => toast('雲端儲存失敗，請稍後再試', 'error'));
        if (data.liabilities) void ctx.replaceLiabilities(data.liabilities).catch(() => toast('雲端儲存失敗，請稍後再試', 'error'));
        if (data.snapshots)   void ctx.replaceSnapshots(data.snapshots).catch(() => toast('雲端儲存失敗，請稍後再試', 'error'));
        if (data.stakingItems)     ctx.setStakingItems(data.stakingItems);
        if (data.loans)            ctx.setLoans(data.loans);
        if (data.stockItems)       ctx.setStockItems(data.stockItems);
        if (data.monthlyRecords)    ctx.setMonthlyRecords(data.monthlyRecords);
        if (data.cashflowTemplate)  ctx.setCashflowTemplate(data.cashflowTemplate);
        // Backward compat: old backups stored global templates as incomeItems/expenseItems
        if (!data.cashflowTemplate && data.incomeItems && data.expenseItems) {
          ctx.setCashflowTemplate({ income: data.incomeItems, expense: data.expenseItems });
        }
        if (data.annualEntries)    ctx.setAnnualEntries(data.annualEntries);
        if (data.borrowingLimits != null) ctx.setBorrowingLimits(data.borrowingLimits);
        if (data.customCategories) ctx.setCustomCategories(data.customCategories);
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
    <>
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
          title="JSON 備份匯入"
          disabled={importing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">備份匯入</span>
        </button>
        <button
          onClick={() => setShowImportModal(true)}
          title="CSV / Excel 批量匯入"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors"
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
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} />}
    </>
  );
}
