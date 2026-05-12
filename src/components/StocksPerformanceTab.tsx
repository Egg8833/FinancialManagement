'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Check, X, RefreshCw } from 'lucide-react';
import { useAppContext, type DividendRecord, type StockItem, type StockQuote } from '../context/AppContext';
import { useToast } from '../context/ToastContext';

// ─── 計算輔助 ─────────────────────────────────────────────────────────────────

function calcCostBasisTWD(item: StockItem, usdToTwd: number): number {
  // avgCost = 總投入成本（非每股），直接換算
  const isUSD = !item.symbol.endsWith('.TW') && !item.symbol.endsWith('.TWO');
  return isUSD ? item.avgCost * usdToTwd : item.avgCost;
}

function calcCurrentValueTWD(item: StockItem, quote: StockQuote | undefined, usdToTwd: number): number {
  if (!quote) return 0;
  const value = quote.price * item.shares;
  return quote.currency === 'USD' ? value * usdToTwd : value;
}

function calcDividendsTWD(
  symbol: string,
  records: DividendRecord[],
  usdToTwd: number,
): number {
  return records
    .filter(r => r.symbol === symbol)
    .reduce((sum, r) => {
      const total = r.dividendPerShare * r.shares;
      return sum + (r.currency === 'USD' ? total * usdToTwd : total);
    }, 0);
}

function calcAnnualizedReturn(
  costBasis: number,
  currentValue: number,
  dividends: number,
  purchaseDate: string | undefined,
): number | null {
  if (!purchaseDate || costBasis <= 0) return null;
  const holdingDays = Math.floor((Date.now() - new Date(purchaseDate).getTime()) / 86_400_000);
  if (holdingDays < 7) return null;
  const totalReturn = (currentValue - costBasis + dividends) / costBasis;
  return Math.pow(1 + totalReturn, 365 / holdingDays) - 1;
}

