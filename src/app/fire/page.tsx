'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { calculateFire, runMonteCarlo, type FireResult } from '../../lib/fireCalc';
import { CompareView } from './CompareView';
import { SliderInput, NumberInput, formatTWD } from './shared';
import { FireProgressCard } from './FireProgressCard';
import { FireMilestones } from './FireMilestones';
import { CoastFireCard } from './CoastFireCard';
import { FireProjectionChart } from './FireProjectionChart';
import { SwrSensitivityCard } from './SwrSensitivityCard';
import { MonteCarloSection } from './MonteCarloSection';

export default function FirePage() {
  const {
    netWorth, monthlyNetCashFlow, totalMonthlyExpense,
    showValues, fireSettings, setFireSettings, assetsLoading,
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

  // 若使用者在雲端資料尚未載入完成時就進入本頁，起始淨資產/現金流會先以 0 掛載；
  // 待雲端資料載入完成（assetsLoading true→false）時自動補回真實數值一次，
  // 避免整頁計算「卡」在錯誤的 0 起點（currentNetWorth 等欄位本身不會被持久化）。
  const wasLoadingRef = useRef(assetsLoading);
  useEffect(() => {
    const wasLoading = wasLoadingRef.current;
    wasLoadingRef.current = assetsLoading;
    if (wasLoading && !assetsLoading) {
      setCurrentNetWorth(Math.max(0, netWorth));
      setMonthlyInvestment(Math.max(0, monthlyNetCashFlow));
      setRetirementMonthlyExpense(totalMonthlyExpense);
    }
  }, [assetsLoading, netWorth, monthlyNetCashFlow, totalMonthlyExpense]);

  // Persistence effect
  // 不持久化 currentNetWorth/monthlyInvestment/retirementMonthlyExpense：
  // 這些欄位選填，故意不寫入以免固定住每天變動的淨資產，改由掛載時讀取即時 netWorth。
  useEffect(() => {
    setFireSettings({
      currentAge, targetRetirementAge, annualReturnRate, inflationRate, swr, taxRate,
    });
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
  }), [currentAge, targetRetirementAge, currentNetWorth, monthlyInvestment, retirementMonthlyExpense, annualReturnRate, inflationRate, swr, taxRate, extraMonthly]);

  // 基準結果（無額外儲蓄）
  const baseResult: FireResult = useMemo(() => {
    if (extraMonthly === 0) return result;
    return calculateFire({
      currentAge, targetRetirementAge, currentNetWorth, monthlyInvestment,
      retirementMonthlyExpense,
      annualReturnRate: annualReturnRate / 100, inflationRate: inflationRate / 100,
      safeWithdrawalRate: swr / 100,
      taxRate: taxRate / 100,
    });
  }, [currentAge, targetRetirementAge, currentNetWorth, monthlyInvestment, retirementMonthlyExpense, annualReturnRate, inflationRate, swr, taxRate, extraMonthly]);

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

      <FireProgressCard
        fireProgress={fireProgress}
        currentNetWorth={currentNetWorth}
        fireGap={fireGap}
        fireNumber={result.fireNumber}
        formatAmount={formatAmount}
      />

      <FireMilestones currentNetWorth={currentNetWorth} fireNumber={result.fireNumber} formatAmount={formatAmount} />

      <CoastFireCard
        currentNetWorth={currentNetWorth}
        coastFireNumber={coastFireNumber}
        coastFireProgress={coastFireProgress}
        coastAchieved={coastAchieved}
        fireNumber={result.fireNumber}
        annualReturnRate={annualReturnRate}
        targetRetirementAge={targetRetirementAge}
        formatAmount={formatAmount}
      />

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
                        taxRate: taxRate / 100,
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
          <FireProjectionChart
            result={result}
            yearsToNeutralFire={yearsToNeutralFire}
            extraMonthly={extraMonthly}
            extraYearsSaved={extraYearsSaved}
          />

          <SwrSensitivityCard
            currentAge={currentAge}
            targetRetirementAge={targetRetirementAge}
            currentNetWorth={currentNetWorth}
            monthlyInvestment={monthlyInvestment}
            extraMonthly={extraMonthly}
            retirementMonthlyExpense={retirementMonthlyExpense}
            annualReturnRate={annualReturnRate}
            inflationRate={inflationRate}
            swr={swr}
            onSelectSwr={setSwr}
            formatAmount={formatAmount}
          />
        </div>
      </div>

      <MonteCarloSection mcResult={mcResult} />
      </>}
    </>
  );
}
