# 三大功能增強設計規格

**日期：** 2026-05-12  
**專案：** FinancialManagement (Next.js PWA)  
**功能範圍：** 財務健康評分 · 投資績效分析 · FIRE 退休規劃計算機

---

## 背景與目標

現有系統已具備完整的資產/負債追蹤、股票即時報價、質押借貸管理，但缺乏：
1. 財務狀態的**綜合量化評估**
2. 投資組合的**歷史績效**與股利收益追蹤
3. 長期**財務自由規劃**工具

三個功能相互獨立，可逐一設計與交付。

---

## 功能一：財務健康評分儀表板

### 目標
把使用者現有的所有財務數據自動轉換成一個 0–100 的健康分數，讓使用者一眼看出財務狀態強弱，並知道優先改善哪個面向。

### 顯示位置
- **首頁摘要卡（mini）**：嵌入現有儀表板，顯示總分 + 評等 + 進入詳情連結
- **獨立頁面 `/health`**：完整展開六項指標，含進度條、當前數值、建議文字

### 新增檔案
| 檔案 | 說明 |
|------|------|
| `src/lib/healthScore.ts` | 純函式計算模組，接收 AppContext 資料，回傳評分結果 |
| `src/components/HealthScoreCard.tsx` | 首頁用的迷你儀表盤卡片 |
| `src/app/health/page.tsx` | 完整健康報告頁面 |

### 計分指標與權重

| 指標 | 權重 | 資料來源 | 0 分條件 | 100 分條件 |
|------|------|----------|----------|------------|
| 儲蓄率 | 25% | `monthlyNetCashFlow / totalMonthlyIncome` | ≤ 0% | ≥ 30% |
| 緊急備用金 | 20% | `assets` 中 id=`liquid` 類別的 items 總額 / `totalMonthlyExpense` | < 1 個月 | ≥ 6 個月 |
| 負債比率 | 25% | `totalLiabilities / totalAssets` | ≥ 70% | ≤ 20% |
| 投資比率 | 15% | `combinedAssets` 中 id=`investment` 類別的 items 總額 / `totalAssets`（含自動同步股票市值） | = 0% | ≥ 40% |
| 現金流健康度 | 10% | `monthlyNetCashFlow` | < 0（赤字） | ≥ 月收入 20% |
| 淨資產成長趨勢 | 5% | 最近 3 筆 `snapshots` 是否遞增 | 連續下跌 | 連續 3 月上升 |

各指標在邊界之間線性內插（clamp 0–100）。

### 評等對照表

| 分數 | 評等 | 顏色 |
|------|------|------|
| 90–100 | 優秀 | emerald |
| 75–89 | 良好 | blue |
| 60–74 | 普通 | yellow |
| 40–59 | 警示 | orange |
| 0–39 | 危險 | red |

### `healthScore.ts` 函式簽章與回傳結構

```typescript
// 輸入
export type HealthScoreInput = {
  totalMonthlyIncome: number;
  totalMonthlyExpense: number;
  monthlyNetCashFlow: number;
  totalAssets: number;
  totalLiabilities: number;
  liquidAssets: number;        // assets 中 id='liquid' 類別 items 總和
  investmentAssets: number;    // combinedAssets 中 id='investment' 類別 items 總和
  snapshots: AssetSnapshot[];  // 從 AppContext 傳入，取最後 3 筆
};

export function calculateHealthScore(input: HealthScoreInput): HealthScoreResult { ... }

export type MetricResult = {
  key: string;
  label: string;
  score: number;       // 0–100
  rawValue: number;    // 實際數值（e.g. 儲蓄率 0.23 = 23%）
  benchmark: string;   // 建議基準文字（e.g. "建議 ≥ 30%"）
  advice: string;      // 簡短改善建議
};

export type HealthScoreResult = {
  totalScore: number;
  grade: '優秀' | '良好' | '普通' | '警示' | '危險';
  metrics: MetricResult[];
};
```