const fmt = (n: number) => n.toLocaleString('zh-TW', { maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;

// ─── 股利新增列 ───────────────────────────────────────────────────────────────

function AddDividendRow({
  symbol,
  currentShares,
  currency,
  onConfirm,
  onCancel,
}: {
  symbol: string;
  currentShares: number;
  currency: 'TWD' | 'USD';
  onConfirm: (record: Omit<DividendRecord, 'id' | 'source'>) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dps, setDps] = useState('');
  const [shares, setShares] = useState(String(currentShares));

  return (
    <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg text-sm">
      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        className="border border-indigo-200 rounded px-2 py-1 text-xs bg-white"
      />
      <input
        type="number"
        placeholder="每股股利"
        value={dps}
        onChange={e => setDps(e.target.value)}
        className="w-24 border border-indigo-200 rounded px-2 py-1 text-xs text-right bg-white"
      />
      <input
        type="number"
        placeholder="股數"
        value={shares}
        onChange={e => setShares(e.target.value)}
        className="w-24 border border-indigo-200 rounded px-2 py-1 text-xs text-right bg-white"
      />
      <button
        onClick={() => {
          if (!dps || Number(dps) <= 0 || !shares || Number(shares) <= 0) return;
          onConfirm({ symbol, date, dividendPerShare: Number(dps), shares: Number(shares), currency });
        }}
        className="text-indigo-600 hover:text-indigo-800"
      >
        <Check className="w-4 h-4" />
      </button>
      <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── 每股績效列 ───────────────────────────────────────────────────────────────

function StockPerformanceRow({
  item,
  quote,
  dividendRecords,
  usdToTwd,
  onAddDividend,
  onDeleteDividend,
}: {
  item: StockItem;
  quote: StockQuote | undefined;
  dividendRecords: DividendRecord[];
  usdToTwd: number;
  onAddDividend: (record: Omit<DividendRecord, 'id' | 'source'>) => void;
  onDeleteDividend: (id: string) => void;
}) {
  const [showDividends, setShowDividends] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const costBasis = calcCostBasisTWD(item, usdToTwd);
  const currentValue = calcCurrentValueTWD(item, quote, usdToTwd);
  const dividends = calcDividendsTWD(item.symbol, dividendRecords, usdToTwd);
  const unrealized = currentValue - costBasis;
  const totalReturn = costBasis > 0 ? (unrealized + dividends) / costBasis : 0;
  const annualized = calcAnnualizedReturn(costBasis, currentValue, dividends, item.purchaseDate);

  const myDividends = dividendRecords.filter(r => r.symbol === item.symbol);
  const displayName = quote?.shortName ?? item.symbol;
  const currency: 'TWD' | 'USD' = (item.symbol.endsWith('.TW') || item.symbol.endsWith('.TWO')) ? 'TWD' : 'USD';

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="p-4 bg-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-400 truncate">{item.symbol}</p>
          </div>

          <div className="flex items-center gap-6 flex-shrink-0">
            <div className="w-24 text-center">
              <p className="text-xs text-gray-400 mb-0.5">投入成本</p>
              <p className="font-medium text-sm">{costBasis > 0 ? fmt(costBasis) : '—'}</p>
            </div>
            <div className="w-24 text-center">
              <p className="text-xs text-gray-400 mb-0.5">未實現損益</p>
              <p className={`font-bold text-sm ${unrealized >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {currentValue > 0 ? fmtPct((unrealized) / costBasis) : '—'}
              </p>
            </div>
            <div className="w-20 text-center">
              <p className="text-xs text-gray-400 mb-0.5">已收股利</p>
              <p className="font-medium text-sm text-emerald-600">{dividends > 0 ? fmt(dividends) : '—'}</p>
            </div>
            <div className="w-28 text-center">
              <p className="text-xs text-gray-400 mb-0.5">年化報酬率</p>
              <p className={`font-bold text-sm ${annualized !== null ? (annualized >= 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-gray-400'}`}>
                {annualized !== null ? fmtPct(annualized) : (item.purchaseDate ? '—' : '未設購買日')}
              </p>
            </div>
          </div>

          <div className="flex-1 flex justify-end">
            <button
              onClick={() => setShowDividends(v => !v)}
              className="text-xs text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
            >
              股利 ({myDividends.length}) {showDividends ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* 含息總報酬 */}
        <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-2">
          <span className="text-xs text-gray-400">含息總報酬：</span>
          <span className={`text-sm font-bold ${totalReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {costBasis > 0 ? fmtPct(totalReturn) : '—'}
          </span>
        </div>
      </div>

      {/* 股利展開區 */}
      {showDividends && (
        <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-2">
          {myDividends.length === 0 && !isAdding && (
            <p className="text-xs text-gray-400 text-center py-2">尚無股利記錄</p>
          )}
          {myDividends.map(r => (
            <div key={r.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2">
              <span className="text-gray-500">{r.date}</span>
              <span>每股 {r.dividendPerShare} · {r.shares.toLocaleString()} 股</span>
              <span className="font-medium text-emerald-600">
                {fmt(r.dividendPerShare * r.shares)} {r.currency}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.source === 'auto' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                {r.source === 'auto' ? 'Auto' : '手動'}
              </span>
              <button onClick={() => onDeleteDividend(r.id)} className="text-gray-300 hover:text-rose-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {isAdding && (
            <AddDividendRow
              symbol={item.symbol}
              currentShares={item.shares}
              currency={currency}
              onConfirm={record => { onAddDividend(record); setIsAdding(false); }}
              onCancel={() => setIsAdding(false)}
            />
          )}
          <button
            onClick={() => setIsAdding(true)}
            className="w-full text-xs text-indigo-600 hover:text-indigo-800 flex items-center justify-center gap-1 py-1"
          >
            <Plus className="w-3 h-3" /> 手動新增股利
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 主元件 ───────────────────────────────────────────────────────────────────

export function StocksPerformanceTab() {
  const {
    stockItems, stockQuotes, dividendRecords, setDividendRecords, usdToTwd,
  } = useAppContext();
  const { toast } = useToast();
  const [isFetching, setIsFetching] = useState(false);

  const fetchAllDividends = useCallback(async () => {
    const eligible = stockItems.filter(s => s.purchaseDate);
    if (eligible.length === 0) return;
    setIsFetching(true);
    try {
      const results = await Promise.allSettled(
        eligible.map(async item => {
          const res = await fetch(`/api/dividends?symbol=${item.symbol}&from=${item.purchaseDate}`);
          if (!res.ok) return;
          const data: { date: string; dividendPerShare: number }[] = await res.json();
          return { item, data };
        })
      );

      setDividendRecords(prev => {
        let updated = [...prev];
        for (const result of results) {
          if (result.status !== 'fulfilled' || !result.value) continue;
          const { item, data } = result.value;
          const currency: 'TWD' | 'USD' = (item.symbol.endsWith('.TW') || item.symbol.endsWith('.TWO')) ? 'TWD' : 'USD';
          for (const d of data) {
            const exists = updated.some(r => r.symbol === item.symbol && r.date === d.date && r.source === 'auto');
            if (!exists) {
              updated.push({
                id: `auto-${item.symbol}-${d.date}`,
                symbol: item.symbol,
                date: d.date,
                dividendPerShare: d.dividendPerShare,
                shares: item.shares,
                currency,
                source: 'auto',
              });
            }
          }
        }
        return updated;
      });
      toast('股利資料已同步');
    } catch {
      toast('同步失敗，請稍後再試', 'error');
    } finally {
      setIsFetching(false);
    }
  }, [stockItems, setDividendRecords, toast]);

  // 首次進入 Tab 自動同步（只跑一次）
  const hasFetched = useRef(false);
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchAllDividends();
    }
  }, [fetchAllDividends]);

  const handleAddDividend = (record: Omit<DividendRecord, 'id' | 'source'>) => {
    setDividendRecords(prev => [
      ...prev,
      { ...record, id: `manual-${crypto.randomUUID()}`, source: 'manual' },
    ]);
    toast('已新增股利記錄');
  };

  const handleDeleteDividend = (id: string) => {
    setDividendRecords(prev => prev.filter(r => r.id !== id));
    toast('已刪除股利記錄', 'info');
  };

  // 摘要計算
  const totalCost = stockItems.reduce((sum, item) => {
    const isUSD = !item.symbol.endsWith('.TW') && !item.symbol.endsWith('.TWO');
    return sum + (isUSD ? item.avgCost * usdToTwd : item.avgCost);
  }, 0);

  const totalCostForReturn = stockItems.reduce((sum, item) => {
    const quote = stockQuotes[item.symbol];
    if (!quote) return sum;
    const isUSD = !item.symbol.endsWith('.TW') && !item.symbol.endsWith('.TWO');
    return sum + (isUSD ? item.avgCost * usdToTwd : item.avgCost);
  }, 0);

  const totalValue = stockItems.reduce((sum, item) => {
    const quote = stockQuotes[item.symbol];
    if (!quote) return sum;
    const value = quote.price * item.shares;
    return sum + (quote.currency === 'USD' ? value * usdToTwd : value);
  }, 0);

  const totalDividends = dividendRecords.reduce((sum, r) => {
    const total = r.dividendPerShare * r.shares;
    return sum + (r.currency === 'USD' ? total * usdToTwd : total);
  }, 0);

  const totalUnrealized = totalValue - totalCostForReturn;
  const totalReturn = totalCostForReturn > 0 ? (totalUnrealized + totalDividends) / totalCostForReturn : 0;

  return (
    <div className="space-y-6">
      {/* 摘要列 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: '總投入成本', value: fmt(totalCost), color: 'text-gray-900' },
          { label: '目前市值', value: fmt(totalValue), color: 'text-gray-900' },
          { label: '未實現損益', value: fmtPct(totalCostForReturn > 0 ? totalUnrealized / totalCostForReturn : 0), color: totalUnrealized >= 0 ? 'text-emerald-600' : 'text-rose-600' },
          { label: '已收股利', value: fmt(totalDividends), color: 'text-emerald-600' },
          { label: '含息總報酬率', value: fmtPct(totalReturn), color: totalReturn >= 0 ? 'text-emerald-600' : 'text-rose-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* 同步按鈕 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">股利資料來自 Yahoo Finance，每次進入頁面自動同步</p>
        <button
          onClick={fetchAllDividends}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? '同步中…' : '重新同步'}
        </button>
      </div>

      {/* 每股明細 */}
      <div className="space-y-3">
        {stockItems.length === 0 && (
          <p className="text-center text-gray-400 py-8">尚無持倉，請至「持倉」Tab 新增股票</p>
        )}
        {stockItems.map(item => (
          <StockPerformanceRow
            key={item.id}
            item={item}
            quote={stockQuotes[item.symbol]}
            dividendRecords={dividendRecords}
            usdToTwd={usdToTwd}
            onAddDividend={handleAddDividend}
            onDeleteDividend={handleDeleteDividend}
          />
        ))}
      </div>

      {stockItems.some(s => !s.purchaseDate) && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-4 py-3">
          ⚠️ 部分股票未設定「購買日期」，年化報酬率與自動股利同步需要此資訊。請至「持倉」Tab 編輯。
        </p>
      )}
    </div>
  );
}
