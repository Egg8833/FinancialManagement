"use client";

import { useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useStockContext } from '../context/StockContext';
import { useToast } from '../context/ToastContext';
import { ImportModal } from './ImportModal';
import { buildBackup, applyBackup } from '../lib/backup';

export function DataManager() {
  const ctx = useAppContext();
  const { soldStocks, setSoldStocks } = useStockContext();
  const { status: sessionStatus } = useSession();
  const isGoogleLinked = sessionStatus === 'authenticated';
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const handleExport = () => {
    const data = buildBackup({
      assets: ctx.assets,
      liabilities: ctx.liabilities,
      snapshots: ctx.snapshots,
      stakingItems: ctx.stakingItems,
      loans: ctx.loans,
      stockItems: ctx.stockItems,
      soldStocks,
      monthlyRecords: ctx.monthlyRecords,
      cashflowTemplate: ctx.cashflowTemplate,
      annualEntries: ctx.annualEntries,
      borrowingLimits: ctx.borrowingLimits,
      customCategories: ctx.customCategories,
      netWorthGoal: ctx.netWorthGoal,
      usdToTwd: ctx.usdToTwd,
      userName: ctx.userName,
      userEmail: ctx.userEmail,
    });
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
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const { hasCloudFailure } = await applyBackup(data, {
          replaceAssets: ctx.replaceAssets,
          replaceLiabilities: ctx.replaceLiabilities,
          replaceSnapshots: ctx.replaceSnapshots,
          setStakingItems: ctx.setStakingItems,
          setLoans: ctx.setLoans,
          setStockItems: ctx.setStockItems,
          setSoldStocks,
          setMonthlyRecords: ctx.setMonthlyRecords,
          setCashflowTemplate: ctx.setCashflowTemplate,
          setAnnualEntries: ctx.setAnnualEntries,
          setBorrowingLimits: ctx.setBorrowingLimits,
          setCustomCategories: ctx.setCustomCategories,
          setNetWorthGoal: ctx.setNetWorthGoal,
          setUsdToTwd: ctx.setUsdToTwd,
          setUserName: ctx.setUserName,
          setUserEmail: ctx.setUserEmail,
        }, { allowIdentityOverride: !isGoogleLinked });

        if (hasCloudFailure) {
          toast('資料已匯入，但雲端同步的部分失敗，請稍後再試', 'error');
        } else {
          toast('資料匯入成功');
        }
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
