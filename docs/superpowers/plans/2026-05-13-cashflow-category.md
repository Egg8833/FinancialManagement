# Cashflow 類別分析升級 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 cashflow 頁加入自訂類別系統，並新增「類別分析」tab 含甜甜圈圖與堆疊柱狀圖。

**Architecture:** `CashFlowItem` 加 `customCategory?: string` 欄位；`AppContext` 管理 `customCategories: string[]` 清單（localStorage）；cashflow page 重組為 3 tabs（收支管理 / 50-30-20 / 類別分析）；純函式抽取至 `src/lib/categoryUtils.ts` 便於測試。

**Tech Stack:** Next.js 14, TypeScript, Recharts (PieChart donut + stacked BarChart), Vitest

---

## File Structure

| 動作 | 檔案 | 負責 |
|------|------|------|
| Modify | `src/context/AppContext.tsx` | `CashFlowItem` 加 `customCategory`；新增 `customCategories` state |
| Modify | `src/components/DataManager.tsx` | export/import 加入 `customCategories` |
| **Create** | `src/lib/categoryUtils.ts` | 純函式：`buildDonutData`, `buildCategoryMonthData`, `getCategoryColor` |
| **Create** | `src/lib/categoryUtils.test.ts` | 上述純函式的 Vitest 測試 |
| Modify | `src/app/cashflow/page.tsx` | 3-tab 結構、表單加 category select、新 `CategoryAnalysisTab` |

---

## Task 1: AppContext — CashFlowItem + customCategories

**Files:**
- Modify: `src/context/AppContext.tsx`

- [ ] **Step 1: 在 `CashFlowItem` type 加入 `customCategory` 欄位**

找到 `CashFlowItem` type（約 line 186）：

```ts
export type CashFlowItem = {
  id: string;
  name: string;
  amount: number;
  category: string;
  isRecurring: boolean;
  budget?: number;
  expenseTag?: 'needs' | 'wants' | 'savings';
  customCategory?: string;   // 新增：用戶自訂類別，undefined = 不分類
};
```

- [ ] **Step 2: 在 `AppContextType` interface 加入新欄位**

找到 `interface AppContextType {`（約 line 217），在 `goals / setGoals` 後加入：

```ts
  // 自訂類別
  customCategories: string[];
  setCustomCategories: (cats: string[] | ((prev: string[]) => string[])) => void;
```

- [ ] **Step 3: 在 `AppProvider` 加入常數與 state**

在 `AppProvider` 函式頂部（`const [showValues` 之前）加入常數：

```ts
const DEFAULT_CATEGORIES = ['餐飲', '交通', '房租', '娛樂', '醫療', '購物', '其他'];
```

然後在既有的 `const [goals, setGoals]` 行後加入：

```ts
const [customCategories, setCustomCategories] = useStickyState<string[]>(DEFAULT_CATEGORIES, 'app-custom-categories-v1');
```

- [ ] **Step 4: 在 `clearAllData` 重置 `customCategories`**

找到 `const clearAllData = () => {`，在 `setGoals([]);` 後加入：

```ts
setCustomCategories(DEFAULT_CATEGORIES);
```

- [ ] **Step 5: 在 Provider value 加入 `customCategories` 和 `setCustomCategories`**

找到 `<AppContext.Provider value={{`，在 `goals, setGoals,` 後加入：

```ts
customCategories,
setCustomCategories,
```

- [ ] **Step 6: 確認 TypeScript 無錯誤**

```bash
npx tsc --noEmit
```

預期：無錯誤輸出。

