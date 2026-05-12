# 財務健康評分儀表板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首頁加入迷你健康評分卡，並新增 `/health` 完整報告頁面，利用現有 AppContext 資料自動計算 0–100 分。

**Architecture:** 純函式 `healthScore.ts` 負責計算，`HealthScoreCard` 元件嵌入首頁，`/health` page 展示六指標進度條與建議。無新 API、無新持久化狀態。

**Tech Stack:** Next.js 15 App Router、TypeScript、Tailwind CSS 4、lucide-react、vitest（新增用於測試純函式）

---

## File Map

| 動作 | 路徑 | 說明 |
|------|------|------|
| 新增 | `vitest.config.ts` | vitest 設定（純 node 環境） |
| 新增 | `src/lib/healthScore.ts` | 純計算函式與型別 |
| 新增 | `src/lib/healthScore.test.ts` | healthScore 單元測試 |
| 新增 | `src/components/HealthScoreCard.tsx` | 首頁迷你量表卡 |
| 新增 | `src/app/health/page.tsx` | 完整健康報告頁面 |
| 修改 | `src/app/page.tsx` | 加入 HealthScoreCard |
| 修改 | `src/components/Navbar.tsx` | 加入 /health 導覽連結 |
| 修改 | `package.json` | 加入 test script |

---

## Task 1: 安裝 vitest 並建立設定

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: 安裝 vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: 建立 `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: 在 `package.json` 加入 test script**

在 `"scripts"` 區塊加入：

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: 驗證 vitest 可執行**

```bash
npm test
```

預期輸出：`No test files found` 或 `0 tests passed`（無錯誤即可）

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: add vitest for unit testing"
```

---

## Task 2: 建立 `healthScore.ts`（TDD）

**Files:**
- Create: `src/lib/healthScore.ts`
- Create: `src/lib/healthScore.test.ts`

- [ ] **Step 1: 建立測試檔 `src/lib/healthScore.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { calculateHealthScore, type HealthScoreInput } from './healthScore';

const base: HealthScoreInput = {
  totalMonthlyIncome: 100_000,
  totalMonthlyExpense: 70_000,
  monthlyNetCashFlow: 30_000,
  totalAssets: 3_000_000,
  totalLiabilities: 600_000,
  liquidAssets: 500_000,
  investmentAssets: 1_200_000,
  snapshots: [],
};

describe('calculateHealthScore', () => {
  it('回傳 totalScore 在 0–100 之間', () => {
    const r = calculateHealthScore(base);
    expect(r.totalScore).toBeGreaterThanOrEqual(0);
    expect(r.totalScore).toBeLessThanOrEqual(100);
  });

  it('回傳 6 個 metrics', () => {
    expect(calculateHealthScore(base).metrics).toHaveLength(6);
  });

  it('grade 值在允許範圍內', () => {
    const grade = calculateHealthScore(base).grade;
    expect(['優秀', '良好', '普通', '警示', '危險']).toContain(grade);
  });

  it('儲蓄率 30% → savings score = 100', () => {
    const r = calculateHealthScore({ ...base, monthlyNetCashFlow: 30_000, totalMonthlyIncome: 100_000 });
    expect(r.metrics.find(m => m.key === 'savings')!.score).toBe(100);
  });

  it('儲蓄率負值 → savings score = 0', () => {
    const r = calculateHealthScore({ ...base, monthlyNetCashFlow: -1 });
    expect(r.metrics.find(m => m.key === 'savings')!.score).toBe(0);
  });

  it('負債比率 20% → debt score = 100', () => {
    const r = calculateHealthScore({ ...base, totalLiabilities: 600_000, totalAssets: 3_000_000 });
    expect(r.metrics.find(m => m.key === 'debt')!.score).toBe(100);
  });

  it('負債比率 70%+ → debt score = 0', () => {
    const r = calculateHealthScore({ ...base, totalLiabilities: 2_200_000, totalAssets: 3_000_000 });
    expect(r.metrics.find(m => m.key === 'debt')!.score).toBe(0);
  });

  it('緊急備用金 6 個月 → liquidity score = 100', () => {
    const r = calculateHealthScore({ ...base, liquidAssets: 6 * 70_000, totalMonthlyExpense: 70_000 });
    expect(r.metrics.find(m => m.key === 'liquidity')!.score).toBe(100);
  });

  it('連續 3 月淨資產上升 → growth score = 100', () => {
    const snapshots = [
      { netWorth: 800_000 },
      { netWorth: 900_000 },
      { netWorth: 1_000_000 },
    ];
    const r = calculateHealthScore({ ...base, snapshots });
    expect(r.metrics.find(m => m.key === 'growth')!.score).toBe(100);
  });

  it('連續 3 月淨資產下降 → growth score = 0', () => {
    const snapshots = [
      { netWorth: 1_000_000 },
      { netWorth: 900_000 },
      { netWorth: 800_000 },
    ];
    const r = calculateHealthScore({ ...base, snapshots });
    expect(r.metrics.find(m => m.key === 'growth')!.score).toBe(0);
  });

  it('完美輸入 → grade 為 優秀', () => {
    const r = calculateHealthScore({
      totalMonthlyIncome: 100_000,
      totalMonthlyExpense: 50_000,
      monthlyNetCashFlow: 50_000,
      totalAssets: 10_000_000,
      totalLiabilities: 500_000,
      liquidAssets: 3_000_000,
      investmentAssets: 5_000_000,
      snapshots: [
        { netWorth: 8_400_000 },
        { netWorth: 8_950_000 },
        { netWorth: 9_500_000 },
      ],
    });
    expect(r.grade).toBe('優秀');
  });
});
```