### 首頁 HealthScoreCard UI
- 半圓形量表（SVG，顏色隨評等變化）
- 中央顯示總分數字
- 下方顯示評等標籤
- 右下「查看詳情 →」連結至 `/health`

### `/health` 頁面 UI
- 頂部：大型量表 + 評等 + 日期
- 六項指標卡，每卡包含：
  - 指標名稱 + icon
  - 當前數值（格式化，e.g. "儲蓄率 23.5%"）
  - 進度條（寬度 = score/100，顏色同評等）
  - 基準線標記（e.g. 30% 處有刻度線）
  - 一句建議文字（score < 60 才顯示）
- Navbar 新增「健康評分」入口

---

## 功能二：投資績效分析

### 目標
在現有股票頁新增「績效」Tab，追蹤每檔股票的實際報酬率（含股利），並提供整體投資組合績效摘要。

### 資料結構擴充

```typescript
// 新增至 src/context/AppContext.tsx
export type DividendRecord = {
  id: string;
  symbol: string;           // e.g. '2330.TW'
  date: string;             // YYYY-MM-DD（除息日）
  dividendPerShare: number;
  shares: number;           // 持有股數（除息時）
  currency: 'TWD' | 'USD';
  source: 'auto' | 'manual'; // 'auto' = 從 Yahoo Finance 抓取，'manual' = 使用者手動新增
};
```

AppContext 新增：
- `dividendRecords: DividendRecord[]`（useStickyState，key `app-dividends-v1`）
- `setDividendRecords`

### 新增 API：`/api/dividends`

利用現有 `yahoo-finance2` 套件，**不需引入任何新依賴**。

```
GET /api/dividends?symbol=2330.TW&from=2024-01-01
```

實作：
```typescript
import YahooFinance from 'yahoo-finance2';
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// yf.historical 的 events: 'dividends' 模式
const history = await yf.historical(symbol, {
  period1: from,
  events: 'dividends',
});
// 回傳：[{ date: Date, dividends: number }, ...]
```

回傳格式：
```json
[
  { "date": "2024-07-01", "dividendPerShare": 4.5, "currency": "TWD" },
  { "date": "2025-01-01", "dividendPerShare": 5.0, "currency": "TWD" }
]
```

**快取策略：** 同一 symbol + from 組合快取 24 小時（股利資料變動頻率極低）。

### 股利自動同步流程

1. 使用者在股票持倉設定 `purchaseDate` 後，績效 Tab 自動觸發 `/api/dividends?symbol=X&from=purchaseDate`
2. 回傳結果合併到 `dividendRecords`（`source: 'auto'`），以 `symbol + date` 去重
3. 使用者可手動新增補充記錄（`source: 'manual'`）或刪除不正確的 auto 記錄
4. Yahoo Finance 缺漏台股股利時，顯示「⚠️ 部分資料可能不完整，可手動補充」提示

### UI：股票頁 Tab 切換

現有「持倉」View 保持不變，新增「績效」Tab：

**績效 Tab — 頂部摘要列**
| 欄位 | 說明 |
|------|------|
| 總投入成本 | `Σ (avgCost × shares)`，換算 TWD |
| 目前市值 | 同現有計算 |
| 未實現損益 | 市值 - 成本 |
| 已收股利 | `Σ dividendPerShare × shares`，換算 TWD |
| 含息總報酬率 | `(未實現損益 + 已收股利) / 總投入成本 × 100` |

**績效 Tab — 每股明細**

每列顯示：股票名稱、持倉成本、當前市值、未實現損益（+%）、已收股利、簡化年化報酬率

**簡化年化報酬率公式（需 `purchaseDate`）：**
```
holdingDays = today - purchaseDate
totalReturn = (currentValue - costBasis + dividends) / costBasis
annualizedReturn = (1 + totalReturn)^(365/holdingDays) - 1
```
- 若無 `purchaseDate`，顯示「— 未設購買日期」
- 若 `holdingDays < 7`，顯示「— 持倉未滿一週」（避免除以極小值造成失真）

