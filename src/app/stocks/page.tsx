"use client";

import { useState } from 'react';
import { TrendingUp, Activity, Plus, RotateCcw } from 'lucide-react';
import { useAppContext, type StockItem } from '../../context/AppContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import dynamic from 'next/dynamic';
import { useNameLookup } from '../../hooks/useNameLookup';
import { MarketSelector } from '../../components/stocks/MarketSelector';
import { StockRow } from '../../components/stocks/StockRow';
import { type Market, toSymbol } from '../../lib/stockUtils';
import { ChartSkeleton, TableRowSkeleton } from '../../components/ui/Skeleton';
import { ErrorBoundary } from '../../components/ErrorBoundary';

const StocksPerformanceTab = dynamic(
  () => import('../../components/StocksPerformanceTab').then(m => ({ default: m.StocksPerformanceTab })),
  { loading: () => <ChartSkeleton />, ssr: false }
);
const DividendCalendar = dynamic(
  () => import('../../components/DividendCalendar').then(m => ({ default: m.DividendCalendar })),
  { loading: () => <ChartSkeleton height="h-64" />, ssr: false }
);
const PortfolioRebalance = dynamic(
  () => import('../../components/PortfolioRebalance').then(m => ({ default: m.PortfolioRebalance })),
  { loading: () => <ChartSkeleton />, ssr: false }
);
const PortfolioTrendChart = dynamic(
  () => import('../../components/stocks/PortfolioTrendChart').then(m => ({ default: m.PortfolioTrendChart })),
  { loading: () => <ChartSkeleton height="h-40" />, ssr: false }
);
const StockSectorChart = dynamic(
  () => import('../../components/StockSectorChart').then(m => ({ default: m.StockSectorChart })),
  { loading: () => <ChartSkeleton height="h-40" />, ssr: false }
);

const SYMBOL_PLACEHOLDER: Record<Market, string> = {
  '台股': '如: 0050, 2330',
  '美股': '如: AAPL, TSLA',
  '其他': '如: BTC-USD',
};

