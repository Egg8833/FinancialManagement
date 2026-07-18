"use client";

import { useState, useEffect, useRef } from 'react';
import { User, Mail, Save, CheckCircle, DollarSign, Download, Upload, Database, Bell, ShieldCheck } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';

export default function SettingsPage() {
  const {
    userName, setUserName,
    userEmail, setUserEmail,
    usdToTwd, setUsdToTwd,
    assets,
    liabilities,
    stakingItems, setStakingItems,
    stockItems, setStockItems,
    monthlyRecords, setMonthlyRecords,
    cashflowTemplate, setCashflowTemplate,
    annualEntries, setAnnualEntries,
    loans, setLoans,
    snapshots,
    borrowingLimits, setBorrowingLimits,
    replaceAssets, replaceLiabilities, replaceSnapshots,
    netWorthGoal, setNetWorthGoal,
    setLastExportDate,
    reportSchedule, setReportSchedule,
    lastReportSent,
    enablePledgeTracking, setEnablePledgeTracking,
  } = useAppContext();
  const { toast } = useToast();

  const [localName, setLocalName] = useState(userName);
  const [localEmail, setLocalEmail] = useState(userEmail);
  const [localUsdRate, setLocalUsdRate] = useState(usdToTwd.toString());
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  const handleSave = () => {
    setUserName(localName.trim());
    setUserEmail(localEmail.trim());
    const rate = parseFloat(localUsdRate);
    if (!isNaN(rate) && rate > 0) setUsdToTwd(rate);
    setSaved(true);
    toast('個人資訊已儲存');
  };

  const hasChanges =
    localName !== userName ||
    localEmail !== userEmail ||
    parseFloat(localUsdRate) !== usdToTwd;

  const handleExport = () => {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      assets,
      liabilities,
      stakingItems,
      stockItems,
      monthlyRecords,
      cashflowTemplate,
      incomeItems: cashflowTemplate.income,
      expenseItems: cashflowTemplate.expense,
      annualEntries,
      loans,
      snapshots,
      borrowingLimits,
      netWorthGoal,
      usdToTwd,
      userName,
      userEmail,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assetdash-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setLastExportDate(new Date().toISOString().split('T')[0]);
    toast('備份已下載');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.version || !data.assets) {
          toast('無效的備份檔案');
          return;
        }
        if (!confirm('匯入備份將覆蓋目前所有資料，是否繼續？')) return;
        if (data.assets)      void replaceAssets(data.assets).catch(() => toast('雲端儲存失敗，請稍後再試', 'error'));
        if (data.liabilities) void replaceLiabilities(data.liabilities).catch(() => toast('雲端儲存失敗，請稍後再試', 'error'));
        if (data.snapshots)   void replaceSnapshots(data.snapshots).catch(() => toast('雲端儲存失敗，請稍後再試', 'error'));
        if (data.stakingItems) setStakingItems(data.stakingItems);
        if (data.stockItems) setStockItems(data.stockItems);
        if (data.monthlyRecords)   setMonthlyRecords(data.monthlyRecords);
        if (data.cashflowTemplate) setCashflowTemplate(data.cashflowTemplate);
        if (!data.cashflowTemplate && data.incomeItems && data.expenseItems) {
          setCashflowTemplate({ income: data.incomeItems, expense: data.expenseItems });
        }
        if (data.annualEntries) setAnnualEntries(data.annualEntries);
        if (data.loans) setLoans(data.loans);
        if (data.borrowingLimits) setBorrowingLimits(data.borrowingLimits);
        if (typeof data.netWorthGoal === 'number') setNetWorthGoal(data.netWorthGoal);
        if (typeof data.usdToTwd === 'number') { setUsdToTwd(data.usdToTwd); setLocalUsdRate(data.usdToTwd.toString()); }
        if (data.userName) { setUserName(data.userName); setLocalName(data.userName); }
        if (data.userEmail) { setUserEmail(data.userEmail); setLocalEmail(data.userEmail); }
        toast('備份已成功匯入');
      } catch {
        toast('解析備份失敗，請確認檔案格式');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">個人資訊設定</h1>
        <p className="text-sm text-gray-500 mt-1">管理您的個人資料，資料僅儲存在本地設備中</p>
      </div>

      <div className="max-w-2xl space-y-8">

        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-xl font-bold border-2 border-white/30">
                {localName ? localName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="text-white">
                <h2 className="font-bold text-lg">{localName || '使用者'}</h2>
                <p className="text-sm text-white/70">{localEmail || '尚未設定信箱'}</p>
              </div>
            </div>
          </div>

          {/* Form Body */}
          <div className="p-6 space-y-5">
            {/* Name Field */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 text-gray-400" />
                使用者名稱
              </label>
              <input
                type="text"
                value={localName}
                onChange={e => setLocalName(e.target.value)}
                placeholder="請輸入您的名稱"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-gray-50 focus:bg-white"
              />
              <p className="text-xs text-gray-400 mt-1.5">此名稱將顯示在導覽列與報表中</p>
            </div>

            {/* Email Field */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4 text-gray-400" />
                個人信箱
              </label>
              <input
                type="email"
                value={localEmail}
                onChange={e => setLocalEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-gray-50 focus:bg-white"
              />
              <p className="text-xs text-gray-400 mt-1.5">寄送資產報表時將自動使用此信箱作為收件人</p>
            </div>

            {/* USD/TWD Rate Field */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                USD / TWD 匯率
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={localUsdRate}
                  onChange={e => setLocalUsdRate(e.target.value)}
                  placeholder="32"
                  className="w-40 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-gray-50 focus:bg-white"
                />
                <span className="text-sm text-gray-500">1 USD = {localUsdRate || '32'} TWD</span>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">用於換算美股市值與質押擔保品（TWD）</p>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-2">
              <div>
                {saved && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600 animate-fade-in">
                    <CheckCircle className="w-4 h-4" />
                    已儲存
                  </span>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={!hasChanges}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-indigo-200"
              >
                <Save className="w-4 h-4" />
                儲存設定
              </button>
            </div>
          </div>
        </div>

        {/* Backup Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-gray-900">資料備份與還原</h3>
            </div>
            <p className="text-sm text-gray-500 mt-1">將所有資產、負債、質押、股票等資料匯出為 JSON 檔案</p>
          </div>
          <div className="p-6 flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
            >
              <Download className="w-4 h-4" />
              匯出備份 (JSON)
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white text-gray-700 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              匯入備份
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>
        </div>

        {/* Report Schedule Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-gray-900">自動報表排程</h3>
            </div>
            <p className="text-sm text-gray-500 mt-1">設定定期自動寄送資產報表至您的信箱</p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">寄送頻率</label>
              <div className="flex gap-3 flex-wrap">
                {(['none', 'weekly', 'monthly'] as const).map(opt => {
                  const labels = { none: '不自動寄送', weekly: '每週', monthly: '每月' };
                  const isSelected = reportSchedule === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setReportSchedule(opt)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                      }`}
                    >
                      {labels[opt]}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {reportSchedule === 'none' && '目前不會自動寄送報表。'}
                {reportSchedule === 'weekly' && `每週一自動寄送報表至 ${userEmail || '（尚未設定信箱）'}。`}
                {reportSchedule === 'monthly' && `每月 1 日自動寄送報表至 ${userEmail || '（尚未設定信箱）'}。`}
              </p>
            </div>
            {lastReportSent && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                上次寄送時間：{new Date(lastReportSent).toLocaleString('zh-TW')}
              </div>
            )}
            {reportSchedule !== 'none' && !userEmail && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
                <span>⚠️</span>
                <span>請先在上方設定個人信箱，否則自動報表無法寄出。</span>
              </div>
            )}
          </div>
        </div>

        {/* Feature Toggles Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-gray-900">功能開關</h3>
            </div>
            <p className="text-sm text-gray-500 mt-1">開啟或關閉特定進階功能</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">質押擔保品追蹤</p>
                <p className="text-xs text-gray-400 mt-0.5">在股票頁顯示擔保品欄位與設定，適合有股票質押需求的用戶</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enablePledgeTracking}
                onClick={() => setEnablePledgeTracking(!enablePledgeTracking)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  enablePledgeTracking ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    enablePledgeTracking ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100">
          <h3 className="text-sm font-bold text-indigo-800 mb-2">🔒 隱私說明</h3>
          <ul className="text-sm text-indigo-700 space-y-1.5">
            <li>• 所有個人資料僅儲存於您的瀏覽器（localStorage）中</li>
            <li>• 資料不會上傳至任何雲端伺服器</li>
            <li>• 清除瀏覽器資料將同時移除這些設定</li>
            <li>• 寄送報表時，郵件透過您設定的 SMTP 直接發送</li>
          </ul>
        </div>

      </div>
    </>
  );
}
