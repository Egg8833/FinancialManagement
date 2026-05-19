# Mobile Responsiveness Design

**Date:** 2026-05-19  
**Status:** Approved  
**Goal:** 讓 Dashboard、Cashflow、Health 三頁在手機（375px+）可正常使用，作為 v1 產品最低門檻。

---

## Scope

優先三頁（v1 必須）：
1. **Dashboard** — 資訊密度高，需要卡片重排
2. **Cashflow** — 輸入表單複雜，需要單欄化
3. **Health** — 已相對良好，微調即可

次優先（v1.1）：
- Stocks — 表格轉卡片（工程量大，獨立 sprint）
- FIRE — Settings 抽屜化（獨立 sprint）
- Annual — 行動版摘要視圖（合併入 Cashflow 後一起處理）

---

## Breakpoints

使用 Tailwind 標準：
- `sm`: 640px（手機橫式）
- `md`: 768px（平板）
- `lg`: 1024px（桌機）

目標：**375px 起可用**，768px 以上恢復完整桌機版面。

---

## Dashboard 修改

### 現狀問題
- HeroKPI 3欄在手機擠壓
- Asset 分類卡片 2欄在 375px 約 160px 寬，顯示不完整
- NetWorthChart 高度固定，手機上太高
- FinancialGoals 橫向滾動但無提示

### 修改方案

**HeroKPI（`src/components/HeroKPI.tsx`）**
```
桌機：grid-cols-3
手機：grid-cols-2（第三個卡片全寬）
```
- 主要 KPI（淨資產）永遠全寬
- 資產/負債並排

**Asset Category Cards**
```
桌機：grid-cols-2 或 3
手機：grid-cols-1（單欄，卡片全寬）
```

**NetWorthChart**
```
桌機：height={300}
手機：height={200}，移除 Y 軸標籤（只保留線條）
```

**FinancialGoals**
```
桌機：grid-cols-2
手機：grid-cols-1 + 橫向 scroll snap（每次滑一個）
```

**Monthly Cash Flow Alerts**
- 現況：inline block，手機不換行
- 修改：flex-col，每個 alert 獨立一行

### CSS 策略
優先使用 Tailwind responsive prefix，不寫自訂 media query。

---

## Cashflow 修改

### 現狀問題
- 收入/支出並排 2欄在手機過窄
- 類別管理 UI 輸入框寬度 ~20px
- Month navigator 日期字串在手機截斷
- Tab 標籤在手機 3 個可能溢出

### 修改方案

**月份導航（Month Navigator）**
```
桌機：← 2025年 5月 →（完整顯示）
手機：← 5月 →（省略年份，或用 select 下拉選月）
```

**Tab 標籤**
```
桌機：月度現金流 | 分類分析 | 年度總覽（文字）
手機：月流 | 分析 | 年度（縮短）或 icon + 文字
```

**收入/支出並排 → 單欄**
```
桌機：grid-cols-2（收入左、支出右）
手機：grid-cols-1（先顯示收入，再顯示支出，加分隔線）
```

**類別管理 UI**
- 現況：inline text input，寬度極小
- 修改：點擊「管理類別」開啟全螢幕 Modal，input 寬度 100%

**新增項目表單**
- 現況：在列表下方 inline
- 修改：手機上改為浮動「+ 新增」按鈕，點擊開啟 bottom sheet

**Budget 進度條**
- 手機顯示時簡化：只顯示 `已用 / 預算` 數字，進度條縮小

---

## Health Score 修改

### 現狀問題（相對輕微）
- 圓形分數儀表板在手機可能過大（估計 200px 直徑）
- 6 個指標卡片 3欄在手機擠壓
- Action Plan 列表在手機文字截斷

### 修改方案

**Score Gauge**
```
桌機：200px 直徑
手機：160px 直徑，縮小 font-size
```

**Metric Cards**
```
桌機：grid-cols-3
手機：grid-cols-2（6 個卡片 → 3 排 × 2 欄）
```

**Action Plan**
- 每個行動項換行顯示（不截斷）
- CTA button 全寬（w-full）

**Health Trend Chart**
- 手機高度降至 150px
- 移除網格線，保留趨勢線和參考線

---

## Navbar 手機適配

**現況：** 水平連結列，手機螢幕寬度不足。

**修改方案：**
- 手機（< md）：底部 Tab Bar，固定於畫面底部
- 顯示 5 個主要頁面圖示（Dashboard / 現金流 / FIRE / 股票 / 健康）
- 「負債」和「設定」收入 ⋯ 更多 選單（或齒輪圖示）

**底部 Tab Bar 佈局：**
```
[🏠 總覽] [💵 現金流] [🔥 FIRE] [📈 股票] [❤️ 健康]
```

桌機：保留現有頂部橫向 Navbar。

---

## Implementation Notes

- 所有修改用 Tailwind responsive prefix（`sm:`, `md:`），不引入額外 CSS
- 不引入新 UI 庫（避免 bundle 增大）
- Bottom sheet / Modal 用現有 `ConfirmDialog` 模式實作
- 測試基準：Chrome DevTools iPhone 12（390px × 844px）

---

## Success Criteria

- [ ] Dashboard 在 375px 不出現橫向 scrollbar
- [ ] Cashflow 在 375px 輸入表單可正常操作（點擊、輸入、儲存）
- [ ] Health Score 在 375px 所有元素可見、不截斷
- [ ] Navbar 在手機顯示底部 Tab Bar
- [ ] 桌機（>= 768px）版面與現有相同