- [ ] **Step 7: Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "feat(cashflow): add customCategory to CashFlowItem and customCategories state"
```

---

## Task 2: DataManager — backup/restore 加入 customCategories

**Files:**
- Modify: `src/components/DataManager.tsx`

- [ ] **Step 1: 在 `handleExport` 的 data 物件加入 `customCategories`**

找到 `handleExport` 函式中的 `const data = {`，在 `borrowingLimits: ctx.borrowingLimits,` 後加入：

```ts
customCategories: ctx.customCategories,
```

- [ ] **Step 2: 在 `handleImport` 加入 `customCategories` 還原**

找到 `if (data.borrowingLimits != null)` 行，在其後加入：

```ts
if (data.customCategories) ctx.setCustomCategories(data.customCategories);
```

- [ ] **Step 3: Commit**

```bash
git add src/components/DataManager.tsx
git commit -m "feat(cashflow): include customCategories in backup export/import"
```

---

## Task 3: categoryUtils — 純函式 + Vitest 測試

**Files:**
- Create: `src/lib/categoryUtils.ts`
- Create: `src/lib/categoryUtils.test.ts`

- [ ] **Step 1: 先寫失敗的測試**

建立 `src/lib/categoryUtils.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import {
  buildDonutData,
  buildCategoryMonthData,
  getCategoryColor,
  CATEGORY_COLORS,
  UNCATEGORIZED_COLOR,
} from './categoryUtils';

describe('buildDonutData', () => {
  it('groups expenses by customCategory and sorts by value desc', () => {
    const items = [
      { customCategory: '餐飲', amount: 5000 },
      { customCategory: '交通', amount: 2000 },
      { customCategory: '餐飲', amount: 3000 },
    ];
    const result = buildDonutData(items);
    expect(result).toEqual([
      { name: '餐飲', value: 8000 },
      { name: '交通', value: 2000 },
    ]);
  });

  it('groups items without customCategory as 未分類', () => {
    const items = [
      { amount: 1000 },
      { customCategory: undefined, amount: 2000 },
    ];
    const result = buildDonutData(items);
    expect(result).toEqual([{ name: '未分類', value: 3000 }]);
  });

  it('filters out zero-value categories', () => {
    const result = buildDonutData([]);
    expect(result).toEqual([]);
  });
});

describe('buildCategoryMonthData', () => {
  it('returns exactly 12 data points', () => {
    const result = buildCategoryMonthData([]);
    expect(result).toHaveLength(12);
  });

  it('each point has a label string', () => {
    const result = buildCategoryMonthData([]);
    result.forEach(r => expect(typeof r.label).toBe('string'));
  });

  it('accumulates same category amounts across items', () => {
    const items = [
      { customCategory: '餐飲', amount: 5000 },
      { customCategory: '餐飲', amount: 3000 },
    ];
    const result = buildCategoryMonthData(items);
    result.forEach(r => expect(r['餐飲']).toBe(8000));
  });

  it('groups uncategorised items as 未分類', () => {
    const items = [{ amount: 4000 }];
    const result = buildCategoryMonthData(items);
    result.forEach(r => expect(r['未分類']).toBe(4000));
  });
});

describe('getCategoryColor', () => {
  it('returns the correct indexed color for a known category', () => {
    const cats = ['餐飲', '交通'];
    expect(getCategoryColor('餐飲', cats)).toBe(CATEGORY_COLORS[0]);
    expect(getCategoryColor('交通', cats)).toBe(CATEGORY_COLORS[1]);
  });

  it('wraps around when index exceeds CATEGORY_COLORS length', () => {
    const cats = Array.from({ length: 12 }, (_, i) => `cat${i}`);
    expect(getCategoryColor('cat11', cats)).toBe(CATEGORY_COLORS[11 % CATEGORY_COLORS.length]);
  });

  it('returns UNCATEGORIZED_COLOR for unknown category', () => {
    expect(getCategoryColor('未知', [])).toBe(UNCATEGORIZED_COLOR);
    expect(getCategoryColor('未知', ['餐飲'])).toBe(UNCATEGORIZED_COLOR);
  });
});
```

- [ ] **Step 2: 執行測試，確認失敗**

```bash
npx vitest run src/lib/categoryUtils.test.ts
```

預期：FAIL（`categoryUtils` 不存在）。

- [ ] **Step 3: 建立 `src/lib/categoryUtils.ts` 實作**

```ts
export const CATEGORY_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
  '#84cc16', '#f97316', '#94a3b8',
] as const;

