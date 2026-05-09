"use client";

import { useState } from 'react';
import { Plus, TrendingUp, TrendingDown, Wallet, X, Check } from 'lucide-react';
import { HeroKPI } from '../components/HeroKPI';
import { AssetCategoryCard } from '../components/AssetComponents';
import { LiabilitiesCard } from '../components/LiabilityComponents';
import { useAppContext } from '../context/AppContext';

export default function DashboardPage() {
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');

  const {
    showValues,
    assets,
    setAssets,
    combinedAssets,
    liabilities,
    setLiabilities, 
    combinedLiabilities,
    totalMonthlyIncome,
    totalMonthlyExpense,
    monthlyNetCashFlow,
    totalAssets, 
    totalLiabilities, 
    netWorth 
  } = useAppContext();

  const formatCurrency = (amount: number) => {
    if (!showValues) return '****';
    return amount.toLocaleString('en-US');
  };

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

  // --- CRUD Operations for Assets ---
  const nowTs = () => new Date().toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

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
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">個人資產狀態總覽</h1>
          <p className="text-sm text-gray-500 mt-1">追蹤與管理您的財務狀況 (資料將保存在您的設備中)</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddingCategory(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
          >
            <Plus className="w-4 h-4" />
            新增資產大類
          </button>
        </div>
      </div>

      {isAddingCategory && (
        <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-2xl p-5 flex flex-col sm:flex-row gap-3 items-end">
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

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">本月預計收入</p>
              <p className="font-bold text-gray-900">{formatCurrency(totalMonthlyIncome)}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-gray-100"></div>
          <div className="flex items-center gap-3">
            <div className="bg-rose-50 p-2 rounded-lg text-rose-600">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">本月預計支出</p>
              <p className="font-bold text-gray-900">{formatCurrency(totalMonthlyExpense)}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-gray-100"></div>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${monthlyNetCashFlow >= 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">本月淨現金流</p>
              <p className={`font-bold ${monthlyNetCashFlow >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{formatCurrency(monthlyNetCashFlow)}</p>
            </div>
          </div>
        </div>
      </div>

      <HeroKPI 
        netWorth={netWorth}
        totalAssets={totalAssets}
        totalLiabilities={totalLiabilities}
        formatCurrency={formatCurrency}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            資產分佈
          </h3>
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
    </>
  );
}
