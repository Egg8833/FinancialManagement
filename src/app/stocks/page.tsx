"use client";

import { useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Plus, Check, X, Trash2, Pencil, RotateCcw } from 'lucide-react';
import { useAppContext, type StockItem } from '../../context/AppContext';

export default function StocksPage() {
  const { stockItems, setStockItems, stockQuotes, refreshQuotes, lastUpdated } = useAppContext();
  const [isAdding, setIsAdding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshQuotes();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // New item state
  const [newSymbol, setNewSymbol] = useState('');
  const [newShares, setNewShares] = useState('');
  const [newAvgCost, setNewAvgCost] = useState('');

  const usdToTwd = stockQuotes['TWD=X']?.price || 32;

  // Calculate totals
  let totalCostTWD = 0;
  let totalValueTWD = 0;
  let todayChangeTWD = 0;

  for (const item of stockItems) {
    const quote = stockQuotes[item.symbol];
    const shares = item.shares;
    const cost = item.avgCost * shares;
    
    // Default to TWD if quote not found
    let value = cost;
    let change = 0;

    if (quote) {
      value = quote.price * shares;
      // daily change in value = value - (value / (1 + changePercent/100))
      // Or simply use the changePercent to estimate daily profit
      const prevClose = quote.price / (1 + quote.changePercent / 100);
      change = (quote.price - prevClose) * shares;

      if (quote.currency === 'USD') {
        value *= usdToTwd;
        totalCostTWD += cost * usdToTwd; // Assuming avgCost was input in USD
        change *= usdToTwd;
      } else {
        totalCostTWD += cost;
      }
    } else {
      // If no quote, assume it's TWD for fallback
      totalCostTWD += cost;
    }

    totalValueTWD += value;
    todayChangeTWD += change;
  }

  const totalProfitTWD = totalValueTWD - totalCostTWD;
  const profitPercent = totalCostTWD > 0 ? (totalProfitTWD / totalCostTWD) * 100 : 0;

  const handleAdd = () => {
    if (!newSymbol.trim() || !newShares || !newAvgCost) return;
    const newItem: StockItem = {
      id: Date.now().toString(),
      symbol: newSymbol.toUpperCase(),
      shares: Number(newShares) || 0,
      avgCost: Number(newAvgCost) || 0,
    };
    setStockItems(prev => [...prev, newItem]);
    setNewSymbol('');
    setNewShares('');
    setNewAvgCost('');
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    setStockItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdate = (id: string, updatedItem: Partial<StockItem>) => {
    setStockItems(prev => prev.map(item => item.id === id ? { ...item, ...updatedItem } : item));
  };

  return (
    <>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">投資追蹤 (Stocks & Crypto)</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-500">即時同步市場報價與損益計算</p>
            {lastUpdated && (
              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                最後更新: {lastUpdated}
                <button 
                  onClick={handleRefresh} 
                  className={`hover:text-indigo-600 transition-all ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`}
                  disabled={isRefreshing}
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
          </div>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          新增追蹤標的
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl p-6 shadow-lg text-white">
          <div className="flex items-center gap-2 mb-2 opacity-80">
            <Activity className="w-5 h-5" />
            <span className="font-medium">股票總市值 (TWD)</span>
          </div>
          <h2 className="text-4xl font-bold">{Math.round(totalValueTWD).toLocaleString('en-US')}</h2>
          <p className="text-xs text-indigo-200 mt-2">USD/TWD: {usdToTwd.toFixed(2)}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <TrendingUp className={`w-5 h-5 ${todayChangeTWD >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
            <span className="font-medium">今日整體損益</span>
          </div>
          <h2 className={`text-3xl font-bold ${todayChangeTWD >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {todayChangeTWD >= 0 ? '+' : ''}{Math.round(todayChangeTWD).toLocaleString('en-US')}
          </h2>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <TrendingUp className={`w-5 h-5 ${totalProfitTWD >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
            <span className="font-medium">累計總損益 (TWD)</span>
          </div>
          <h2 className={`text-3xl font-bold ${totalProfitTWD >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {totalProfitTWD >= 0 ? '+' : ''}{Math.round(totalProfitTWD).toLocaleString('en-US')}
          </h2>
          <p className={`text-sm font-medium mt-1 ${totalProfitTWD >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {totalProfitTWD >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Stock List */}
      <div className="bg-white rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h3 className="font-bold text-gray-900">投資標的清單</h3>
        </div>
        
        {isAdding && (
          <div className="p-6 bg-indigo-50/50 border-b border-gray-100">
            <h4 className="text-sm font-bold text-indigo-800 mb-3">新增標的</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">代號 (Symbol)</label>
                <input type="text" placeholder="如: 2330.TW, AAPL" value={newSymbol} onChange={e => setNewSymbol(e.target.value)} className="w-full border rounded p-2 text-sm" />
                <p className="text-[10px] text-gray-400 mt-1">台股請加 .TW (例如: 2330.TW)</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">股數/張數</label>
                <input type="number" placeholder="數量" value={newShares} onChange={e => setNewShares(e.target.value)} className="w-full border rounded p-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">平均成本 (買進價)</label>
                <input type="number" placeholder="單價" value={newAvgCost} onChange={e => setNewAvgCost(e.target.value)} className="w-full border rounded p-2 text-sm" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={handleAdd} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">確認新增</button>
              <button onClick={() => setIsAdding(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300">取消</button>
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {stockItems.map((item) => (
            <StockRow 
              key={item.id} 
              item={item} 
              quote={stockQuotes[item.symbol]} 
              usdToTwd={usdToTwd}
              onUpdate={(data) => handleUpdate(item.id, data)} 
              onDelete={() => handleDelete(item.id)} 
            />
          ))}
          {stockItems.length === 0 && !isAdding && (
            <div className="p-8 text-center text-gray-500 text-sm">目前沒有追蹤任何標的</div>
          )}
        </div>
      </div>
    </>
  );
}

function StockRow({ 
  item, 
  quote, 
  usdToTwd,
  onUpdate, 
  onDelete 
}: { 
  item: StockItem, 
  quote?: { price: number; changePercent: number; currency: string }, 
  usdToTwd: number,
  onUpdate: (data: Partial<StockItem>) => void, 
  onDelete: () => void 
}) {
  const [isEditing, setIsEditing] = useState(false);
  
  const [editSymbol, setEditSymbol] = useState(item.symbol);
  const [editShares, setEditShares] = useState(item.shares.toString());
  const [editAvgCost, setEditAvgCost] = useState(item.avgCost.toString());

  const handleSave = () => {
    onUpdate({
      symbol: editSymbol.toUpperCase(),
      shares: Number(editShares) || 0,
      avgCost: Number(editAvgCost) || 0,
    });
    setIsEditing(false);
  };

  const currentPrice = quote?.price || 0;
  const isUSD = quote?.currency === 'USD';
  const currencySymbol = isUSD ? '$' : 'NT$';
  
  const totalCost = item.shares * item.avgCost;
  const totalValue = item.shares * currentPrice;
  const profit = totalValue - totalCost;
  const profitPercent = totalCost > 0 ? (profit / totalCost) * 100 : 0;
  
  const valueTWD = isUSD ? totalValue * usdToTwd : totalValue;
  const changePercent = quote?.changePercent || 0;

  if (isEditing) {
    return (
      <div className="p-6 bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-gray-700">編輯標的</h4>
          <div className="flex gap-2">
            <button onClick={onDelete} className="p-1.5 text-rose-600 hover:bg-rose-100 rounded transition-colors" title="刪除"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">代號</label>
            <input type="text" value={editSymbol} onChange={e => setEditSymbol(e.target.value)} className="w-full border rounded p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">股數</label>
            <input type="number" value={editShares} onChange={e => setEditShares(e.target.value)} className="w-full border rounded p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">平均成本</label>
            <input type="number" value={editAvgCost} onChange={e => setEditAvgCost(e.target.value)} className="w-full border rounded p-2 text-sm" />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 flex items-center gap-1"><Check className="w-4 h-4"/> 儲存</button>
          <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 flex items-center gap-1"><X className="w-4 h-4"/> 取消</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col xl:flex-row xl:items-center justify-between hover:bg-slate-50 transition-colors group">
      <div className="flex items-start gap-4 mb-4 xl:mb-0">
        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">
          {item.symbol.charAt(0)}
        </div>
        <div>
          <h4 className="font-bold text-gray-900 text-lg">{item.symbol}</h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">均價: {currencySymbol}{item.avgCost.toLocaleString()}</span>
            <span className="text-xs text-gray-300">|</span>
            <span className="text-xs text-gray-500">股數: {item.shares.toLocaleString()}</span>
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-4 md:gap-8 items-center">
        <div className="w-24">
          <p className="text-xs text-gray-500 mb-0.5">現價</p>
          {quote ? (
            <div>
              <p className="font-medium text-gray-900">{currencySymbol}{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className={`text-[10px] font-bold ${changePercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">載入中...</p>
          )}
        </div>
        
        <div className="w-28">
          <p className="text-xs text-gray-500 mb-0.5">總市值 (TWD)</p>
          <p className="font-medium text-gray-900">
            {Math.round(valueTWD).toLocaleString()}
          </p>
        </div>
        
        <div className="w-28">
          <p className="text-xs text-gray-500 mb-0.5">未實現損益</p>
          {quote ? (
            <div>
              <p className={`font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {profit >= 0 ? '+' : ''}{Math.round(isUSD ? profit * usdToTwd : profit).toLocaleString()}
              </p>
              <p className={`text-[10px] font-bold ${profitPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%
              </p>
            </div>
          ) : (
             <p className="text-sm text-gray-400">-</p>
          )}
        </div>

        <div className="flex-grow xl:flex-grow-0 flex justify-end">
          <button 
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 border border-indigo-200 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors flex items-center gap-1"
          >
            <Pencil className="w-3.5 h-3.5" /> 編輯
          </button>
        </div>
      </div>
    </div>
  );
}
