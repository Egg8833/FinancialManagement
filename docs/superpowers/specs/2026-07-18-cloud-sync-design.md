# 雲端同步與 Google 登入 — 設計文件

日期:2026-07-18
狀態:已與使用者確認方向,待實作

## 1. 背景與目標

目前所有資料(資產、負債、貸款、質押、股票、現金流…)都存在瀏覽器 localStorage,透過 `src/services/*` 讀寫,並有 JSON 匯出/匯入備份功能。限制是資料綁定單一瀏覽器,無法跨裝置,也無法開放給其他人使用。

目標:

1. 新增 **Google 登入**,登入後資料存到後端資料庫,可跨裝置同步。
2. **保留免登入訪客模式**:行為與現狀完全相同(localStorage + JSON 匯出/匯入),未登入使用者不受任何影響。
3. 架構要能支撐未來**開放給家人或網友使用**(多使用者、資料隔離)。
4. 以長期可維護性為優先:前端改為領域操作、後端細粒度 CRUD + 樂觀鎖,一步到位。

## 2. 技術選型(已確認)

| 項目 | 選擇 | 理由 |
|---|---|---|
| 部署 | Vercel | 專案現況即為 Next.js App Router,已有 cron route |
| 資料庫 | Neon Postgres(Vercel Marketplace) | Serverless、免費額度足夠、一鍵整合 |
| ORM | Drizzle ORM + drizzle-kit migration | 輕量、無 codegen、serverless 冷啟動友善 |
| 認證 | Auth.js(NextAuth v5)+ Google OAuth | 家人網友幾乎都有 Google 帳號,不用管密碼 |
| Session | JWT 策略 | API 請求不用每次查 DB |
| 驗證 | zod | API body 驗證 |

新增依賴:`next-auth@beta`、`drizzle-orm`、`@neondatabase/serverless`、`drizzle-kit`、`zod`。

環境變數:`DATABASE_URL`、`AUTH_SECRET`、`AUTH_GOOGLE_ID`、`AUTH_GOOGLE_SECRET`。

## 3. 整體架構

```
瀏覽器
 ├─ 訪客模式:Context → Repository(local) → localStorage(行為同現狀)
 └─ 登入模式:Context → Repository(remote) → /api/user/* Route Handlers
                                                 │ Auth.js session(JWT)驗證
                                                 ▼
                                           Drizzle ORM → Neon Postgres
```

- 兩種模式共用同一套 Repository 介面與 Context 領域操作,只有實作不同。
- 現有公開 API(`/api/quote`、`/api/dividends`、`/api/history`、`/api/twse-name`、cron)不受影響。
- 使用者資料 API 一律放在 `/api/user/*` 前綴之下,統一由 session 驗證保護。

## 4. 資料層設計

### 4.1 Repository 介面(CRUD 形狀)

每個領域一個介面,放在 `src/repositories/`。以資產為例:

```ts
interface AssetRepository {
  getAll(): Promise<AssetCategory[]>;
  create(category: AssetCategory): Promise<void>;
  update(id: string, patch: Partial<AssetCategory>, version: number): Promise<void>;
  remove(id: string): Promise<void>;
  replaceAll(data: AssetCategory[]): Promise<void>; // 僅供匯入/還原
}
```

- **local 實作**:把操作套用到記憶體陣列後寫 localStorage(包裝現有 `src/services/*` 邏輯),不做版本檢查(`version` 參數忽略)。
- **remote 實作**:呼叫 `/api/user/*` 細粒度端點;`update` 帶 `version`,收到 409 拋出 `ConflictError`。
- `RepositoryProvider` 依 Auth.js session 狀態提供 local 或 remote 實作;登入狀態切換時重新載入資料。

### 4.2 Context 改為領域操作

Context 不再對外暴露 `setAssets` 等整陣列 setter,改為意圖明確的領域操作:

```ts
interface AssetContextType {
  assets: AssetCategory[];
  loading: boolean;
  addCategory(category: AssetCategory): Promise<void>;
  updateCategory(id: string, patch: Partial<AssetCategory>): Promise<void>;
  removeCategory(id: string): Promise<void>;
  addItem(categoryId: string, item: AssetItem): Promise<void>;
  updateItem(categoryId: string, itemId: string, patch: Partial<AssetItem>): Promise<void>;
  removeItem(categoryId: string, itemId: string): Promise<void>;
  replaceAll(data: AssetCategory[]): Promise<void>; // 匯入流程專用
}
```

- 所有目前直接呼叫 setter 的元件,改為呼叫對應領域操作(全專案範圍重構,各 Context 同理:Loan、CashFlow、Stock、Settings)。
- **樂觀更新**:操作先更新畫面 → 背景呼叫 repository → 失敗回滾並 toast;收到 `ConflictError` 時提示「資料已在其他裝置修改」並重新拉取該領域資料。
- 登入模式初次載入為非同步,Context 提供 `loading` 狀態;訪客模式同步載入,`loading` 恆為 false。

## 5. API 設計

### 5.1 端點形狀

每種資料五個端點,同構設計。以資產為例:

```
GET    /api/user/assets          → 全部載入(每筆含 version)
POST   /api/user/assets          → 新增一筆
PATCH  /api/user/assets/:id      → 部分更新,body 帶 version,不符回 409
DELETE /api/user/assets/:id      → 刪除一筆
PUT    /api/user/assets          → 整批取代(僅匯入/還原用,transaction 內 delete+insert)
```

### 5.2 共用中介層

所有 `/api/user/*` handler 進入點依序:

1. `auth()` 驗 session,未登入回 401。
2. zod 驗證 body,失敗回 422。
3. **userId 一律取自 session**,不接受 client 傳入;所有查詢以 userId 過濾。

### 5.3 樂觀鎖

- 每張資料表都有 `version int`(每次更新 +1)與 `updated_at timestamptz`。
- `PATCH` 必須帶 client 目前持有的 `version`;DB 內 version 不符 → 409,不寫入。
- `POST` 重複 id → 409;`PATCH`/`DELETE` 找不到 → 404。

### 5.4 錯誤格式

統一為 `{ error: { code: string, message: string } }`,狀態碼使用 401 / 404 / 409 / 422 / 500。

## 6. 資料庫 Schema

### 6.1 Auth.js 標準表

`users`、`accounts`(Drizzle Adapter 標準 schema;JWT session 策略,不需要 sessions 表)。

### 6.2 使用者資料表

每個領域一張表,共同欄位:

```
user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE
id          text NOT NULL              -- 沿用 client 端產生的 id
version     int  NOT NULL DEFAULT 1
updated_at  timestamptz NOT NULL DEFAULT now()
PRIMARY KEY (user_id, id)
```

實體內容以現有 `src/types.ts` 型別為準,巢狀結構(如 `AssetCategory.items`)以 jsonb 欄位儲存,不再往下拆表——樂觀鎖以「一筆記錄」為單位已足夠,避免過度正規化。

各階段資料表:

| 階段 | 資料表 | 對應型別 / localStorage key |
|---|---|---|
| 1 | `assets` | `AssetCategory`(`app-assets-v1`) |
| 1 | `liabilities` | `LiabilityItem`(`app-liabilities-v1`) |
| 1 | `snapshots` | `AssetSnapshot`(`app-snapshots-v1`) |
| 2 | `loans` | `LoanItem` |
| 2 | `staking_items` | `StakingItem` |
| 2 | `user_settings` | 借款額度等單值設定(key-value jsonb) |
| 3 | `stock_items` | `StockItem`(含歷史持有) |
| 3 | `monthly_records` | `MonthRecord` |
| 3 | `cashflow_templates` | `CashflowTemplate` |
| 3 | `annual_entries` | `AnnualEntry` |
| 3 | `custom_categories` | 自訂分類 |
| 3 | `financial_goals` | `FinancialGoal`(清單,獨立成表) |
| 3 | (併入 `user_settings`) | `FireSettings` 等單值設定 |

migration 一律用 drizzle-kit 產生與管理。

## 7. 登入與首次匯入流程

1. Navbar 加登入按鈕(Google);登入後顯示頭像與登出。
2. 登入成功 → `GET /api/user/summary`(回傳雲端各領域是否有資料)。
3. **雲端空 + 本地有資料** → 彈窗:「要把這台電腦的資料匯入帳號嗎?」確認後以各領域 `PUT`(replaceAll)上傳。
4. **雲端已有資料** → 直接以雲端為主;不自動合併。
5. 本地訪客資料永遠保留不動:登出後回訪客模式,原資料仍在。
6. 現有 JSON 匯出/匯入功能兩種模式都保留;登入時匯入 = 寫到雲端(replaceAll)。

## 8. 分階段上線

| 階段 | 內容 | 驗收 |
|---|---|---|
| Phase 1 | Auth.js + Google 登入、DB 基礎建設(Drizzle、migration)、Repository 骨架與 Provider、資產/負債/快照完整 CRUD、首登匯入流程 | 登入後資產頁跨裝置同步;訪客模式行為不變 |
| Phase 2 | 貸款、質押、借款額度 | 負債管理頁雲端同步 |
| Phase 3 | 股票、月度現金流、年度項目、自訂分類、目標與 FIRE 設定 | 全站雲端同步 |

每階段內尚未遷移的領域,登入模式下暫時仍走 local repository(讀寫 localStorage),不另加 UI 標示;匯出功能維持涵蓋全部資料。

## 9. 測試策略

- **Repository 契約測試**:local 與 remote 實作跑同一套行為測試,保證兩種模式語意一致(remote 以 mock fetch 驗證)。
- **Route handler 測試**:權限隔離(使用者 A 拿不到 B 的資料)、401 未登入、409 版本衝突、422 驗證失敗。
- **Context 單元測試**:樂觀更新成功路徑、失敗回滾、Conflict 重拉。
- 既有測試(fireCalc、healthScore、categoryUtils 等)不受影響。
- 工具沿用 Vitest。

## 10. 明確不做(YAGNI)

- 不做帳號密碼 / Email 登入(只有 Google)。
- 不做多裝置即時推播同步(靠載入時拉取 + 樂觀鎖擋衝突)。
- 不做離線佇列(登入模式下 API 失敗即回滾提示,不排隊重送)。
- 不做資料分享 / 家庭共享帳本(未來需求,本次只做多使用者隔離)。
- 不做 audit log(schema 的 version/updated_at 已為未來留路)。