export const UNCATEGORIZED_COLOR = '#d1d5db';

type MinimalItem = { customCategory?: string; amount: number };

export function buildDonutData(
  expenseItems: MinimalItem[]
): { name: string; value: number }[] {
  const map: Record<string, number> = {};
  for (const item of expenseItems) {
    const cat = item.customCategory ?? '未分類';
    map[cat] = (map[cat] ?? 0) + item.amount;
  }
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function buildCategoryMonthData(
  expenseItems: MinimalItem[],
  referenceDate: Date = new Date()
): Record<string, number | string>[] {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 11 + i, 1);
    const label = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const row: Record<string, number | string> = { label };
    for (const item of expenseItems) {
      const cat = item.customCategory ?? '未分類';
      row[cat] = ((row[cat] as number) ?? 0) + item.amount;
    }
    return row;
  });
}

export function getCategoryColor(cat: string, categories: string[]): string {
  const idx = categories.indexOf(cat);
  return idx >= 0 ? CATEGORY_COLORS[idx % CATEGORY_COLORS.length] : UNCATEGORIZED_COLOR;
}
```

- [ ] **Step 4: 執行測試，確認全部通過**

```bash
npx vitest run src/lib/categoryUtils.test.ts
```

預期：全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/categoryUtils.ts src/lib/categoryUtils.test.ts
git commit -m "feat(cashflow): add categoryUtils pure functions with tests"
```

---

## Task 4: cashflow/page.tsx — 擴展 handlers + 3-tab 結構

**Files:**
- Modify: `src/app/cashflow/page.tsx`

- [ ] **Step 1: 更新 import — 加入 recharts PieChart 與 categoryUtils**

找到 `import { BarChart, Bar, ...` 這行，改為：

```ts
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell,
} from 'recharts';
```

然後在現有 import 區域末尾加入：

```ts
import {
  CATEGORY_COLORS, UNCATEGORIZED_COLOR,
  buildDonutData, buildCategoryMonthData, getCategoryColor,
} from '../../lib/categoryUtils';
```

- [ ] **Step 2: 更新 `useAppContext` 解構，加入 `customCategories` 和 `setCustomCategories`**

找到 `const { incomeItems, setIncomeItems, ...` 解構，加入：

```ts
customCategories, setCustomCategories,
```

- [ ] **Step 3: 更新 `handleAddItem` 簽名與實作**

將原本的：

```ts
const handleAddItem = (type: 'income' | 'expense', name: string, amount: number, budget?: number, expenseTag?: CashFlowItem['expenseTag']) => {
  const newItem: CashFlowItem = {
    id: Date.now().toString(),
    name,
    amount,
    category: 'General',
    isRecurring: true,
    budget,
    expenseTag,
  };
```

改為：

```ts
const handleAddItem = (type: 'income' | 'expense', name: string, amount: number, budget?: number, expenseTag?: CashFlowItem['expenseTag'], customCategory?: string) => {
  const newItem: CashFlowItem = {
    id: Date.now().toString(),
    name,
    amount,
    category: 'General',
    isRecurring: true,
    budget,
    expenseTag,
    customCategory,
  };
```

- [ ] **Step 4: 更新 `handleUpdateItem` 簽名與實作**

將原本的：

```ts
const handleUpdateItem = (type: 'income' | 'expense', id: string, name: string, amount: number, budget?: number, expenseTag?: CashFlowItem['expenseTag']) => {
  const updateFn = (prev: CashFlowItem[]) =>
    prev.map(item => item.id === id ? { ...item, name, amount, budget, expenseTag } : item);
```

改為：

