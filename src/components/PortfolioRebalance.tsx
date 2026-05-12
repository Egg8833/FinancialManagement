'use client';

import { useMemo, useState } from 'react';
import { Sliders, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppContext, type StockSector } from '../context/AppContext';
import { useStickyState } from '../hooks/useStickyState';

const SECTORS: StockSector[] = [
  '科技','金融','醫療','消費','工業',
  '能源','原物料','房地產','公用事業','通訊','其他',
];

const SECTOR_COLORS: Record<StockSector, string> = {
  '科技':    '#6366f1',
  '金融':    '#3b82f6',
  '醫療':    '#10b981',
  '消費':    '#f59e0b',
  '工業':    '#64748b',
  '能源':    '#f97316',
  '原物料':  '#84cc16',
  '房地產':  '#ec4899',
  '公用事業':'#06b6d4',
  '通訊':    '#8b5cf6',
  '其他':    '#94a3b8',
};

const THRESHOLD = 2; // only show deviations > 2 percentage points

export function PortfolioRebalance() {
  const { stockItems, stockQuotes, usdToTwd } = useAppContext();
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [targetAllocs, setTargetAllocs] = useStickyState<Record<string, number>>({}, 'app-rebalance-targets-v1');
  const [draft, setDraft] = useState<Record<string, string>>({});

  // Current sector values + total
  const { sectorMap, portfolioTotal } = useMemo(() => {
    const sectorMap: Record<string, number> = {};
    let portfolioTotal = 0;
    for (const item of stockItems) {
      const quote = stockQuotes[item.symbol];
      if (!quote) continue;
      const value = quote.currency === 'USD'
        ? quote.price * item.shares * usdToTwd
        : quote.price * item.shares;
      const sector = item.sector ?? '其他';
      sectorMap[sector] = (sectorMap[sector] ?? 0) + value;
      portfolioTotal += value;
    }
    return { sectorMap, portfolioTotal };
  }, [stockItems, stockQuotes, usdToTwd]);

  const hasTargets = Object.values(targetAllocs).some(v => v > 0);
  const totalTarget = Object.values(targetAllocs).reduce((s, v) => s + v, 0);

  // Sectors that have either current allocation or target
  const activeSectors = SECTORS.filter(
    s => (sectorMap[s] ?? 0) > 0 || (targetAllocs[s] ?? 0) > 0
  );

  const rows = useMemo(() =>
    activeSectors.map(s => {
      const currentValue = sectorMap[s] ?? 0;
      const currentPct = portfolioTotal > 0 ? (currentValue / portfolioTotal) * 100 : 0;
      const targetPct = targetAllocs[s] ?? 0;
      const targetValue = portfolioTotal * targetPct / 100;
      const diffPct = targetPct - currentPct;
      const diffValue = targetValue - currentValue;
      return { sector: s, currentValue, currentPct, targetPct, targetValue, diffPct, diffValue };
    }),
  [activeSectors, sectorMap, portfolioTotal, targetAllocs]);

  const significantRows = rows.filter(r => Math.abs(r.diffPct) > THRESHOLD);

  const startEditing = () => {
    const d: Record<string, string> = {};
    for (const s of SECTORS) d[s] = String(targetAllocs[s] ?? 0);
    setDraft(d);
    setIsEditing(true);
  };

  const saveEditing = () => {
    const next: Record<string, number> = {};
    for (const s of SECTORS) {
      const v = parseFloat(draft[s] ?? '0') || 0;
      if (v > 0) next[s] = v;
    }
    setTargetAllocs(next);
    setIsEditing(false);
  };

  if (portfolioTotal === 0) return null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mt-6">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-500" />
          <span className="font-bold text-gray-900">投資組合再平衡</span>
          {hasTargets && significantRows.length > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
              {significantRows.length} 項偏離目標
            </span>
          )}
          {!hasTargets && (
            <span className="text-xs text-gray-400">— 設定目標配置比例後顯示建議</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-gray-100 pt-5 space-y-5">
          {/* Target allocation editor */}
          {isEditing ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">設定各板塊目標比例（加總建議為 100%）</p>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${Math.abs(totalTarget - 100) < 1 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    已分配 {totalTarget.toFixed(0)}%
                  </span>
                  <button onClick={saveEditing} className="flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">
                    <Check className="w-3 h-3" /> 儲存
                  </button>
                  <button onClick={() => setIsEditing(false)} className="p-1 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SECTORS.map(s => (
                  <div key={s} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: SECTOR_COLORS[s] }}
                    />
                    <span className="text-xs text-gray-600 flex-1">{s}</span>
                    <div className="flex items-center gap-0.5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={draft[s] ?? '0'}
                        onChange={e => setDraft(prev => ({ ...prev, [s]: e.target.value }))}
                        className="w-12 border border-gray-200 rounded px-1.5 py-0.5 text-xs text-right outline-none focus:border-indigo-400"
                      />
                      <span className="text-xs text-gray-400">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {hasTargets
                  ? `目標配置已設定（${activeSectors.length} 個板塊）`
                  : '尚未設定目標配置'}
              </p>
              <button
                onClick={startEditing}
                className="text-xs text-indigo-600 font-bold hover:text-indigo-800"
              >
                {hasTargets ? '編輯目標' : '+ 設定目標'}
              </button>
            </div>
          )}

          {/* Rebalance table */}
          {hasTargets && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                配置分析（偏差 &gt; {THRESHOLD}% 才顯示建議）
              </p>
              {rows.map(({ sector, currentValue, currentPct, targetPct, diffPct, diffValue }) => {
                const isOver = diffPct < -THRESHOLD;
                const isUnder = diffPct > THRESHOLD;
                const isOk = !isOver && !isUnder;
                return (
                  <div
                    key={sector}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      isOk ? 'bg-gray-50' : isUnder ? 'bg-indigo-50 border border-indigo-100' : 'bg-amber-50 border border-amber-100'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: SECTOR_COLORS[sector as StockSector] }}
                    />
                    <span className="text-sm font-medium text-gray-700 w-20">{sector}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                        <span>現況 {currentPct.toFixed(1)}%</span>
                        <span>→</span>
                        <span className="font-bold text-gray-700">目標 {targetPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/70 rounded-full overflow-hidden relative">
                        <div
                          className="absolute top-0 left-0 h-full rounded-full opacity-40"
                          style={{ width: `${Math.min(100, targetPct)}%`, backgroundColor: SECTOR_COLORS[sector as StockSector] }}
                        />
                        <div
                          className="absolute top-0 left-0 h-full rounded-full"
                          style={{ width: `${Math.min(100, currentPct)}%`, backgroundColor: SECTOR_COLORS[sector as StockSector] }}
                        />
                      </div>
                    </div>
                    <div className="text-right w-32">
                      {isOk ? (
                        <span className="text-xs text-emerald-600 font-bold">✓ 符合目標</span>
                      ) : (
                        <>
                          <p className={`text-xs font-black ${isUnder ? 'text-indigo-600' : 'text-amber-600'}`}>
                            {isUnder ? '買入' : '減持'} NT${Math.abs(Math.round(diffValue)).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {isUnder ? '+' : ''}{diffPct.toFixed(1)}%
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {significantRows.length === 0 && (
                <div className="text-center py-4 text-sm text-emerald-600 font-bold">
                  ✓ 所有板塊均符合目標配置（偏差 ≤ {THRESHOLD}%）
                </div>
              )}
              <p className="text-[10px] text-gray-400 pt-1">
                * 建議金額依目前組合總市值 NT${(portfolioTotal / 10000).toFixed(0)}萬 計算，僅供參考，不構成投資建議。
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
