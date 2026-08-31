# 資產報表排程 / 質押警示改為伺服器自動觸發 — 設計文件

日期:2026-08-31
狀態:已與使用者確認方向,待實作

## 1. 背景與目標

目前「資產報表排程寄送」(`api/cron/send-asset-report`)與「質押維持率警示」(`api/pledge-alert`)雖然路徑上有 `cron` 字樣,但實際上**不是真正的排程**——判斷邏輯全部寫在前端 `useEffect`(`EmailReportSender.tsx`、`debt/page.tsx`),只有使用者剛好打開該頁面時才會檢查並觸發寄信。收件信箱與排程頻率也大多存在瀏覽器 localStorage。

目標:改用 Vercel Cron,讓伺服器每天自動檢查所有使用者、到期就寄信,不再依賴使用者開網頁。

範圍:
1. 資產報表排程(weekly / monthly)
2. 質押維持率警示(< 200% 提醒 / < 167% 緊急)

環境限制(已確認):Vercel **Hobby** 方案 —— 每個 cron 一天只觸發一次(實際時間點由 Vercel 排定,可能有誤差),serverless function 執行逾時 10 秒。

## 2. 整體架構

```
Vercel Cron (每天 1 次,UTC 01:00)
   │  Authorization: Bearer $CRON_SECRET
   ▼
GET /api/cron/daily-check
   │
   ├─ 撈出 users 表所有使用者
   │
   └─ 逐一使用者(try/catch 各自獨立):
        1. 從 DB 讀 assets / liabilities / appState(stockItems, dividendRecords,
           loans, stakingItems, cashflowTemplate, monthlyRecords, usdToTwd,
           reportSchedule, lastReportSent, pledgeAlertLastSent)
        2. 若有股票持倉 → getQuotes(symbols) 抓即時報價(與 /api/quote 共用同一函式與快取)
        3. 呼叫共用純函式(src/lib/reportCalc.ts)算出:
           combinedAssets / combinedLiabilities / totalMonthlyIncome / totalMonthlyExpense / pledgeRatios
        4a. 資產報表到期(reportSchedule 對應今天 且 lastReportSent != 今天)
            → sendEmail(資產報表) → 寫回 appState.lastReportSent
        4b. 質押比 < 200%(warning)/ < 167%(danger) 且該等級今天未寄過
            → sendEmail(質押警示) → 寫回 appState.pledgeAlertLastSent
```

單一 cron 端點涵蓋兩件事,避免在 Hobby 方案下管理多個 cron 排程。

## 3. 資料層變更(不新增資料表)

| 項目 | 現況 | 變更 |
|---|---|---|
| 收件信箱 | 前端 localStorage `userEmail`(登入後由 Google session 同步,但未寫回 DB) | 伺服器端一律用 `users.email`(next-auth 登入時已寫入) |
| `reportSchedule` | `appState` 表,id=`reportSchedule`(已雲端同步) | 不變,cron 直接讀 |
| `pledgeAlertLastSent` | `appState` 表,id=`pledgeAlertLastSent`(已雲端同步) | 不變,cron 讀 + 寫回 |
| `lastReportSent` | 前端 localStorage,裝置本機,不同步 | 改存進 `appState`,id=`lastReportSent`,cron 讀 + 寫回,前端手動寄送成功後也寫回同一個 key(取代原本的 localStorage) |

沒有登入(訪客模式,資料只在 localStorage)的使用者,伺服器本來就看不到資料,cron 會自然跳過 —— 這與現況一致(訪客模式從未支援雲端功能)。

## 4. 業務邏輯共用:抽出純函式

目前 `combinedAssets`/`combinedLiabilities`(`AssetContext.tsx`)、月收支(`AppContext.tsx`)、質押維持率(`debt/page.tsx`)的計算邏輯內嵌在 React `useMemo` 裡,前端與 cron 都需要一致的計算結果。抽出為純函式,前端 Context 與伺服器 cron 共用同一份實作,避免兩邊各寫一套、日後行為漂移:

- `src/lib/assetCalc.ts`:`buildCombinedAssets(assets, totalStockValueTWD, stakingEarnTotal)`、`buildCombinedLiabilities(liabilities, borrowItems, loans)` —— 從 `AssetContext.tsx` 現有 `useMemo` 內容原樣抽出
- `src/lib/cashflowCalc.ts`:`computeMonthlyIncome(...)`、`computeMonthlyExpense(...)` —— 從 `AppContext.tsx` 抽出
- `src/lib/pledgeCalc.ts`:`computePledgeRatios(stakingItems, stockItems, stockQuotes, usdToTwd)` —— 從 `debt/page.tsx` 抽出,回傳 `{ platform, ratio, borrowValue, collateralValue }[]`