- [ ] **Step 2: 執行測試，確認全部失敗**

```bash
npm test
```

預期：所有測試 FAIL（`calculateHealthScore is not a function`）

- [ ] **Step 3: 建立 `src/lib/healthScore.ts`**

```typescript
type Snapshot = { netWorth: number };

export type HealthScoreInput = {
  totalMonthlyIncome: number;
  totalMonthlyExpense: number;
  monthlyNetCashFlow: number;
  totalAssets: number;
  totalLiabilities: number;
  liquidAssets: number;
  investmentAssets: number;
  snapshots: Snapshot[];
};

export type MetricResult = {
  key: string;
  label: string;
  score: number;
  rawValue: number;
  benchmark: string;
  advice: string;
};

export type HealthScoreResult = {
  totalScore: number;
  grade: '優秀' | '良好' | '普通' | '警示' | '危險';
  metrics: MetricResult[];
};

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function toScore(value: number, zeroBound: number, hundredBound: number): number {
  if (hundredBound === zeroBound) return value >= hundredBound ? 100 : 0;
  return clamp(Math.round(((value - zeroBound) / (hundredBound - zeroBound)) * 100));
}

const WEIGHTS: Record<string, number> = {
  savings: 0.25,
  liquidity: 0.20,
  debt: 0.25,
  investment: 0.15,
  cashflow: 0.10,
  growth: 0.05,
};

function calcSavings(input: HealthScoreInput): MetricResult {
  const rate = input.totalMonthlyIncome > 0 ? input.monthlyNetCashFlow / input.totalMonthlyIncome : 0;
  const score = toScore(rate, 0, 0.3);
  return {
    key: 'savings', label: '儲蓄率', score, rawValue: rate,
    benchmark: '建議 ≥ 30%',
    advice: score < 60 ? '建議減少非必要支出或增加收入，目標儲蓄率 20% 以上' : '',
  };
}

function calcLiquidity(input: HealthScoreInput): MetricResult {
  const months = input.totalMonthlyExpense > 0 ? input.liquidAssets / input.totalMonthlyExpense : 0;
  const score = toScore(months, 1, 6);
  return {
    key: 'liquidity', label: '緊急備用金', score, rawValue: months,
    benchmark: '建議 ≥ 6 個月支出',
    advice: score < 60 ? `流動資金可支撐 ${months.toFixed(1)} 個月，建議增至 6 個月` : '',
  };
}

function calcDebt(input: HealthScoreInput): MetricResult {
  const ratio = input.totalAssets > 0 ? input.totalLiabilities / input.totalAssets : 0;
  const score = toScore(ratio, 0.7, 0.2);
  return {
    key: 'debt', label: '負債比率', score, rawValue: ratio,
    benchmark: '建議 ≤ 20%',
    advice: score < 60 ? `負債佔資產 ${(ratio * 100).toFixed(1)}%，建議優先還清高利率債務` : '',
  };
}

function calcInvestment(input: HealthScoreInput): MetricResult {
  const ratio = input.totalAssets > 0 ? input.investmentAssets / input.totalAssets : 0;
  const score = toScore(ratio, 0, 0.4);
  return {
    key: 'investment', label: '投資比率', score, rawValue: ratio,
    benchmark: '建議 ≥ 40%',
    advice: score < 60 ? '可將閒置現金配置至長期投資，提升資產增值效率' : '',
  };
}

function calcCashFlow(input: HealthScoreInput): MetricResult {
  const rate = input.totalMonthlyIncome > 0 && input.monthlyNetCashFlow > 0
    ? input.monthlyNetCashFlow / input.totalMonthlyIncome : 0;
  const score = toScore(rate, 0, 0.2);
  return {
    key: 'cashflow', label: '現金流健康度', score, rawValue: input.monthlyNetCashFlow,
    benchmark: '月盈餘 ≥ 月收入 20%',
    advice: score < 60
      ? (input.monthlyNetCashFlow < 0 ? '月現金流為負，需立即檢視支出結構' : '月盈餘偏低，建議提高儲蓄比例')
      : '',
  };
}

function calcGrowth(input: HealthScoreInput): MetricResult {
  const recent = input.snapshots.slice(-3);
  let score = 50;
  if (recent.length >= 2) {
    const allUp = recent.every((s, i) => i === 0 || s.netWorth >= recent[i - 1].netWorth);
    const allDown = recent.every((s, i) => i === 0 || s.netWorth <= recent[i - 1].netWorth);
    if (allUp) score = 100;
    else if (allDown) score = 0;
  }
  return {
    key: 'growth', label: '淨資產成長趨勢', score, rawValue: recent.length,
    benchmark: '近 3 個月持續上升',
    advice: score < 60 ? '近期淨資產呈下降趨勢，建議檢視資產與負債變化' : '',
  };
}

function toGrade(score: number): HealthScoreResult['grade'] {
  if (score >= 90) return '優秀';
  if (score >= 75) return '良好';
  if (score >= 60) return '普通';
  if (score >= 40) return '警示';
  return '危險';
}

export function calculateHealthScore(input: HealthScoreInput): HealthScoreResult {
  const metrics = [
    calcSavings(input),
    calcLiquidity(input),
    calcDebt(input),
    calcInvestment(input),
    calcCashFlow(input),
    calcGrowth(input),
  ];
  const totalScore = Math.round(
    metrics.reduce((sum, m) => sum + m.score * WEIGHTS[m.key], 0)
  );
  return { totalScore, grade: toGrade(totalScore), metrics };
}
```

