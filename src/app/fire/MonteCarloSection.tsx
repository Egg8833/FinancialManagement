import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import type { runMonteCarlo } from '../../lib/fireCalc';
import { formatTWD } from './shared';

interface MonteCarloSectionProps {
  mcResult: ReturnType<typeof runMonteCarlo>;
}

export function MonteCarloSection({ mcResult }: MonteCarloSectionProps) {
  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-gray-900">Monte Carlo 模擬分析</h2>
        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">500 次模擬</span>
      </div>

      {/* 達成機率摘要 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '10 年後達成機率', value: mcResult.successRateAt10 },
          { label: '20 年後達成機率', value: mcResult.successRateAt20 },
          { label: '30 年後達成機率', value: mcResult.successRateAt30 },
          { label: '中位數達成年齡', value: null, age: mcResult.medianFireAge },
        ].map(({ label, value, age }) => {
          const pct = value ?? 0;
          const color = pct >= 75 ? 'text-emerald-600' : pct >= 50 ? 'text-indigo-600' : pct >= 25 ? 'text-amber-600' : 'text-rose-600';
          return (
            <div key={label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm text-center">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              {age !== undefined ? (
                <p className="text-2xl font-black text-gray-900">{age !== null ? `${age} 歲` : '—'}</p>
              ) : (
                <p className={`text-2xl font-black ${color}`}>{pct.toFixed(0)}%</p>
              )}
            </div>
          );
        })}
      </div>

      {/* 資產路徑扇形圖 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-gray-900 mb-1">資產路徑信心區間</h3>
        <p className="text-xs text-gray-400 mb-4">灰色區域為 10–90 百分位，深色為 25–75 百分位，線條為中位數（第50百分位）</p>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={mcResult.byYear} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => formatTWD(v as number)} width={65} />
            <Tooltip
              formatter={(v: unknown, name: string) => {
                const labels: Record<string, string> = { p90: '90%', p75: '75%', p50: '中位數', p25: '25%', p10: '10%' };
                return [formatTWD(v as number), labels[name] ?? name];
              }}
              labelFormatter={l => `${l} 年`}
              contentStyle={{ borderRadius: 10, fontSize: 11, border: '1px solid #e2e8f0' }}
            />
            <ReferenceLine y={mcResult.fireNumber} stroke="#ef4444" strokeDasharray="6 3" label={{ value: 'FIRE', position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }} />
            <Area type="monotone" dataKey="p90" stroke="none" fill="#e0e7ff" fillOpacity={0.5} />
            <Area type="monotone" dataKey="p75" stroke="none" fill="#c7d2fe" fillOpacity={0.6} />
            <Area type="monotone" dataKey="p25" stroke="none" fill="#c7d2fe" fillOpacity={0} />
            <Area type="monotone" dataKey="p10" stroke="none" fill="#e0e7ff" fillOpacity={0} />
            <Line type="monotone" dataKey="p50" stroke="#6366f1" strokeWidth={2.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 達成機率折線 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-gray-900 mb-1">達成 FIRE 機率曲線</h3>
        <p className="text-xs text-gray-400 mb-4">在各年份前達成 FIRE 的模擬次數比例（500 次模擬）</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={mcResult.byYear} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v}%`} width={40} />
            <Tooltip formatter={(v: unknown) => [`${(v as number).toFixed(1)}%`, '達成機率']} labelFormatter={l => `${l} 年`} contentStyle={{ borderRadius: 10, fontSize: 11 }} />
            <ReferenceLine y={50} stroke="#6366f1" strokeDasharray="4 2" label={{ value: '50%', position: 'insideTopRight', fontSize: 9, fill: '#6366f1' }} />
            <ReferenceLine y={80} stroke="#10b981" strokeDasharray="4 2" label={{ value: '80%', position: 'insideTopRight', fontSize: 9, fill: '#10b981' }} />
            <Area type="monotone" dataKey="successRate" stroke="#6366f1" strokeWidth={2} fill="#e0e7ff" fillOpacity={0.6} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
