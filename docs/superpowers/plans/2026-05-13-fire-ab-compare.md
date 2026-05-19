# FIRE A/B 情境比較 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 FIRE 頁加入「A/B 比較」tab，讓使用者設定兩套完整獨立參數，並排比較達成財務自由的時間點與資產成長曲線。

**Architecture:** 新增 `CompareView.tsx` 負責所有 A/B 邏輯；`page.tsx` 只加 tab 切換 state 與 UI，現有單一情境頁面零改動。兩組 params 各自呼叫已有 `calculateFire()`，不新增計算邏輯。

**Tech Stack:** Next.js 14 App Router, TypeScript, React hooks (`useState`, `useMemo`), Recharts (`LineChart`、`ReferenceLine`), Tailwind CSS

---

## File Structure

| 檔案 | 改動 |
|------|------|
| `src/app/fire/CompareView.tsx` | 新增：`ScenarioParams` type、`ScenarioPanel`、比較摘要表、疊加圖表 |
| `src/app/fire/page.tsx` | 修改：新增 `CompareView` import、`activeTab` state、tab UI、conditional render |

---

### Task 1: 建立 `CompareView.tsx`

**Files:**
- Create: `src/app/fire/CompareView.tsx`

純 UI 元件，無純函數可 unit test。以 `npx tsc --noEmit` 驗證型別正確性。

- [ ] **Step 1: 建立檔案，寫入完整實作**

建立 `src/app/fire/CompareView.tsx`，內容如下：

```tsx
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

function toFireInput(p: ScenarioParams) {
  return {
    currentAge: p.currentAge,
    targetRetirementAge: p.targetRetirementAge,
    currentNetWorth: p.currentNetWorth,
    monthlyInvestment: p.monthlyInvestment,
    retirementMonthlyExpense: p.retirementMonthlyExpense,
    annualReturnRate: p.annualReturnRate / 100,
    inflationRate: p.inflationRate / 100,
    safeWithdrawalRate: p.swr / 100,
  };
}

function ScenarioPanel({
  label, params, onChange, colorClass, borderClass,
}: {
  label: string;
  params: ScenarioParams;
  onChange: (p: ScenarioParams) => void;
  colorClass: string;
  borderClass: string;
}) {
  const set = <K extends keyof ScenarioParams>(key: K, value: ScenarioParams[K]) =>
    onChange({ ...params, [key]: value });

  return (
    <div className={`bg-white border ${borderClass} rounded-2xl p-5 space-y-4`}>
      <h3 className={`font-bold text-base ${colorClass}`}>{label}</h3>
      <div className="grid grid-cols-2 gap-3">
        <NumberInput label="當前年齡" value={params.currentAge} onChange={v => set('currentAge', v)} />
        <NumberInput label="目標退休年齡" value={params.targetRetirementAge} onChange={v => set('targetRetirementAge', v)} />
      </div>
      <NumberInput label="現有可投資淨資產（TWD）" value={params.currentNetWorth} onChange={v => set('currentNetWorth', v)} prefix="$" />
      <NumberInput label="每月可投入金額（TWD）" value={params.monthlyInvestment} onChange={v => set('monthlyInvestment', v)} prefix="$" />
      <NumberInput label="退休後預計月支出（TWD）" value={params.retirementMonthlyExpense} onChange={v => set('retirementMonthlyExpense', v)} prefix="$" />
      <SliderInput label="預期年化報酬率" value={params.annualReturnRate} onChange={v => set('annualReturnRate', v)} min={1} max={15} step={0.5} format={v => `${v}%`} />
      <SliderInput label="通膨率" value={params.inflationRate} onChange={v => set('inflationRate', v)} min={0} max={5} step={0.1} format={v => `${v}%`} />
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

function amountDiff(a: number, b: number): ReactNode {
  const diff = b - a;
  if (Math.abs(diff) < 10000) return <span className="text-gray-500">相同</span>;
  if (diff > 0) return <span className="text-amber-600">B 多 {formatTWD(Math.abs(diff))}</span>;
  return <span className="text-indigo-600">A 多 {formatTWD(Math.abs(diff))}</span>;
}

export function CompareView() {
  const { netWorth, monthlyNetCashFlow, totalMonthlyExpense } = useAppContext();

  const defaultParams: ScenarioParams = {
    currentAge: 30,
    targetRetirementAge: 55,
    currentNetWorth: Math.max(0, netWorth),
    monthlyInvestment: Math.max(0, monthlyNetCashFlow),
    retirementMonthlyExpense: totalMonthlyExpense,
    annualReturnRate: 6,
    inflationRate: 2,
    swr: 4,
  };

  const [scenarioA, setScenarioA] = useState<ScenarioParams>(defaultParams);
  const [scenarioB, setScenarioB] = useState<ScenarioParams>(defaultParams);

  const resultA = useMemo(() => calculateFire(toFireInput(scenarioA)), [scenarioA]);
  const resultB = useMemo(() => calculateFire(toFireInput(scenarioB)), [scenarioB]);

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
        />
        <ScenarioPanel
          label="情境 B"
          params={scenarioB}
          onChange={setScenarioB}
          colorClass="text-amber-600"
          borderClass="border-amber-200"
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
              <td className="py-3 text-center font-bold text-gray-900">{formatTWD(resultA.fireNumber)}</td>
              <td className="py-3 text-center font-bold text-gray-900">{formatTWD(resultB.fireNumber)}</td>
              <td className="py-3 text-center">{amountDiff(resultA.fireNumber, resultB.fireNumber)}</td>
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
              tickFormatter={v => formatTWD(v as number)}
              width={60}
            />
            <Tooltip
              formatter={(value: unknown, name: string) => [
                formatTWD(value as number),
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
```

