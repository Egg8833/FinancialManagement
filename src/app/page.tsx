"use client";

import { useState, useMemo } from 'react';
import { Plus, X, Check, Sparkles, Camera } from 'lucide-react';
import { HeroKPI } from '../components/HeroKPI';
import { AssetCategoryCard } from '../components/AssetComponents';
import { NetWorthChart } from '../components/NetWorthChart';
import { AssetAllocationChart } from '../components/AssetAllocationChart';
import { LiabilitiesCard } from '../components/LiabilityComponents';
import { HealthScoreCard } from '../components/HealthScoreCard';
import { FinancialGoals } from '../components/FinancialGoals';
import { useAppContext } from '../context/AppContext';
import { formatCurrency as _fmt, nowTs } from '../lib/utils';
import { CashflowSummaryBar } from '../components/dashboard/CashflowSummaryBar';
import { SnapshotTable } from '../components/dashboard/SnapshotTable';
import Link from 'next/link';


export default function DashboardPage() {
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const {
    showValues,
    assets,
    setAssets,
    combinedAssets,
    setLiabilities,
    combinedLiabilities,
    totalMonthlyIncome,
    totalMonthlyExpense,
    monthlyNetCashFlow,
    totalAssets,
    totalLiabilities,
    netWorth,
    momDelta,
    netWorthGoal,
    setNetWorthGoal,
    snapshots,
    setSnapshots,
    takeSnapshot,
    clearAllData,
    stakingItems,
  } = useAppContext();

  const isDemoData = useMemo(
    () => assets.some(cat => cat.items.some(item => item.id === 'l1')),
    [assets],
  );
  const [demoDismissed, setDemoDismissed] = useState(false);

  const formatCurrency = (amount: number) => _fmt(amount, showValues);

  const liquidAssets = useMemo(
    () => assets.find(c => c.id === 'liquid')?.items.reduce((s, i) => s + i.amount, 0) ?? 0,
    [assets],
  );
  const runwayMonths = totalMonthlyExpense > 0 ? liquidAssets / totalMonthlyExpense : null;

  const alerts = useMemo(() => {
    const result: Array<{ level: 'warn' | 'info'; message: string; href: string; cta: string }> = [];

    if (monthlyNetCashFlow < 0) {
      result.push({ level: 'warn', message: `本月預計現金流為負（${_fmt(monthlyNetCashFlow, showValues)}），支出超過收入`, href: '/cashflow', cta: '調整預算' });
    }

    if (runwayMonths !== null && runwayMonths < 3) {
      result.push({ level: 'warn', message: `現金彈藥僅剩 ${runwayMonths.toFixed(1)} 個月，建議補充流動資金`, href: '/cashflow', cta: '查看現金流' });
    }

    const borrowItems = stakingItems.filter((i: { stakingType?: string }) => (i.stakingType ?? 'borrow') === 'borrow');
    for (const item of borrowItems) {
      if (item.apy > 10) {
        result.push({ level: 'warn', message: `「${item.name}」借貸年利率 ${item.apy}%，注意資金成本`, href: '/staking', cta: '查看借貸' });
      }
    }

    return result;
  }, [monthlyNetCashFlow, runwayMonths, stakingItems, showValues]);

  const colorOptions = [
    { colorClass: 'bg-violet-400', bgClass: 'bg-violet-50' },
    { colorClass: 'bg-orange-400', bgClass: 'bg-orange-50' },
    { colorClass: 'bg-teal-400',   bgClass: 'bg-teal-50'   },
    { colorClass: 'bg-pink-400',   bgClass: 'bg-pink-50'   },
    { colorClass: 'bg-yellow-400', bgClass: 'bg-yellow-50' },
  ];

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const color = colorOptions[assets.length % colorOptions.length];
    setAssets(prev => [...prev, {
      id: `cat-${Date.now()}`,
      title: newCategoryName.trim(),
      description: newCategoryDesc.trim() || '自訂資產類別',
      colorClass: color.colorClass,
      bgClass: color.bgClass,
      updatedAt: nowTs(),
      items: [],
    }]);
    setNewCategoryName('');
    setNewCategoryDesc('');
    setIsAddingCategory(false);
  };

  const handleUpdateAsset = (categoryId: string, itemId: string, newName: string, newAmount: number) => {
    setAssets(prev => prev.map(cat => {
      if (cat.id !== categoryId) return cat;
      return {
        ...cat,
        items: cat.items.map(item => item.id === itemId ? { ...item, name: newName, amount: newAmount } : item),
        updatedAt: nowTs()
      };
    }));
  };

  const handleDeleteAsset = (categoryId: string, itemId: string) => {
    setAssets(prev => prev.map(cat => {
      if (cat.id !== categoryId) return cat;
      return {
        ...cat,
        items: cat.items.filter(item => item.id !== itemId),
        updatedAt: nowTs()
      };
    }));
  };

  const handleUpdateCategory = (id: string, title: string, description: string, colorClass: string, bgClass: string) => {
    setAssets(prev => prev.map(cat => cat.id === id ? { ...cat, title, description, colorClass, bgClass, updatedAt: nowTs() } : cat));
  };

  const handleDeleteCategory = (id: string) => {
    setAssets(prev => prev.filter(cat => cat.id !== id));
  };

  const handleAddAsset = (categoryId: string, name: string, amount: number) => {
    if (!name.trim()) return;
    setAssets(prev => prev.map(cat => {
      if (cat.id !== categoryId) return cat;
      return {
        ...cat,
        items: [...cat.items, { id: Date.now().toString(), name, amount }],
        updatedAt: nowTs()
      };
    }));
  };

  // --- CRUD Operations for Liabilities ---
  const handleUpdateLiability = (itemId: string, newName: string, newAmount: number) => {
    setLiabilities(prev => prev.map(item => item.id === itemId ? { ...item, name: newName, amount: newAmount, updatedAt: nowTs() } : item));
  };

  const handleDeleteLiability = (itemId: string) => {
    setLiabilities(prev => prev.filter(item => item.id !== itemId));
  };

  const handleAddLiability = (name: string, amount: number) => {
    if (!name.trim()) return;
    setLiabilities(prev => [...prev, {
      id: Date.now().toString(),
      name,
      description: '自訂負債',
      amount,
      updatedAt: nowTs(),
      icon: 'creditCard'
    }]);
  };

  return (
    <div className="pb-4">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">個人資產狀態總覽</h1>
          <p className="text-sm text-gray-500 mt-1">追蹤與管理您的財務狀況 (資料將保存在您的設備中)</p>
        </div>
        <button
          onClick={takeSnapshot}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
        >
          <Camera className="w-4 h-4" />
          拍快照
        </button>
      </div>

      {isDemoData && !demoDismissed && (
        <div className="mb-6 flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-4">
          <Sparkles className="w-5 h-5 text-indigo-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-indigo-900">目前顯示的是範例資料</p>
            <p className="text-xs text-indigo-600 mt-0.5">這些數字只是示範用途，請清除後輸入你自己的財務資料。</p>
          </div>
          <button
            onClick={clearAllData}
            className="shrink-0 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            清除範例資料
          </button>
          <button
            onClick={() => setDemoDismissed(true)}
            className="shrink-0 p-1 text-indigo-400 hover:text-indigo-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${
                alert.level === 'warn'
                  ? 'bg-amber-50 border border-amber-200 text-amber-800'
                  : 'bg-indigo-50 border border-indigo-200 text-indigo-800'
              }`}
            >
              <span className="shrink-0">{alert.level === 'warn' ? '⚠️' : '💡'}</span>
              <span className="flex-1">{alert.message}</span>
              <Link
                href={alert.href}
                className="ml-2 shrink-0 text-xs font-semibold underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
              >
                {alert.cta}
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-4">
        <CashflowSummaryBar
          totalMonthlyIncome={totalMonthlyIncome}
          totalMonthlyExpense={totalMonthlyExpense}
          monthlyNetCashFlow={monthlyNetCashFlow}
          runwayMonths={runwayMonths}
          formatCurrency={formatCurrency}
        />
        <HealthScoreCard />
      </div>

      <HeroKPI
        netWorth={netWorth}
        totalAssets={totalAssets}
        totalLiabilities={totalLiabilities}
        formatCurrency={formatCurrency}
        showValues={showValues}
        netWorthGoal={netWorthGoal}
        setNetWorthGoal={setNetWorthGoal}
        monthlyNetCashFlow={monthlyNetCashFlow}
        momDelta={momDelta}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">資產分佈</h3>
            <button
              onClick={() => setIsAddingCategory(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
            >
              <Plus className="w-4 h-4" />
              新增大類
            </button>
          </div>

          {isAddingCategory && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">類別名稱 *</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder="例：保險、退休金"
                  className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white"
                  autoFocus
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">說明（選填）</label>
                <input
                  type="text"
                  value={newCategoryDesc}
                  onChange={e => setNewCategoryDesc(e.target.value)}
                  placeholder="簡短描述此類別"
                  className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleAddCategory}
                  className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  <Check className="w-4 h-4" /> 新增
                </button>
                <button
                  onClick={() => { setIsAddingCategory(false); setNewCategoryName(''); setNewCategoryDesc(''); }}
                  className="flex items-center gap-1 px-3 py-2 bg-white text-gray-500 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {combinedAssets.map((category) => (
              <AssetCategoryCard
                key={category.id}
                category={category}
                showValues={showValues}
                formatCurrency={formatCurrency}
                onUpdateAsset={handleUpdateAsset}
                onDeleteAsset={handleDeleteAsset}
                onAddAsset={handleAddAsset}
                onUpdateCategory={handleUpdateCategory}
                onDeleteCategory={handleDeleteCategory}
              />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            負債明細
          </h3>
          <LiabilitiesCard
            liabilities={combinedLiabilities}
            totalLiabilities={totalLiabilities}
            showValues={showValues}
            formatCurrency={formatCurrency}
            onUpdateLiability={handleUpdateLiability}
            onDeleteLiability={handleDeleteLiability}
            onAddLiability={handleAddLiability}
          />
        </div>
      </div>

      <NetWorthChart
        snapshots={snapshots}
        showValues={showValues}
        formatCurrency={formatCurrency}
      />

      <AssetAllocationChart
        combinedAssets={combinedAssets}
        totalAssets={totalAssets}
        showValues={showValues}
      />

      <FinancialGoals />

      <SnapshotTable
        snapshots={snapshots}
        showValues={showValues}
        takeSnapshot={takeSnapshot}
        onDelete={id => setSnapshots(prev => prev.filter(s => s.id !== id))}
      />
    </div>
  );
}
