# 財務目標自動連結資產 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓財務目標可連結特定 asset items，`currentAmount` 自動從連結 items 加總，無需手動更新。

**Architecture:** 在 `FinancialGoal` 型別新增 `linkedAssetItemIds?: string[]`。渲染時 `resolveCurrentAmount()` 即時計算 derived 進度（有連結）或回傳手動值（無連結）。UI 層強制每個 item 只能被一個目標佔用（disabled + 標示）。

**Tech Stack:** TypeScript, React hooks (`useState`), Vitest, Tailwind CSS

---

## File Structure

| 檔案 | 角色 |
|------|------|
| `src/lib/goalUtils.ts` | 新增：`resolveCurrentAmount`、`getLinkedItemIds` 純函數 |
| `src/lib/goalUtils.test.ts` | 新增：8 個 Vitest 測試 |
| `src/context/AppContext.tsx` | 修改：`FinancialGoal` 加 `linkedAssetItemIds?: string[]`（第 138–146 行） |
| `src/components/FinancialGoals.tsx` | 修改：GoalCard props/state/view/edit + FinancialGoals isAdding 表單 |

---

### Task 1: goalUtils.ts — pure helper functions + Vitest tests

**Files:**
- Create: `src/lib/goalUtils.ts`
- Create: `src/lib/goalUtils.test.ts`

- [ ] **Step 1: 建立測試檔（先寫失敗的測試）**

建立 `src/lib/goalUtils.test.ts`，內容如下：

```ts
import { describe, it, expect } from 'vitest';
import { resolveCurrentAmount, getLinkedItemIds } from './goalUtils';
import type { FinancialGoal } from '../context/AppContext';
import type { AssetCategory } from '../types';

const mkGoal = (overrides: Partial<FinancialGoal> = {}): FinancialGoal => ({
  id: 'g1', name: 'Test', targetAmount: 100000, currentAmount: 50000,
  color: '#6366f1', icon: 'other', ...overrides,
});

const mkAssets = (): AssetCategory[] => [
  {
    id: 'liquid', title: '流動資金', description: '', colorClass: '', bgClass: '', updatedAt: '',
    items: [
      { id: 'a1', name: '銀行活存', amount: 300000 },
      { id: 'a2', name: '支付寶', amount: 150000 },
    ],
  },
  {
    id: 'investment', title: '投資', description: '', colorClass: '', bgClass: '', updatedAt: '',
    items: [
      { id: 'a3', name: '加密貨幣', amount: 100000 },
    ],
  },
];

describe('resolveCurrentAmount', () => {
  it('returns currentAmount when linkedAssetItemIds is undefined', () => {
    const goal = mkGoal({ currentAmount: 50000 });
    expect(resolveCurrentAmount(goal, mkAssets())).toBe(50000);
  });

  it('returns currentAmount when linkedAssetItemIds is empty array', () => {
    const goal = mkGoal({ currentAmount: 50000, linkedAssetItemIds: [] });
    expect(resolveCurrentAmount(goal, mkAssets())).toBe(50000);
  });

  it('sums linked asset items when linkedAssetItemIds is set', () => {
    const goal = mkGoal({ linkedAssetItemIds: ['a1', 'a3'] });
    expect(resolveCurrentAmount(goal, mkAssets())).toBe(400000);
  });

  it('silently skips orphan ids', () => {
    const goal = mkGoal({ linkedAssetItemIds: ['a1', 'orphan-id'] });
    expect(resolveCurrentAmount(goal, mkAssets())).toBe(300000);
  });
});

describe('getLinkedItemIds', () => {
  it('returns ids linked by a single goal', () => {
    const goals = [mkGoal({ id: 'g1', linkedAssetItemIds: ['a1', 'a2'] })];
    expect(getLinkedItemIds(goals)).toEqual(new Set(['a1', 'a2']));
  });

  it('excludes ids from the specified goal', () => {
    const goals = [mkGoal({ id: 'g1', linkedAssetItemIds: ['a1', 'a2'] })];
    expect(getLinkedItemIds(goals, 'g1')).toEqual(new Set());
  });

  it('aggregates ids from multiple goals excluding specified', () => {
    const goals = [
      mkGoal({ id: 'g1', linkedAssetItemIds: ['a1'] }),
      mkGoal({ id: 'g2', linkedAssetItemIds: ['a2', 'a3'] }),
    ];
    expect(getLinkedItemIds(goals, 'g1')).toEqual(new Set(['a2', 'a3']));
  });

  it('returns empty set when no goals have links', () => {
    const goals = [mkGoal({ id: 'g1' })];
    expect(getLinkedItemIds(goals)).toEqual(new Set());
  });
});
```

