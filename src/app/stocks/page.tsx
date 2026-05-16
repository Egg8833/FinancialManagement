"use client";

import { useState, useEffect, useRef } from 'react';
import { TrendingUp, Activity, Plus, Check, X, Trash2, Pencil, RotateCcw, ChevronDown, ChevronUp, ShieldCheck, FileText, BarChart2 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAppContext, type StockItem, type StockQuote } from '../../context/AppContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { StocksPerformanceTab } from '../../components/StocksPerformanceTab';
import { StockSectorChart } from '../../components/StockSectorChart';
import { DividendCalendar } from '../../components/DividendCalendar';
import { PortfolioRebalance } from '../../components/PortfolioRebalance';

type Market = '台股' | '美股' | '其他';

const LOT_SIZE = 1000; // 台股 1張 = 1000股

function sharesToUnit(shares: number, market: Market): { value: number; unit: string } {
  if (market === '台股') return { value: shares / LOT_SIZE, unit: '張' };
  return { value: shares, unit: '股' };
}

function unitToShares(lots: number, market: Market): number {
  return market === '台股' ? lots * LOT_SIZE : lots;
}

const MARKET_GRADIENT: Record<Market, string> = {
  '台股': 'from-emerald-400 to-emerald-600',
  '美股': 'from-blue-400 to-blue-600',
  '其他': 'from-orange-400 to-orange-500',
};

function StockAvatar({ symbol, market, displayName }: { symbol: string; market: Market; displayName: string }) {
  const [imgError, setImgError] = useState(false);
  const code = symbol.replace(/\.(TW|TWO)$/, '');
  const logoUrl = `https://assets.parqet.com/logos/symbol/${code}?variant=light`;

  const fallbackChar = displayName
    ? Array.from(displayName)[0]
    : code.slice(0, 2);

  if (!imgError) {
    return (
      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-100">
        <img
          src={logoUrl}
          alt={code}
          className="w-full h-full object-contain p-1"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`w-12 h-12 rounded-xl flex-shrink-0 bg-gradient-to-br ${MARKET_GRADIENT[market]} flex items-center justify-center`}>
      <span className="text-white font-bold text-sm leading-none">{fallbackChar}</span>
    </div>
  );
}

function getMarket(symbol: string): Market {
  if (symbol.endsWith('.TW') || symbol.endsWith('.TWO')) return '台股';
  return '美股';
}

function toSymbol(raw: string, market: Market): string {
  const upper = raw.trim().toUpperCase();
  if (market === '台股' && upper && !upper.includes('.')) return upper + '.TW';
  return upper;
}

const MARKET_BADGE: Record<Market, string> = {
  '台股': 'bg-emerald-100 text-emerald-700',
  '美股': 'bg-blue-100 text-blue-700',
  '其他': 'bg-orange-100 text-orange-700',
};