- [ ] **Step 4: 執行測試，確認全部通過**

```bash
npm test
```

預期：`11 tests passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/healthScore.ts src/lib/healthScore.test.ts
git commit -m "feat: add healthScore calculation lib with unit tests"
```

---

## Task 3: 建立 `HealthScoreCard` 迷你量表元件

**Files:**
- Create: `src/components/HealthScoreCard.tsx`

- [ ] **Step 1: 建立 `src/components/HealthScoreCard.tsx`**

```typescript
'use client';

import Link from 'next/link';
import { useAppContext } from '../context/AppContext';
import { calculateHealthScore, type HealthScoreResult } from '../lib/healthScore';

const GRADE_COLOR: Record<HealthScoreResult['grade'], string> = {
  '優秀': '#10b981',
  '良好': '#3b82f6',
  '普通': '#eab308',
  '警示': '#f97316',
  '危險': '#ef4444',
};

const GRADE_BG: Record<HealthScoreResult['grade'], string> = {
  '優秀': 'bg-emerald-50',
  '良好': 'bg-blue-50',
  '普通': 'bg-yellow-50',
  '警示': 'bg-orange-50',
  '危險': 'bg-red-50',
};

function MiniGauge({ score, color }: { score: number; color: string }) {
  const r = 36;
  const circumference = Math.PI * r;
  return (
    <svg width="90" height="52" viewBox="0 0 90 52">
      <path d={`M 9 46 A ${r} ${r} 0 0 1 81 46`} fill="none" stroke="#e2e8f0" strokeWidth="9" strokeLinecap="round" />
      <path
        d={`M 9 46 A ${r} ${r} 0 0 1 81 46`}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - score / 100)}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x="45" y="44" textAnchor="middle" fontSize="18" fontWeight="800" fill="#1e293b">{score}</text>
    </svg>
  );
}

export function HealthScoreCard() {
  const {
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
    totalAssets, totalLiabilities, assets, combinedAssets, snapshots,
  } = useAppContext();

  const liquidAssets = assets.find(c => c.id === 'liquid')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
  const investmentAssets = combinedAssets.find(c => c.id === 'investment')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;

  const result = calculateHealthScore({
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
    totalAssets, totalLiabilities, liquidAssets, investmentAssets, snapshots,
  });

  const color = GRADE_COLOR[result.grade];

  return (
    <div className={`flex-1 min-w-[200px] ${GRADE_BG[result.grade]} border border-gray-100 rounded-2xl p-4 flex items-center justify-between shadow-sm`}>
      <div className="flex items-center gap-2">
        <MiniGauge score={result.totalScore} color={color} />
        <div>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">財務健康</p>
          <p className="font-bold text-sm" style={{ color }}>{result.grade}</p>
        </div>
      </div>
      <Link href="/health" className="text-xs text-gray-400 hover:text-indigo-600 transition-colors whitespace-nowrap">
        詳情 →
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: 驗證 TypeScript 編譯無誤**

```bash
npx tsc --noEmit
```

預期：無錯誤輸出

- [ ] **Step 3: Commit**

```bash
git add src/components/HealthScoreCard.tsx
git commit -m "feat: add HealthScoreCard mini gauge component"
```

---

## Task 4: 建立 `/health` 完整報告頁面

**Files:**
- Create: `src/app/health/page.tsx`

- [ ] **Step 1: 建立 `src/app/health/page.tsx`**

```typescript
'use client';