**股利記錄區塊（每股展開）**
- 按股票代號分組，列出每次除息記錄
- `source: 'auto'` 的記錄顯示「Auto」標籤，`manual` 顯示「手動」
- 可手動新增補充記錄（日期、每股股利、股數）
- 可刪除任何記錄（auto 或 manual）
- 新增時自動帶入目前持股數

### 不新增獨立頁面
績效功能整合在現有 `/stocks` 頁面 Tab 內，不另增 Navbar 入口。

---

## 功能三：FIRE 退休規劃計算機

### 目標
讓使用者輸入幾個關鍵參數，立即看到「何時能達成財務自由」，並提供三種情境（保守/中性/樂觀）的複利曲線。

### 新增檔案
| 檔案 | 說明 |
|------|------|
| `src/app/fire/page.tsx` | FIRE 計算機完整頁面 |

Navbar 新增「FIRE 計算機」入口（`/fire`）。

### 輸入參數（左側面板）

| 參數 | 預設值 | 資料來源 |
|------|--------|----------|
| 當前年齡 | 空白（需填） | 手動輸入 |
| 目標退休年齡 | 55 歲 | 手動輸入（slider + input） |
| 預計退休後月支出 | `totalMonthlyExpense` | 自動帶入，可修改 |
| 預期年化投資報酬率 | 6% | slider 1%–15% |
| 通膨率 | 2% | slider 0%–5% |
| 每月可投入金額 | `monthlyNetCashFlow`（≥0） | 自動帶入，可修改 |
| 現有可投資淨資產 | `Math.max(0, netWorth)` | 自動帶入，可修改（負值時帶入 0） |

### 核心計算

**FIRE 目標金額（25 倍法則）：**
```
retirementMonthlyExpense_real = retirementMonthlyExpense × (1 + inflation)^yearsToRetire
FIRE_Number = retirementMonthlyExpense_real × 12 × 25
```

**逐年複利投影（月複利）：**
```
FV(0) = currentNetWorth
FV(month) = FV(month-1) × (1 + annualReturn/12) + monthlyInvestment
FIRE_year = first year where FV ≥ FIRE_Number
```

**三種情境：**
| 情境 | 投報率 | 通膨率 |
|------|--------|--------|
| 保守 | 輸入值 - 2% | 輸入值 + 0.5% |
| 中性 | 輸入值 | 輸入值 |
| 樂觀 | 輸入值 + 2% | 輸入值 - 0.5% |

### 右側圖表 UI

- **Recharts AreaChart**：X 軸 = 西元年份，Y 軸 = 累積資產（TWD）
- 三條曲線（保守/中性/樂觀），顏色分別藍/indigo/emerald
- 一條水平虛線 = FIRE 目標金額（紅色）
- 三條曲線與目標線的交叉點用圓點 + 標籤標示年份
- 圖表下方摘要：「以中性情境，預計 **2041 年**（38 歲）達成財務自由，距今 **15 年**」

### 頁面限制
- 計算結果純 client-side，無需 API
- 不儲存輸入參數（頁面狀態，重整清空）

---

## 共用工作項目

### Navbar 新增入口
`src/components/Navbar.tsx` 新增兩個項目：
- 健康評分 → `/health`（Heart icon）
- FIRE 計算機 → `/fire`（Flame icon）

### 資料安全
三個功能均不更動現有資料結構的讀取邏輯，僅功能二新增 `dividendRecords` 欄位（可選，不影響現有功能）。

---

## 交付順序

1. **功能一**：healthScore.ts + HealthScoreCard + /health 頁面
2. **功能二**：DividendRecord 型別 + AppContext 擴充 + 股票頁績效 Tab
3. **功能三**：/fire 頁面（純 client 計算）