function MarketSelector({ value, onChange }: { value: Market; onChange: (m: Market) => void }) {
  const options: Market[] = ['台股', '美股', '其他'];
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium w-fit">
      {options.map(m => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`px-3 py-1.5 transition-colors ${value === m ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

// ─── Portfolio Trend Chart ─────────────────────────────────────────────────────

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y';

const RANGES: { key: TimeRange; label: string; days: number }[] = [
  { key: '1W', label: '每日', days: 7 },
  { key: '1M', label: '1月', days: 30 },
  { key: '3M', label: '3月', days: 90 },
  { key: '6M', label: '6月', days: 180 },
  { key: '1Y', label: '1年', days: 365 },
];

type DailyBar = { date: string; close: number };
type ChartPoint = { date: string; value: number };

function PortfolioTrendChart({ stockItems, usdToTwd }: { stockItems: StockItem[]; usdToTwd: number }) {
  const [range, setRange] = useState<TimeRange>('1M');
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changeInfo, setChangeInfo] = useState<{ value: number; pct: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (stockItems.length === 0) { setChartData([]); setChangeInfo(null); return; }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const days = RANGES.find(r => r.key === range)!.days;
    const now = new Date();
    const p2 = now.toISOString().slice(0, 10);
    const p1 = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const results = await Promise.all(
          stockItems.map(async item => {
            try {
              const res = await fetch(
                `/api/history?symbol=${encodeURIComponent(item.symbol)}&period1=${p1}&period2=${p2}`,
                { signal: ctrl.signal }
              );
              if (!res.ok) return { item, bars: [] as DailyBar[] };
              return { item, bars: (await res.json()) as DailyBar[] };
            } catch { return { item, bars: [] as DailyBar[] }; }
          })
        );

        if (ctrl.signal.aborted) return;

        const allDates = new Set<string>();
        for (const { bars } of results) for (const b of bars) allDates.add(b.date);
        const sortedDates = Array.from(allDates).sort();
        if (sortedDates.length === 0) { setChartData([]); setChangeInfo(null); return; }

        const priceMaps = results.map(({ bars }) => {
          const m = new Map<string, number>();
          for (const b of bars) m.set(b.date, b.close);
          return { map: m, sorted: bars };
        });

        const points: ChartPoint[] = sortedDates.map(date => {
          let total = 0;
          for (let i = 0; i < results.length; i++) {
            const { item } = results[i];
            if (item.purchaseDate && date < item.purchaseDate) continue;
            const { map, sorted } = priceMaps[i];
            let price = map.get(date);
            if (price === undefined) {
              for (let j = sorted.length - 1; j >= 0; j--) {
                if (sorted[j].date <= date) { price = sorted[j].close; break; }
              }
            }
            if (price === undefined) continue;
            const isUSD = !item.symbol.endsWith('.TW') && !item.symbol.endsWith('.TWO');
            total += price * item.shares * (isUSD ? usdToTwd : 1);
          }
          return { date, value: Math.round(total) };
        });

        setChartData(points);
        if (points.length >= 2) {
          const first = points[0].value, last = points[points.length - 1].value;
          const diff = last - first;
          setChangeInfo({ value: diff, pct: first > 0 ? (diff / first) * 100 : 0 });
        } else {
          setChangeInfo(null);
        }
      } catch (err) {
        if (!ctrl.signal.aborted) setError('無法載入歷史數據');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [range, stockItems, usdToTwd]);

  const isPositive = !changeInfo || changeInfo.value >= 0;
  const lineColor = isPositive ? '#6366f1' : '#10b981';

  const formatXTick = (d: string) => {
    const dt = new Date(d);
    if (range === '1W' || range === '1M') return `${dt.getMonth() + 1}/${dt.getDate()}`;
    if (range === '3M') return `${dt.getMonth() + 1}月`;
    return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
  };

  const formatYTick = (v: number) => `${(v / 10000).toFixed(0)}萬`;

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100 mt-6 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap gap-3 justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-500" />
            <h3 className="font-bold text-gray-900">證券資產趨勢圖</h3>
          </div>
          {changeInfo && (
            <p className={`text-sm font-medium mt-0.5 ${isPositive ? 'text-rose-500' : 'text-emerald-500'}`}>
              {isPositive ? '+' : ''}{Math.round(changeInfo.value).toLocaleString()} TWD
              <span className="ml-1 opacity-75">({isPositive ? '+' : ''}{changeInfo.pct.toFixed(2)}%)</span>
            </p>
          )}
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 transition-colors ${range === r.key ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {loading && (
          <div className="h-64 flex items-center justify-center">
            <div className="text-sm text-gray-400 animate-pulse">載入歷史數據中...</div>
          </div>
        )}
        {!loading && error && (
          <div className="h-64 flex items-center justify-center">
            <div className="text-sm text-rose-400">{error}</div>
          </div>
        )}
        {!loading && !error && chartData.length === 0 && (
          <div className="h-64 flex items-center justify-center">
            <div className="text-sm text-gray-400">尚無歷史數據，請新增持有標的與購買日期</div>
          </div>
        )}
        {!loading && !error && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="pgGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={lineColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatXTick}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={formatYTick}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <Tooltip
                formatter={(v: number) => [`NT$${Math.round(v).toLocaleString()}`, '投資組合市值']}
                labelFormatter={(label: string) => label}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  fontSize: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={lineColor}
                strokeWidth={2}
                fill="url(#pgGrad)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: lineColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ─── Name Lookup Hook ──────────────────────────────────────────────────────────

function useNameLookup(symbol: string): string {
  const [name, setName] = useState('');
  useEffect(() => {
    if (!symbol) { setName(''); return; }
    const isTW = symbol.endsWith('.TW') || symbol.endsWith('.TWO');
    const t = setTimeout(async () => {
      try {
        if (isTW) {
          const code = symbol.replace(/\.(TW|TWO)$/, '');
          const res = await fetch(`/api/twse-name?code=${code}`);
          if (res.ok) {
            const data = await res.json();
            setName(data.name || '');
            return;
          }
        }
        const res = await fetch(`/api/quote?symbols=${symbol}`);
        if (res.ok) {
          const data = await res.json();
          setName(data[symbol]?.shortName || '');
        }
      } catch { setName(''); }
    }, 500);
    return () => clearTimeout(t);
  }, [symbol]);
  return name;
}

export default function StocksPage() {
  const { stockItems, setStockItems, stockQuotes, refreshQuotes, lastUpdated, quoteError, usdToTwd, showValues } = useAppContext();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<{ label: string; action: () => void } | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'holdings' | 'performance'>('holdings');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const quotesLoading = stockItems.length > 0 && lastUpdated === '';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshQuotes();
    setLastRefreshed(new Date());
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // New item state
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
    const cost = item.avgCost; // avgCost = 總成本

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
    setNewSymbolRaw('');
    setNewPlatform('');
    setNewShares('');
    setNewAvgCost('');
    setNewPurchaseDate('');
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

  const symbolPlaceholder: Record<Market, string> = {
    '台股': '如: 0050, 2330',
    '美股': '如: AAPL, TSLA',
    '其他': '如: BTC-USD',
  };

  return (
    <>
      {quoteError && lastUpdated && (
        <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-700">
          <span className="text-amber-500 text-base">⚠</span>
          <span>行情更新失敗，目前顯示 <strong>{lastUpdated}</strong> 的快取報價，數值可能不是最新。</span>
          <button
            onClick={handleRefresh}
            className="ml-auto text-xs font-medium underline underline-offset-2 hover:text-amber-900"
          >
            重試
          </button>
        </div>
      )}

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
            {lastRefreshed && (
              <span className="ml-1 text-xs text-gray-400">
                · 報價更新於 {lastRefreshed.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
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

      {/* Tab 切換 */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
        {(['holdings', 'performance'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'holdings' ? '持倉' : '績效分析'}
          </button>
        ))}
      </div>

      {activeTab === 'holdings' && (<>
      {/* KPI Cards */}
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

      {/* Portfolio KPI Summary */}
      {stockItems.length > 0 && (() => {
        const fmtCurrency = (n: number) => showValues ? `NT$${Math.round(n).toLocaleString()}` : '****';
        // avgCost in this app = 總成本 (total cost), not per-share price
        const totalCost = totalCostTWD;
        const totalMarket = totalValueTWD;
        const pnl = totalMarket - totalCost;
        const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">持倉成本</p>
              <p className="font-bold text-gray-900">{fmtCurrency(totalCost)}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">市值</p>
              <p className="font-bold text-gray-900">{fmtCurrency(totalMarket)}</p>
            </div>
            <div className={`rounded-2xl p-4 border shadow-sm ${pnl >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">損益</p>
              <p className={`font-bold ${pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtCurrency(pnl)}</p>
            </div>
            <div className={`rounded-2xl p-4 border shadow-sm ${pnlPct >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">報酬率</p>
              <p className={`font-bold ${pnlPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{showValues ? `${pnlPct.toFixed(2)}%` : '****'}</p>
            </div>
          </div>
        );
      })()}

      {/* Stock List */}
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
                  placeholder={symbolPlaceholder[newMarket]}
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
          {!quotesLoading && (() => {
            // 依平台分組
            const groups = new Map<string, typeof stockItems>();
            for (const item of stockItems) {
              const key = item.platform?.trim() || '未分類';
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(item);
            }

            const PLATFORM_COLORS = [
              { bar: 'bg-indigo-400', text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-100' },
              { bar: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
              { bar: 'bg-blue-400',    text: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-100'    },
              { bar: 'bg-violet-400',  text: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-100'  },
              { bar: 'bg-orange-400',  text: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-100'  },
              { bar: 'bg-rose-400',    text: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-100'    },
            ];

            return Array.from(groups.entries()).map(([platform, items], groupIdx) => {
              // 計算該平台小計
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
                  {/* 平台標頭 */}
                  <div className={`flex items-center justify-between px-6 py-2.5 ${color.bg} border-y ${color.border}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`w-1 h-4 rounded-full ${color.bar} inline-block`} />
                      <span className={`text-xs font-semibold ${color.text} tracking-wide`}>{platform}</span>
                    </div>
                    <div className="flex items-center gap-6 text-xs tabular-nums">
                      <span className="text-gray-500">
                        市值 <span className="font-semibold text-gray-700">{Math.round(gValueTWD).toLocaleString()}</span>
                      </span>
                      <span className="text-gray-500">
                        成本 <span className="font-semibold text-gray-700">{Math.round(gCostTWD).toLocaleString()}</span>
                      </span>
                      <span className={`font-semibold ${gProfit >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {gProfit >= 0 ? '+' : ''}{Math.round(gProfit).toLocaleString()}
                        <span className="ml-1 font-medium opacity-75">({gProfit >= 0 ? '+' : ''}{gProfitPct.toFixed(1)}%)</span>
                      </span>
                    </div>
                  </div>
                  {items.map((item) => (
                    <StockRow
                      key={item.id}
                      item={item}
                      quote={stockQuotes[item.symbol]}
                      usdToTwd={usdToTwd}
                      totalPortfolioTWD={totalValueTWD}
                      onUpdate={(data) => handleUpdate(item.id, data)}
                      onDelete={() => handleDelete(item.id, item.symbol)}
                    />
                  ))}
                </div>
              );
            });
          })()}
        </div>
      </div>
      {/* Portfolio Trend Chart */}
          <PortfolioTrendChart stockItems={stockItems} usdToTwd={usdToTwd} />
      </>)}

      {activeTab === 'performance' && (
        <div className="space-y-6">
          <StocksPerformanceTab />
          <StockSectorChart />
          <DividendCalendar />
          <PortfolioRebalance />
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

function StockRow({
  item,
  quote,
  usdToTwd,
  totalPortfolioTWD,
  onUpdate,
  onDelete
}: {
  item: StockItem,
  quote?: StockQuote,
  usdToTwd: number,
  totalPortfolioTWD: number,
  onUpdate: (data: Partial<StockItem>) => void,
  onDelete: () => void
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const [editMarket, setEditMarket] = useState<Market>(getMarket(item.symbol));
  const [editSymbolRaw, setEditSymbolRaw] = useState(
    item.symbol.endsWith('.TW') ? item.symbol.slice(0, -3) : item.symbol
  );
  const [editPlatform, setEditPlatform] = useState(item.platform || '');
  const [editShares, setEditShares] = useState(item.shares.toString());
  const [editAvgCost, setEditAvgCost] = useState(item.avgCost.toString());
  const [editCollateralShares, setEditCollateralShares] = useState((item.collateralShares ?? 0).toString());
  const [editNotes, setEditNotes] = useState(item.notes || '');
  const [editPurchaseDate, setEditPurchaseDate] = useState(item.purchaseDate || '');

  const editSymbolFull = toSymbol(editSymbolRaw, editMarket);
  const editNamePreview = useNameLookup(editSymbolRaw ? editSymbolFull : '');

  const handleSave = () => {
    const totalShares = Number(editShares) || 0;
    const collateral = Math.min(unitToShares(Number(editCollateralShares) || 0, editMarket), totalShares);
    onUpdate({
      symbol: editSymbolFull,
      platform: editPlatform.trim(),
      shares: totalShares,
      avgCost: Number(editAvgCost) || 0,
      collateralShares: collateral,
      notes: editNotes.trim(),
      purchaseDate: editPurchaseDate || undefined,
    });
    setIsEditing(false);
  };

  const currentPrice = quote?.price || 0;
  const isUSD = quote?.currency === 'USD';
  const currencySymbol = isUSD ? '$' : 'NT$';

  const totalCost = item.avgCost; // avgCost = 總成本
  const totalValue = item.shares * currentPrice;
  const profit = totalValue - totalCost;
  const profitPercent = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  const valueTWD = isUSD ? totalValue * usdToTwd : totalValue;
  const portfolioWeight = totalPortfolioTWD > 0 ? (valueTWD / totalPortfolioTWD) * 100 : 0;
  const changePercent = quote?.changePercent || 0;
  const market = getMarket(item.symbol);
  const displayName = quote?.shortName || item.symbol;

  const symbolPlaceholder: Record<Market, string> = {
    '台股': '如: 0050, 2330',
    '美股': '如: AAPL, TSLA',
    '其他': '如: BTC-USD',
  };

  if (isEditing) {
    return (
      <div className="p-6 bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-gray-700">編輯標的</h4>
          <button onClick={onDelete} className="p-1.5 text-rose-600 hover:bg-rose-100 rounded transition-colors" title="刪除">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="mb-4">
          <label className="block text-xs text-gray-500 mb-1.5">市場</label>
          <MarketSelector value={editMarket} onChange={setEditMarket} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">代號</label>
            <input
              type="text"
              placeholder={symbolPlaceholder[editMarket]}
              value={editSymbolRaw}
              onChange={e => setEditSymbolRaw(e.target.value)}
              className="w-full border rounded p-2 text-sm"
            />
            {editSymbolRaw && (
              <p className="text-[10px] mt-1 text-indigo-500 font-medium">
                {editSymbolFull}{editNamePreview ? ` · ${editNamePreview}` : ''}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">平台</label>
            <input type="text" placeholder="如: 永豐, TD Ameritrade" value={editPlatform} onChange={e => setEditPlatform(e.target.value)} className="w-full border rounded p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">股數</label>
            <input type="number" value={editShares} onChange={e => setEditShares(e.target.value)} className="w-full border rounded p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">成本</label>
            <input type="number" value={editAvgCost} onChange={e => setEditAvgCost(e.target.value)} className="w-full border rounded p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">購買日期</label>
            <input type="date" value={editPurchaseDate} onChange={e => setEditPurchaseDate(e.target.value)} className="w-full border rounded p-2 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">備註</label>
            <input type="text" placeholder="如: 長期持有, 定期定額" value={editNotes} onChange={e => setEditNotes(e.target.value)} className="w-full border rounded p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              擔保品（{editMarket === '台股' ? '張，0 表示無' : '股，0 表示無'}）
            </label>
            <input
              type="number"
              min="0"
              step="1"
              max={sharesToUnit(Number(editShares) || 0, editMarket).value}
              placeholder="0"
              value={editCollateralShares}
              onChange={e => {
                const max = sharesToUnit(Number(editShares) || 0, editMarket).value;
                const val = Math.min(Math.floor(Number(e.target.value) || 0), Math.floor(max));
                setEditCollateralShares(val.toString());
              }}
              className="w-full border rounded p-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 flex items-center gap-1"><Check className="w-4 h-4" /> 儲存</button>
          <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 flex items-center gap-1"><X className="w-4 h-4" /> 取消</button>
        </div>
      </div>
    );
  }

  const avgPricePerShare = item.shares > 0 ? item.avgCost / item.shares : 0;

  return (
    <div className="border-b border-gray-100 last:border-0">
      {/* 主列 */}
      <div className="px-6 py-4 flex flex-col xl:flex-row xl:items-center justify-between hover:bg-slate-50 transition-colors group">
        <div className="flex items-start gap-4 mb-4 xl:mb-0">
          <StockAvatar symbol={item.symbol} market={market} displayName={displayName} />
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-gray-900 text-lg leading-tight">
                {item.symbol.endsWith('.TW') ? item.symbol.slice(0, -3) : item.symbol}
              </h4>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${MARKET_BADGE[market]}`}>
                {market}
              </span>
              {!!item.collateralShares && (
                <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-100 text-amber-700">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  擔保品 {sharesToUnit(item.collateralShares, market).value.toLocaleString()} {sharesToUnit(item.collateralShares, market).unit}
                </span>
              )}
            </div>
            {displayName && (
              <p className="text-xs text-gray-400 mt-0.5">{displayName}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              {item.platform && (
                <>
                  <span className="text-xs text-gray-500">{item.platform}</span>
                  <span className="text-xs text-gray-300">|</span>
                </>
              )}
              <span className="text-xs text-gray-500">股數: {item.shares.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 md:gap-10 items-start">
          <div className="w-32">
            <p className="text-xs text-gray-400 mb-1">現價</p>
            {quote ? (
              <>
                <p className="text-base font-semibold text-gray-900 tabular-nums">{currencySymbol}{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className={`text-sm font-medium mt-0.5 tabular-nums ${changePercent >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                </p>
              </>
            ) : (
              <>
                <p className="text-base text-gray-400">載入中...</p>
                <p className="text-sm text-transparent mt-0.5">-</p>
              </>
            )}
          </div>

          <div className="w-36">
            <p className="text-xs text-gray-400 mb-1">總市值 (TWD)</p>
            <p className="text-base font-semibold text-gray-900 tabular-nums">{Math.round(valueTWD).toLocaleString()}</p>
            <p className="text-sm text-gray-400 mt-0.5 tabular-nums">{portfolioWeight.toFixed(1)}%</p>
          </div>

          <div className="w-36">
            <p className="text-xs text-gray-400 mb-1">未實現損益</p>
            {quote ? (
              <>
                <p className={`text-base font-bold tabular-nums ${profit >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {profit >= 0 ? '+' : ''}{Math.round(isUSD ? profit * usdToTwd : profit).toLocaleString()}
                </p>
                <p className={`text-sm font-medium mt-0.5 tabular-nums ${profitPercent >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%
                </p>
              </>
            ) : (
              <>
                <p className="text-base text-gray-400">-</p>
                <p className="text-sm text-transparent mt-0.5">-</p>
              </>
            )}
          </div>

          <div className="flex gap-2 flex-grow xl:flex-grow-0 justify-end">
            <button
              onClick={() => setIsExpanded(v => !v)}
              className="p-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
              title={isExpanded ? '收起詳情' : '展開詳情'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 border border-indigo-200 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors flex items-center gap-1"
            >
              <Pencil className="w-3.5 h-3.5" /> 編輯
            </button>
          </div>
        </div>
      </div>

      {/* 展開子面板 */}
      {isExpanded && (
        <div className="px-6 pb-5 bg-gray-50/60 border-t border-gray-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">均價 (每股成本)</p>
              <p className="text-sm font-semibold text-gray-800">
                {currencySymbol}{avgPricePerShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">總成本</p>
              <p className="text-sm font-semibold text-gray-800">
                {currencySymbol}{item.avgCost.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">持股張/股數</p>
              <p className="text-sm font-semibold text-gray-800">{item.shares.toLocaleString()} 股</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">市場 / 平台</p>
              <p className="text-sm font-semibold text-gray-800">
                {market}{item.platform ? ` · ${item.platform}` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />擔保品
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  max={sharesToUnit(item.shares, market).value}
                  value={sharesToUnit(item.collateralShares ?? 0, market).value}
                  onChange={e => {
                    const maxRaw = item.shares;
                    const raw = Math.min(unitToShares(Math.floor(Number(e.target.value) || 0), market), maxRaw);
                    onUpdate({ collateralShares: raw });
                  }}
                  className="w-20 border rounded px-2 py-1 text-sm font-semibold text-amber-700 bg-amber-50 border-amber-200"
                />
                <span className="text-xs text-gray-500">{sharesToUnit(0, market).unit}</span>
                <span className="text-xs text-gray-400">
                  / {sharesToUnit(item.shares, market).value.toLocaleString()} {sharesToUnit(item.shares, market).unit}
                </span>
              </div>
              {!!item.collateralShares && item.collateralShares < item.shares && (
                <p className="text-[10px] text-amber-600 mt-1">
                  非擔保品: {sharesToUnit(item.shares - item.collateralShares, market).value.toLocaleString()} {sharesToUnit(0, market).unit}
                </p>
              )}
            </div>
            {quote && (
              <div>
                <p className="text-xs text-gray-400 mb-1">今日漲跌幅</p>
                <p className={`text-sm font-semibold ${changePercent >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                </p>
              </div>
            )}
            {item.purchaseDate && (
              <div>
                <p className="text-xs text-gray-400 mb-1">購買日期</p>
                <p className="text-sm font-semibold text-gray-800">{item.purchaseDate}</p>
              </div>
            )}
            {item.notes && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><FileText className="w-3 h-3" />備註</p>
                <p className="text-sm text-gray-700">{item.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