前端 Context 改為呼叫這些函式取代原本內嵌的計算(行為不變,純重構)。

`api/quote/route.ts` 內呼叫 yahoo-finance2 的邏輯抽成 `src/lib/quoteService.ts` 的 `getQuotes(symbols)`,含現有 60 秒快取與 inflight 去重,API route 與 cron 都呼叫它。

## 5. Cron 端點實作

`src/app/api/cron/daily-check/route.ts`:

- 驗證:讀 `Authorization` header,比對 `Bearer ${process.env.CRON_SECRET}`,不符回 401。Vercel 觸發自家 cron 時會自動帶上這個 header(需在 Vercel 專案環境變數設定 `CRON_SECRET`)。
- 檔案頂端加 `export const maxDuration = 60;`——Hobby 方案 function 預設逾時 10 秒,但可用此設定明確拉到 60 秒上限(Hobby 方案允許的最大值),幾乎零成本換到 6 倍餘裕,直接在本次實作做,不留到之後。
- 逐使用者處理包在 `try/catch`,單一使用者失敗(例如某股票代號查價失敗、SMTP 暫時錯誤)只記錄 log、不中斷整批。
- 回傳處理摘要 JSON(成功/失敗數量),方便日後查 Vercel cron 執行紀錄除錯。

`vercel.json`(新增):
```json
{
  "crons": [{ "path": "/api/cron/daily-check", "schedule": "0 1 * * *" }]
}
```

## 6. 前端變更

- `EmailReportSender.tsx`:移除「排程到期自動 fetch 寄信」的 `useEffect`(改由伺服器負責),保留「立即寄送」手動按鈕邏輯;寄送成功後改為呼叫新的 API 把 `lastReportSent` 寫回 `appState`(而非只寫 localStorage)。
- `debt/page.tsx`:移除「質押比過低自動 fetch 寄警示信」的 `useEffect`,保留 `PledgeAlertBanner` 畫面顯示邏輯(使用者開網頁時仍看得到警示橫幅,只是不再由前端觸發寄信)。
- `settingsService.ts` / `SettingsContext.tsx`:`lastReportSent` 改用既有的 `useSyncedState`(比照 `reportSchedule`、`pledgeAlertLastSent` 的模式),移除原本的 `useStickyState`(純本機)版本。

## 7. 錯誤處理與可觀察性

- 單一使用者處理失敗不影響其他使用者(try/catch 包每個使用者迴圈)。
- SMTP / 股價 API 失敗時記錄 `console.error`(含 userId,不含信箱等 PII),讓 Vercel 的 function log 可查。
- Hobby 方案搭配 `maxDuration = 60` 後有 60 秒可用:目前使用者數量小,單一使用者處理(DB 查詢 + 股價 API + SMTP)預期在 1-2 秒內,仍有充足餘裕。若未來使用者數大幅增加導致逼近 60 秒,需改成分批處理或改用 Vercel Pro / 外部排程觸發(記錄為已知限制,非本次範圍)。
- **appState 樂觀鎖版本衝突為預期行為,非 bug**:前端 `useSyncedState`/`AppStateContext` 用記憶體快取的 `version` 做樂觀鎖,cron 直接寫 DB 會讓某使用者當下的前端快取版本過期。此使用者之後在網頁上寫入同一個 key(例如手動按「立即寄送」寫回 `lastReportSent`)會收到 409,但 `AppStateContext.setValue` 既有邏輯會自動 `reload()` 並提示「資料已在其他裝置修改,已重新載入」——cron 在這個機制下等同於「另一台裝置」,行為與既有多裝置同步衝突完全一致。測試時看到這個 toast 屬正常現象,不代表故障。

## 8. 測試

- `src/lib/assetCalc.ts`、`cashflowCalc.ts`、`pledgeCalc.ts` 為純函式,直接單元測試(輸入資料 → 驗證輸出數值),涵蓋原有前端行為的邊界案例(空陣列、缺報價、USD 換算)。
- `daily-check` route 用整合測試方式:mock DB(比照現有 `src/db/testDb.ts` 的 pglite 測試資料庫)+ mock `getQuotes`/`sendEmail`,驗證到期判斷邏輯(該寄/不該寄)與寫回 `lastReportSent`/`pledgeAlertLastSent` 的行為。
- 手動驗證:設定 `CRON_SECRET`,本機用 `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily-check` 觸發,確認寄信與資料庫寫回正確。
