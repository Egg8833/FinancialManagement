# 健康分數 CTA 深度連結 — Design Spec

Date: 2026-05-13  
Status: Approved

## Overview

在「升級行動計畫」每個 actionItem 上新增「立即前往」按鈕，點擊直接導航至對應功能頁，讓用戶從問題診斷到實際操作形成完整流程。

健康分數趨勢圖已存在（`hasScoreTrend` 時顯示），本次不修改趨勢圖。

## 現況分析

`src/app/health/page.tsx` 已有：
- `ActionItem` type（第 105–116 行）：含 key、label、action、amount 等欄位
- `actionItems` useMemo（4 項：liquidity、debt、investment、savings）
- 「升級行動計畫」render 區塊：顯示行動說明與分數提升，但無導航按鈕

## Data Model

### `ActionItem` type 新增兩個欄位

```ts
type ActionItem = {
  key: string;
  Icon: LucideIcon;
  label: string;
  current: string;
  target: string;
  action: string;
  amount: number;
  isMonthly: boolean;
  scoreGain: number;
  priority: '高' | '中' | '低';
  href: string;       // 目標頁面路徑
  ctaLabel: string;   // 按鈕文字
};
```

### 各指標對應

| key | href | ctaLabel |
|-----|------|---------|
| `liquidity` | `/` | 管理資產 |
| `debt` | `/staking` | 管理負債 |
| `investment` | `/stocks` | 管理投資 |
| `savings` | `/cashflow` | 管理收支 |

`growth` 與 `cashflow` 兩個指標不在 actionItems 邏輯中，不需處理。

## UI 變更

### 新增 import

```ts
import Link from 'next/link';
```

### 「升級行動計畫」每個 actionItem 新增 CTA 按鈕

在現有右側 `scoreGain` 區塊之後加入：

```tsx
<Link
  href={item.href}
  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap shrink-0"
>
  {item.ctaLabel} <ArrowRight className="w-3 h-3" />
</Link>
```

`ArrowRight` 已從 lucide-react import，不需新增。

## 改動範圍

| 檔案 | 改動 |
|------|------|
| `src/app/health/page.tsx` | 新增 `Link` import；`ActionItem` type 加 `href`/`ctaLabel`；各 item push 時填入對應值；render 加按鈕 |

不新增任何檔案。不改動其他頁面或元件。

## 測試

純 UI 改動，無純函數邏輯可 unit test。以 `npx tsc --noEmit` 驗證型別正確（`href`/`ctaLabel` 必填，缺漏會在 compile 時報錯）。

## 不在範圍

- 健康分數趨勢圖：已存在，不改動
- MetricCard CTA：不加（YAGNI）
- growth / cashflow 指標的 CTA：這兩項目前不在 actionItems 中