import { Heart, PiggyBank, ShieldCheck, CreditCard, TrendingUp, Wallet, BarChart2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { calculateHealthScore, type HealthScoreResult, type MetricResult } from '../../lib/healthScore';
import type { LucideIcon } from 'lucide-react';

const GRADE_COLOR: Record<HealthScoreResult['grade'], string> = {
  '優秀': '#10b981', '良好': '#3b82f6', '普通': '#eab308', '警示': '#f97316', '危險': '#ef4444',
};

const GRADE_BG: Record<HealthScoreResult['grade'], string> = {
  '優秀': 'from-emerald-500 to-emerald-600',
  '良好': 'from-blue-500 to-blue-600',
  '普通': 'from-yellow-400 to-yellow-500',
  '警示': 'from-orange-400 to-orange-500',
  '危險': 'from-red-500 to-red-600',
};

const METRIC_ICON: Record<string, LucideIcon> = {
  savings: PiggyBank,
  liquidity: ShieldCheck,
  debt: CreditCard,
  investment: TrendingUp,
  cashflow: Wallet,
  growth: BarChart2,
};

function LargeGauge({ score, grade }: { score: number; grade: HealthScoreResult['grade'] }) {
  const r = 80;
  const circumference = Math.PI * r;
  const color = GRADE_COLOR[grade];
  return (
    <svg width="200" height="115" viewBox="0 0 200 115">
      <path d={`M 20 100 A ${r} ${r} 0 0 1 180 100`} fill="none" stroke="#e2e8f0" strokeWidth="16" strokeLinecap="round" />
      <path
        d={`M 20 100 A ${r} ${r} 0 0 1 180 100`}
        fill="none"
        stroke={color}
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - score / 100)}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x="100" y="95" textAnchor="middle" fontSize="36" fontWeight="900" fill="#1e293b">{score}</text>
      <text x="100" y="112" textAnchor="middle" fontSize="12" fill="#64748b">/ 100</text>
    </svg>
  );
}

function MetricCard({ metric }: { metric: MetricResult }) {
  const Icon = METRIC_ICON[metric.key] ?? Heart;
  const barColor =
    metric.score >= 75 ? 'bg-emerald-500' :
    metric.score >= 60 ? 'bg-blue-500' :
    metric.score >= 40 ? 'bg-yellow-400' :
    'bg-red-500';

  const displayValue = (() => {
    if (metric.key === 'savings' || metric.key === 'debt' || metric.key === 'investment') {
      return `${(metric.rawValue * 100).toFixed(1)}%`;
    }
    if (metric.key === 'liquidity') return `${metric.rawValue.toFixed(1)} 個月`;
    if (metric.key === 'cashflow') return `${metric.rawValue >= 0 ? '+' : ''}${metric.rawValue.toLocaleString()} / 月`;
    return metric.rawValue > 0 ? `最近 ${metric.rawValue} 筆快照` : '尚無資料';
  })();

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gray-50 rounded-lg text-gray-500">
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-800">{metric.label}</p>
          <p className="text-xs text-gray-400">{metric.benchmark}</p>
        </div>
        <span className="text-lg font-black text-gray-900">{metric.score}</span>
      </div>

      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${metric.score}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-400 mb-2">
        <span>當前：{displayValue}</span>
        <span>{metric.score} / 100 分</span>
      </div>

      {metric.advice && (
        <p className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2 mt-3">{metric.advice}</p>
      )}
    </div>
  );
}

