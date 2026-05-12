# FIRE 退休規劃計算機 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/fire` 頁面，讓使用者輸入年齡與財務目標，即時計算三種情境下的財務自由達成年份並顯示複利曲線。

**Architecture:** 純 client-side 計算，`fireCalc.ts` 提供純函式，`/fire` page 負責 UI 與互動。無新 API、無持久化（頁面狀態，重整清空）。預設值自動從 AppContext 帶入。

**Tech Stack:** Next.js 15 App Router、TypeScript、Recharts（已安裝）、Tailwind CSS 4

---

## File Map

| 動作 | 路徑 | 說明 |
|------|------|------|
| 新增 | `src/lib/fireCalc.ts` | 純 FIRE 計算函式 |
| 新增 | `src/lib/fireCalc.test.ts` | 計算邏輯單元測試 |
| 新增 | `src/app/fire/page.tsx` | FIRE 計算機完整頁面 |
| 修改 | `src/components/Navbar.tsx` | 加入 /fire 導覽連結 |

---

## Task 1: 建立 `fireCalc.ts`（TDD）

**Files:**
- Create: `src/lib/fireCalc.ts`
- Create: `src/lib/fireCalc.test.ts`

- [ ] **Step 1: 建立測試檔 `src/lib/fireCalc.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { calculateFire, type FireInput } from './fireCalc';

const base: FireInput = {
  currentAge: 35,
  targetRetirementAge: 55,
  currentNetWorth: 2_000_000,
  monthlyInvestment: 30_000,
  retirementMonthlyExpense: 60_000,
  annualReturnRate: 0.06,
  inflationRate: 0.02,
};

describe('calculateFire', () => {
  it('FIRE Number = 月支出（通膨調整後） × 12 × 25', () => {
    const r = calculateFire(base);
    // 20 years to retirement, 2% inflation: expense × (1.02)^20 × 12 × 25
    const expected = 60_000 * Math.pow(1.02, 20) * 12 * 25;
    expect(r.fireNumber).toBeCloseTo(expected, -3); // within 1000
  });

  it('projectionData 至少包含 1 筆資料', () => {
    expect(calculateFire(base).projectionData.length).toBeGreaterThan(0);
  });

  it('projectionData 第一筆 neutral 值等於 currentNetWorth', () => {
    const r = calculateFire(base);
    expect(r.projectionData[0].neutral).toBe(base.currentNetWorth);
  });

  it('樂觀情境達成 FIRE 早於或等於中性情境', () => {
    const r = calculateFire(base);
    if (r.optimisticFireYear && r.neutralFireYear) {
      expect(r.optimisticFireYear).toBeLessThanOrEqual(r.neutralFireYear);
    }
  });

  it('保守情境達成 FIRE 晚於或等於中性情境', () => {
    const r = calculateFire(base);
    if (r.conservativeFireYear && r.neutralFireYear) {
      expect(r.conservativeFireYear).toBeGreaterThanOrEqual(r.neutralFireYear);
    }
  });

  it('netWorth = 0 且 monthlyInvestment = 0 → 不會達成 FIRE（返回 null）', () => {
    const r = calculateFire({ ...base, currentNetWorth: 0, monthlyInvestment: 0 });
    expect(r.neutralFireYear).toBeNull();
  });

  it('已超過 FIRE Number → neutralFireYear 為當前年份', () => {
    const r = calculateFire({ ...base, currentNetWorth: 100_000_000 });
    expect(r.neutralFireYear).toBe(new Date().getFullYear());
  });
});
```

- [ ] **Step 2: 執行測試，確認全部失敗**

```bash
npm test
```

預期：`calculateFire is not a function`

- [ ] **Step 3: 建立 `src/lib/fireCalc.ts`**

