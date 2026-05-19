# FIRE A/B 情境比較 — Design Spec

Date: 2026-05-13
Status: Approved

## Overview

在 FIRE 退休規劃頁加入「A/B 比較」模式，讓使用者設定兩套完整的獨立參數，並排比較達成財務自由的時間點與資產成長軌跡。切換 tab 進入比較模式，現有單一情境頁面完全不動。

## Architecture

- `src/app/fire/page.tsx`：頂部加 pill-style tab（`單一情境 | A/B 比較`），activeTab 控制渲染。`compare` 時渲染 `<CompareView>`，其餘維持原樣。
- `src/app/fire/CompareView.tsx`（新增）：A/B 完整比較介面，內部管理兩組 state，初始值從 AppContext 讀取（與 single 頁一致）。

## Data Model

### `ScenarioParams` type（定義在 `CompareView.tsx`）

```ts
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
```

### 初始值

切換到 compare tab 時：
- `scenarioA` = AppContext 的 `netWorth`、`monthlyNetCashFlow`、`totalMonthlyExpense` 填入（與 single 頁相同預設值）
- `scenarioB` = 與 `scenarioA` 相同初始值，使用者自行調整

### 計算

兩組 params 各自呼叫 `calculateFire()`（已有 `fireCalc.ts`），不需新增計算邏輯。

```ts
const resultA = useMemo(() => calculateFire({
  currentAge: a.currentAge,
  targetRetirementAge: a.targetRetirementAge,
  currentNetWorth: a.currentNetWorth,
  monthlyInvestment: a.monthlyInvestment,
  retirementMonthlyExpense: a.retirementMonthlyExpense,
  annualReturnRate: a.annualReturnRate / 100,
  inflationRate: a.inflationRate / 100,
  safeWithdrawalRate: a.swr / 100,
}), [a]);

const resultB = useMemo(() => calculateFire({ /* same with b */ }), [b]);
```

## UI 結構

### Tab 切換（`page.tsx`）

FIRE 頁標題下方加 pill tab：

```tsx
<div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
  <button onClick={() => setActiveTab('single')}
    className={activeTab === 'single' ? 'bg-white shadow-sm ...' : '...'}>
    單一情境
  </button>
  <button onClick={() => setActiveTab('compare')}
    className={activeTab === 'compare' ? 'bg-white shadow-sm ...' : '...'}>
    A/B 比較
  </button>
</div>
```

### CompareView 佈局

#### 輸入面板（`grid grid-cols-1 sm:grid-cols-2 gap-4`）

情境 A（indigo 色調）和情境 B（amber 色調）各一個 card，每個包含：

| 欄位 | 元件 |
|------|------|
| 當前年齡 / 目標退休年齡 | `NumberInput`（2 欄） |
| 現有可投資淨資產 | `NumberInput` |
| 每月可投入金額 | `NumberInput` |
| 退休後預計月支出 | `NumberInput` |
| 預期年化報酬率 | `SliderInput`（1–15%） |
| 通膨率 | `SliderInput`（0–5%） |
| 安全提領率 (SWR) | `SliderInput`（3–5%） |

> `SliderInput` 與 `NumberInput` 直接在 `CompareView.tsx` 內重新定義（與 `page.tsx` 相同實作），避免跨檔案耦合。不提取共用元件。

#### 比較摘要表

```
          情境 A      情境 B      差異
FIRE目標  XXXX萬      XXXX萬      ±XX萬
保守達成  XXXX年      XXXX年      ±XX年 / — 若其中一方無法達成
中性達成  XXXX年      XXXX年      ±XX年
樂觀達成  XXXX年      XXXX年      ±XX年
```

差異欄規則：
- A 較早：顯示 `A 早 N 年`（綠色）
- B 較早：顯示 `B 早 N 年`（amber）
- 其中一方 60 年內不達成：顯示 `—`

#### 資產成長比較圖

使用 Recharts `LineChart`，兩組 `projectionData` 疊加於同一圖表：

- 情境 A 中性線：indigo `#6366f1`，`strokeWidth={2.5}`
- 情境 B 中性線：amber `#f59e0b`，`strokeWidth={2.5}`
- 情境 A FIRE 目標：indigo 虛線 `ReferenceLine`
- 情境 B FIRE 目標：amber 虛線 `ReferenceLine`（若與 A 相同則省略）
- X 軸：年份；Y 軸：formatTWD

`projectionData` 中各 scenario 的 `neutral` dataKey 已由 `calculateFire` 產生，直接使用。

### 色彩規範

| 情境 | 主色 | 輕色背景 | 邊框 |
|------|------|----------|------|
| 情境 A | `text-indigo-600` | `bg-indigo-50` | `border-indigo-200` |
| 情境 B | `text-amber-600` | `bg-amber-50` | `border-amber-200` |

## 改動範圍

| 檔案 | 改動 |
|------|------|
| `src/app/fire/page.tsx` | 新增 `activeTab` state；頂部加 tab UI；`compare` 時渲染 `<CompareView>`，否則渲染現有內容 |
| `src/app/fire/CompareView.tsx`（新增）| `ScenarioParams` type；`scenarioA`/`scenarioB` state；輸入面板；比較摘要；疊加圖表 |

不改動：`fireCalc.ts`、AppContext、其他頁面。

## 測試

無純函數新邏輯，`calculateFire` 已有測試。以 `npx tsc --noEmit` 驗證型別正確性。

## 不在範圍

- Monte Carlo A/B 比較：資訊過多，YAGNI
- Coast FIRE A/B 比較：YAGNI
- URL 參數分享：YAGNI
- localStorage 持久化：YAGNI
- A/B 以外的第三情境：YAGNI