- [ ] **Step 2: 執行測試，確認全部失敗**

```
npx vitest run src/lib/goalUtils.test.ts
```

預期：FAIL，錯誤訊息 `Cannot find module './goalUtils'`

- [ ] **Step 3: 建立實作檔**

建立 `src/lib/goalUtils.ts`，內容如下：

```ts
import type { FinancialGoal } from '../context/AppContext';
import type { AssetCategory } from '../types';

export function resolveCurrentAmount(goal: FinancialGoal, assets: AssetCategory[]): number {
  if (!goal.linkedAssetItemIds?.length) return goal.currentAmount;
  const allItems = assets.flatMap(cat => cat.items);
  return goal.linkedAssetItemIds.reduce((sum, id) => {
    const item = allItems.find(i => i.id === id);
    return sum + (item?.amount ?? 0);
  }, 0);
}

export function getLinkedItemIds(goals: FinancialGoal[], excludeGoalId?: string): Set<string> {
  return new Set(
    goals
      .filter(g => g.id !== excludeGoalId)
      .flatMap(g => g.linkedAssetItemIds ?? [])
  );
}
```

- [ ] **Step 4: 執行測試，確認全部通過**

```
npx vitest run src/lib/goalUtils.test.ts
```

預期：8 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/goalUtils.ts src/lib/goalUtils.test.ts
git commit -m "feat(goals): add goalUtils pure helpers with tests"
```

---

### Task 2: AppContext.tsx — 新增 linkedAssetItemIds 欄位

**Files:**
- Modify: `src/context/AppContext.tsx:138-146`

- [ ] **Step 1: 在 FinancialGoal 型別新增欄位**

找到 `src/context/AppContext.tsx` 第 138–146 行，目前內容：

```ts
export type FinancialGoal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string; // YYYY-MM-DD
  color: string;
  icon: 'home' | 'car' | 'travel' | 'emergency' | 'retirement' | 'education' | 'other';
};
```

改為：

```ts
export type FinancialGoal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string; // YYYY-MM-DD
  color: string;
  icon: 'home' | 'car' | 'travel' | 'emergency' | 'retirement' | 'education' | 'other';
  linkedAssetItemIds?: string[];
};
```

- [ ] **Step 2: TypeScript 型別檢查**

```
npx tsc --noEmit
```

預期：0 errors（新增 optional 欄位不破壞現有程式碼）

- [ ] **Step 3: Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "feat(goals): add linkedAssetItemIds to FinancialGoal type"
```

---

### Task 3: FinancialGoals.tsx — GoalCard + FinancialGoals 全面更新

**Files:**
- Modify: `src/components/FinancialGoals.tsx`

此 task 更新 `GoalCard` 元件（props/state/view/edit 表單）以及 `FinancialGoals` 元件（context 解構、isAdding 表單、props 傳遞）。

- [ ] **Step 1: 更新 import（第 1–6 行）**

目前：

```ts
'use client';

import { useState } from 'react';
import { Plus, Trash2, Check, X, Pencil, Target, Home, Car, Plane, Shield, BookOpen, TrendingUp, type LucideProps } from 'lucide-react';
import { useAppContext, type FinancialGoal } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
```

改為：

```ts
'use client';

import { useState } from 'react';
import { Plus, Trash2, Check, X, Pencil, Target, Home, Car, Plane, Shield, BookOpen, TrendingUp, type LucideProps } from 'lucide-react';
import { useAppContext, type FinancialGoal } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import type { AssetCategory } from '../types';
import { resolveCurrentAmount, getLinkedItemIds } from '../lib/goalUtils';
```