```ts
const handleUpdateItem = (type: 'income' | 'expense', id: string, name: string, amount: number, budget?: number, expenseTag?: CashFlowItem['expenseTag'], customCategory?: string) => {
  const updateFn = (prev: CashFlowItem[]) =>
    prev.map(item => item.id === id ? { ...item, name, amount, budget, expenseTag, customCategory } : item);
```

- [ ] **Step 5: 在 `CashFlowPage` 函式內加入 `activeTab` state**

在 `const [isAddingIncome, ...` 後加入：

```ts
const [activeTab, setActiveTab] = useState<'flow' | 'analysis50' | 'category'>('flow');
```

- [ ] **Step 6: 在 JSX 頁面標題後加入 tab bar**

找到 `{/* Summary KPI */}` 區塊前，加入：

```tsx
{/* Tab Bar */}
<div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
  {(['flow', 'analysis50', 'category'] as const).map(tab => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        activeTab === tab
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {tab === 'flow' ? '收支管理' : tab === 'analysis50' ? '50/30/20' : '類別分析'}
    </button>
  ))}
</div>
```

- [ ] **Step 7: 用 tab 條件包住現有內容**

將 `{/* Summary KPI */}` 開始，到 `</div>` 結束的整個收支列表包進：

```tsx
{activeTab === 'flow' && (<>
  {/* Summary KPI */}
  ...（現有 KPI 卡片）
  ...（現有 income/expense 列表）
</>)}
```

將 50/30/20 分析區塊和 AnnualTracker 和 12-month trend chart 包進：

```tsx
{activeTab === 'analysis50' && (<>
  {/* 50/30/20 分析 */}
  {hasTaggedItems && ( ... )}
  <AnnualTracker />
  {/* 12-month trend chart */}
  <div className="mt-6 ...">...</div>
</>)}
```

在最後加入：

```tsx
{activeTab === 'category' && (
  <CategoryAnalysisTab
    expenseItems={expenseItems}
    customCategories={customCategories}
    setCustomCategories={setCustomCategories}
    setExpenseItems={setExpenseItems}
    showValues={showValues}
  />
)}
```

- [ ] **Step 8: 更新 JSX 中呼叫 `AddItemRow` 和 `CashFlowRow` 的 callback，傳入 `customCategories` 和 `c` 參數**

對 income `AddItemRow`：

```tsx
<AddItemRow
  type="income"
  customCategories={customCategories}
  onConfirm={(n, a) => { handleAddItem('income', n, a); setIsAddingIncome(false); }}
  onCancel={() => setIsAddingIncome(false)}
/>
```

對 expense `AddItemRow`：

```tsx
<AddItemRow
  type="expense"
  customCategories={customCategories}
  onConfirm={(n, a, b, t, c) => { handleAddItem('expense', n, a, b, t, c); setIsAddingExpense(false); }}
  onCancel={() => setIsAddingExpense(false)}
/>
```

對 income `CashFlowRow`：

```tsx
<CashFlowRow
  key={item.id}
  item={item}
  type="income"
  customCategories={customCategories}
  onUpdate={(n, a, b, t, c) => handleUpdateItem('income', item.id, n, a, b, t, c)}
  onDelete={() => handleDeleteItem('income', item.id)}
  showValues={showValues}
/>
```

對 expense `CashFlowRow`：

```tsx
<CashFlowRow
  key={item.id}
  item={item}
  type="expense"
  customCategories={customCategories}
  onUpdate={(n, a, b, t, c) => handleUpdateItem('expense', item.id, n, a, b, t, c)}
  onDelete={() => handleDeleteItem('expense', item.id)}
  showValues={showValues}
/>
```

- [ ] **Step 9: Commit**

```bash
git add src/app/cashflow/page.tsx
git commit -m "feat(cashflow): add 3-tab structure and extend item handlers for customCategory"
```

---

## Task 5: CashFlowRow + AddItemRow — customCategory 欄位

**Files:**
- Modify: `src/app/cashflow/page.tsx`（繼續）