- [ ] **Step 2: TypeScript 型別檢查**

```
npx tsc --noEmit
```

預期：0 errors。

- [ ] **Step 3: Commit**

```bash
git add src/app/fire/CompareView.tsx
git commit -m "feat(fire): add CompareView component for A/B scenario comparison"
```

---

### Task 2: 修改 `page.tsx` — 加入 tab 切換

**Files:**
- Modify: `src/app/fire/page.tsx`

- [ ] **Step 1: 新增 `CompareView` import**

在 `src/app/fire/page.tsx` 頂部，找到：

```ts
import { calculateFire, runMonteCarlo, type FireResult, type FireScenario } from '../../lib/fireCalc';
```

在其後加一行：

```ts
import { calculateFire, runMonteCarlo, type FireResult, type FireScenario } from '../../lib/fireCalc';
import { CompareView } from './CompareView';
```

- [ ] **Step 2: 新增 `activeTab` state**

在 `FirePage` 元件內，找到現有的第一個 `useState`：

```ts
  const [currentAge, setCurrentAge] = useState(30);
```

在其**前**插入：

```ts
  const [activeTab, setActiveTab] = useState<'single' | 'compare'>('single');
```

結果：

```ts
  const [activeTab, setActiveTab] = useState<'single' | 'compare'>('single');
  const [currentAge, setCurrentAge] = useState(30);
```

- [ ] **Step 3: 加入 tab UI**

找到 `return (` 內的標題區塊：

```tsx
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">FIRE 退休規劃計算機</h1>
        <p className="text-sm text-gray-500 mt-1">Financial Independence, Retire Early — 預測你的財務自由時間點</p>
      </div>
```

改為（在標題 div 下方加 tab switcher）：

```tsx
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
```

- [ ] **Step 4: 條件渲染 `CompareView`**

需要兩個精確的字串替換：

**替換 1：** 在 `{/* FIRE 進度條 */}` 前插入 ternary 開頭。

找到：
```tsx
      {/* FIRE 進度條 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-6">
```

改為：
```tsx
      {activeTab === 'compare' ? <CompareView /> : <>
      {/* FIRE 進度條 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-6">
```

**替換 2：** 在 return 末尾的外層 `</>` 前插入 ternary 結尾。

找到（return 最末尾，`);` 的前一行）：
```tsx
    </>
  );
}
```

改為：
```tsx
      </>}
    </>
  );
}
```

- [ ] **Step 5: TypeScript 型別檢查**

```
npx tsc --noEmit
```

預期：0 errors。

- [ ] **Step 6: Commit**

```bash
git add src/app/fire/page.tsx
git commit -m "feat(fire): add single/compare tab switcher to FIRE page"
```