- [ ] **Step 2: 更新 GoalCard props 型別與 state**

目前 GoalCard function signature（第 41–58 行）：

```ts
function GoalCard({
  goal,
  showValues,
  onUpdate,
  onDelete,
}: {
  goal: FinancialGoal;
  showValues: boolean;
  onUpdate: (g: FinancialGoal) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(goal.name);
  const [target, setTarget] = useState(String(goal.targetAmount));
  const [current, setCurrent] = useState(String(goal.currentAmount));
  const [deadline, setDeadline] = useState(goal.deadline ?? '');
  const [color, setColor] = useState(goal.color);
  const [icon, setIcon] = useState<FinancialGoal['icon']>(goal.icon);
```

改為：

```ts
function GoalCard({
  goal,
  showValues,
  assets,
  goals,
  onUpdate,
  onDelete,
}: {
  goal: FinancialGoal;
  showValues: boolean;
  assets: AssetCategory[];
  goals: FinancialGoal[];
  onUpdate: (g: FinancialGoal) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(goal.name);
  const [target, setTarget] = useState(String(goal.targetAmount));
  const [current, setCurrent] = useState(String(goal.currentAmount));
  const [deadline, setDeadline] = useState(goal.deadline ?? '');
  const [color, setColor] = useState(goal.color);
  const [icon, setIcon] = useState<FinancialGoal['icon']>(goal.icon);
  const [linkedIds, setLinkedIds] = useState<string[]>(goal.linkedAssetItemIds ?? []);
```

- [ ] **Step 3: 更新 GoalCard computed values（第 60–69 行）**

目前：

```ts
  const progress = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
  const remaining = goal.targetAmount - goal.currentAmount;
  const days = goal.deadline ? daysUntil(goal.deadline) : null;
  const monthsLeft = days !== null ? Math.ceil(days / 30) : null;
  const monthlyNeeded = monthsLeft && monthsLeft > 0 && remaining > 0 ? Math.ceil(remaining / monthsLeft) : null;

  const progressColor =
    progress >= 100 ? '#10b981' :
    progress >= 60  ? '#6366f1' :
    progress >= 30  ? '#f59e0b' : '#f43f5e';

  const IconComp = GOAL_ICONS[goal.icon];
```

改為：

```ts
  const effectiveCurrent = resolveCurrentAmount(goal, assets);
  const progress = goal.targetAmount > 0 ? Math.min(100, (effectiveCurrent / goal.targetAmount) * 100) : 0;
  const remaining = goal.targetAmount - effectiveCurrent;
  const days = goal.deadline ? daysUntil(goal.deadline) : null;
  const monthsLeft = days !== null ? Math.ceil(days / 30) : null;
  const monthlyNeeded = monthsLeft && monthsLeft > 0 && remaining > 0 ? Math.ceil(remaining / monthsLeft) : null;

  const progressColor =
    progress >= 100 ? '#10b981' :
    progress >= 60  ? '#6366f1' :
    progress >= 30  ? '#f59e0b' : '#f43f5e';

  const IconComp = GOAL_ICONS[goal.icon];
  const takenIds = getLinkedItemIds(goals, goal.id);
```

- [ ] **Step 4: 更新 handleSave（第 73–84 行）**

目前：

```ts
  const handleSave = () => {
    onUpdate({
      ...goal,
      name,
      targetAmount: Number(target) || 0,
      currentAmount: Number(current) || 0,
      deadline: deadline || undefined,
      color,
      icon,
    });
    setIsEditing(false);
  };
```

改為：

```ts
  const handleSave = () => {
    onUpdate({
      ...goal,
      name,
      targetAmount: Number(target) || 0,
      currentAmount: linkedIds.length ? goal.currentAmount : Number(current) || 0,
      deadline: deadline || undefined,
      color,
      icon,
      linkedAssetItemIds: linkedIds.length ? linkedIds : undefined,
    });
    setIsEditing(false);
  };
```

- [ ] **Step 5: 更新 GoalCard 編輯表單 — 「目前已存」欄位改為條件式**

找到編輯表單內的 `目前已存` 區塊（第 101–104 行）：

