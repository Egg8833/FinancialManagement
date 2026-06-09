"use client";
import { useState, useEffect, useRef } from 'react';
import { BarChart2 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { type StockItem } from '../../context/AppContext';

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

export function PortfolioTrendChart({ stockItems, usdToTwd }: { stockItems: StockItem[]; usdToTwd: number }) {
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
        const uniqueSymbols = Array.from(new Set(stockItems.map(i => i.symbol)));
        const fetchResults = await Promise.all(
          uniqueSymbols.map(async symbol => {
            try {
              const res = await fetch(
                `/api/history?symbol=${encodeURIComponent(symbol)}&period1=${p1}&period2=${p2}`,
                { signal: ctrl.signal }
              );
              if (!res.ok) return { symbol, bars: [] as DailyBar[] };
              return { symbol, bars: (await res.json()) as DailyBar[] };
            } catch { return { symbol, bars: [] as DailyBar[] }; }
          })
        );
        const barsMap = new Map(fetchResults.map(r => [r.symbol, r.bars]));
        const results = stockItems.map(item => ({ item, bars: barsMap.get(item.symbol) ?? [] as DailyBar[] }));

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
      } catch {
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
