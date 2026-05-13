'use client';

import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';
import type { ReactNode } from 'react';
import { useAppContext } from '../../context/AppContext';
import { calculateFire } from '../../lib/fireCalc';

type ScenarioParams = {
  currentAge: number;
  targetRetirementAge: number;
  currentNetWorth: number;
  monthlyInvestment: number;
  retirementMonthlyExpense: number;
  annualReturnRate: number; // percent, e.g. 6
  inflationRate: number;    // percent, e.g. 2
  swr: number;              // percent, e.g. 4
  taxRate: number;
};

function SliderInput({ label, value, onChange, min, max, step, format }: {
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
        type="range" min={min} max={max} step={step} value={value}
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

function NumberInput({ label, value, onChange, prefix }: {
  label: string; value: number; onChange: (v: number) => void; prefix?: string;
}) {
  return (
    <div>
      <label className="text-sm text-gray-600 block mb-1">{label}</label>
      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-indigo-400">
        {prefix && (
          <span className="px-3 bg-gray-50 text-gray-400 text-sm border-r border-gray-200 h-10 flex items-center">
            {prefix}
          </span>
        )}
        <input
          type="number" value={value}
          onChange={e => onChange(Number(e.target.value) || 0)}
          className="flex-1 px-3 py-2 text-sm outline-none bg-white"
        />
      </div>
    </div>
  );
}

function formatTWD(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)} 億`;
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)} 萬`;
  return v.toLocaleString();
}

function toFireInput(p: ScenarioParams, lifeEvents: any) {
  return {
    currentAge: p.currentAge,
    targetRetirementAge: p.targetRetirementAge,
    currentNetWorth: p.currentNetWorth,
    monthlyInvestment: p.monthlyInvestment,
    retirementMonthlyExpense: p.retirementMonthlyExpense,
    annualReturnRate: p.annualReturnRate / 100,
    inflationRate: p.inflationRate / 100,
    safeWithdrawalRate: p.swr / 100,
    taxRate: p.taxRate / 100,
    lifeEvents,
  };
}