```typescript
export type FireScenario = 'conservative' | 'neutral' | 'optimistic';

export type FireInput = {
  currentAge: number;
  targetRetirementAge: number;
  currentNetWorth: number;
  monthlyInvestment: number;
  retirementMonthlyExpense: number;
  annualReturnRate: number;   // e.g. 0.06
  inflationRate: number;      // e.g. 0.02
};

export type FireYearData = {
  year: number;
  age: number;
  conservative: number;
  neutral: number;
  optimistic: number;
};

export type FireResult = {
  fireNumber: number;
  projectionData: FireYearData[];
  neutralFireYear: number | null;
  neutralFireAge: number | null;
  conservativeFireYear: number | null;
  conservativeFireAge: number | null;
  optimisticFireYear: number | null;
  optimisticFireAge: number | null;
};

type Rates = { returnRate: number; inflationRate: number };

function scenarioRates(input: FireInput, scenario: FireScenario): Rates {
  switch (scenario) {
    case 'conservative':
      return {
        returnRate: Math.max(0, input.annualReturnRate - 0.02),
        inflationRate: input.inflationRate + 0.005,
      };
    case 'optimistic':
      return {
        returnRate: input.annualReturnRate + 0.02,
        inflationRate: Math.max(0, input.inflationRate - 0.005),
      };
    default:
      return { returnRate: input.annualReturnRate, inflationRate: input.inflationRate };
  }
}

function calcFireNumber(monthlyExpense: number, inflationRate: number, yearsToRetire: number): number {
  const realMonthlyExpense = monthlyExpense * Math.pow(1 + inflationRate, Math.max(0, yearsToRetire));
  return realMonthlyExpense * 12 * 25;
}

function projectWealth(start: number, monthlyContrib: number, monthlyRate: number, months: number): number {
  let fv = start;
  for (let m = 0; m < months; m++) {
    fv = fv * (1 + monthlyRate) + monthlyContrib;
  }
  return Math.round(fv);
}

const SCENARIOS: FireScenario[] = ['conservative', 'neutral', 'optimistic'];
const MAX_YEARS = 60;

export function calculateFire(input: FireInput): FireResult {
  const currentYear = new Date().getFullYear();
  const yearsToRetire = Math.max(0, input.targetRetirementAge - input.currentAge);
  const neutralRates = scenarioRates(input, 'neutral');
  const fireNumber = calcFireNumber(input.retirementMonthlyExpense, neutralRates.inflationRate, yearsToRetire);

  const fireYears: Record<FireScenario, number | null> = {
    conservative: null, neutral: null, optimistic: null,
  };
  const projectionData: FireYearData[] = [];
  const startWealth = Math.max(0, input.currentNetWorth);

  for (let year = 0; year <= MAX_YEARS; year++) {
    const entry: FireYearData = {
      year: currentYear + year,
      age: input.currentAge + year,
      conservative: 0, neutral: 0, optimistic: 0,
    };

    for (const scenario of SCENARIOS) {
      const rates = scenarioRates(input, scenario);
      const value = projectWealth(startWealth, input.monthlyInvestment, rates.returnRate / 12, year * 12);
      entry[scenario] = value;

      if (fireYears[scenario] === null) {
        const targetFireNumber = calcFireNumber(
          input.retirementMonthlyExpense,
          rates.inflationRate,
          Math.max(0, yearsToRetire - year),
        );
        if (value >= targetFireNumber) {
          fireYears[scenario] = currentYear + year;
        }
      }
    }

    projectionData.push(entry);

    // 所有情境都找到後，再多投影 5 年供圖表參考
    if (year > 5 && SCENARIOS.every(s => fireYears[s] !== null)) {
      const maxFireYear = Math.max(...SCENARIOS.map(s => fireYears[s] ?? 0));
      if (currentYear + year >= maxFireYear + 5) break;
    }
  }

  return {
    fireNumber,
    projectionData,
    neutralFireYear: fireYears.neutral,
    neutralFireAge: fireYears.neutral ? input.currentAge + (fireYears.neutral - currentYear) : null,
    conservativeFireYear: fireYears.conservative,
    conservativeFireAge: fireYears.conservative ? input.currentAge + (fireYears.conservative - currentYear) : null,
    optimisticFireYear: fireYears.optimistic,
    optimisticFireAge: fireYears.optimistic ? input.currentAge + (fireYears.optimistic - currentYear) : null,
  };
}
```

- [ ] **Step 4: 執行測試，確認全部通過**

```bash
npm test
```

預期：所有 fireCalc 測試 PASS（加上先前 healthScore 測試，共 18 tests passed）

- [ ] **Step 5: Commit**