const PLATFORM_COLORS = [
  { bar: 'bg-indigo-400', text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-100' },
  { bar: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  { bar: 'bg-blue-400',    text: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-100'    },
  { bar: 'bg-violet-400',  text: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-100'  },
  { bar: 'bg-orange-400',  text: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-100'  },
  { bar: 'bg-rose-400',    text: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-100'    },
];

export default function StocksPage() {
  const { stockItems, setStockItems, stockQuotes, refreshQuotes, lastUpdated, usdToTwd, enablePledgeTracking } = useAppContext();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<{ label: string; action: () => void } | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'holdings' | 'performance'>('holdings');

  const quotesLoading = stockItems.length > 0 && lastUpdated === '';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshQuotes();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const [newMarket, setNewMarket] = useState<Market>('台股');
  const [newSymbolRaw, setNewSymbolRaw] = useState('');
  const [newPlatform, setNewPlatform] = useState('');
  const [newShares, setNewShares] = useState('');
  const [newAvgCost, setNewAvgCost] = useState('');
  const [newPurchaseDate, setNewPurchaseDate] = useState('');

  const newSymbolFull = toSymbol(newSymbolRaw, newMarket);
  const newNamePreview = useNameLookup(newSymbolRaw ? newSymbolFull : '');

  let totalCostTWD = 0;
  let totalValueTWD = 0;
  let todayChangeTWD = 0;

  for (const item of stockItems) {
    const quote = stockQuotes[item.symbol];
    const shares = item.shares;
    const cost = item.avgCost;
    let value = cost;
    let change = 0;

    if (quote) {
      value = quote.price * shares;
      const prevClose = quote.price / (1 + quote.changePercent / 100);
      change = (quote.price - prevClose) * shares;
      if (quote.currency === 'USD') {
        value *= usdToTwd;
        totalCostTWD += cost * usdToTwd;
        change *= usdToTwd;
      } else {
        totalCostTWD += cost;
      }
    } else {
      totalCostTWD += cost;
    }
    totalValueTWD += value;
    todayChangeTWD += change;
  }

  const totalProfitTWD = totalValueTWD - totalCostTWD;
  const profitPercent = totalCostTWD > 0 ? (totalProfitTWD / totalCostTWD) * 100 : 0;

  const handleAdd = () => {
    if (!newSymbolRaw.trim() || !newShares || !newAvgCost) return;
    const newItem: StockItem = {
      id: Date.now().toString(),
      symbol: newSymbolFull,
      platform: newPlatform.trim(),
      shares: Number(newShares) || 0,
      avgCost: Number(newAvgCost) || 0,
      purchaseDate: newPurchaseDate || undefined,
    };
    setStockItems(prev => [...prev, newItem]);
    setNewSymbolRaw(''); setNewPlatform(''); setNewShares(''); setNewAvgCost(''); setNewPurchaseDate('');
    setIsAdding(false);
  };

  const handleDelete = (id: string, symbol: string) => {
    setDeleteTarget({
      label: symbol,
      action: () => { setStockItems(prev => prev.filter(item => item.id !== id)); toast(`已刪除「${symbol}」`, 'info'); }
    });
  };

  const handleUpdate = (id: string, updatedItem: Partial<StockItem>) => {
    setStockItems(prev => prev.map(item => item.id === id ? { ...item, ...updatedItem } : item));
  };

  const platformGroups = new Map<string, typeof stockItems>();
  for (const item of stockItems) {
    const key = item.platform?.trim() || '未分類';
    if (!platformGroups.has(key)) platformGroups.set(key, []);
    platformGroups.get(key)!.push(item);
  }

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

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
        {(['holdings', 'performance'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'holdings' ? '持倉' : '績效分析'}
          </button>
        ))}
      </div>

      {activeTab === 'holdings' && (<>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl p-6 shadow-lg text-white">
            <div className="flex items-center gap-2 mb-2 opacity-80">
              <Activity className="w-5 h-5" />
              <span className="font-medium">股票總市值 (TWD)</span>
            </div>
            <h2 className="text-4xl font-bold">{Math.round(totalValueTWD).toLocaleString('en-US')}</h2>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <TrendingUp className={`w-5 h-5 ${todayChangeTWD >= 0 ? 'text-rose-500' : 'text-emerald-500'}`} />
              <span className="font-medium">今日整體損益</span>
            </div>
            <h2 className={`text-3xl font-bold ${todayChangeTWD >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {todayChangeTWD >= 0 ? '+' : ''}{Math.round(todayChangeTWD).toLocaleString('en-US')}
            </h2>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <TrendingUp className={`w-5 h-5 ${totalProfitTWD >= 0 ? 'text-rose-500' : 'text-emerald-500'}`} />
              <span className="font-medium">累計總損益 (TWD)</span>
            </div>
            <h2 className={`text-3xl font-bold ${totalProfitTWD >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {totalProfitTWD >= 0 ? '+' : ''}{Math.round(totalProfitTWD).toLocaleString('en-US')}
            </h2>
            <p className={`text-sm font-medium mt-1 ${totalProfitTWD >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {totalProfitTWD >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-bold text-gray-900">投資標的清單</h3>
          </div>

          {isAdding && (
            <div className="p-6 bg-indigo-50/50 border-b border-gray-100">
              <h4 className="text-sm font-bold text-indigo-800 mb-3">新增標的</h4>
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1.5">市場</label>
                <MarketSelector value={newMarket} onChange={setNewMarket} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">代號</label>
                  <input
                    type="text"
                    placeholder={SYMBOL_PLACEHOLDER[newMarket]}
                    value={newSymbolRaw}
                    onChange={e => setNewSymbolRaw(e.target.value)}
                    className="w-full border rounded p-2 text-sm"
                  />
                  {newSymbolRaw && (
                    <p className="text-[10px] mt-1 text-indigo-500 font-medium">
                      {newSymbolFull}{newNamePreview ? ` · ${newNamePreview}` : ''}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">平台</label>
                  <input type="text" placeholder="如: 永豐, TD Ameritrade" value={newPlatform} onChange={e => setNewPlatform(e.target.value)} className="w-full border rounded p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">股數/張數</label>
                  <input type="number" placeholder="數量" value={newShares} onChange={e => setNewShares(e.target.value)} className="w-full border rounded p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">成本 (總買入金額)</label>
                  <input type="number" placeholder="如: 600000" value={newAvgCost} onChange={e => setNewAvgCost(e.target.value)} className="w-full border rounded p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">購買日期</label>
                  <input type="date" value={newPurchaseDate} onChange={e => setNewPurchaseDate(e.target.value)} className="w-full border rounded p-2 text-sm" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={handleAdd} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">確認新增</button>
                <button onClick={() => { setIsAdding(false); setNewSymbolRaw(''); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300">取消</button>
              </div>
            </div>
          )}

          <div>
            {stockItems.length === 0 && !isAdding && (
              <div className="p-8 text-center text-gray-500 text-sm">目前沒有追蹤任何標的</div>
            )}
            {quotesLoading && (
              <div className="divide-y divide-gray-50">
                {stockItems.map(item => (
                  <div key={item.id} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                    <div className="w-12 h-12 rounded-xl bg-gray-200 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-24" />
                      <div className="h-3 bg-gray-100 rounded w-16" />
                    </div>
                    <div className="space-y-2 text-right">
                      <div className="h-4 bg-gray-200 rounded w-20 ml-auto" />
                      <div className="h-3 bg-gray-100 rounded w-14 ml-auto" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!quotesLoading && Array.from(platformGroups.entries()).map(([platform, items], groupIdx) => {
              let gValueTWD = 0, gCostTWD = 0;
              for (const item of items) {
                const q = stockQuotes[item.symbol];
                const value = q ? q.price * item.shares * (q.currency === 'USD' ? usdToTwd : 1) : item.avgCost;
                const cost = q?.currency === 'USD' ? item.avgCost * usdToTwd : item.avgCost;
                gValueTWD += value;
                gCostTWD += cost;
              }
              const gProfit = gValueTWD - gCostTWD;
              const gProfitPct = gCostTWD > 0 ? (gProfit / gCostTWD) * 100 : 0;
              const color = PLATFORM_COLORS[groupIdx % PLATFORM_COLORS.length];

              return (
                <div key={platform} className={groupIdx > 0 ? 'mt-4' : ''}>
                  <div className={`flex items-center justify-between px-6 py-2.5 ${color.bg} border-y ${color.border}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`w-1 h-4 rounded-full ${color.bar} inline-block`} />
                      <span className={`text-xs font-semibold ${color.text} tracking-wide`}>{platform}</span>
                    </div>
                    <div className="flex items-center gap-6 text-xs tabular-nums">
                      <span className="text-gray-500">市值 <span className="font-semibold text-gray-700">{Math.round(gValueTWD).toLocaleString()}</span></span>
                      <span className="text-gray-500">成本 <span className="font-semibold text-gray-700">{Math.round(gCostTWD).toLocaleString()}</span></span>
                      <span className={`font-semibold ${gProfit >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {gProfit >= 0 ? '+' : ''}{Math.round(gProfit).toLocaleString()}
                        <span className="ml-1 font-medium opacity-75">({gProfit >= 0 ? '+' : ''}{gProfitPct.toFixed(1)}%)</span>
                      </span>
                    </div>
                  </div>
                  {items.map(item => (
                    <StockRow
                      key={item.id}
                      item={item}
                      quote={stockQuotes[item.symbol]}
                      usdToTwd={usdToTwd}
                      totalPortfolioTWD={totalValueTWD}
                      enablePledgeTracking={enablePledgeTracking}
                      onUpdate={data => handleUpdate(item.id, data)}
                      onDelete={() => handleDelete(item.id, item.symbol)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <ErrorBoundary>
          <PortfolioTrendChart stockItems={stockItems} usdToTwd={usdToTwd} />
        </ErrorBoundary>
      </>)}

      {activeTab === 'performance' && (
        <div className="space-y-6">
          <ErrorBoundary><StocksPerformanceTab /></ErrorBoundary>
          <ErrorBoundary><StockSectorChart /></ErrorBoundary>
          <ErrorBoundary><DividendCalendar /></ErrorBoundary>
          <ErrorBoundary><PortfolioRebalance /></ErrorBoundary>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`確定要刪除「${deleteTarget.label}」嗎？`}
          onConfirm={() => { deleteTarget.action(); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
