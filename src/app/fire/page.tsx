'use client';

import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';
import { useAppContext } from '../../context/AppContext';
import { calculateFire, type FireResult, type FireScenario } from '../../lib/fireCalc';

function SliderInput({
  label, value, onChange, min, max, step, format,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; format: (v: number) => string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-bold text-gray-900">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-indigo-600"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

function NumberInput({
  label, value, onChange, prefix,
}: {
  label: string; value: number; onChange: (v: number) => void; prefix?: string;
}) {
  return (
    <div>
      <label className="text-sm text-gray-600 block mb-1">{label}</label>
      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-indigo-400">
        {prefix && <span className="px-3 bg-gray-50 text-gray-400 text-sm border-r border-gray-200 h-10 flex items-center">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value) || 0)}
          className="flex-1 px-3 py-2 text-sm outline-none bg-white"
        />
      </div>
    </div>
  );
}

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

function formatTWD(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)} 億`;
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)} 萬`;
  return v.toLocaleString();
}

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

export default function FirePage() {
  const { netWorth, monthlyNetCashFlow, totalMonthlyExpense } = useAppContext();

  const [currentAge, setCurrentAge] = useState(30);
  const [targetRetirementAge, setTargetRetirementAge] = useState(55);
  const [currentNetWorth, setCurrentNetWorth] = useState(Math.max(0, netWorth));
  const [monthlyInvestment, setMonthlyInvestment] = useState(Math.max(0, monthlyNetCashFlow));
  const [retirementMonthlyExpense, setRetirementMonthlyExpense] = useState(totalMonthlyExpense);
  const [annualReturnRate, setAnnualReturnRate] = useState(6);
  const [inflationRate, setInflationRate] = useState(2);

  const result: FireResult = useMemo(() => calculateFire({
    currentAge,
    targetRetirementAge,
    currentNetWorth,
    monthlyInvestment,
    retirementMonthlyExpense,
    annualReturnRate: annualReturnRate / 100,
    inflationRate: inflationRate / 100,
  }), [currentAge, targetRetirementAge, currentNetWorth, monthlyInvestment, retirementMonthlyExpense, annualReturnRate, inflationRate]);

  const currentYear = new Date().getFullYear();
  const yearsToNeutralFire = result.neutralFireYear ? result.neutralFireYear - currentYear : null;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">FIRE 退休規劃計算機</h1>
        <p className="text-sm text-gray-500 mt-1">Financial Independence, Retire Early — 預測你的財務自由時間點</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左側輸入面板 */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-5">
            <h2 className="font-bold text-gray-900">基本設定</h2>

            <div className="grid grid-cols-2 gap-4">
              <NumberInput label="當前年齡" value={currentAge} onChange={setCurrentAge} />
              <NumberInput label="目標退休年齡" value={targetRetirementAge} onChange={setTargetRetirementAge} />
            </div>

            <NumberInput
              label="現有可投資淨資產（TWD）"
              value={currentNetWorth}
              onChange={setCurrentNetWorth}
              prefix="$"
            />
            <NumberInput
              label="每月可投入金額（TWD）"
              value={monthlyInvestment}
              onChange={setMonthlyInvestment}
              prefix="$"
            />
            <NumberInput
              label="退休後預計月支出（TWD）"
              value={retirementMonthlyExpense}
              onChange={setRetirementMonthlyExpense}
              prefix="$"
            />
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-5">
            <h2 className="font-bold text-gray-900">報酬假設</h2>

            <SliderInput
              label="預期年化投資報酬率"
              value={annualReturnRate}
              onChange={setAnnualReturnRate}
              min={1} max={15} step={0.5}
              format={v => `${v}%`}
            />
            <SliderInput
              label="通膨率"
              value={inflationRate}
              onChange={setInflationRate}
              min={0} max={5} step={0.1}
              format={v => `${v}%`}
            />
          </div>

          {/* FIRE 目標數字 */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">FIRE 目標金額（25倍法則）</p>
            <p className="text-3xl font-black text-indigo-700">{formatTWD(result.fireNumber)}</p>
            <p className="text-xs text-indigo-400 mt-1">
              退休月支出（通膨調整後）× 12 × 25
            </p>
          </div>
        </div>

        {/* 右側圖表 */}
        <div className="lg:col-span-2 space-y-6">
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
              </p>
            )}
          </div>

          {/* 複利曲線圖 */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-4">資產複利成長曲線</h2>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={result.projectionData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={v => String(v)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={v => formatTWD(v as number)}
                  width={60}
                />
                <Tooltip
                  formatter={(value: unknown) => [
                    formatTWD(value as number),
                  ]}
                  labelFormatter={label => `${label} 年`}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Legend
                  formatter={name => SCENARIO_LABELS[name as FireScenario] ?? name}
                />
                {/* FIRE 目標線 */}
                <ReferenceLine
                  y={result.fireNumber}
                  stroke="#ef4444"
                  strokeDasharray="6 3"
                  label={{ value: 'FIRE 目標', position: 'insideTopRight', fontSize: 11, fill: '#ef4444' }}
                />
                {/* 三條情境線 */}
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
        </div>
      </div>
    </>
  );
}
