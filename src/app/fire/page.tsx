'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';
import { useAppContext } from '../../context/AppContext';
import { calculateFire, runMonteCarlo, type FireResult, type FireScenario } from '../../lib/fireCalc';
import { AreaChart, Area } from 'recharts';
import { CompareView } from './CompareView';

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
          type="number" value={value}
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
  return v.toLocaleString('en-US');
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
  const { 
    netWorth, monthlyNetCashFlow, totalMonthlyExpense, 
    showValues, fireSettings, setFireSettings, lifeEvents, setLifeEvents 
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<'single' | 'compare'>('single');
  // Initialize with persisted settings or defaults
  const [currentAge, setCurrentAge] = useState(fireSettings.currentAge);
  const [targetRetirementAge, setTargetRetirementAge] = useState(fireSettings.targetRetirementAge);
  const [currentNetWorth, setCurrentNetWorth] = useState(fireSettings.currentNetWorth ?? Math.max(0, netWorth));
  const [monthlyInvestment, setMonthlyInvestment] = useState(fireSettings.monthlyInvestment ?? Math.max(0, monthlyNetCashFlow));
  const [retirementMonthlyExpense, setRetirementMonthlyExpense] = useState(fireSettings.retirementMonthlyExpense ?? totalMonthlyExpense);
  const [annualReturnRate, setAnnualReturnRate] = useState(fireSettings.annualReturnRate);
  const [inflationRate, setInflationRate] = useState(fireSettings.inflationRate);
  const [swr, setSwr] = useState(fireSettings.swr);
  const [taxRate, setTaxRate] = useState(fireSettings.taxRate || 0);
  const [extraMonthly, setExtraMonthly] = useState(0);

  // Persistence effect
  useEffect(() => {
    setFireSettings({
      currentAge, targetRetirementAge, annualReturnRate, inflationRate, swr, taxRate,
      // We don't necessarily want to persist the exact current net worth if it changes daily, 
      // but for the sake of the calculator, let's keep the user's manual adjustments.
    } as any);
  }, [currentAge, targetRetirementAge, annualReturnRate, inflationRate, swr, taxRate, setFireSettings]);

  const formatAmount = (val: number) => showValues ? formatTWD(val) : '****';

  const result: FireResult = useMemo(() => calculateFire({
    currentAge,
    targetRetirementAge,
    currentNetWorth,
    monthlyInvestment: monthlyInvestment + extraMonthly,
    retirementMonthlyExpense,
    annualReturnRate: annualReturnRate / 100,
    inflationRate: inflationRate / 100,
    safeWithdrawalRate: swr / 100,
    taxRate: taxRate / 100,
    lifeEvents,
  }), [currentAge, targetRetirementAge, currentNetWorth, monthlyInvestment, retirementMonthlyExpense, annualReturnRate, inflationRate, swr, taxRate, extraMonthly, lifeEvents]);

  // 基準結果（無額外儲蓄）
  const baseResult: FireResult = useMemo(() => {
    if (extraMonthly === 0) return result;
    return calculateFire({
      currentAge, targetRetirementAge, currentNetWorth, monthlyInvestment,
      retirementMonthlyExpense,
      annualReturnRate: annualReturnRate / 100, inflationRate: inflationRate / 100,
      safeWithdrawalRate: swr / 100,
      taxRate: taxRate / 100,
      lifeEvents,
    });
  }, [currentAge, targetRetirementAge, currentNetWorth, monthlyInvestment, retirementMonthlyExpense, annualReturnRate, inflationRate, swr, taxRate, extraMonthly, lifeEvents]);

  const [volatility, setVolatility] = useState(12);

  const currentYear = new Date().getFullYear();
  const yearsToNeutralFire = result.neutralFireYear ? result.neutralFireYear - currentYear : null;

  // 進度計算
  const fireProgress = result.fireNumber > 0 ? Math.min(100, (currentNetWorth / result.fireNumber) * 100) : 0;
  const fireGap = Math.max(0, result.fireNumber - currentNetWorth);

  // what-if 節省年數
  const extraYearsSaved = (extraMonthly > 0 && baseResult.neutralFireYear && result.neutralFireYear)
    ? baseResult.neutralFireYear - result.neutralFireYear
    : null;

  // Coast FIRE: today's lump sum that grows to fireNumber by targetRetirementAge without further contributions
  const coastFireNumber = useMemo(() => {
    const years = Math.max(0, targetRetirementAge - currentAge);
    const rate = annualReturnRate / 100;
    if (years === 0) return result.fireNumber;
    return result.fireNumber / Math.pow(1 + rate, years);
  }, [result.fireNumber, targetRetirementAge, currentAge, annualReturnRate]);

  const coastFireProgress = coastFireNumber > 0
    ? Math.min(100, (currentNetWorth / coastFireNumber) * 100)
    : 0;
  const coastAchieved = currentNetWorth >= coastFireNumber;

  // Monte Carlo
  const mcResult = useMemo(() => runMonteCarlo({
    currentAge,
    currentNetWorth,
    monthlyInvestment: monthlyInvestment + extraMonthly,
    retirementMonthlyExpense,
    annualReturnRate: annualReturnRate / 100,
    inflationRate: inflationRate / 100,
    safeWithdrawalRate: swr / 100,
    volatility: volatility / 100,
    simulations: 500,
    maxYears: 50,
  }), [currentAge, currentNetWorth, monthlyInvestment, extraMonthly, retirementMonthlyExpense, annualReturnRate, inflationRate, swr, volatility]);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">FIRE 退休規劃計算機</h1>
        <p className="text-sm text-gray-500 mt-1">Financial Independence, Retire Early — 預測你的財務自由時間點</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {(['single', 'compare'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'single' ? '單一情境' : 'A/B 比較'}
          </button>
        ))}
      </div>

      {activeTab === 'compare' ? <CompareView /> : <>

      {/* FIRE 進度條 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-gray-700">FIRE 達成進度</p>
          <p className="text-sm font-bold text-indigo-600">{fireProgress.toFixed(1)}%</p>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-700"
            style={{ width: `${fireProgress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>目前淨資產：{formatAmount(currentNetWorth)}</span>
          <span>還差 {formatAmount(fireGap)}</span>
          <span>FIRE 目標：{formatAmount(result.fireNumber)}</span>
        </div>
      </div>

      {/* 財務自由里程碑 (Milestones) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { pct: 0.1, label: '安全墊達成', color: 'indigo' },
          { pct: 0.25, label: '咖啡自由', color: 'emerald' },
          { pct: 0.5, label: '半退休目標', color: 'sky' },
          { pct: 1.0, label: '完全財務自由', color: 'amber' },
        ].map(m => {
          const reached = currentNetWorth >= result.fireNumber * m.pct;
          return (
            <div key={m.pct} className={`bg-white border rounded-xl p-3 text-center transition-all ${reached ? `border-${m.color}-500 bg-${m.color}-50` : 'border-gray-100 opacity-60'}`}>
              <p className={`text-[10px] font-bold uppercase mb-1 ${reached ? `text-${m.color}-600` : 'text-gray-400'}`}>
                {m.label} ({m.pct * 100}%)
              </p>
              <p className="text-sm font-black text-gray-900">{formatAmount(result.fireNumber * m.pct)}</p>
              {reached && <span className="text-[10px] font-bold text-emerald-600 block mt-1">✓ 已達成</span>}
            </div>
          );
        })}
      </div>

      {/* Coast FIRE 卡片 */}
      <div className={`rounded-2xl p-5 shadow-sm mb-6 ${
        coastAchieved
          ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white'
          : 'bg-white border border-gray-100'
      }`}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${coastAchieved ? 'text-white/70' : 'text-gray-400'}`}>
              Coast FIRE 數字
            </p>
            <p className={`text-2xl font-black ${coastAchieved ? 'text-white' : 'text-gray-900'}`}>
              {formatAmount(coastFireNumber)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {coastAchieved && (
              <span className="px-3 py-1.5 bg-white/20 rounded-full text-xs font-bold text-white">
                ✓ 已達成 Coast FIRE
              </span>
            )}
            <div className={`text-right ${coastAchieved ? 'text-white/70' : 'text-gray-400'}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider">vs FIRE 目標</p>
              <p className={`text-sm font-bold ${coastAchieved ? 'text-white' : 'text-indigo-600'}`}>
                {formatAmount(result.fireNumber)}
              </p>
            </div>
          </div>
        </div>

        {!coastAchieved && (
          <>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 transition-all duration-700"
                style={{ width: `${coastFireProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>目前 {formatTWD(currentNetWorth)}</span>
              <span className="font-bold text-teal-600">{coastFireProgress.toFixed(1)}%</span>
              <span>Coast 目標 {formatTWD(coastFireNumber)}</span>
            </div>
          </>
        )}

        {coastAchieved ? (
          <p className="text-sm text-white/80 mt-2">
            恭喜！你已達到 Coast FIRE。即使今天停止投入，以 {annualReturnRate}% 年化報酬自然成長，也能在 {targetRetirementAge} 歲達成財務自由目標。
          </p>
        ) : (
          <p className="text-xs text-gray-400 mt-2">
            只需存到此金額，之後無需再追加投入，靠複利自然成長即可在 {targetRetirementAge} 歲達成 FIRE 目標金額。
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左側輸入面板 */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">基本設定</h2>
              <button
                onClick={() => {
                  setCurrentNetWorth(Math.max(0, netWorth));
                  setMonthlyInvestment(Math.max(0, monthlyNetCashFlow));
                  setRetirementMonthlyExpense(totalMonthlyExpense);
                }}
                className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg font-bold hover:bg-indigo-100 transition-colors"
              >
                從總覽同步
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <NumberInput label="當前年齡" value={currentAge} onChange={setCurrentAge} />
              <NumberInput label="目標退休年齡" value={targetRetirementAge} onChange={setTargetRetirementAge} />
            </div>
            <NumberInput label="現有可投資淨資產（TWD）" value={currentNetWorth} onChange={setCurrentNetWorth} prefix="$" />
            <NumberInput label="每月可投入金額（TWD）" value={monthlyInvestment} onChange={setMonthlyInvestment} prefix="$" />
            <NumberInput label="退休後預計月支出（TWD）" value={retirementMonthlyExpense} onChange={setRetirementMonthlyExpense} prefix="$" />
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-5">
            <h2 className="font-bold text-gray-900">報酬假設</h2>
            <SliderInput label="預期年化投資報酬率" value={annualReturnRate} onChange={setAnnualReturnRate} min={1} max={15} step={0.5} format={v => `${v}%`} />
            <SliderInput label="通膨率" value={inflationRate} onChange={setInflationRate} min={0} max={5} step={0.1} format={v => `${v}%`} />
            <SliderInput label="實質稅率 (Tax)" value={taxRate} onChange={setTaxRate} min={0} max={40} step={1} format={v => `${v}%`} />
            <SliderInput label="年化波動率（Monte Carlo）" value={volatility} onChange={setVolatility} min={5} max={30} step={1} format={v => `${v}%`} />
            <div className="space-y-1">
              <SliderInput
                label="安全提領率 (SWR)"
                value={swr} onChange={setSwr}
                min={3} max={5} step={0.1}
                format={v => `${v}%`}
              />
              <p className="text-xs text-gray-400">
                {swr === 4 ? '4% 法則（最常見）' : swr < 4 ? '保守型（資產更長壽）' : '積極型（退休花費較高）'}
              </p>
            </div>
          </div>

          {/* What-if 額外儲蓄 */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-3">
            <h2 className="font-bold text-indigo-800">What-if 情境模擬</h2>
            <SliderInput
              label="每月額外投入"
              value={extraMonthly} onChange={setExtraMonthly}
              min={0} max={50000} step={1000}
              format={v => v === 0 ? '不額外投入' : `+${v.toLocaleString()}`}
            />
            {extraYearsSaved !== null && extraYearsSaved > 0 && (
              <div className="bg-white rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">提早達成 FIRE</p>
                <p className="text-2xl font-black text-emerald-600">{extraYearsSaved} 年</p>
                <p className="text-xs text-gray-400">每月多存 {extraMonthly.toLocaleString()} 元</p>
              </div>
            )}
            {extraYearsSaved === 0 && extraMonthly > 0 && (
              <p className="text-xs text-indigo-500 text-center">效果有限，考慮提高報酬率或降低支出</p>
            )}
          </div>

          {/* FIRE 目標金額 */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">
              FIRE 目標金額（{swr}% SWR）
            </p>
            <p className="text-3xl font-black text-indigo-700">{formatAmount(result.fireNumber)}</p>
            <p className="text-xs text-indigo-400 mt-1">
              退休月支出（通膨調整後）× 12 ÷ {swr}%
            </p>
          </div>

          {/* 優化建議 (Insights) */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
            <h2 className="font-bold text-emerald-800 flex items-center gap-2">
              <span className="text-lg">💡</span> 優化建議
            </h2>
            <div className="space-y-4">
              <div className="bg-white/60 rounded-xl p-3">
                <p className="text-xs text-emerald-700 font-bold mb-1">增加儲蓄動力</p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  若每月額外多存 <span className="font-bold text-emerald-600">5,000</span> 元，
                  預計可提早 <span className="font-bold text-emerald-600">
                    {(() => {
                      const opt = calculateFire({
                        currentAge, targetRetirementAge, currentNetWorth,
                        monthlyInvestment: monthlyInvestment + 5000,
                        retirementMonthlyExpense, annualReturnRate: annualReturnRate / 100,
                        inflationRate: inflationRate / 100, safeWithdrawalRate: swr / 100,
                        taxRate: taxRate / 100, lifeEvents,
                      });
                      return (result.neutralFireYear && opt.neutralFireYear) ? result.neutralFireYear - opt.neutralFireYear : 0;
                    })()} 年
                  </span> 達成財務自由。
                </p>
              </div>
              <div className="bg-white/60 rounded-xl p-3">
                <p className="text-xs text-emerald-700 font-bold mb-1">降低支出效益</p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  若退休後每月減少 <span className="font-bold text-emerald-600">5,000</span> 元支出，
                  目標金額將減少 <span className="font-bold text-emerald-600">{formatTWD(5000 * 12 / (swr/100))}</span>。
                </p>
              </div>
            </div>
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
                    label={{ value: `${pct*100}%`, position: 'insideLeft', fontSize: 9, fill: '#94a3b8' }}
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

          {/* SWR 比較卡 */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3 text-sm">SWR 敏感度分析</h3>
            <div className="grid grid-cols-3 gap-3">
              {[3.5, 4.0, 4.5].map(rate => {
                const r = calculateFire({
                  currentAge, targetRetirementAge, currentNetWorth,
                  monthlyInvestment: monthlyInvestment + extraMonthly,
                  retirementMonthlyExpense,
                  annualReturnRate: annualReturnRate / 100,
                  inflationRate: inflationRate / 100,
                  safeWithdrawalRate: rate / 100,
                });
                const isSelected = Math.abs(swr - rate) < 0.05;
                return (
                  <button
                    key={rate}
                    onClick={() => setSwr(rate)}
                    className={`rounded-xl p-3 text-center transition-all border ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:border-indigo-200'}`}
                  >
                    <p className={`text-xs font-bold mb-1 ${isSelected ? 'text-indigo-600' : 'text-gray-500'}`}>{rate}% SWR</p>
                    <p className="text-sm font-black text-gray-900">{formatAmount(r.fireNumber)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.neutralFireYear ? `${r.neutralFireYear} 達成` : '60年內不達'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── 人生重大事件 (Life Events) ── */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">人生重大事件模擬</h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">預測非線性收支</span>
          </div>
          <button
            onClick={() => {
              const name = prompt('事件名稱 (如：買房、加薪)');
              const age = Number(prompt('發生年齡', String(currentAge + 5)));
              const type = prompt('類型: 1.加薪(月) 2.增加支出(月) 3.單筆支出/收入(一次性)', '1');
              const amount = Number(prompt('金額', '10000'));
              if (name && age && type && amount) {
                const eventType = type === '1' ? 'income_jump' : type === '2' ? 'expense_jump' : 'one_time_lump_sum';
                setLifeEvents([...lifeEvents, { id: `le-${Date.now()}`, name, age, type: eventType as any, amount }]);
              }
            }}
            className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-gray-800 transition-colors"
          >
            + 新增事件
          </button>
        </div>

        {lifeEvents.length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-gray-400">尚未設定任何重大事件。你可以加入如「35歲買房支出」、「40歲職位晉升加薪」等設定。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lifeEvents.map(event => (
              <div key={event.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-gray-400 mb-0.5">{event.age} 歲</p>
                  <p className="text-sm font-bold text-gray-900">{event.name}</p>
                  <p className={`text-xs font-medium ${event.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {event.type === 'income_jump' ? '加薪' : event.type === 'expense_jump' ? '增加支出' : '單筆收支'} 
                    : {event.amount > 0 ? '+' : ''}{event.amount.toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setLifeEvents(lifeEvents.filter(e => e.id !== event.id))}
                  className="text-gray-300 hover:text-rose-500 transition-colors"
                >
                  <span className="text-lg">×</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Monte Carlo 模擬 ── */}
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
      </>}
    </>
  );
}
