# 個人資產管理系統 (Personal Financial Management Dashboard)

一個基於 Next.js 15 開發的個人財務管理儀表板，旨在幫助使用者追蹤資產、負債、現金流以及投資表現。

## 🚀 核心功能

- **📊 資產概覽儀表板**: 透過視覺化圖表整合所有財務數據，即時掌握淨資產狀況。
- **📈 股票追蹤**: 整合 Yahoo Finance API，提供即時美股/台股價格更新與損益分析。
- **💸 貸款與質押管理**: 紀錄貸款進度、利率，並監控證券質押的維持率與到期日。
- **📅 現金流分析**: 追蹤每月收支，並生成年度財務報表。
- **💡 決策支援**: 提供財務健康度分析，幫助使用者做出更好的理財決策。

## 🛠️ 技術棧

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Library**: [React 19](https://reactjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Charts**: [Recharts](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Data**: Yahoo Finance API

## 🏁 快速開始

### 1. 安裝依賴
```bash
npm install
```

### 2. 啟動開發伺服器
```bash
npm run dev
```
打開 [http://localhost:3000](http://localhost:3000) 即可查看結果。

## 🗺️ 未來開發路線圖 (Roadmap)

- [ ] **身分驗證**: 整合 Google 登入，並提供本地/雲端模式切換以保護隱私。
- [ ] **資料持久化**: 導入雲端資料庫以實現多裝置同步。
- [ ] **匯入/匯出**: 支援 Excel 格式的資料批量處理。
- [ ] **自動化通知**:
    - 質押到期或維持率過低提醒。
    - 每月自動寄送資產報表至電子信箱。
- [ ] **社群整合**: 導入 Line Notify，自動記錄帳單與支出費用。

---
*本專案僅供個人財務管理參考，不構成任何投資建議。*