function ScenarioPanel({
  label, params, onChange, colorClass, borderClass, onSync
}: {
  label: string;
  params: ScenarioParams;
  onChange: (p: ScenarioParams) => void;
  colorClass: string;
  borderClass: string;
  onSync?: () => void;
}) {
  const set = <K extends keyof ScenarioParams>(key: K, value: ScenarioParams[K]) =>
    onChange({ ...params, [key]: value });

  return (
    <div className={`bg-white border ${borderClass} rounded-2xl p-5 space-y-4`}>
      <div className="flex justify-between items-center">
        <h3 className={`font-bold text-base ${colorClass}`}>{label}</h3>
        {onSync && (
          <button
            onClick={onSync}
            className="text-[10px] bg-gray-50 text-gray-500 px-2 py-1 rounded-lg font-bold hover:bg-gray-100 transition-colors"
          >
            從總覽同步
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberInput label="當前年齡" value={params.currentAge} onChange={v => set('currentAge', v)} />
        <NumberInput label="目標退休年齡" value={params.targetRetirementAge} onChange={v => set('targetRetirementAge', v)} />
      </div>
      <NumberInput label="現有可投資淨資產（TWD）" value={params.currentNetWorth} onChange={v => set('currentNetWorth', v)} prefix="$" />
      <NumberInput label="每月可投入金額（TWD）" value={params.monthlyInvestment} onChange={v => set('monthlyInvestment', v)} prefix="$" />
      <NumberInput label="退休後預計月支出（TWD）" value={params.retirementMonthlyExpense} onChange={v => set('retirementMonthlyExpense', v)} prefix="$" />
      <SliderInput label="預期年化報酬率" value={params.annualReturnRate} onChange={setAnnualReturnRate => set('annualReturnRate', setAnnualReturnRate)} min={1} max={15} step={0.5} format={v => `${v}%`} />
      <SliderInput label="通膨率" value={params.inflationRate} onChange={v => set('inflationRate', v)} min={0} max={5} step={0.1} format={v => `${v}%`} />
      <SliderInput label="實質稅率 (Tax)" value={params.taxRate} onChange={v => set('taxRate', v)} min={0} max={40} step={1} format={v => `${v}%`} />
      <SliderInput label="安全提領率 (SWR)" value={params.swr} onChange={v => set('swr', v)} min={3} max={5} step={0.1} format={v => `${v}%`} />
    </div>
  );
}

function yearDiff(a: number | null, b: number | null): ReactNode {
  if (a === null || b === null) return <span className="text-gray-400">—</span>;
  const diff = b - a;
  if (diff === 0) return <span className="text-gray-500">相同</span>;
  if (diff > 0) return <span className="text-indigo-600">A 早 {diff} 年</span>;
  return <span className="text-amber-600">B 早 {Math.abs(diff)} 年</span>;
}

export function CompareView() {
  const { netWorth, monthlyNetCashFlow, totalMonthlyExpense, showValues, lifeEvents } = useAppContext();

  const defaultParams: ScenarioParams = {
    currentAge: 30,
    targetRetirementAge: 55,
    currentNetWorth: Math.max(0, netWorth),
    monthlyInvestment: Math.max(0, monthlyNetCashFlow),
    retirementMonthlyExpense: totalMonthlyExpense,
    annualReturnRate: 6,
    inflationRate: 2,
    swr: 4,
    taxRate: 0,
  };

  const [scenarioA, setScenarioA] = useState<ScenarioParams>(defaultParams);
  const [scenarioB, setScenarioB] = useState<ScenarioParams>(defaultParams);

  const resultA = useMemo(() => calculateFire(toFireInput(scenarioA, lifeEvents)), [scenarioA, lifeEvents]);
  const resultB = useMemo(() => calculateFire(toFireInput(scenarioB, lifeEvents)), [scenarioB, lifeEvents]);

  const formatAmount = (val: number) => showValues ? formatTWD(val) : '****';

  const chartData = useMemo(() => {
    const mapA = new Map(resultA.projectionData.map(d => [d.year, d.neutral]));
    const mapB = new Map(resultB.projectionData.map(d => [d.year, d.neutral]));
    const years = Array.from(new Set([...mapA.keys(), ...mapB.keys()])).sort((x, y) => x - y);
    return years.map(year => ({
      year,
      neutralA: mapA.get(year) ?? null,
      neutralB: mapB.get(year) ?? null,
    }));
  }, [resultA.projectionData, resultB.projectionData]);

  const sameFireNumber = Math.abs(resultA.fireNumber - resultB.fireNumber) < 10000;

  const comparisonRows: [string, number | null, number | null][] = [
    ['保守達成', resultA.conservativeFireYear, resultB.conservativeFireYear],
    ['中性達成', resultA.neutralFireYear, resultB.neutralFireYear],
    ['樂觀達成', resultA.optimisticFireYear, resultB.optimisticFireYear],
  ];

  return (
    <div className="space-y-6">
      {/* 雙欄輸入面板 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ScenarioPanel
          label="情境 A"
          params={scenarioA}
          onChange={setScenarioA}
          colorClass="text-indigo-600"
          borderClass="border-indigo-200"
          onSync={() => setScenarioA({ ...scenarioA, currentNetWorth: Math.max(0, netWorth), monthlyInvestment: Math.max(0, monthlyNetCashFlow), retirementMonthlyExpense: totalMonthlyExpense })}
        />
        <ScenarioPanel
          label="情境 B"
          params={scenarioB}
          onChange={setScenarioB}
          colorClass="text-amber-600"
          borderClass="border-amber-200"
          onSync={() => setScenarioB({ ...scenarioB, currentNetWorth: Math.max(0, netWorth), monthlyInvestment: Math.max(0, monthlyNetCashFlow), retirementMonthlyExpense: totalMonthlyExpense })}
        />
      </div>

      {/* 比較摘要表 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm overflow-x-auto">
        <h2 className="font-bold text-gray-900 mb-4">比較摘要</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 text-gray-500 font-medium w-28"></th>
              <th className="text-center py-2 text-indigo-600 font-bold">情境 A</th>
              <th className="text-center py-2 text-amber-600 font-bold">情境 B</th>
              <th className="text-center py-2 text-gray-500 font-medium">差異</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            <tr>
              <td className="py-3 text-gray-500">FIRE 目標</td>
              <td className="py-3 text-center font-bold text-gray-900">{formatAmount(resultA.fireNumber)}</td>
              <td className="py-3 text-center font-bold text-gray-900">{formatAmount(resultB.fireNumber)}</td>
              <td className="py-3 text-center">
                {showValues ? (
                  resultB.fireNumber > resultA.fireNumber 
                    ? <span className="text-amber-600">B 多 {formatTWD(resultB.fireNumber - resultA.fireNumber)}</span>
                    : <span className="text-indigo-600">A 多 {formatTWD(resultA.fireNumber - resultB.fireNumber)}</span>
                ) : '****'}
              </td>
            </tr>
            {comparisonRows.map(([label, a, b]) => (
              <tr key={label}>
                <td className="py-3 text-gray-500">{label}</td>
                <td className="py-3 text-center font-bold text-gray-900">{a ? `${a} 年` : '60年內不達'}</td>
                <td className="py-3 text-center font-bold text-gray-900">{b ? `${b} 年` : '60年內不達'}</td>
                <td className="py-3 text-center">{yearDiff(a, b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 疊加複利成長曲線 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h2 className="font-bold text-gray-900 mb-1">資產成長比較（中性情境）</h2>
        <p className="text-xs text-gray-400 mb-4">情境 A（靛藍）vs 情境 B（琥珀），各自以中性報酬率假設計算</p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickFormatter={v => formatAmount(v as number)}
              width={60}
            />
            <Tooltip
              formatter={(value: unknown, name: string) => [
                formatAmount(value as number),
                name === 'neutralA' ? '情境 A' : '情境 B',
              ]}
              labelFormatter={label => `${label} 年`}
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
            />
            <Legend formatter={name => name === 'neutralA' ? '情境 A（中性）' : '情境 B（中性）'} />
            <ReferenceLine
              y={resultA.fireNumber}
              stroke="#6366f1"
              strokeDasharray="6 3"
              label={{ value: 'A FIRE', position: 'insideTopRight', fontSize: 10, fill: '#6366f1' }}
            />
            {!sameFireNumber && (
              <ReferenceLine
                y={resultB.fireNumber}
                stroke="#f59e0b"
                strokeDasharray="6 3"
                label={{ value: 'B FIRE', position: 'insideTopRight', fontSize: 10, fill: '#f59e0b' }}
              />
            )}
            <Line
              type="monotone" dataKey="neutralA" stroke="#6366f1"
              strokeWidth={2.5} dot={false} activeDot={{ r: 4 }}
            />
            <Line
              type="monotone" dataKey="neutralB" stroke="#f59e0b"
              strokeWidth={2.5} dot={false} activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