```bash
git add src/lib/fireCalc.ts src/lib/fireCalc.test.ts
git commit -m "feat: add fireCalc pure calculation lib with unit tests"
```

---

## Task 2: 建立 `/fire` 頁面

**Files:**
- Create: `src/app/fire/page.tsx`

- [ ] **Step 1: 建立 `src/app/fire/page.tsx`**

```typescript
'use client';

import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';
import { useAppContext } from '../../context/AppContext';
import { calculateFire, type FireResult } from '../../lib/fireCalc';

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
                  formatter={(value: number, name: string) => [
                    formatTWD(value),
                    SCENARIO_LABELS[name as FireScenario] ?? name,
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
```

- [ ] **Step 2: 確認 TypeScript 無誤**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/fire/page.tsx
git commit -m "feat: add /fire FIRE retirement calculator page"
```

---

## Task 3: 加入 Navbar 連結

**Files:**
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: 在 `src/components/Navbar.tsx` 加入 Flame icon 與 /fire 連結**

找到 import 行（已在健康評分計劃中加入了 `Heart`）：
```typescript
import { LayoutDashboard, Eye, EyeOff, BarChart3, Coins, Activity, Wallet, Menu, X, Trash2, Settings, Heart } from 'lucide-react';
```

加入 `Flame`：
```typescript
import { LayoutDashboard, Eye, EyeOff, BarChart3, Coins, Activity, Wallet, Menu, X, Trash2, Settings, Heart, Flame } from 'lucide-react';
```

找到 `NAV_LINKS`（已有 Heart/health 連結）：
```typescript
const NAV_LINKS = [
  { href: '/', label: '總覽', Icon: LayoutDashboard },
  { href: '/cashflow', label: '收支管理', Icon: Wallet },
  { href: '/staking', label: '借貸 & 活儲', Icon: Coins },
  { href: '/stocks', label: '投資追蹤', Icon: Activity },
  { href: '/health', label: '健康評分', Icon: Heart },
  { href: '/chart', label: '資產狀態圖', Icon: BarChart3 },
];
```

加入 FIRE 連結：
```typescript
const NAV_LINKS = [
  { href: '/', label: '總覽', Icon: LayoutDashboard },
  { href: '/cashflow', label: '收支管理', Icon: Wallet },
  { href: '/staking', label: '借貸 & 活儲', Icon: Coins },
  { href: '/stocks', label: '投資追蹤', Icon: Activity },
  { href: '/health', label: '健康評分', Icon: Heart },
  { href: '/fire', label: 'FIRE 計算機', Icon: Flame },
  { href: '/chart', label: '資產狀態圖', Icon: BarChart3 },
];
```

- [ ] **Step 2: 完整驗證**

```bash
npm run dev
```

確認：
- Navbar 顯示「FIRE 計算機」連結（桌機 + 手機側欄）
- `/fire` 頁面載入正常，左側面板預設帶入 AppContext 的淨資產、月盈餘、月支出
- 調整滑桿時圖表即時更新
- 圖表顯示三條曲線 + 紅色 FIRE 目標虛線
- Tooltip 顯示格式化金額

- [ ] **Step 3: 執行所有測試確認無回歸**

```bash
npm test
```

預期：所有測試通過（healthScore + fireCalc）

- [ ] **Step 4: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "feat: add FIRE calculator link to Navbar"
```

---

## Self-Review Checklist

- [x] `calculateFire` 接受百分比以小數表示（0.06 = 6%），`/fire` page 傳入時除以 100
- [x] `projectWealth` 使用月複利（annualRate/12）而非年複利
- [x] FIRE number 以目標退休年齡計算通膨（非當前年份）
- [x] 三情境各自使用對應的 `returnRate` 與 `inflationRate` 計算 FIRE number
- [x] `currentNetWorth` 負值時傳入 `Math.max(0, netWorth)`（page.tsx 預設值處理）
- [x] 投影最多 60 年，找到所有情境後再延伸 5 年供圖表視覺化
- [x] `formatTWD` 在圖表與 FIRE number 顯示上統一使用
- [x] `/fire` 頁面無 localStorage 持久化（state 在 `page.tsx` 內，重整清空）
- [x] `FireScenario` 型別在 `fireCalc.ts` export，供 `fire/page.tsx` import 使用