```tsx
          <div>
            <label className="text-xs text-gray-400 mb-1 block">目前已存</label>
            <input type="number" value={current} onChange={e => setCurrent(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          </div>
```

改為：

```tsx
          <div>
            <label className="text-xs text-gray-400 mb-1 block">目前已存</label>
            {linkedIds.length > 0 ? (
              <p className="px-3 py-2 text-sm bg-gray-50 rounded-lg text-indigo-600 font-bold">
                {showValues
                  ? `$${resolveCurrentAmount({ ...goal, linkedAssetItemIds: linkedIds }, assets).toLocaleString()}（連結自動計算）`
                  : '****'}
              </p>
            ) : (
              <input type="number" value={current} onChange={e => setCurrent(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
            )}
          </div>
```

- [ ] **Step 6: 在編輯表單「目標日期」區塊後新增「連結資產」區塊**

找到 `目標日期` 區塊（第 106–109 行）：

```tsx
        <div>
          <label className="text-xs text-gray-400 mb-1 block">目標日期（選填）</label>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
        </div>
```

在這段**之後**插入（不刪除 `目標日期` 區塊）：

```tsx
        <div>
          <label className="text-xs text-gray-400 mb-1 block">連結資產（選填）</label>
          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
            {assets.map(cat => (
              <div key={cat.id}>
                <p className="text-xs font-bold text-gray-500 px-3 py-1.5 bg-gray-50 border-b border-gray-100">{cat.title}</p>
                {cat.items.map(item => {
                  const isTaken = takenIds.has(item.id);
                  const takenByGoal = isTaken
                    ? goals.find(g => g.id !== goal.id && g.linkedAssetItemIds?.includes(item.id))?.name
                    : null;
                  return (
                    <label
                      key={item.id}
                      className={`flex items-center gap-2 px-3 py-1.5 text-sm border-b border-gray-50 last:border-0 ${isTaken ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={linkedIds.includes(item.id)}
                        disabled={isTaken}
                        onChange={e => {
                          if (e.target.checked) setLinkedIds(prev => [...prev, item.id]);
                          else setLinkedIds(prev => prev.filter(id => id !== item.id));
                        }}
                        className="rounded"
                      />
                      <span className="flex-1 truncate">{item.name}</span>
                      {takenByGoal ? (
                        <span className="text-xs text-gray-400 shrink-0">已連結：{takenByGoal}</span>
                      ) : (
                        <span className="text-xs text-gray-400 shrink-0">{showValues ? `$${item.amount.toLocaleString()}` : '****'}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
```

- [ ] **Step 7: 更新 GoalCard 卡片視圖 — 進度條數字 + 新增 chip 列**

找到卡片視圖進度條數字行（第 174 行）：

```tsx
          <span>{showValues ? `${goal.currentAmount.toLocaleString()} / ${goal.targetAmount.toLocaleString()}` : '****'}</span>
```

改為：

```tsx
          <span>{showValues ? `${effectiveCurrent.toLocaleString()} / ${goal.targetAmount.toLocaleString()}` : '****'}</span>
```

然後找到 `{/* 底部資訊 */}` 區塊（第 185–195 行）：

```tsx
      {/* 底部資訊 */}
      <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
        {progress >= 100 ? (
          <span className="text-emerald-600 font-bold">🎉 目標達成！</span>
        ) : (
          <span>還差 {showValues ? remaining.toLocaleString() : '****'}</span>
        )}
        {monthlyNeeded && monthlyNeeded > 0 && (
          <span className="text-indigo-500">每月需存 {showValues ? monthlyNeeded.toLocaleString() : '****'}</span>
        )}
      </div>
```

在 `{/* 底部資訊 */}` **之前**插入 chip 列：

```tsx
      {/* 連結資產 chips */}
      {(goal.linkedAssetItemIds?.length ?? 0) > 0 && (() => {
        const allItems = assets.flatMap(cat => cat.items);
        const linked = (goal.linkedAssetItemIds ?? [])
          .map(id => allItems.find(i => i.id === id))
          .filter((i): i is NonNullable<typeof i> => i != null);
        const shown = linked.slice(0, 3);
        const extra = linked.length - shown.length;
        return (
          <div className="flex flex-wrap gap-1 mt-2 mb-1">
            {shown.map(item => (
              <span key={item.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs">
                {item.name}{showValues ? ` $${item.amount.toLocaleString()}` : ''}
              </span>
            ))}
            {extra > 0 && <span className="text-xs text-gray-400 self-center">+{extra} 個</span>}
          </div>
        );
      })()}
      {/* 底部資訊 */}
      <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
        {progress >= 100 ? (
          <span className="text-emerald-600 font-bold">🎉 目標達成！</span>
        ) : (
          <span>還差 {showValues ? remaining.toLocaleString() : '****'}</span>
        )}
        {monthlyNeeded && monthlyNeeded > 0 && (
          <span className="text-indigo-500">每月需存 {showValues ? monthlyNeeded.toLocaleString() : '****'}</span>
        )}
      </div>
```

- [ ] **Step 8: 更新 FinancialGoals 元件 — context 解構 + newLinkedIds state + newGoalTakenIds**

找到 `FinancialGoals` 元件的 context 解構（第 201 行）：

```ts
  const { goals, setGoals, showValues } = useAppContext();
```

改為：

```ts
  const { goals, setGoals, showValues, assets } = useAppContext();
```

在 `const [newColor, setNewColor] = useState('#6366f1');` 之後（第 209 行後）插入：

```ts
  const [newLinkedIds, setNewLinkedIds] = useState<string[]>([]);
  const newGoalTakenIds = getLinkedItemIds(goals);
```

- [ ] **Step 9: 更新 handleAdd — 加入 linkedAssetItemIds + 重置 newLinkedIds**

找到 `handleAdd`（第 211–227 行）：

```ts
  const handleAdd = () => {
    if (!newName.trim() || !newTarget) return;
    const goal: FinancialGoal = {
      id: `goal-${Date.now()}`,
      name: newName.trim(),
      targetAmount: Number(newTarget) || 0,
      currentAmount: Number(newCurrent) || 0,
      deadline: newDeadline || undefined,
      color: newColor,
      icon: newIcon,
    };
    setGoals(prev => [...prev, goal]);
    toast('已新增財務目標');
    setNewName(''); setNewTarget(''); setNewCurrent(''); setNewDeadline('');
    setNewIcon('other'); setNewColor('#6366f1');
    setIsAdding(false);
  };
```

改為：

```ts
  const handleAdd = () => {
    if (!newName.trim() || !newTarget) return;
    const goal: FinancialGoal = {
      id: `goal-${Date.now()}`,
      name: newName.trim(),
      targetAmount: Number(newTarget) || 0,
      currentAmount: newLinkedIds.length ? 0 : Number(newCurrent) || 0,
      deadline: newDeadline || undefined,
      color: newColor,
      icon: newIcon,
      linkedAssetItemIds: newLinkedIds.length ? newLinkedIds : undefined,
    };
    setGoals(prev => [...prev, goal]);
    toast('已新增財務目標');
    setNewName(''); setNewTarget(''); setNewCurrent(''); setNewDeadline('');
    setNewIcon('other'); setNewColor('#6366f1'); setNewLinkedIds([]);
    setIsAdding(false);
  };
```

- [ ] **Step 10: 更新整體進度計算（第 239–241 行）**

找到：

```ts
  const totalGoalAmount = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalCurrentAmount = goals.reduce((s, g) => s + g.currentAmount, 0);
  const overallProgress = totalGoalAmount > 0 ? (totalCurrentAmount / totalGoalAmount) * 100 : 0;
```

改為：

```ts
  const totalGoalAmount = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalCurrentAmount = goals.reduce((s, g) => s + resolveCurrentAmount(g, assets), 0);
  const overallProgress = totalGoalAmount > 0 ? (totalCurrentAmount / totalGoalAmount) * 100 : 0;
```

也更新 `整體進度` 底下達成計算（第 250 行）：

```tsx
              整體進度 {overallProgress.toFixed(0)}%・{goals.filter(g => g.currentAmount >= g.targetAmount).length}/{goals.length} 項達成
```

改為：

```tsx
              整體進度 {overallProgress.toFixed(0)}%・{goals.filter(g => resolveCurrentAmount(g, assets) >= g.targetAmount).length}/{goals.length} 項達成
```

- [ ] **Step 11: isAdding 表單 — 「目前已存」改條件式 + 新增連結資產區塊**

找到 isAdding 表單內的「目前已存」input（第 281–287 行）：

```tsx
            <input
              type="number"
              placeholder="目前已存（選填）"
              value={newCurrent}
              onChange={e => setNewCurrent(e.target.value)}
              className="border border-indigo-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white"
            />
```

改為：

```tsx
            {newLinkedIds.length > 0 ? (
              <div className="border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-indigo-50 text-indigo-700 font-medium">
                {showValues
                  ? `$${assets.flatMap(c => c.items).filter(i => newLinkedIds.includes(i.id)).reduce((s, i) => s + i.amount, 0).toLocaleString()}（連結自動計算）`
                  : '****'}
              </div>
            ) : (
              <input
                type="number"
                placeholder="目前已存（選填）"
                value={newCurrent}
                onChange={e => setNewCurrent(e.target.value)}
                className="border border-indigo-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white"
              />
            )}
```

然後找到「類型」區塊（第 313–326 行）前面，在「顏色」區塊結束後的位置，在「類型」`<div>` **之前**插入：

```tsx
          <div>
            <label className="text-xs text-gray-500 mb-1 block">連結資產（選填）</label>
            <div className="border border-indigo-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto bg-white">
              {assets.map(cat => (
                  <div key={cat.id}>
                    <p className="text-xs font-bold text-gray-500 px-3 py-1.5 bg-gray-50 border-b border-gray-100">{cat.title}</p>
                    {cat.items.map(item => {
                      const isTaken = newGoalTakenIds.has(item.id);
                      const takenByGoal = isTaken
                        ? goals.find(g => g.linkedAssetItemIds?.includes(item.id))?.name
                        : null;
                      return (
                        <label
                          key={item.id}
                          className={`flex items-center gap-2 px-3 py-1.5 text-sm border-b border-gray-50 last:border-0 ${isTaken ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}
                        >
                          <input
                            type="checkbox"
                            checked={newLinkedIds.includes(item.id)}
                            disabled={isTaken}
                            onChange={e => {
                              if (e.target.checked) setNewLinkedIds(prev => [...prev, item.id]);
                              else setNewLinkedIds(prev => prev.filter(id => id !== item.id));
                            }}
                            className="rounded"
                          />
                          <span className="flex-1 truncate">{item.name}</span>
                          {takenByGoal ? (
                            <span className="text-xs text-gray-400 shrink-0">已連結：{takenByGoal}</span>
                          ) : (
                            <span className="text-xs text-gray-400 shrink-0">{showValues ? `$${item.amount.toLocaleString()}` : '****'}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
              ))}
            </div>
          </div>
```

- [ ] **Step 12: 更新 GoalCard 的 JSX 呼叫，傳入 assets 和 goals props**

找到 GoalCard 呼叫（第 347–354 行）：

```tsx
        {goals.map(goal => (
          <GoalCard
            key={goal.id}
            goal={goal}
            showValues={showValues}
            onUpdate={updated => handleUpdate(goal.id, updated)}
            onDelete={() => handleDelete(goal.id)}
          />
        ))}
```

改為：

```tsx
        {goals.map(goal => (
          <GoalCard
            key={goal.id}
            goal={goal}
            showValues={showValues}
            assets={assets}
            goals={goals}
            onUpdate={updated => handleUpdate(goal.id, updated)}
            onDelete={() => handleDelete(goal.id)}
          />
        ))}
```

- [ ] **Step 13: TypeScript 型別檢查**

```
npx tsc --noEmit
```

預期：0 errors

- [ ] **Step 14: 執行全部測試**

```
npx vitest run
```

預期：所有測試通過（包含 goalUtils 的 8 個）

- [ ] **Step 15: Commit**

```bash
git add src/components/FinancialGoals.tsx
git commit -m "feat(goals): link asset items to goals with auto progress"
```