- [ ] **Step 1: 更新 `CashFlowRow` props interface**

找到 `function CashFlowRow({` 的 props type，改為：

```ts
function CashFlowRow({
  item,
  type,
  onUpdate,
  onDelete,
  showValues,
  customCategories,
}: {
  item: CashFlowItem;
  type: 'income' | 'expense';
  onUpdate: (n: string, a: number, b?: number, t?: CashFlowItem['expenseTag'], c?: string) => void;
  onDelete: () => void;
  showValues: boolean;
  customCategories: string[];
})
```

- [ ] **Step 2: 在 `CashFlowRow` 函式內加入 `customCategory` state**

在 `const [expenseTag, setExpenseTag]` 行後加入：

```ts
const [customCategory, setCustomCategory] = useState<string | undefined>(item.customCategory);
```

- [ ] **Step 3: 更新 `handleSave` 傳遞 `customCategory`**

將：

```ts
onUpdate(name, Number(amount) || 0, budget ? Number(budget) : undefined, expenseTag);
```

改為：

```ts
onUpdate(name, Number(amount) || 0, budget ? Number(budget) : undefined, expenseTag, customCategory);
```

- [ ] **Step 4: 在 edit mode 加入 category select（expense only）**

找到 edit mode 中 expense 欄位區塊（`{type === 'expense' && (`），在 `expenseTag` 按鈕群組後加入：

```tsx
<select
  value={customCategory ?? ''}
  onChange={e => setCustomCategory(e.target.value || undefined)}
  className="text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-indigo-300 bg-white"
>
  <option value="">不分類</option>
  {customCategories.map(cat => (
    <option key={cat} value={cat}>{cat}</option>
  ))}
</select>
```

- [ ] **Step 5: 在 view mode 顯示 customCategory chip**

找到 view mode 中顯示 `item.expenseTag` chip 的地方（`{item.expenseTag && (`），在其後加入：

```tsx
{item.customCategory && (
  <span
    className="px-1.5 py-0.5 rounded text-[10px] font-bold"
    style={{
      backgroundColor: `${getCategoryColor(item.customCategory, customCategories)}20`,
      color: getCategoryColor(item.customCategory, customCategories),
    }}
  >
    {item.customCategory}
  </span>
)}
```

- [ ] **Step 6: 更新 `AddItemRow` props interface**

找到 `function AddItemRow({` 的 props type，改為：

```ts
function AddItemRow({
  type,
  onConfirm,
  onCancel,
  customCategories,
}: {
  type: 'income' | 'expense';
  onConfirm: (n: string, a: number, b?: number, t?: CashFlowItem['expenseTag'], c?: string) => void;
  onCancel: () => void;
  customCategories: string[];
})
```

- [ ] **Step 7: 在 `AddItemRow` 函式內加入 `customCategory` state**

在 `const [expenseTag, setExpenseTag]` 行後加入：

```ts
const [customCategory, setCustomCategory] = useState<string | undefined>(undefined);
```

- [ ] **Step 8: 更新 `AddItemRow` 的 onConfirm call 傳遞 `customCategory`**

找到：

```ts
onClick={() => onConfirm(name, Number(amount) || 0, budget ? Number(budget) : undefined, expenseTag)}
```

改為：

```ts
onClick={() => onConfirm(name, Number(amount) || 0, budget ? Number(budget) : undefined, expenseTag, customCategory)}
```

- [ ] **Step 9: 在 `AddItemRow` expense 欄位加入 category select**

在 expenseTag 按鈕群組後加入：

```tsx
<select
  value={customCategory ?? ''}
  onChange={e => setCustomCategory(e.target.value || undefined)}
  className="text-xs border border-indigo-200 rounded px-2 py-1 outline-none bg-white"
>
  <option value="">不分類</option>
  {customCategories.map(cat => (
    <option key={cat} value={cat}>{cat}</option>
  ))}
</select>
```

