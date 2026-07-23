import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';
import type { FireResult, FireScenario } from '../../lib/fireCalc';
import { formatTWD } from './shared';

const SCENARIO_COLORS = {
  conservative: '#94a3b8',
  neutral: '#6366f1',
  optimistic: '#10b981',
} as const;

const SCENARIO_LABELS = {
  conservative: '保守',
  neutral: '中性',
  optimistic: '樂觀',
} as const;

function ResultBadge({ label, year, age, color }: { label: string; year: number | null; age: number | null; color: string }) {
  return (
    <div className="text-center">
      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color }}>{label}</p>
      {year ? (
        <>
          <p className="text-2xl font-black text-gray-900">{year}</p>
          <p className="text-sm text-gray-500">{age} 歲</p>
        </>
      ) : (
        <p className="text-lg font-bold text-gray-400">60年內無法達成</p>
      )}
    </div>
  );
}

interface FireProjectionChartProps {
  result: FireResult;
  yearsToNeutralFire: number | null;
  extraMonthly: number;
  extraYearsSaved: number | null;
}

export function FireProjectionChart({ result, yearsToNeutralFire, extraMonthly, extraYearsSaved }: FireProjectionChartProps) {
  return (
    <>
      {/* 三情境達成年份 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h2 className="font-bold text-gray-900 mb-4">預計達成財務自由</h2>
        <div className="grid grid-cols-3 gap-4 divide-x divide-gray-100">
          <ResultBadge label="保守" year={result.conservativeFireYear} age={result.conservativeFireAge} color={SCENARIO_COLORS.conservative} />
          <ResultBadge label="中性" year={result.neutralFireYear} age={result.neutralFireAge} color={SCENARIO_COLORS.neutral} />
          <ResultBadge label="樂觀" year={result.optimisticFireYear} age={result.optimisticFireAge} color={SCENARIO_COLORS.optimistic} />
        </div>
        {yearsToNeutralFire !== null && (
          <p className="text-center text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100">
            以中性情境，距離財務自由還有 <strong className="text-indigo-600">{yearsToNeutralFire} 年</strong>
            {extraMonthly > 0 && extraYearsSaved !== null && extraYearsSaved > 0 && (
              <span className="text-emerald-600">（每月多存 {extraMonthly.toLocaleString()} 可提早 {extraYearsSaved} 年）</span>
            )}
          </p>
        )}
      </div>

      {/* 複利曲線圖 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h2 className="font-bold text-gray-900 mb-4">資產複利成長曲線</h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={result.projectionData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => String(v)} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => formatTWD(v as number)} width={60} />
            <Tooltip
              formatter={(value: unknown) => [formatTWD(value as number)]}
              labelFormatter={label => `${label} 年`}
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
            />
            <Legend formatter={name => SCENARIO_LABELS[name as FireScenario] ?? name} />
            <ReferenceLine
              y={result.fireNumber}
              stroke="#ef4444"
              strokeDasharray="6 3"
              label={{ value: 'FIRE 目標', position: 'insideTopRight', fontSize: 11, fill: '#ef4444' }}
            />
            {[0.25, 0.5].map(pct => (
              <ReferenceLine
                key={pct}
                y={result.fireNumber * pct}
                stroke="#cbd5e1"
                strokeDasharray="3 3"
                label={{ value: `${pct * 100}%`, position: 'insideLeft', fontSize: 9, fill: '#94a3b8' }}
              />
            ))}
            {(['conservative', 'neutral', 'optimistic'] as const).map(scenario => (
              <Line
                key={scenario}
                type="monotone"
                dataKey={scenario}
                stroke={SCENARIO_COLORS[scenario]}
                strokeWidth={scenario === 'neutral' ? 2.5 : 1.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-400 mt-3 text-center">
          紅色虛線為 FIRE 目標金額，曲線與目標線交叉點即為預計達成年份
        </p>
      </div>
    </>
  );
}