export default function HealthPage() {
  const {
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
    totalAssets, totalLiabilities, assets, combinedAssets, snapshots,
  } = useAppContext();

  const liquidAssets = assets.find(c => c.id === 'liquid')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
  const investmentAssets = combinedAssets.find(c => c.id === 'investment')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;

  const result = calculateHealthScore({
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
    totalAssets, totalLiabilities, liquidAssets, investmentAssets, snapshots,
  });

  const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">財務健康評分</h1>
        <p className="text-sm text-gray-500 mt-1">根據你的財務資料自動計算，更新於 {today}</p>
      </div>

      {/* 頂部評分卡 */}
      <div className={`rounded-3xl p-8 mb-8 bg-gradient-to-br ${GRADE_BG[result.grade]} text-white shadow-lg`}>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <LargeGauge score={result.totalScore} grade={result.grade} />
          <div>
            <p className="text-white/70 text-sm font-bold uppercase tracking-widest mb-1">整體財務健康</p>
            <p className="text-4xl font-black mb-2">{result.grade}</p>
            <p className="text-white/80 text-sm max-w-xs">
              {result.totalScore >= 75
                ? '你的財務狀況良好，持續保持良好習慣。'
                : result.totalScore >= 60
                ? '財務狀況尚可，部分指標有改善空間。'
                : '有幾項財務指標需要優先關注，請查看下方建議。'}
            </p>
          </div>
        </div>
      </div>

      {/* 六指標卡片 */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">各項指標詳情</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {result.metrics.map(metric => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
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
git add src/app/health/page.tsx
git commit -m "feat: add /health full financial health report page"
```

---

## Task 5: 整合至首頁 + 更新 Navbar

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: 在 `src/app/page.tsx` 加入 import 與元件**

在檔案頂部 import 區加入：
```typescript
import { HealthScoreCard } from '../components/HealthScoreCard';
```

找到以下區塊（月度收支摘要列）：
```typescript
<div className="mb-6 flex flex-wrap gap-4">
  <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
```

在這個 `<div className="mb-6 flex flex-wrap gap-4">` 裡面、月度摘要 div 之後，加入：
```typescript
<HealthScoreCard />
```

最終結構：
```typescript
<div className="mb-6 flex flex-wrap gap-4">
  <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
    {/* 現有月度收支摘要 */}
  </div>
  <HealthScoreCard />
</div>
```

- [ ] **Step 2: 在 `src/components/Navbar.tsx` 加入 /health 連結**

在 `NAV_LINKS` 陣列中加入新項目：

找到：
```typescript
import { LayoutDashboard, Eye, EyeOff, BarChart3, Coins, Activity, Wallet, Menu, X, Trash2, Settings } from 'lucide-react';
```

改為：
```typescript
import { LayoutDashboard, Eye, EyeOff, BarChart3, Coins, Activity, Wallet, Menu, X, Trash2, Settings, Heart } from 'lucide-react';
```

找到：
```typescript
const NAV_LINKS = [
  { href: '/', label: '總覽', Icon: LayoutDashboard },
  { href: '/cashflow', label: '收支管理', Icon: Wallet },
  { href: '/staking', label: '借貸 & 活儲', Icon: Coins },
  { href: '/stocks', label: '投資追蹤', Icon: Activity },
  { href: '/chart', label: '資產狀態圖', Icon: BarChart3 },
];
```

改為：
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

- [ ] **Step 3: 驗證編譯與啟動**

```bash
npx tsc --noEmit
npm run dev
```

開啟瀏覽器：
- 確認首頁頂部出現健康評分卡（迷你量表 + 評等）
- 點擊「詳情 →」可跳轉至 `/health`
- `/health` 頁面顯示大型量表 + 6 指標卡
- Navbar 有「健康評分」連結（桌機 + 手機側欄）

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/Navbar.tsx
git commit -m "feat: integrate HealthScoreCard on dashboard and add /health nav link"
```

---

## Self-Review Checklist

- [x] `calculateHealthScore` 接收所有指標需要的輸入，回傳 6 metrics + totalScore + grade
- [x] `toScore(ratio, 0.7, 0.2)` 正確處理負債比率反向計分（低比率 = 高分）
- [x] MiniGauge 與 LargeGauge 的 SVG arc 使用 strokeDasharray/offset 技術，避免 arc path endpoint 計算
- [x] `liquidAssets` 來自 `assets`（非 combinedAssets）的 `liquid` category
- [x] `investmentAssets` 來自 `combinedAssets`（含自動同步股票）的 `investment` category
- [x] `/health` 頁面不需要新 API 或新持久化狀態
- [x] Navbar 修改只加一個 link，不改動其他結構