- [ ] **Step 10: TypeScript check**

```bash
npx tsc --noEmit
```

預期：無錯誤。

- [ ] **Step 11: Commit**

```bash
git add src/app/cashflow/page.tsx
git commit -m "feat(cashflow): add customCategory field to expense form rows"
```

---

## Task 6: CategoryAnalysisTab — 類別管理 + 甜甜圈 + 堆疊柱狀圖

**Files:**
- Modify: `src/app/cashflow/page.tsx`（繼續）

- [ ] **Step 1: 在 cashflow/page.tsx 最底部（`AutoStakingExpenseRow` 之後）加入 `CategoryManager` 元件**

```tsx
function CategoryManager({
  customCategories,
  setCustomCategories,
  setExpenseItems,
}: {
  customCategories: string[];
  setCustomCategories: (cats: string[] | ((prev: string[]) => string[])) => void;
  setExpenseItems: (fn: (prev: CashFlowItem[]) => CashFlowItem[]) => void;
}) {
  const [newCat, setNewCat] = useState('');
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleAdd = () => {
    const trimmed = newCat.trim();
    if (!trimmed || customCategories.includes(trimmed)) return;
    setCustomCategories(prev => [...prev, trimmed]);
    setNewCat('');
  };

  const handleDelete = (cat: string) => {
    setCustomCategories(prev => prev.filter(c => c !== cat));
    setExpenseItems(prev =>
      prev.map(item => item.customCategory === cat ? { ...item, customCategory: undefined } : item)
    );
  };

  const handleRename = (oldName: string) => {
    const trimmed = editValue.trim();
    if (!trimmed || (trimmed !== oldName && customCategories.includes(trimmed))) return;
    setCustomCategories(prev => prev.map(c => c === oldName ? trimmed : c));
    setExpenseItems(prev =>
      prev.map(item => item.customCategory === oldName ? { ...item, customCategory: trimmed } : item)
    );
    setEditingCat(null);
  };

  return (
    <div className="mb-6">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">類別管理</p>
      <div className="flex flex-wrap gap-2 items-center">
        {customCategories.map((cat, i) =>
          editingCat === cat ? (
            <div key={cat} className="flex items-center gap-1">
              <input
                autoFocus
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRename(cat);
                  if (e.key === 'Escape') setEditingCat(null);
                }}
                className="text-xs border border-indigo-300 rounded px-2 py-0.5 w-20 outline-none"
              />
              <button onClick={() => handleRename(cat)} className="text-indigo-600 hover:text-indigo-800">
                <Check className="w-3 h-3" />
              </button>
              <button onClick={() => setEditingCat(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div
              key={cat}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}20`,
                color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
              }}
            >
              <span
                className="cursor-pointer"
                onDoubleClick={() => { setEditingCat(cat); setEditValue(cat); }}
              >
                {cat}
              </span>
              <button
                onClick={() => { setEditingCat(cat); setEditValue(cat); }}
                className="opacity-50 hover:opacity-100 ml-0.5"
              >
                <Pencil className="w-2.5 h-2.5" />
              </button>
              <button
                onClick={() => handleDelete(cat)}
                className="opacity-50 hover:opacity-100"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )
        )}
        <div className="flex items-center gap-1">
          <input
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="新增類別"
            className="text-xs border border-gray-200 rounded px-2 py-0.5 w-20 outline-none focus:border-indigo-300"
          />
          <button
            onClick={handleAdd}
            className="text-indigo-600 hover:text-indigo-800"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 在 `CategoryManager` 後加入 `CategoryAnalysisTab` 元件**

```tsx
function CategoryAnalysisTab({
  expenseItems,
  customCategories,
  setCustomCategories,
  setExpenseItems,
  showValues,
}: {
  expenseItems: CashFlowItem[];
  customCategories: string[];
  setCustomCategories: (cats: string[] | ((prev: string[]) => string[])) => void;
  setExpenseItems: (fn: (prev: CashFlowItem[]) => CashFlowItem[]) => void;
  showValues: boolean;
}) {
  const donutData = useMemo(() => buildDonutData(expenseItems), [expenseItems]);

  const categoryMonthData = useMemo(
    () => buildCategoryMonthData(expenseItems),
    [expenseItems]
  );

  const allCats = useMemo(() => {
    const set = new Set<string>();
    for (const item of expenseItems) set.add(item.customCategory ?? '未分類');
    return Array.from(set);
  }, [expenseItems]);

  return (
    <div className="space-y-6 mt-2">
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <CategoryManager
          customCategories={customCategories}
          setCustomCategories={setCustomCategories}
          setExpenseItems={setExpenseItems}
        />

        {donutData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-gray-400">
            尚無支出項目，請在「收支管理」tab 新增支出並設定類別
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 甜甜圈圖 */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 text-center">
                當月佔比
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {donutData.map((entry, i) => {
                      const color = entry.name === '未分類'
                        ? UNCATEGORIZED_COLOR
                        : getCategoryColor(entry.name, customCategories);
                      return <Cell key={entry.name} fill={color} />;
                    })}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      showValues ? `NT$${v.toLocaleString()}` : '****',
                      name,
                    ]}
                    contentStyle={{ borderRadius: 8, fontSize: 11 }}
                  />
                  <Legend
                    formatter={name => {
                      const d = donutData.find(x => x.name === name);
                      const total = donutData.reduce((s, x) => s + x.value, 0);
                      const pct = total > 0 && d ? ((d.value / total) * 100).toFixed(0) : '0';
                      return `${name} ${pct}%`;
                    }}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 堆疊柱狀圖 */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 text-center">
                近 12 個月趨勢
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryMonthData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={v => showValues ? `${(v / 1000).toFixed(0)}K` : ''}
                    width={35}
                  />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      showValues ? `NT$${v.toLocaleString()}` : '****',
                      name,
                    ]}
                    contentStyle={{ borderRadius: 8, fontSize: 11 }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  {allCats.map(cat => {
                    const color = cat === '未分類'
                      ? UNCATEGORIZED_COLOR
                      : getCategoryColor(cat, customCategories);
                    return (
                      <Bar
                        key={cat}
                        dataKey={cat}
                        stackId="a"
                        fill={color}
                        radius={allCats.indexOf(cat) === allCats.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                      />
                    );
                  })}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

預期：無錯誤。

- [ ] **Step 4: 執行全部測試**

```bash
npx vitest run
```

預期：所有測試 PASS（包含原有 `healthScore.test.ts`、`fireCalc.test.ts` 及新的 `categoryUtils.test.ts`）。

- [ ] **Step 5: 最終 commit**

```bash
git add src/app/cashflow/page.tsx
git commit -m "feat(cashflow): add CategoryAnalysisTab with donut chart and stacked bar chart"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - `customCategory` 欄位 → Task 1
  - `customCategories` 自訂清單 → Task 1
  - DataManager backup/restore → Task 2
  - 類別管理（新增/重新命名/刪除） → Task 6 `CategoryManager`
  - 3-tab 結構 → Task 4
  - expense form 加 category select → Task 5
  - 甜甜圈圖 → Task 6
  - 堆疊柱狀圖 → Task 6
  - 刪除類別同步清除 items → Task 6 `handleDelete`
  - 重新命名同步更新 items → Task 6 `handleRename`

- [x] **Placeholder scan:** 無 TBD / TODO。

- [x] **Type consistency:**
  - `onUpdate` / `onConfirm` 五個參數（n, a, b?, t?, c?）全程一致
  - `customCategory?: string` 在 `CashFlowItem`、state、handler 全程一致
  - `CATEGORY_COLORS` 由 `categoryUtils.ts` export，在 `CategoryManager` 與 `CategoryAnalysisTab` 均 import 同一來源
