# Full Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 拆分 4 個過大的頁面組件、提取共用工具 hook、修復 build 設定，讓每個頁面縮到 ≤300 行。

**Architecture:** 從各頁面提取內嵌組件至 `src/components/{debt,stocks,cashflow,dashboard}/`；共用計算邏輯移至 `src/lib/`；共用 hook 移至 `src/hooks/`。所有功能不變，只改結構。

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Lucide React

---

## 新建檔案總覽

```
src/lib/loanUtils.ts
src/hooks/useNameLookup.ts
src/components/debt/SectionHeader.tsx
src/components/debt/QuotaBar.tsx
src/components/debt/StakingRow.tsx
src/components/debt/StakingSection.tsx
src/components/debt/BorrowSection.tsx
src/components/debt/PledgeRatioCard.tsx
src/components/debt/PaymentDueDialog.tsx
src/components/debt/RevolvingLoanCard.tsx
src/components/debt/InstallmentLoanCard.tsx
src/components/debt/LoanSection.tsx
src/components/stocks/StockAvatar.tsx
src/components/stocks/MarketSelector.tsx
src/components/stocks/PortfolioTrendChart.tsx
src/components/stocks/StockRow.tsx
src/components/cashflow/CashflowKPICards.tsx
src/components/cashflow/FlowFilterBar.tsx
src/components/cashflow/FixedItemsSection.tsx
src/components/cashflow/OneTimeEntriesSection.tsx
src/components/dashboard/CashflowSummaryBar.tsx
src/components/dashboard/SnapshotTable.tsx
```

**修改檔案：**
```
src/app/debt/page.tsx          1431 → ~290 行
src/app/stocks/page.tsx        1033 → ~250 行
src/app/cashflow/page.tsx       534 → ~150 行
src/app/page.tsx                471 → ~200 行
next.config.mjs                 移除 ignoreBuildErrors / ignoreDuringBuilds
```

---

## Task 1：建立 src/lib/loanUtils.ts

**Files:**
- Create: `src/lib/loanUtils.ts`

- [ ] **Step 1：建立 loanUtils.ts**

```ts
// src/lib/loanUtils.ts

export type ScheduleRow = {
  period: number;
  date: string;
  payment: number;
  principal: number;
  interest: number;
  beginningBalance: number;
  endingBalance: number;
  isPaid: boolean;
};

import type { LoanItem } from '../types';

export function calcEndDate(nextPaymentDate: string | undefined, remainingPeriods: number): string {
  if (remainingPeriods <= 0) return '已到期';
  const base = nextPaymentDate ? new Date(nextPaymentDate) : new Date();
  base.setMonth(base.getMonth() + remainingPeriods - 1);
  return `${base.getFullYear()}/${base.getMonth() + 1}/${base.getDate()}`;
}

export function generateSchedule(loan: LoanItem): ScheduleRow[] {
  const paidCount = loan.originalPeriods - loan.remainingPeriods;
  const initP = loan.initialPrincipal ?? loan.principal;
  const rows: ScheduleRow[] = [];
  let currentBalance = initP;

  for (let i = 0; i < loan.originalPeriods; i++) {
    let dateStr = '—';
    if (loan.nextPaymentDate) {
      const d = new Date(loan.nextPaymentDate);
      d.setMonth(d.getMonth() + (i - paidCount));
      dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    }
    const beginningBalance = currentBalance;
    const interest = Math.round(beginningBalance * loan.interestRate / 100 / 12);
    let principal = loan.monthlyPayment - interest;
    if (beginningBalance < principal || i === loan.originalPeriods - 1) {
      principal = beginningBalance;
    }
    currentBalance = Math.max(0, beginningBalance - principal);
    if (i === paidCount - 1) currentBalance = loan.principal;
    rows.push({ period: i + 1, date: dateStr, payment: principal + interest, principal, interest, beginningBalance, endingBalance: currentBalance, isPaid: i < paidCount });
    if (currentBalance <= 0 && i >= paidCount) break;
  }
  return rows;
}

export function isPaymentDue(nextPaymentDate: string | undefined): boolean {
  if (!nextPaymentDate) return false;
  return new Date(nextPaymentDate) <= new Date();
}
```

- [ ] **Step 2：確認 TypeScript 無誤**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

---

## Task 2：建立 debt 子組件（簡單組件）

**Files:**
- Create: `src/components/debt/SectionHeader.tsx`
- Create: `src/components/debt/QuotaBar.tsx`
- Create: `src/components/debt/StakingRow.tsx`

- [ ] **Step 1：SectionHeader.tsx**

```tsx
// src/components/debt/SectionHeader.tsx
"use client";

export function SectionHeader({ title, color, children }: { title: string; color: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className={`w-1.5 h-6 rounded-full ${color}`} />
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2：QuotaBar.tsx**

```tsx
// src/components/debt/QuotaBar.tsx
"use client";
import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { ShieldCheck } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

export function QuotaBar({ limit, setLimit, totalBorrow }: {
  limit: number;
  setLimit: (v: number) => void;
  totalBorrow: number;
}) {
  const { showValues } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [input, setInput] = useState((limit / 10000).toString());
  const available = limit - totalBorrow;
  const availableWan = (Math.abs(available) / 10000).toLocaleString('zh-TW', { maximumFractionDigits: 1 });
  const limitWan = (limit / 10000).toLocaleString('zh-TW', { maximumFractionDigits: 1 });

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2 text-indigo-600">
        <ShieldCheck className="w-4 h-4" />
        <span className="text-sm font-medium">剩餘可借款額度</span>
        {limit > 0 && (
          <span className={`text-lg font-bold ${available < 0 ? 'text-rose-600' : 'text-indigo-700'}`}>
            {showValues ? `${available < 0 ? '−' : ''}${availableWan} 萬` : '****'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm text-indigo-500">
        <span>總額度：</span>
        {isEditing ? (
          <>
            <input type="number" value={input} onChange={e => setInput(e.target.value)} className="w-20 border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white outline-none" autoFocus placeholder="萬" />
            <span className="text-xs text-indigo-400">萬</span>
            <button onClick={() => { setLimit((Number(input) || 0) * 10000); setIsEditing(false); }} className="text-indigo-600"><Check className="w-4 h-4" /></button>
            <button onClick={() => setIsEditing(false)} className="text-gray-400"><X className="w-4 h-4" /></button>
          </>
        ) : (
          <button onClick={() => { setInput((limit / 10000).toString()); setIsEditing(true); }} className="font-bold text-indigo-700 hover:underline">
            {limit > 0 ? `${limitWan} 萬` : '點擊設定'}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3：StakingRow.tsx**

```tsx
// src/components/debt/StakingRow.tsx
"use client";
import { useState } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { useAppContext, type StakingItem, type StakingType } from '../../context/AppContext';

export function StakingRow({ item, type, onUpdate, onDelete }: {
  item: StakingItem;
  type: StakingType;
  onUpdate: (d: Partial<StakingItem>) => void;
  onDelete: () => void;
}) {
  const { showValues } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [eName, setEName] = useState(item.name);
  const [eProtocol, setEProtocol] = useState(item.protocol);
  const [eAmount, setEAmount] = useState(item.amount.toString());
  const [eValue, setEValue] = useState(item.value.toString());
  const [eApy, setEApy] = useState(item.apy.toString());
  const [eBorrowDate, setEBorrowDate] = useState(item.borrowDate || '');
  const [eRepayDate, setERepayDate] = useState(item.repayDate || '');
  const isBorrow = type === 'borrow';
  const monthly = Math.round(item.value * item.apy / 100 / 12);

  const handleSave = () => {
    onUpdate({ name: eName, protocol: eProtocol, amount: Number(eAmount) || 0, value: Number(eValue) || 0, apy: Number(eApy) || 0, borrowDate: eBorrowDate, repayDate: eRepayDate });
    setIsEditing(false);
  };

  if (isEditing) return (
    <div className="p-5 bg-gray-50 border-b border-gray-100">
      <div className="flex justify-between mb-3">
        <span className="text-sm font-bold text-gray-700">編輯</span>
        <button onClick={onDelete} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="col-span-2 lg:col-span-1"><label className="block text-xs text-gray-500 mb-1">名稱</label><input type="text" value={eName} onChange={e => setEName(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">平台</label><input type="text" value={eProtocol} onChange={e => setEProtocol(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">數量</label><input type="number" value={eAmount} onChange={e => setEAmount(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">{isBorrow ? '借款金額' : '存入金額'}</label><input type="number" value={eValue} onChange={e => setEValue(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">{isBorrow ? '借款利率' : '收益率'} (%)</label><input type="number" value={eApy} onChange={e => setEApy(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">{isBorrow ? '借款日' : '開始日'}</label><input type="date" value={eBorrowDate} onChange={e => setEBorrowDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        {isBorrow && <div><label className="block text-xs text-gray-500 mb-1">償還日</label><input type="date" value={eRepayDate} onChange={e => setERepayDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>}
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 flex items-center gap-1"><Check className="w-4 h-4" /> 儲存</button>
        <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm flex items-center gap-1"><X className="w-4 h-4" /> 取消</button>
      </div>
    </div>
  );

  return (
    <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
      <div className="flex items-start gap-3 mb-3 xl:mb-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${isBorrow ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
          {item.name.charAt(0)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">{item.name}</span>
            <span className="text-xs text-gray-400">via {item.protocol}</span>
          </div>
          {(item.borrowDate || item.repayDate) && (
            <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
              {item.borrowDate && <span>{isBorrow ? '借款' : '開始'}: {item.borrowDate}</span>}
              {item.repayDate && <span>償還: {item.repayDate}</span>}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0 shrink-0">
        <div className="w-16 px-2"><p className="text-xs text-gray-500">數量</p><p className="font-medium tabular-nums">{item.amount.toLocaleString()}</p></div>
        <div className="w-28 px-2"><p className="text-xs text-gray-500">{isBorrow ? '借款金額' : '存入金額'}</p><p className="font-medium tabular-nums">{showValues ? `${(item.value / 10000).toLocaleString('zh-TW', { maximumFractionDigits: 1 })} 萬` : '****'}</p></div>
        <div className="w-20 px-2"><p className="text-xs text-gray-500">{isBorrow ? '借款利率' : '收益率'}</p><p className={`font-bold ${isBorrow ? 'text-rose-600' : 'text-emerald-600'}`}>{item.apy}%</p></div>
        <div className="w-24 px-2"><p className="text-xs text-gray-500">{isBorrow ? '月利息支出' : '月收益'}</p><p className={`font-bold tabular-nums ${isBorrow ? 'text-rose-600' : 'text-emerald-600'}`}>{showValues ? monthly.toLocaleString('en-US') : '****'}</p></div>
        <div className="px-2">
          <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 border border-indigo-200 text-indigo-600 rounded-lg text-sm hover:bg-indigo-50 flex items-center gap-1">
            <Pencil className="w-3.5 h-3.5" /> 管理
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Task 3：建立 debt 子組件（複雜組件）

**Files:**
- Create: `src/components/debt/StakingSection.tsx`
- Create: `src/components/debt/BorrowSection.tsx`
- Create: `src/components/debt/PaymentDueDialog.tsx`
- Create: `src/components/debt/RevolvingLoanCard.tsx`

- [ ] **Step 1：StakingSection.tsx**

```tsx
// src/components/debt/StakingSection.tsx
"use client";
import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { type StakingItem, type StakingType } from '../../context/AppContext';
import { SectionHeader } from './SectionHeader';
import { StakingRow } from './StakingRow';

export function StakingSection({ title, accentColor, type, items, onAdd, onUpdate, onDelete, extra }: {
  title: string; accentColor: string; type: StakingType;
  items: StakingItem[];
  onAdd: (item: Omit<StakingItem, 'id'>) => void;
  onUpdate: (id: string, data: Partial<StakingItem>) => void;
  onDelete: (id: string, name: string) => void;
  extra?: React.ReactNode;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState('');
  const [amount, setAmount] = useState('');
  const [value, setValue] = useState('');
  const [apy, setApy] = useState('');
  const [borrowDate, setBorrowDate] = useState('');
  const [repayDate, setRepayDate] = useState('');
  const isBorrow = type === 'borrow';
  const btnColor = isBorrow ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100';
  const confirmColor = isBorrow ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700';

  const handleAdd = () => {
    if (!name.trim() || !value) return;
    onAdd({ name, protocol: protocol || 'Custom', amount: Number(amount) || 0, value: Number(value) || 0, apy: Number(apy) || 0, stakingType: type, borrowDate, repayDate });
    setName(''); setProtocol(''); setAmount(''); setValue(''); setApy(''); setBorrowDate(''); setRepayDate('');
    setIsAdding(false);
  };

  return (
    <div>
      <SectionHeader title={title} color={accentColor}>
        <button onClick={() => setIsAdding(v => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${btnColor}`}>
          <Plus className="w-3.5 h-3.5" /> 新增
        </button>
      </SectionHeader>
      {extra && <div className="mb-4">{extra}</div>}
      {isAdding && (
        <div className={`mb-4 rounded-2xl border p-5 ${isBorrow ? 'bg-indigo-50/50 border-indigo-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="col-span-2 lg:col-span-1"><label className="block text-xs text-gray-500 mb-1">名稱</label><input autoFocus type="text" value={name} onChange={e => setName(e.target.value)} placeholder="名稱" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">平台</label><input type="text" value={protocol} onChange={e => setProtocol(e.target.value)} placeholder="Lido" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">數量</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">{isBorrow ? '借款金額' : '存入金額'}</label><input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="TWD" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">{isBorrow ? '借款利率' : '年化收益率'} (%)</label><input type="number" value={apy} onChange={e => setApy(e.target.value)} placeholder="APY" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">{isBorrow ? '借款日' : '開始日'}</label><input type="date" value={borrowDate} onChange={e => setBorrowDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm text-gray-600" /></div>
            {isBorrow && <div><label className="block text-xs text-gray-500 mb-1">最後償還日</label><input type="date" value={repayDate} onChange={e => setRepayDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm text-gray-600" /></div>}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleAdd} className={`px-4 py-2 text-white rounded-lg text-sm flex items-center gap-1 ${confirmColor}`}><Check className="w-4 h-4" /> 確認新增</button>
            <button onClick={() => setIsAdding(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm">取消</button>
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {items.map(item => (
          <StakingRow key={item.id} item={item} type={type} onUpdate={data => onUpdate(item.id, data)} onDelete={() => onDelete(item.id, item.name)} />
        ))}
        {items.length === 0 && !isAdding && (
          <div className="py-8 text-center text-gray-400 text-sm">尚無項目</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2：BorrowSection.tsx**

```tsx
// src/components/debt/BorrowSection.tsx
"use client";
import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { type StakingItem } from '../../context/AppContext';
import { SectionHeader } from './SectionHeader';
import { StakingRow } from './StakingRow';
import { QuotaBar } from './QuotaBar';
import { PledgeRatioCard } from './PledgeRatioCard';

export function BorrowSection({ pledgePlatforms, borrowByPlatform, collateralByPlatform, borrowingLimits, setBorrowingLimits, onAdd, onUpdate, onDelete }: {
  pledgePlatforms: string[];
  borrowByPlatform: Record<string, StakingItem[]>;
  collateralByPlatform: Record<string, number>;
  borrowingLimits: Record<string, number>;
  setBorrowingLimits: (v: Record<string, number> | ((p: Record<string, number>) => Record<string, number>)) => void;
  onAdd: (item: Omit<StakingItem, 'id'>) => void;
  onUpdate: (id: string, data: Partial<StakingItem>) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState('');
  const [amount, setAmount] = useState('');
  const [value, setValue] = useState('');
  const [apy, setApy] = useState('');
  const [borrowDate, setBorrowDate] = useState('');
  const [repayDate, setRepayDate] = useState('');

  const handleAdd = () => {
    if (!name.trim() || !value) return;
    onAdd({ name, protocol: protocol || '未分類', amount: Number(amount) || 0, value: Number(value) || 0, apy: Number(apy) || 0, stakingType: 'borrow', borrowDate, repayDate });
    setName(''); setProtocol(''); setAmount(''); setValue(''); setApy(''); setBorrowDate(''); setRepayDate('');
    setIsAdding(false);
  };

  return (
    <div>
      <SectionHeader title="質押借款" color="bg-indigo-500">
        <button onClick={() => setIsAdding(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors">
          <Plus className="w-3.5 h-3.5" /> 新增
        </button>
      </SectionHeader>
      {isAdding && (
        <div className="mb-6 rounded-2xl border bg-indigo-50/50 border-indigo-100 p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="col-span-2 lg:col-span-1"><label className="block text-xs text-gray-500 mb-1">名稱</label><input autoFocus type="text" value={name} onChange={e => setName(e.target.value)} placeholder="名稱" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">平台</label><input type="text" value={protocol} onChange={e => setProtocol(e.target.value)} placeholder="元大" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">數量</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">借款金額</label><input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="TWD" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">借款利率 (%)</label><input type="number" value={apy} onChange={e => setApy(e.target.value)} placeholder="APY" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">借款日</label><input type="date" value={borrowDate} onChange={e => setBorrowDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm text-gray-600" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">最後償還日</label><input type="date" value={repayDate} onChange={e => setRepayDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm text-gray-600" /></div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleAdd} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-indigo-700"><Check className="w-4 h-4" /> 確認新增</button>
            <button onClick={() => setIsAdding(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm">取消</button>
          </div>
        </div>
      )}
      {pledgePlatforms.length === 0 && !isAdding && (
        <div className="py-8 text-center text-gray-400 text-sm bg-white rounded-2xl border border-dashed border-gray-200">尚無質押借款項目</div>
      )}
      {pledgePlatforms.map(platform => {
        const items = borrowByPlatform[platform];
        const platformBorrow = items.reduce((s, i) => s + i.value, 0);
        const platformCollateral = collateralByPlatform[platform] || 0;
        const platformLimit = borrowingLimits[platform] || 0;
        return (
          <div key={platform} className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full">{platform}</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <QuotaBar limit={platformLimit} setLimit={v => setBorrowingLimits(prev => ({ ...prev, [platform]: v }))} totalBorrow={platformBorrow} />
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-3">
              {items.map(item => (
                <StakingRow key={item.id} item={item} type="borrow" onUpdate={data => onUpdate(item.id, data)} onDelete={() => onDelete(item.id, item.name)} />
              ))}
            </div>
            <PledgeRatioCard platformName={platform} totalBorrowValue={platformBorrow} totalCollateralValueTWD={platformCollateral} />
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3：PaymentDueDialog.tsx**

```tsx
// src/components/debt/PaymentDueDialog.tsx
"use client";
import { useState } from 'react';
import { RefreshCw, Check } from 'lucide-react';
import { useAppContext, type LoanItem } from '../../context/AppContext';

export function PaymentDueDialog({ loans, onRecord, onClose }: {
  loans: LoanItem[];
  onRecord: (id: string) => void;
  onClose: () => void;
}) {
  const { showValues } = useAppContext();
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());

  const handleConfirm = (id: string) => {
    onRecord(id);
    setConfirmed(prev => {
      const next = new Set(prev);
      next.add(id);
      if (next.size >= loans.length) setTimeout(onClose, 600);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5">
          <div className="flex items-center gap-3 text-white">
            <RefreshCw className="w-5 h-5 shrink-0" />
            <div>
              <h3 className="font-bold text-lg">還款提醒</h3>
              <p className="text-sm text-white/80 mt-0.5">以下信貸的還款日已到，請確認是否已還款</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 space-y-3 max-h-80 overflow-y-auto">
          {loans.map(loan => {
            const isDone = confirmed.has(loan.id);
            return (
              <div key={loan.id} className={`flex items-center justify-between gap-3 p-4 rounded-xl border transition-all duration-300 ${isDone ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-100'}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm">{loan.name}</span>
                    <span className="text-xs text-gray-400">{loan.bank}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    還款日 <span className="font-medium text-amber-600">{loan.nextPaymentDate}</span>
                    <span className="mx-1.5 text-gray-300">·</span>
                    每月還款 <span className="font-semibold text-gray-700">{showValues ? loan.monthlyPayment.toLocaleString('en-US') : '****'}</span>
                  </div>
                </div>
                {isDone ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold shrink-0"><Check className="w-4 h-4" /> 已記錄</span>
                ) : (
                  <button onClick={() => handleConfirm(loan.id)} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition-colors">
                    <Check className="w-3.5 h-3.5" /> 確認已還款
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="px-6 pb-5 pt-2">
          <button onClick={onClose} className="w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">稍後再說</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4：RevolvingLoanCard.tsx**

```tsx
// src/components/debt/RevolvingLoanCard.tsx
"use client";
import { useState } from 'react';
import { CreditCard, Pencil, Check, X, Trash2 } from 'lucide-react';
import { useAppContext, type LoanItem } from '../../context/AppContext';

export function RevolvingLoanCard({ loan, onDelete, onUpdate }: {
  loan: LoanItem; onDelete: () => void; onUpdate: (d: Partial<LoanItem>) => void;
}) {
  const { showValues } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [ep, setEp] = useState(loan.principal.toString());
  const [er, setEr] = useState(loan.interestRate.toString());
  const [em, setEm] = useState(loan.monthlyPayment.toString());

  const handleSave = () => {
    onUpdate({ principal: Number(ep) || 0, interestRate: Number(er) || 0, monthlyPayment: Number(em) || 0 });
    setIsEditing(false);
  };

  if (isEditing) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex justify-between items-center mb-3">
        <span className="font-bold text-gray-800">{loan.name}（{loan.bank}）</span>
        <button onClick={onDelete} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="block text-xs text-gray-500 mb-1">目前借款餘額</label><input type="number" value={ep} onChange={e => setEp(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">年利率 (%)</label><input type="number" step="0.01" value={er} onChange={e => setEr(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">每月扣息</label><input type="number" value={em} onChange={e => setEm(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 flex items-center gap-1"><Check className="w-4 h-4" /> 儲存</button>
        <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm flex items-center gap-1"><X className="w-4 h-4" /> 取消</button>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center shrink-0"><CreditCard className="w-4 h-4" /></div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900">{loan.name}</span>
            <span className="text-xs text-gray-400">{loan.bank}</span>
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full">循環</span>
          </div>
          <div className="flex flex-wrap gap-3 mt-1.5 text-sm">
            <span className="text-gray-500">借款餘額 <b className="text-gray-900">{showValues ? loan.principal.toLocaleString('en-US') : '****'}</b></span>
            <span className="text-gray-500">利率 <b className="text-amber-600">{loan.interestRate}%</b></span>
            <span className="text-gray-500">每月扣息 <b className="text-rose-600">{showValues ? loan.monthlyPayment.toLocaleString('en-US') : '****'}</b></span>
          </div>
          <p className="mt-1 text-xs text-gray-400">循環利息，本金不自動調降。如有還本請點編輯手動修改餘額。</p>
        </div>
      </div>
      <button onClick={() => setIsEditing(true)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg self-start lg:self-auto"><Pencil className="w-4 h-4" /></button>
    </div>
  );
}
```

---

## Task 4：建立 PledgeRatioCard、InstallmentLoanCard、LoanSection

**Files:**
- Create: `src/components/debt/PledgeRatioCard.tsx`
- Create: `src/components/debt/InstallmentLoanCard.tsx`
- Create: `src/components/debt/LoanSection.tsx`

- [ ] **Step 1：PledgeRatioCard.tsx**（維持率模擬卡片，原樣搬移）

```tsx
// src/components/debt/PledgeRatioCard.tsx
"use client";
import { useState } from 'react';
import { AlertTriangle, AlertOctagon, ShieldCheck as ShieldOk } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

export function PledgeRatioCard({ platformName, totalBorrowValue, totalCollateralValueTWD }: {
  platformName: string; totalBorrowValue: number; totalCollateralValueTWD: number;
}) {
  const { showValues } = useAppContext();
  const [dropPct, setDropPct] = useState(0);
  if (totalBorrowValue <= 0) return null;

  const ratio    = (totalCollateralValueTWD / totalBorrowValue) * 100;
  const isRed    = ratio < 130;
  const isYellow = ratio >= 130 && ratio < 166;
  const borderClass = isRed ? 'border-rose-200' : isYellow ? 'border-amber-200' : 'border-emerald-100';
  const textClass   = isRed ? 'text-rose-600'   : isYellow ? 'text-amber-600'   : 'text-emerald-600';
  const badgeBg     = isRed ? 'bg-rose-100'     : isYellow ? 'bg-amber-100'     : 'bg-emerald-100';
  const Icon        = isRed ? AlertOctagon       : isYellow ? AlertTriangle      : ShieldOk;
  const statusText  = isRed ? '危險' : isYellow ? '警戒' : '安全';
  const buffer   = Math.round(totalCollateralValueTWD - totalBorrowValue * 1.30);
  const shortage = Math.round(totalBorrowValue * 1.30 - totalCollateralValueTWD);

  const simCollateral = totalCollateralValueTWD * (1 - dropPct / 100);
  const simRatio      = totalBorrowValue > 0 ? (simCollateral / totalBorrowValue) * 100 : 0;
  const simIsRed      = simRatio < 130;
  const simIsYellow   = simRatio >= 130 && simRatio < 166;
  const simBuffer     = Math.round(simCollateral - totalBorrowValue * 1.30);
  const simShortage   = Math.round(totalBorrowValue * 1.30 - simCollateral);
  const simTextClass  = simIsRed ? 'text-rose-600' : simIsYellow ? 'text-amber-600' : 'text-emerald-600';
  const simBadgeBg    = simIsRed ? 'bg-rose-100'   : simIsYellow ? 'bg-amber-100'   : 'bg-emerald-100';
  const SimIcon       = simIsRed ? AlertOctagon     : simIsYellow ? AlertTriangle    : ShieldOk;
  const simStatusText = simIsRed ? '危險' : simIsYellow ? '警戒' : '安全';
  const isSimulating  = dropPct > 0;
  const BAR_MIN = 100, BAR_MAX = 200;
  const toBarPct  = (v: number) => Math.min(Math.max((v - BAR_MIN) / (BAR_MAX - BAR_MIN) * 100, 0), 100);
  const barPct    = toBarPct(ratio);
  const simBarPct = toBarPct(simRatio);
  const dangerPct = toBarPct(130);
  const warnPct   = toBarPct(166);

  return (
    <div className={`mt-4 bg-white rounded-2xl border ${isSimulating ? 'border-violet-200' : borderClass} p-5 transition-colors`}>
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${badgeBg} ${textClass}`}><Icon className="w-3.5 h-3.5" />{statusText}</span>
          <span className="text-sm font-semibold text-gray-700">質押維持率</span>
          {platformName && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{platformName}</span>}
        </div>
        <p className={`text-3xl font-bold tabular-nums ${totalCollateralValueTWD <= 0 ? 'text-gray-300' : textClass}`}>
          {totalCollateralValueTWD <= 0 ? '—' : `${ratio.toFixed(1)}%`}
        </p>
      </div>
      {totalCollateralValueTWD <= 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">
          尚未設定此平台的擔保品股票。請至「股票」頁面，在對應股票的「平台」欄位填入「{platformName}」並設定擔保股數。
        </p>
      )}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-50 rounded-xl p-3"><p className="text-[10px] text-gray-400 mb-1">擔保品市值</p><p className="text-sm font-bold text-gray-800 tabular-nums">{showValues ? Math.round(totalCollateralValueTWD).toLocaleString('en-US') : '****'}</p><p className="text-[10px] text-gray-400">TWD</p></div>
        <div className="bg-gray-50 rounded-xl p-3"><p className="text-[10px] text-gray-400 mb-1">融資借款</p><p className="text-sm font-bold text-gray-800 tabular-nums">{showValues ? totalBorrowValue.toLocaleString('en-US') : '****'}</p><p className="text-[10px] text-gray-400">TWD</p></div>
        <div className={`rounded-xl p-3 ${isRed ? 'bg-rose-50' : 'bg-emerald-50'}`}>
          <div className="flex items-center gap-1 mb-1 group relative">
            <p className="text-[10px] text-gray-400">{isRed ? '追繳缺口' : '安全緩衝'}</p>
            <span className="text-[10px] text-gray-300 cursor-default select-none">ⓘ</span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-800 text-white text-[11px] leading-relaxed rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              {isRed ? '擔保品市值低於追繳門檻的差額。需補充此金額的擔保品，才能回到安全線 (維持率 130%)。' : '擔保品市值跌超過此金額後，維持率將低於 130% 並觸發追繳。數字越大代表越安全。'}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
            </div>
          </div>
          <p className={`text-sm font-bold tabular-nums ${isRed ? 'text-rose-600' : 'text-emerald-600'}`}>{showValues ? `${isRed ? '-' : '+'}${(isRed ? shortage : buffer).toLocaleString('en-US')}` : '****'}</p>
          <p className="text-[10px] text-gray-400">TWD</p>
        </div>
      </div>
      <div className="mb-5">
        <div className="relative h-4 rounded-full overflow-visible bg-gray-100">
          <div className="absolute inset-0 rounded-full overflow-hidden flex">
            <div className="h-full bg-rose-200" style={{ width: `${dangerPct}%` }} />
            <div className="h-full bg-amber-100" style={{ width: `${warnPct - dangerPct}%` }} />
            <div className="h-full bg-emerald-100 flex-1" />
          </div>
          {isSimulating && (
            <>
              <div className="absolute top-0 bottom-0 w-0.5 bg-violet-400 opacity-60" style={{ left: `${simBarPct}%` }} />
              <div className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 bg-white transition-all ${simIsRed ? 'border-rose-500' : simIsYellow ? 'border-amber-400' : 'border-emerald-500'}`} style={{ left: `${simBarPct}%` }} />
            </>
          )}
          <div className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md transition-all ${isRed ? 'bg-rose-500' : isYellow ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ left: `${barPct}%` }} />
          <div className="absolute top-0 bottom-0 w-0.5 bg-rose-400" style={{ left: `${dangerPct}%` }} />
          <div className="absolute top-0 bottom-0 w-0.5 bg-amber-400" style={{ left: `${warnPct}%` }} />
        </div>
        <div className="relative h-5 mt-1">
          <span className="absolute -translate-x-1/2 text-[10px] text-rose-500 font-medium" style={{ left: `${dangerPct}%` }}>▲ 130%<br />追繳線</span>
          <span className="absolute -translate-x-1/2 text-[10px] text-amber-500 font-medium" style={{ left: `${warnPct}%` }}>▲ 166%<br />警戒線</span>
        </div>
      </div>
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5"><span className="text-base">📉</span> 跌幅模擬</span>
          <div className="flex items-center gap-2">
            {isSimulating && <button onClick={() => setDropPct(0)} className="text-[10px] text-violet-500 hover:text-violet-700 font-medium transition-colors">重置</button>}
            <span className={`text-sm font-bold tabular-nums min-w-[3rem] text-right ${isSimulating ? 'text-violet-600' : 'text-gray-400'}`}>{dropPct === 0 ? '無模擬' : `-${dropPct}%`}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {[10, 20, 30, 40, 50].map(p => (
            <button key={p} onClick={() => setDropPct(p)} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${dropPct === p ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>-{p}%</button>
          ))}
          <button onClick={() => setDropPct(0)} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${dropPct === 0 ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>重置</button>
        </div>
        <input type="range" min={0} max={60} step={1} value={dropPct} onChange={e => setDropPct(Number(e.target.value))} className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-violet-500 bg-gray-200" />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-0.5"><span>0%</span><span>-15%</span><span>-30%</span><span>-45%</span><span>-60%</span></div>
        {isSimulating && (
          <div className={`mt-4 rounded-xl border p-4 ${simIsRed ? 'bg-rose-50 border-rose-200' : simIsYellow ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${simBadgeBg} ${simTextClass}`}><SimIcon className="w-3 h-3" />{simStatusText}</span>
                <span className="text-xs text-gray-500">若持股整體下跌 <span className="font-bold text-violet-600">{dropPct}%</span></span>
              </div>
              <span className={`text-2xl font-bold tabular-nums ${simTextClass}`}>{simRatio.toFixed(1)}%</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/70 rounded-lg p-2.5"><p className="text-[10px] text-gray-400 mb-0.5">模擬擔保品市值</p><p className={`text-xs font-bold tabular-nums ${simTextClass}`}>{Math.round(simCollateral).toLocaleString()}</p><p className="text-[10px] text-gray-400">TWD <span className="text-rose-500">▼ {Math.round(totalCollateralValueTWD - simCollateral).toLocaleString()}</span></p></div>
              <div className="bg-white/70 rounded-lg p-2.5"><p className="text-[10px] text-gray-400 mb-0.5">融資借款</p><p className="text-xs font-bold text-gray-700 tabular-nums">{totalBorrowValue.toLocaleString()}</p><p className="text-[10px] text-gray-400">TWD（不變）</p></div>
              <div className="bg-white/70 rounded-lg p-2.5"><p className="text-[10px] text-gray-400 mb-0.5">{simIsRed ? '追繳缺口' : '安全緩衝'}</p><p className={`text-xs font-bold tabular-nums ${simIsRed ? 'text-rose-600' : 'text-emerald-600'}`}>{simIsRed ? '-' : '+'}{(simIsRed ? simShortage : simBuffer).toLocaleString()}</p><p className="text-[10px] text-gray-400">TWD</p></div>
            </div>
            {simIsRed && (
              <div className="mt-4 pt-4 border-t border-rose-200/50">
                <p className="text-xs font-bold text-rose-700 mb-2 flex items-center gap-1.5"><AlertOctagon className="w-4 h-4" /> 補救方案試算</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white/80 rounded-lg p-3 border border-rose-100"><p className="text-[10px] text-gray-500 mb-1">方案 A：補充現金 (償還借款)</p><p className="text-sm font-bold text-rose-600">需償還 {Math.ceil(totalBorrowValue - simCollateral / 1.3).toLocaleString()} TWD</p><p className="text-[10px] text-gray-400 mt-0.5">償還後維持率可回升至 130%</p></div>
                  <div className="bg-white/80 rounded-lg p-3 border border-rose-100"><p className="text-[10px] text-gray-500 mb-1">方案 B：補充擔保品 (匯入股票)</p><p className="text-sm font-bold text-rose-600">需匯入市值 {Math.ceil(totalBorrowValue * 1.3 - simCollateral).toLocaleString()} TWD</p><p className="text-[10px] text-gray-400 mt-0.5">匯入後維持率可回升至 130%</p></div>
                </div>
                <p className="mt-3 text-[10px] text-rose-500/80 leading-relaxed italic">* 建議預留更多緩衝，若要回升至 166% 警戒線，需補充約 {Math.ceil(totalBorrowValue * 1.66 - simCollateral).toLocaleString()} TWD 市值之股票。</p>
              </div>
            )}
            {simIsYellow && !simIsRed && (
              <p className="mt-3 text-xs text-amber-600 bg-amber-100 rounded-lg px-3 py-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />持股下跌 {dropPct}% 後將進入警戒區間。建議預留更多擔保品或部分還款。</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2：InstallmentLoanCard.tsx**

```tsx
// src/components/debt/InstallmentLoanCard.tsx
"use client";
import { useState } from 'react';
import { CreditCard, Pencil, Trash2, Check, X, RefreshCw, ChevronDown } from 'lucide-react';
import { useAppContext, type LoanItem } from '../../context/AppContext';
import { calcEndDate, generateSchedule, isPaymentDue } from '../../lib/loanUtils';

export function InstallmentLoanCard({ loan, onRecord, onDelete, onUpdate }: {
  loan: LoanItem; onRecord: () => void; onDelete: () => void; onUpdate: (d: Partial<LoanItem>) => void;
}) {
  const { showValues } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [ep, setEp] = useState(loan.principal.toString());
  const [eip, setEip] = useState((loan.initialPrincipal ?? '').toString());
  const [er, setEr] = useState(loan.interestRate.toString());
  const [em, setEm] = useState(loan.monthlyPayment.toString());
  const [ed, setEd] = useState(loan.paymentDay.toString());
  const [ek, setEk] = useState(loan.remainingPeriods.toString());
  const [eop, setEop] = useState(loan.originalPeriods.toString());
  const [enpd, setEnpd] = useState(loan.nextPaymentDate ?? '');

  const interest = Math.round(loan.principal * loan.interestRate / 100 / 12);
  const principalPart = loan.monthlyPayment - interest;
  const afterPay = Math.max(0, loan.principal - principalPart);
  const progress = loan.originalPeriods > 0 ? ((loan.originalPeriods - loan.remainingPeriods) / loan.originalPeriods) * 100 : 0;
  const isPaidOff = loan.principal <= 0 || loan.remainingPeriods <= 0;
  const endDate = calcEndDate(loan.nextPaymentDate, loan.remainingPeriods);
  const isDue = !isPaidOff && isPaymentDue(loan.nextPaymentDate);
  const schedule = isExpanded ? generateSchedule(loan) : [];
  const paidCount = loan.originalPeriods - loan.remainingPeriods;
  const initPrincipal = loan.initialPrincipal ?? loan.principal;
  const paidAmount = initPrincipal - loan.principal;

  const handleSave = () => {
    onUpdate({ principal: Number(ep) || 0, initialPrincipal: eip ? Number(eip) : undefined, interestRate: Number(er) || 0, monthlyPayment: Number(em) || 0, paymentDay: Number(ed) || 0, remainingPeriods: Number(ek) || 0, originalPeriods: Number(eop) || 0, nextPaymentDate: enpd || undefined });
    setIsEditing(false);
  };

  if (isEditing) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex justify-between items-center mb-3">
        <span className="font-bold text-gray-800">{loan.name}（{loan.bank}）</span>
        <button onClick={onDelete} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><label className="block text-xs text-gray-500 mb-1">初始貸款金額</label><input type="number" value={eip} onChange={e => setEip(e.target.value)} className="w-full border rounded-lg p-2 text-sm" placeholder="選填" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">目前餘額</label><input type="number" value={ep} onChange={e => setEp(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">年利率 (%)</label><input type="number" step="0.01" value={er} onChange={e => setEr(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">月還款額</label><input type="number" value={em} onChange={e => setEm(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">繳款日（幾號）</label><input type="number" value={ed} min="1" max="31" onChange={e => setEd(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">剩餘期數</label><input type="number" value={ek} onChange={e => setEk(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">初始總期數</label><input type="number" value={eop} onChange={e => setEop(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">下次還款日</label><input type="date" value={enpd} onChange={e => setEnpd(e.target.value)} className="w-full border rounded-lg p-2 text-sm text-gray-600" /></div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 flex items-center gap-1"><Check className="w-4 h-4" /> 儲存</button>
        <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm flex items-center gap-1"><X className="w-4 h-4" /> 取消</button>
      </div>
    </div>
  );

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isPaidOff ? 'border-emerald-200' : 'border-gray-100'}`}>
      <div className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-9 h-9 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center shrink-0"><CreditCard className="w-4 h-4" /></div>
            <span className="font-bold text-gray-900">{loan.name}</span>
            <span className="text-xs text-gray-400">{loan.bank}</span>
            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-full">分期</span>
            {isPaidOff && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">已清償</span>}
            {isDue && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full animate-pulse">還款日已到</span>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!isPaidOff && (
              confirming ? (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5 text-sm">
                  <span className="text-rose-700 font-medium">負債 −{showValues ? loan.monthlyPayment.toLocaleString('en-US') : '****'}</span>
                  <button onClick={() => { onRecord(); setConfirming(false); }} className="text-rose-600 hover:text-rose-800"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setConfirming(false)} className="text-gray-400"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <button onClick={() => setConfirming(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" /> 記錄還款
                </button>
              )
            )}
            <button onClick={() => setIsEditing(true)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => setIsExpanded(v => !v)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
        {isPaidOff ? (
          <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
            <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs shrink-0">✓</div>
            <span className="text-sm font-medium text-emerald-700">此筆貸款已完全清償</span>
          </div>
        ) : (
          <div className="mb-4 bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">還款進度</span>
              <span className="text-sm font-bold text-rose-600 tabular-nums">{Math.round(progress)}%</span>
            </div>
            <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-3 bg-gradient-to-r from-rose-400 to-rose-500 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
              {[25, 50, 75].map(pct => (<div key={pct} className="absolute inset-y-0 w-px bg-white/60" style={{ left: `${pct}%` }} />))}
            </div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-gray-500">已還 <b className="text-gray-700 tabular-nums">{paidCount}</b> 期{loan.initialPrincipal && <span className="text-gray-400 ml-1">（−{paidAmount.toLocaleString('en-US')}）</span>}</span>
              <span className="text-gray-500">剩餘 <b className="text-rose-600 tabular-nums">{loan.remainingPeriods}</b><span className="text-gray-400"> / {loan.originalPeriods} 期</span></span>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-50 rounded-xl p-3"><p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">初始貸款</p><p className="font-bold text-gray-700">{(loan.initialPrincipal ?? loan.principal).toLocaleString('en-US')}</p></div>
          <div className="bg-rose-50 rounded-xl p-3"><p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">目前餘額</p><p className="font-bold text-rose-600">{loan.principal.toLocaleString('en-US')}</p></div>
          <div className="bg-gray-50 rounded-xl p-3"><p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">每月還款</p><p className="font-bold text-gray-700">{loan.monthlyPayment.toLocaleString('en-US')}</p></div>
          <div className="bg-indigo-50 rounded-xl p-3"><p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">預計到期</p><p className="font-bold text-indigo-600">{endDate}</p></div>
        </div>
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">年利率</span><b className="text-amber-600">{loan.interestRate}%</b></div>
              <div className="flex justify-between"><span className="text-gray-500">繳款日</span><b>每月 {loan.paymentDay} 日</b></div>
              <div className="flex justify-between"><span className="text-gray-500">下次還款</span><b className={isDue ? 'text-amber-600' : 'text-indigo-600'}>{loan.nextPaymentDate || '—'}</b></div>
              <div className="flex justify-between"><span className="text-gray-500">剩餘 / 總期數</span><b>{loan.remainingPeriods}<span className="text-gray-400 font-normal"> / {loan.originalPeriods}</span></b></div>
              <div className="flex justify-between"><span className="text-gray-500">本月利息</span><b className="text-rose-500">{interest.toLocaleString('en-US')}</b></div>
              <div className="flex justify-between"><span className="text-gray-500">還款後餘額</span><b className="text-gray-700">{afterPay.toLocaleString('en-US')}</b></div>
            </div>
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">攤還表</span>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {paidCount > 0 && <button onClick={() => setShowHistory(v => !v)} className="text-indigo-500 hover:text-indigo-700 font-medium">{showHistory ? '隱藏已還' : `顯示已還 ${paidCount} 期`}</button>}
                  <span>{loan.remainingPeriods} 期待還</span>
                </div>
              </div>
              <div className="overflow-y-auto max-h-64">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white border-b border-gray-100">
                    <tr className="text-gray-400">
                      <th className="px-4 py-2 text-left font-medium">期別</th>
                      <th className="px-4 py-2 text-left font-medium">還款日</th>
                      <th className="px-4 py-2 text-right font-medium">貸款餘額</th>
                      <th className="px-4 py-2 text-right font-medium">每月應付 (本金/利息)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {schedule.filter(row => showHistory || !row.isPaid).map(row => (
                      <tr key={row.period} className={row.isPaid ? 'opacity-40' : row.period === paidCount + 1 ? 'bg-amber-50' : ''}>
                        <td className="px-4 py-2 font-medium text-gray-700">{String(row.period).padStart(4, '0')}{row.isPaid && <span className="ml-1 text-emerald-500 text-[10px]">✓</span>}{row.period === paidCount + 1 && !row.isPaid && <span className="ml-1 text-amber-500 text-[10px]">← 本期</span>}</td>
                        <td className="px-4 py-2 text-gray-500">{row.date}</td>
                        <td className="px-4 py-2 text-right text-gray-700 font-medium">{showValues ? `$${row.endingBalance.toLocaleString('en-US')}` : '****'}</td>
                        <td className="px-4 py-2 text-right"><div className="font-bold text-gray-900">{showValues ? `$${row.payment.toLocaleString('en-US')}` : '****'}</div><div className="text-[10px] text-gray-400">{showValues ? `$${row.principal.toLocaleString('en-US')} / $${row.interest.toLocaleString('en-US')}` : '****'}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3：LoanSection.tsx**

```tsx
// src/components/debt/LoanSection.tsx
"use client";
import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { type LoanItem, type LoanType } from '../../context/AppContext';
import { SectionHeader } from './SectionHeader';
import { InstallmentLoanCard } from './InstallmentLoanCard';
import { RevolvingLoanCard } from './RevolvingLoanCard';

export function LoanSection({ installmentLoans, revolvingLoans, onRecord, onDelete, onUpdate, onAdd }: {
  installmentLoans: LoanItem[];
  revolvingLoans: LoanItem[];
  onRecord: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onUpdate: (id: string, data: Partial<LoanItem>) => void;
  onAdd: (loan: Omit<LoanItem, 'id'>) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newLoanType, setNewLoanType] = useState<LoanType>('installment');
  const [name, setName] = useState('');
  const [bank, setBank] = useState('');
  const [principal, setPrincipal] = useState('');
  const [initPrincipal, setInitPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [payment, setPayment] = useState('');
  const [payDay, setPayDay] = useState('');
  const [remainPeriods, setRemainPeriods] = useState('');
  const [totalPeriods, setTotalPeriods] = useState('');
  const [nextPayDate, setNextPayDate] = useState('');

  const resetForm = () => {
    setName(''); setBank(''); setPrincipal(''); setInitPrincipal('');
    setRate(''); setPayment(''); setPayDay(''); setRemainPeriods('');
    setTotalPeriods(''); setNextPayDate(''); setNewLoanType('installment');
  };

  const handleAdd = () => {
    if (!name.trim() || !principal) return;
    const rp = Number(remainPeriods) || 0;
    const op = Number(totalPeriods) || rp;
    onAdd({ name, bank: bank || '未知銀行', principal: Number(principal), initialPrincipal: initPrincipal ? Number(initPrincipal) : undefined, interestRate: Number(rate) || 0, monthlyPayment: Number(payment) || 0, paymentDay: Number(payDay) || 0, remainingPeriods: rp, loanType: newLoanType, originalPeriods: op, nextPaymentDate: nextPayDate || undefined });
    resetForm();
    setIsAdding(false);
  };

  return (
    <div>
      <SectionHeader title="信貸" color="bg-rose-500">
        <button onClick={() => setIsAdding(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-medium hover:bg-rose-100 transition-colors">
          <Plus className="w-3.5 h-3.5" /> 新增信貸
        </button>
      </SectionHeader>
      {isAdding && (
        <div className="mb-4 bg-rose-50/60 rounded-2xl border border-rose-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-medium text-gray-700">類型：</span>
            <div className="flex rounded-lg overflow-hidden border border-rose-200 text-xs font-medium">
              <button onClick={() => setNewLoanType('installment')} className={`px-3 py-1.5 ${newLoanType === 'installment' ? 'bg-rose-500 text-white' : 'bg-white text-gray-600 hover:bg-rose-50'}`}>分期還款</button>
              <button onClick={() => setNewLoanType('revolving')} className={`px-3 py-1.5 ${newLoanType === 'revolving' ? 'bg-rose-500 text-white' : 'bg-white text-gray-600 hover:bg-rose-50'}`}>循環借款</button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="block text-xs text-gray-500 mb-1">名稱</label><input autoFocus type="text" value={name} onChange={e => setName(e.target.value)} placeholder="信貸A" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">銀行</label><input type="text" value={bank} onChange={e => setBank(e.target.value)} placeholder="樂天" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">初始貸款金額</label><input type="number" value={initPrincipal} onChange={e => setInitPrincipal(e.target.value)} placeholder="1000000" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">目前餘額</label><input type="number" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="800000" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">年利率 (%)</label><input type="number" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="2.08" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">每月{newLoanType === 'installment' ? '還款額' : '利息'}</label><input type="number" value={payment} onChange={e => setPayment(e.target.value)} placeholder="10242" className="w-full border rounded-lg p-2 text-sm" /></div>
            {newLoanType === 'installment' && <>
              <div><label className="block text-xs text-gray-500 mb-1">繳款日（幾號）</label><input type="number" value={payDay} onChange={e => setPayDay(e.target.value)} placeholder="11" min="1" max="31" className="w-full border rounded-lg p-2 text-sm" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">剩餘期數</label><input type="number" value={remainPeriods} onChange={e => setRemainPeriods(e.target.value)} placeholder="68" className="w-full border rounded-lg p-2 text-sm" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">初始總期數</label><input type="number" value={totalPeriods} onChange={e => setTotalPeriods(e.target.value)} placeholder="84" className="w-full border rounded-lg p-2 text-sm" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">下次還款日</label><input type="date" value={nextPayDate} onChange={e => setNextPayDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm text-gray-600" /></div>
            </>}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleAdd} className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700 flex items-center gap-1"><Check className="w-4 h-4" /> 確認新增</button>
            <button onClick={() => { resetForm(); setIsAdding(false); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300">取消</button>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {installmentLoans.map(l => (<InstallmentLoanCard key={l.id} loan={l} onRecord={() => onRecord(l.id)} onDelete={() => onDelete(l.id, `${l.name}（${l.bank}）`)} onUpdate={data => onUpdate(l.id, data)} />))}
        {revolvingLoans.map(l => (<RevolvingLoanCard key={l.id} loan={l} onDelete={() => onDelete(l.id, `${l.name}（${l.bank}）`)} onUpdate={data => onUpdate(l.id, data)} />))}
        {installmentLoans.length === 0 && revolvingLoans.length === 0 && !isAdding && (
          <div className="py-8 text-center text-gray-400 text-sm bg-white rounded-2xl border border-dashed border-gray-200">尚無信貸項目</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4：驗證 TypeScript**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -30
```

---

## Task 5：縮減 debt/page.tsx

**Files:**
- Modify: `src/app/debt/page.tsx`

- [ ] **Step 1：將 debt/page.tsx 替換為精簡版**（保留 BorrowingPage 主體，刪除所有 helpers 和子組件定義）

最終 `src/app/debt/page.tsx` 內容：

```tsx
"use client";

import { useState, useMemo, useEffect } from 'react';
import { AlertTriangle, AlertOctagon } from 'lucide-react';
import { useAppContext, type StakingItem, type LoanItem } from '../../context/AppContext';
import { PledgeAlertBanner } from '../../components/PledgeAlertBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { LoanRefinanceCalc } from '../../components/LoanRefinanceCalc';
import { LoanPayoffTimeline } from '../../components/LoanPayoffTimeline';
import { LoanSection } from '../../components/debt/LoanSection';
import { BorrowSection } from '../../components/debt/BorrowSection';
import { StakingSection } from '../../components/debt/StakingSection';
import { PaymentDueDialog } from '../../components/debt/PaymentDueDialog';
import { isPaymentDue } from '../../lib/loanUtils';

export default function BorrowingPage() {
  const {
    loans, setLoans, recordLoanPayment,
    stakingItems, setStakingItems,
    borrowingLimits, setBorrowingLimits,
    stockItems, stockQuotes, usdToTwd,
    pledgeAlertLastSent, setPledgeAlertLastSent,
    userEmail, showValues, enablePledgeTracking,
  } = useAppContext();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<{ label: string; action: () => void } | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const installmentLoans = loans.filter(l => l.loanType === 'installment');
  const revolvingLoans   = loans.filter(l => l.loanType === 'revolving');
  const borrowStaking    = stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'borrow');
  const earnStaking      = stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'earn');

  const dueLoans = useMemo(() =>
    installmentLoans.filter(l => l.principal > 0 && l.remainingPeriods > 0 && isPaymentDue(l.nextPaymentDate)),
    [installmentLoans]
  );

  useEffect(() => {
    if (dueLoans.length > 0) setShowPaymentDialog(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const expiringItems = useMemo(() => {
    const today = new Date();
    return borrowStaking
      .filter(item => !!item.repayDate)
      .map(item => ({ ...item, daysLeft: Math.ceil((new Date(item.repayDate!).getTime() - today.getTime()) / 86400000) }))
      .filter(item => item.daysLeft <= 30)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [borrowStaking]);

  const totalLoanPrincipal  = loans.reduce((s, l) => s + l.principal, 0);
  const totalLoanMonthly    = loans.reduce((s, l) => s + l.monthlyPayment, 0);
  const totalBorrowValue    = borrowStaking.reduce((s, i) => s + i.value, 0);
  const totalBorrowInterest = borrowStaking.reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0);
  const totalEarnValue      = earnStaking.reduce((s, i) => s + i.value, 0);
  const totalEarnIncome     = earnStaking.reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0);

  const borrowByPlatform = useMemo(() => {
    const map: Record<string, StakingItem[]> = {};
    for (const item of borrowStaking) {
      const p = (item.protocol || '未分類').trim();
      if (!map[p]) map[p] = [];
      map[p].push(item);
    }
    return map;
  }, [borrowStaking]);

  const pledgePlatforms = useMemo(() => Object.keys(borrowByPlatform), [borrowByPlatform]);

  const collateralByPlatform = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of stockItems) {
      if (!item.collateralShares) continue;
      const quote = stockQuotes[item.symbol];
      if (!quote) continue;
      const value = quote.price * item.collateralShares;
      const twdValue = quote.currency === 'USD' ? value * usdToTwd : value;
      const p = (item.platform || '未分類').trim();
      map[p] = (map[p] || 0) + twdValue;
    }
    return map;
  }, [stockItems, stockQuotes, usdToTwd]);

  const { minRatio, minPlatform, allPlatformRatios } = useMemo(() => {
    let min = Infinity, minP = '';
    const allRatios: Array<{ platform: string; ratio: number; borrowValue: number; collateralValue: number }> = [];
    for (const platform of pledgePlatforms) {
      const borrow = (borrowByPlatform[platform] || []).reduce((s, i) => s + i.value, 0);
      const collateral = collateralByPlatform[platform] || 0;
      const ratio = borrow > 0 ? (collateral / borrow) * 100 : Infinity;
      allRatios.push({ platform, ratio: ratio === Infinity ? 0 : ratio, borrowValue: borrow, collateralValue: collateral });
      if (borrow > 0 && ratio < min) { min = ratio; minP = platform; }
    }
    return { minRatio: min === Infinity ? 0 : min, minPlatform: minP, allPlatformRatios: allRatios };
  }, [pledgePlatforms, borrowByPlatform, collateralByPlatform]);

  const alertLevel: 'warning' | 'danger' | null =
    minRatio > 0 && minPlatform ? (minRatio < 167 ? 'danger' : minRatio < 200 ? 'warning' : null) : null;

  useEffect(() => {
    if (!alertLevel || !userEmail || !minPlatform) return;
    const today = new Date().toISOString().split('T')[0];
    if (pledgeAlertLastSent[alertLevel] === today) return;
    fetch('/api/pledge-alert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientEmail: userEmail, alertLevel, platformName: minPlatform, ratio: minRatio, pledgeData: allPlatformRatios }) })
      .then(res => { if (res.ok) setPledgeAlertLastSent(prev => ({ ...prev, [alertLevel]: today })); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertLevel, minRatio, minPlatform]);

  const handleDeleteLoan    = (id: string, name: string) => setDeleteTarget({ label: name, action: () => { setLoans(prev => prev.filter(l => l.id !== id)); toast(`已刪除「${name}」`, 'info'); } });
  const handleUpdateLoan    = (id: string, data: Partial<LoanItem>) => setLoans(prev => prev.map(l => l.id === id ? { ...l, ...data } : l));
  const handleAddLoan       = (loan: Omit<LoanItem, 'id'>) => setLoans(prev => [...prev, { ...loan, id: Date.now().toString() }]);
  const handleDeleteStaking = (id: string, name: string) => setDeleteTarget({ label: name, action: () => { setStakingItems(prev => prev.filter(i => i.id !== id)); toast(`已刪除「${name}」`, 'info'); } });
  const handleUpdateStaking = (id: string, data: Partial<StakingItem>) => setStakingItems(prev => prev.map(i => i.id === id ? { ...i, ...data } : i));
  const handleAddStaking    = (item: Omit<StakingItem, 'id'>) => setStakingItems(prev => [...prev, { ...item, id: Date.now().toString() }]);

  return (
    <>
      {enablePledgeTracking && alertLevel && <PledgeAlertBanner level={alertLevel} platformName={minPlatform} ratio={minRatio} />}
      {expiringItems.map(item => {
        const isDanger = item.daysLeft <= 7;
        return (
          <div key={`expiry-${item.id}`} className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-3 ${isDanger ? 'bg-red-50 border-red-300 text-red-800' : 'bg-yellow-50 border-yellow-300 text-yellow-800'}`}>
            {isDanger ? <AlertOctagon className="w-5 h-5 shrink-0 text-red-600" /> : <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-600" />}
            <p className="flex-1 text-sm font-medium">{isDanger ? `⚠️ 緊急：「${item.name}」（${item.protocol}）質押借款將於 ${item.daysLeft} 天後到期（${item.repayDate}），請立即安排還款` : `⏰ 注意：「${item.name}」（${item.protocol}）質押借款將於 ${item.daysLeft} 天後到期（${item.repayDate}）`}</p>
          </div>
        );
      })}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">負債 &amp; 生息資產</h1>
        <p className="text-sm text-gray-500 mt-1">信貸、質押借款與活儲的統整追蹤</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3"><div className="w-2 h-7 bg-rose-500 rounded-full" /><span className="font-bold text-gray-700">信貸</span></div>
          <p className="text-xs text-gray-500">總負債</p>
          <p className="text-xl font-bold text-rose-600 mb-1">{showValues ? totalLoanPrincipal.toLocaleString('en-US') : '****'}</p>
          <p className="text-xs text-gray-500">每月還款 <span className="font-semibold text-gray-800">{showValues ? totalLoanMonthly.toLocaleString('en-US') : '****'}</span></p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3"><div className="w-2 h-7 bg-indigo-500 rounded-full" /><span className="font-bold text-gray-700">質押借款</span></div>
          <p className="text-xs text-gray-500">借款本金</p>
          <p className="text-xl font-bold text-indigo-700 mb-1">{showValues ? totalBorrowValue.toLocaleString('en-US') : '****'}</p>
          <p className="text-xs text-gray-500">每月利息 <span className="font-semibold text-rose-600">{showValues ? Math.round(totalBorrowInterest).toLocaleString('en-US') : '****'}</span></p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3"><div className="w-2 h-7 bg-emerald-500 rounded-full" /><span className="font-bold text-gray-700">活儲 / Earn</span></div>
          <p className="text-xs text-gray-500">存入資產</p>
          <p className="text-xl font-bold text-emerald-600 mb-1">{showValues ? totalEarnValue.toLocaleString('en-US') : '****'}</p>
          <p className="text-xs text-gray-500">每月收益 <span className="font-semibold text-emerald-600">{showValues ? Math.round(totalEarnIncome).toLocaleString('en-US') : '****'}</span></p>
        </div>
      </div>

      <LoanSection installmentLoans={installmentLoans} revolvingLoans={revolvingLoans} onRecord={recordLoanPayment} onDelete={handleDeleteLoan} onUpdate={handleUpdateLoan} onAdd={handleAddLoan} />
      <LoanPayoffTimeline />
      <LoanRefinanceCalc />
      <div className="my-8 border-t border-gray-100" />
      <BorrowSection pledgePlatforms={pledgePlatforms} borrowByPlatform={borrowByPlatform} collateralByPlatform={collateralByPlatform} borrowingLimits={borrowingLimits} setBorrowingLimits={setBorrowingLimits} onAdd={handleAddStaking} onUpdate={handleUpdateStaking} onDelete={handleDeleteStaking} />
      <div className="my-8 border-t border-gray-100" />
      <StakingSection title="活儲 / Earn" accentColor="bg-emerald-500" type="earn" items={earnStaking} onAdd={handleAddStaking} onUpdate={handleUpdateStaking} onDelete={handleDeleteStaking} />

      {deleteTarget && <ConfirmDialog message={`確定要刪除「${deleteTarget.label}」嗎？`} onConfirm={() => { deleteTarget.action(); setDeleteTarget(null); }} onCancel={() => setDeleteTarget(null)} />}
      {showPaymentDialog && dueLoans.length > 0 && <PaymentDueDialog loans={dueLoans} onRecord={id => { recordLoanPayment(id); toast('還款已記錄'); }} onClose={() => setShowPaymentDialog(false)} />}
    </>
  );
}
```

- [ ] **Step 2：確認 build 無誤**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "debt" | head -20
```

- [ ] **Step 3：Commit**

```bash
git add src/lib/loanUtils.ts src/components/debt/ src/app/debt/page.tsx
git commit -m "refactor(debt): extract 10 sub-components + loanUtils, page 1431→290 lines"
```

---

## Task 6：建立 stocks 子組件與 hook

**Files:**
- Create: `src/hooks/useNameLookup.ts`
- Create: `src/components/stocks/StockAvatar.tsx`
- Create: `src/components/stocks/MarketSelector.tsx`
- Create: `src/components/stocks/PortfolioTrendChart.tsx`

- [ ] **Step 1：useNameLookup.ts**

```ts
// src/hooks/useNameLookup.ts
"use client";
import { useState, useEffect } from 'react';

const nameCache = new Map<string, string>();

export function useNameLookup(symbol: string): string {
  const [name, setName] = useState(() => nameCache.get(symbol) ?? '');
  useEffect(() => {
    if (!symbol) { setName(''); return; }
    if (nameCache.has(symbol)) { setName(nameCache.get(symbol)!); return; }
    const isTW = symbol.endsWith('.TW') || symbol.endsWith('.TWO');
    const t = setTimeout(async () => {
      try {
        if (isTW) {
          const code = symbol.replace(/\.(TW|TWO)$/, '');
          const res = await fetch(`/api/twse-name?code=${code}`);
          if (res.ok) { const data = await res.json(); const n = data.name || ''; nameCache.set(symbol, n); setName(n); return; }
        }
        const res = await fetch(`/api/quote?symbols=${symbol}`);
        if (res.ok) { const data = await res.json(); const n = data[symbol]?.shortName || ''; nameCache.set(symbol, n); setName(n); }
      } catch { setName(''); }
    }, 500);
    return () => clearTimeout(t);
  }, [symbol]);
  return name;
}
```

- [ ] **Step 2：StockAvatar.tsx**

```tsx
// src/components/stocks/StockAvatar.tsx
"use client";
import { useState } from 'react';

type Market = '台股' | '美股' | '其他';

const MARKET_GRADIENT: Record<Market, string> = {
  '台股': 'from-emerald-400 to-emerald-600',
  '美股': 'from-blue-400 to-blue-600',
  '其他': 'from-orange-400 to-orange-500',
};

export function StockAvatar({ symbol, market, displayName }: { symbol: string; market: Market; displayName: string }) {
  const [imgError, setImgError] = useState(false);
  const code = symbol.replace(/\.(TW|TWO)$/, '');
  const logoUrl = `https://assets.parqet.com/logos/symbol/${code}?variant=light`;
  const fallbackChar = displayName ? Array.from(displayName)[0] : code.slice(0, 2);

  if (!imgError) return (
    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-100">
      <img src={logoUrl} alt={code} className="w-full h-full object-contain p-1" onError={() => setImgError(true)} />
    </div>
  );
  return (
    <div className={`w-12 h-12 rounded-xl flex-shrink-0 bg-gradient-to-br ${MARKET_GRADIENT[market]} flex items-center justify-center`}>
      <span className="text-white font-bold text-sm leading-none">{fallbackChar}</span>
    </div>
  );
}
```

- [ ] **Step 3：MarketSelector.tsx**（同時 export 共用型別與 helpers）

```tsx
// src/components/stocks/MarketSelector.tsx
"use client";

export type Market = '台股' | '美股' | '其他';

export const LOT_SIZE = 1000;

export function sharesToUnit(shares: number, market: Market): { value: number; unit: string } {
  if (market === '台股') return { value: shares / LOT_SIZE, unit: '張' };
  return { value: shares, unit: '股' };
}

export function unitToShares(lots: number, market: Market): number {
  return market === '台股' ? lots * LOT_SIZE : lots;
}

export function getMarket(symbol: string): Market {
  if (symbol.endsWith('.TW') || symbol.endsWith('.TWO')) return '台股';
  return '美股';
}

export function toSymbol(raw: string, market: Market): string {
  const upper = raw.trim().toUpperCase();
  if (market === '台股' && upper && !upper.includes('.')) return upper + '.TW';
  return upper;
}

export const MARKET_GRADIENT: Record<Market, string> = {
  '台股': 'from-emerald-400 to-emerald-600',
  '美股': 'from-blue-400 to-blue-600',
  '其他': 'from-orange-400 to-orange-500',
};

export const MARKET_BADGE: Record<Market, string> = {
  '台股': 'bg-emerald-100 text-emerald-700',
  '美股': 'bg-blue-100 text-blue-700',
  '其他': 'bg-orange-100 text-orange-700',
};

export function MarketSelector({ value, onChange }: { value: Market; onChange: (m: Market) => void }) {
  const options: Market[] = ['台股', '美股', '其他'];
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium w-fit">
      {options.map(m => (
        <button key={m} type="button" onClick={() => onChange(m)} className={`px-3 py-1.5 transition-colors ${value === m ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{m}</button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4：PortfolioTrendChart.tsx**（直接從 stocks/page.tsx lines 114-312 搬移）

```tsx
// src/components/stocks/PortfolioTrendChart.tsx
"use client";
import { useState, useEffect, useRef } from 'react';
import { BarChart2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { StockItem } from '../../context/AppContext';

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y';
type DailyBar = { date: string; close: number };
type ChartPoint = { date: string; value: number };

const RANGES: { key: TimeRange; label: string; days: number }[] = [
  { key: '1W', label: '每日', days: 7 }, { key: '1M', label: '1月', days: 30 },
  { key: '3M', label: '3月', days: 90 }, { key: '6M', label: '6月', days: 180 },
  { key: '1Y', label: '1年', days: 365 },
];

export function PortfolioTrendChart({ stockItems, usdToTwd }: { stockItems: StockItem[]; usdToTwd: number }) {
  const [range, setRange] = useState<TimeRange>('1M');
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changeInfo, setChangeInfo] = useState<{ value: number; pct: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (stockItems.length === 0) { setChartData([]); setChangeInfo(null); return; }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const days = RANGES.find(r => r.key === range)!.days;
    const now = new Date();
    const p2 = now.toISOString().slice(0, 10);
    const p1 = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
    setLoading(true); setError(null);
    (async () => {
      try {
        const uniqueSymbols = Array.from(new Set(stockItems.map(i => i.symbol)));
        const fetchResults = await Promise.all(uniqueSymbols.map(async symbol => {
          try {
            const res = await fetch(`/api/history?symbol=${encodeURIComponent(symbol)}&period1=${p1}&period2=${p2}`, { signal: ctrl.signal });
            if (!res.ok) return { symbol, bars: [] as DailyBar[] };
            return { symbol, bars: (await res.json()) as DailyBar[] };
          } catch { return { symbol, bars: [] as DailyBar[] }; }
        }));
        const barsMap = new Map(fetchResults.map(r => [r.symbol, r.bars]));
        const results = stockItems.map(item => ({ item, bars: barsMap.get(item.symbol) ?? [] as DailyBar[] }));
        if (ctrl.signal.aborted) return;
        const allDates = new Set<string>();
        for (const { bars } of results) for (const b of bars) allDates.add(b.date);
        const sortedDates = Array.from(allDates).sort();
        if (sortedDates.length === 0) { setChartData([]); setChangeInfo(null); return; }
        const priceMaps = results.map(({ bars }) => {
          const m = new Map<string, number>(); for (const b of bars) m.set(b.date, b.close); return { map: m, sorted: bars };
        });
        const points: ChartPoint[] = sortedDates.map(date => {
          let total = 0;
          for (let i = 0; i < results.length; i++) {
            const { item } = results[i];
            if (item.purchaseDate && date < item.purchaseDate) continue;
            const { map, sorted } = priceMaps[i];
            let price = map.get(date);
            if (price === undefined) { for (let j = sorted.length - 1; j >= 0; j--) { if (sorted[j].date <= date) { price = sorted[j].close; break; } } }
            if (price === undefined) continue;
            const isUSD = !item.symbol.endsWith('.TW') && !item.symbol.endsWith('.TWO');
            total += price * item.shares * (isUSD ? usdToTwd : 1);
          }
          return { date, value: Math.round(total) };
        });
        setChartData(points);
        if (points.length >= 2) { const first = points[0].value, last = points[points.length - 1].value; const diff = last - first; setChangeInfo({ value: diff, pct: first > 0 ? (diff / first) * 100 : 0 }); }
        else setChangeInfo(null);
      } catch { if (!ctrl.signal.aborted) setError('無法載入歷史數據'); }
      finally { if (!ctrl.signal.aborted) setLoading(false); }
    })();
    return () => ctrl.abort();
  }, [range, stockItems, usdToTwd]);

  const isPositive = !changeInfo || changeInfo.value >= 0;
  const lineColor = isPositive ? '#6366f1' : '#10b981';
  const formatXTick = (d: string) => {
    const dt = new Date(d);
    if (range === '1W' || range === '1M') return `${dt.getMonth() + 1}/${dt.getDate()}`;
    if (range === '3M') return `${dt.getMonth() + 1}月`;
    return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100 mt-6 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap gap-3 justify-between items-center">
        <div>
          <div className="flex items-center gap-2"><BarChart2 className="w-4 h-4 text-indigo-500" /><h3 className="font-bold text-gray-900">證券資產趨勢圖</h3></div>
          {changeInfo && <p className={`text-sm font-medium mt-0.5 ${isPositive ? 'text-rose-500' : 'text-emerald-500'}`}>{isPositive ? '+' : ''}{Math.round(changeInfo.value).toLocaleString()} TWD <span className="opacity-75">({isPositive ? '+' : ''}{changeInfo.pct.toFixed(2)}%)</span></p>}
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
          {RANGES.map(r => (<button key={r.key} onClick={() => setRange(r.key)} className={`px-3 py-1.5 transition-colors ${range === r.key ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{r.label}</button>))}
        </div>
      </div>
      <div className="p-6">
        {loading && <div className="h-64 flex items-center justify-center"><div className="text-sm text-gray-400 animate-pulse">載入歷史數據中...</div></div>}
        {!loading && error && <div className="h-64 flex items-center justify-center"><div className="text-sm text-rose-400">{error}</div></div>}
        {!loading && !error && chartData.length === 0 && <div className="h-64 flex items-center justify-center"><div className="text-sm text-gray-400">尚無歷史數據，請新增持有標的與購買日期</div></div>}
        {!loading && !error && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs><linearGradient id="pgGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={lineColor} stopOpacity={0.25} /><stop offset="95%" stopColor={lineColor} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatXTick} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}萬`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={55} />
              <Tooltip formatter={(v: number) => [`NT$${Math.round(v).toLocaleString()}`, '投資組合市值']} labelFormatter={(label: string) => label} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }} />
              <Area type="monotone" dataKey="value" stroke={lineColor} strokeWidth={2} fill="url(#pgGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: lineColor }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
```

---

## Task 7：建立 StockRow、縮減 stocks/page.tsx

**Files:**
- Create: `src/components/stocks/StockRow.tsx`
- Modify: `src/app/stocks/page.tsx`

- [ ] **Step 1：StockRow.tsx**（從 stocks/page.tsx lines 701-1033 搬移，加上正確 imports）

```tsx
// src/components/stocks/StockRow.tsx
"use client";
import { useState } from 'react';
import { Pencil, Trash2, Check, X, ChevronDown, ChevronUp, ShieldCheck, FileText } from 'lucide-react';
import { type StockItem, type StockQuote } from '../../context/AppContext';
import { useNameLookup } from '../../hooks/useNameLookup';
import { MarketSelector, MARKET_BADGE, getMarket, toSymbol, sharesToUnit, unitToShares, type Market } from './MarketSelector';
import { StockAvatar } from './StockAvatar';

export function StockRow({ item, quote, usdToTwd, totalPortfolioTWD, enablePledgeTracking, onUpdate, onDelete }: {
  item: StockItem; quote?: StockQuote; usdToTwd: number; totalPortfolioTWD: number;
  enablePledgeTracking: boolean; onUpdate: (data: Partial<StockItem>) => void; onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editMarket, setEditMarket] = useState<Market>(getMarket(item.symbol));
  const [editSymbolRaw, setEditSymbolRaw] = useState(item.symbol.endsWith('.TW') ? item.symbol.slice(0, -3) : item.symbol);
  const [editPlatform, setEditPlatform] = useState(item.platform || '');
  const [editShares, setEditShares] = useState(item.shares.toString());
  const [editAvgCost, setEditAvgCost] = useState(item.avgCost.toString());
  const [editCollateralShares, setEditCollateralShares] = useState((item.collateralShares ?? 0).toString());
  const [editNotes, setEditNotes] = useState(item.notes || '');
  const [editPurchaseDate, setEditPurchaseDate] = useState(item.purchaseDate || '');

  const editSymbolFull = toSymbol(editSymbolRaw, editMarket);
  const editNamePreview = useNameLookup(editSymbolRaw ? editSymbolFull : '');

  const handleSave = () => {
    const totalShares = Number(editShares) || 0;
    const collateral = Math.min(unitToShares(Number(editCollateralShares) || 0, editMarket), totalShares);
    onUpdate({ symbol: editSymbolFull, platform: editPlatform.trim(), shares: totalShares, avgCost: Number(editAvgCost) || 0, collateralShares: collateral, notes: editNotes.trim(), purchaseDate: editPurchaseDate || undefined });
    setIsEditing(false);
  };

  const currentPrice = quote?.price || 0;
  const isUSD = quote?.currency === 'USD';
  const currencySymbol = isUSD ? '$' : 'NT$';
  const totalCost = item.avgCost;
  const totalValue = item.shares * currentPrice;
  const profit = totalValue - totalCost;
  const profitPercent = totalCost > 0 ? (profit / totalCost) * 100 : 0;
  const valueTWD = isUSD ? totalValue * usdToTwd : totalValue;
  const portfolioWeight = totalPortfolioTWD > 0 ? (valueTWD / totalPortfolioTWD) * 100 : 0;
  const changePercent = quote?.changePercent || 0;
  const market = getMarket(item.symbol);
  const displayName = quote?.shortName || item.symbol;
  const avgPricePerShare = item.shares > 0 ? item.avgCost / item.shares : 0;
  const symbolPlaceholder: Record<Market, string> = { '台股': '如: 0050, 2330', '美股': '如: AAPL, TSLA', '其他': '如: BTC-USD' };

  if (isEditing) return (
    <div className="p-6 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-gray-700">編輯標的</h4>
        <button onClick={onDelete} className="p-1.5 text-rose-600 hover:bg-rose-100 rounded"><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="mb-4"><label className="block text-xs text-gray-500 mb-1.5">市場</label><MarketSelector value={editMarket} onChange={setEditMarket} /></div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">代號</label>
          <input type="text" placeholder={symbolPlaceholder[editMarket]} value={editSymbolRaw} onChange={e => setEditSymbolRaw(e.target.value)} className="w-full border rounded p-2 text-sm" />
          {editSymbolRaw && <p className="text-[10px] mt-1 text-indigo-500 font-medium">{editSymbolFull}{editNamePreview ? ` · ${editNamePreview}` : ''}</p>}
        </div>
        <div><label className="block text-xs text-gray-500 mb-1">平台</label><input type="text" placeholder="如: 永豐" value={editPlatform} onChange={e => setEditPlatform(e.target.value)} className="w-full border rounded p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">股數</label><input type="number" value={editShares} onChange={e => setEditShares(e.target.value)} className="w-full border rounded p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">成本</label><input type="number" value={editAvgCost} onChange={e => setEditAvgCost(e.target.value)} className="w-full border rounded p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">購買日期</label><input type="date" value={editPurchaseDate} onChange={e => setEditPurchaseDate(e.target.value)} className="w-full border rounded p-2 text-sm" /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div><label className="block text-xs text-gray-500 mb-1">備註</label><input type="text" placeholder="如: 長期持有" value={editNotes} onChange={e => setEditNotes(e.target.value)} className="w-full border rounded p-2 text-sm" /></div>
        {enablePledgeTracking && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">擔保品（{editMarket === '台股' ? '張' : '股'}，0 表示無）</label>
            <input type="number" min="0" step="1" max={sharesToUnit(Number(editShares) || 0, editMarket).value} placeholder="0" value={editCollateralShares}
              onChange={e => { const max = sharesToUnit(Number(editShares) || 0, editMarket).value; const val = Math.min(Math.floor(Number(e.target.value) || 0), Math.floor(max)); setEditCollateralShares(val.toString()); }}
              className="w-full border rounded p-2 text-sm" />
          </div>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 flex items-center gap-1"><Check className="w-4 h-4" /> 儲存</button>
        <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm flex items-center gap-1"><X className="w-4 h-4" /> 取消</button>
      </div>
    </div>
  );

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div className="px-6 py-4 flex flex-col xl:flex-row xl:items-center justify-between hover:bg-slate-50 transition-colors group">
        <div className="flex items-start gap-4 mb-4 xl:mb-0">
          <StockAvatar symbol={item.symbol} market={market} displayName={displayName} />
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-gray-900 text-lg leading-tight">{item.symbol.endsWith('.TW') ? item.symbol.slice(0, -3) : item.symbol}</h4>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${MARKET_BADGE[market]}`}>{market}</span>
              {enablePledgeTracking && !!item.collateralShares && (
                <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-100 text-amber-700">
                  <ShieldCheck className="w-2.5 h-2.5" />擔保品 {sharesToUnit(item.collateralShares, market).value.toLocaleString()} {sharesToUnit(item.collateralShares, market).unit}
                </span>
              )}
            </div>
            {displayName && <p className="text-xs text-gray-400 mt-0.5">{displayName}</p>}
            <div className="flex items-center gap-2 mt-1">
              {item.platform && <><span className="text-xs text-gray-500">{item.platform}</span><span className="text-xs text-gray-300">|</span></>}
              <span className="text-xs text-gray-500">股數: {item.shares.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-6 md:gap-10 items-start">
          <div className="w-32">
            <p className="text-xs text-gray-400 mb-1">現價</p>
            {quote ? (<><p className="text-base font-semibold text-gray-900 tabular-nums">{currencySymbol}{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p><p className={`text-sm font-medium mt-0.5 tabular-nums ${changePercent >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%</p></>) : (<><p className="text-base text-gray-400">載入中...</p><p className="text-sm text-transparent mt-0.5">-</p></>)}
          </div>
          <div className="w-36">
            <p className="text-xs text-gray-400 mb-1">總市值 (TWD)</p>
            <p className="text-base font-semibold text-gray-900 tabular-nums">{Math.round(valueTWD).toLocaleString()}</p>
            <p className="text-sm text-gray-400 mt-0.5 tabular-nums">{portfolioWeight.toFixed(1)}%</p>
          </div>
          <div className="w-36">
            <p className="text-xs text-gray-400 mb-1">未實現損益</p>
            {quote ? (<><p className={`text-base font-bold tabular-nums ${profit >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{profit >= 0 ? '+' : ''}{Math.round(isUSD ? profit * usdToTwd : profit).toLocaleString()}</p><p className={`text-sm font-medium mt-0.5 tabular-nums ${profitPercent >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%</p></>) : (<><p className="text-base text-gray-400">-</p><p className="text-sm text-transparent mt-0.5">-</p></>)}
          </div>
          <div className="flex gap-2 flex-grow xl:flex-grow-0 justify-end">
            <button onClick={() => setIsExpanded(v => !v)} className="p-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50">{isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
            <button onClick={() => setIsEditing(true)} className="px-4 py-2 border border-indigo-200 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 flex items-center gap-1"><Pencil className="w-3.5 h-3.5" /> 編輯</button>
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="px-6 pb-5 bg-gray-50/60 border-t border-gray-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4">
            <div><p className="text-xs text-gray-400 mb-1">均價 (每股成本)</p><p className="text-sm font-semibold text-gray-800">{currencySymbol}{avgPricePerShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
            <div><p className="text-xs text-gray-400 mb-1">總成本</p><p className="text-sm font-semibold text-gray-800">{currencySymbol}{item.avgCost.toLocaleString()}</p></div>
            <div><p className="text-xs text-gray-400 mb-1">持股張/股數</p><p className="text-sm font-semibold text-gray-800">{item.shares.toLocaleString()} 股</p></div>
            <div><p className="text-xs text-gray-400 mb-1">市場 / 平台</p><p className="text-sm font-semibold text-gray-800">{market}{item.platform ? ` · ${item.platform}` : ''}</p></div>
            {enablePledgeTracking && (
              <div>
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><ShieldCheck className="w-3 h-3" />擔保品</p>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" step="1" max={sharesToUnit(item.shares, market).value} value={sharesToUnit(item.collateralShares ?? 0, market).value}
                    onChange={e => { const raw = Math.min(unitToShares(Math.floor(Number(e.target.value) || 0), market), item.shares); onUpdate({ collateralShares: raw }); }}
                    className="w-20 border rounded px-2 py-1 text-sm font-semibold text-amber-700 bg-amber-50 border-amber-200" />
                  <span className="text-xs text-gray-500">{sharesToUnit(0, market).unit}</span>
                  <span className="text-xs text-gray-400">/ {sharesToUnit(item.shares, market).value.toLocaleString()} {sharesToUnit(item.shares, market).unit}</span>
                </div>
                {!!item.collateralShares && item.collateralShares < item.shares && (
                  <p className="text-[10px] text-amber-600 mt-1">非擔保品: {sharesToUnit(item.shares - item.collateralShares, market).value.toLocaleString()} {sharesToUnit(0, market).unit}</p>
                )}
              </div>
            )}
            {quote && <div><p className="text-xs text-gray-400 mb-1">今日漲跌幅</p><p className={`text-sm font-semibold ${changePercent >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%</p></div>}
            {item.purchaseDate && <div><p className="text-xs text-gray-400 mb-1">購買日期</p><p className="text-sm font-semibold text-gray-800">{item.purchaseDate}</p></div>}
            {item.notes && <div className="col-span-2"><p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><FileText className="w-3 h-3" />備註</p><p className="text-sm text-gray-700">{item.notes}</p></div>}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2：縮減 stocks/page.tsx**

新 stocks/page.tsx 刪除 lines 16-350（所有 helper 型別/函式 + StockAvatar + MarketSelector + PortfolioTrendChart + useNameLookup），改為 import：

```ts
import { useNameLookup } from '../../hooks/useNameLookup';
import { StockRow } from '../../components/stocks/StockRow';
import { PortfolioTrendChart } from '../../components/stocks/PortfolioTrendChart';
import { MarketSelector, toSymbol, type Market } from '../../components/stocks/MarketSelector';
```

並在 page 內保留平台分組常量 `PLATFORM_COLORS` 和新增 form 邏輯，移除 `StockRow` 函式定義（lines 701-1033）。

- [ ] **Step 3：Commit**

```bash
git add src/hooks/useNameLookup.ts src/components/stocks/ src/app/stocks/page.tsx
git commit -m "refactor(stocks): extract StockRow + PortfolioTrendChart + MarketSelector + useNameLookup"
```

---

## Task 8：Cashflow 剩餘組件提取

cashflow/page.tsx 534 行，仍有 4 個 inline 區塊。

**Files:**
- Create: `src/components/cashflow/CashflowKPICards.tsx`
- Create: `src/components/cashflow/FlowFilterBar.tsx`
- Create: `src/components/cashflow/FixedItemsSection.tsx`
- Create: `src/components/cashflow/OneTimeEntriesSection.tsx`

- [ ] **Step 1：CashflowKPICards.tsx**

```tsx
// src/components/cashflow/CashflowKPICards.tsx
"use client";
import { ArrowUpCircle, ArrowDownCircle, Wallet } from 'lucide-react';

export function CashflowKPICards({ totalIncome, totalExpense, netAmount, oneTimeIncomeTotal, oneTimeExpenseTotal, formatCurrency }: {
  totalIncome: number; totalExpense: number; netAmount: number;
  oneTimeIncomeTotal: number; oneTimeExpenseTotal: number;
  formatCurrency: (n: number) => string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 text-emerald-600 mb-2"><ArrowUpCircle className="w-5 h-5" /><span className="text-xs font-bold uppercase tracking-wider">本月總收入</span></div>
        <h2 className="text-3xl font-bold text-gray-900">{formatCurrency(totalIncome)}</h2>
        {oneTimeIncomeTotal > 0 && <p className="text-xs text-gray-400 mt-1.5">含本月一次性收入 {formatCurrency(oneTimeIncomeTotal)}</p>}
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 text-rose-600 mb-2"><ArrowDownCircle className="w-5 h-5" /><span className="text-xs font-bold uppercase tracking-wider">本月總支出</span></div>
        <h2 className="text-3xl font-bold text-gray-900">{formatCurrency(totalExpense)}</h2>
        {oneTimeExpenseTotal > 0 && <p className="text-xs text-gray-400 mt-1.5">含本月一次性支出 {formatCurrency(oneTimeExpenseTotal)}</p>}
      </div>
      <div className={`rounded-2xl p-6 shadow-lg text-white ${netAmount >= 0 ? 'bg-gradient-to-br from-indigo-500 to-indigo-700' : 'bg-gradient-to-br from-rose-500 to-rose-700'}`}>
        <div className="flex items-center gap-2 mb-2 opacity-80"><Wallet className="w-5 h-5" /><span className="text-xs font-bold uppercase tracking-wider">本月預計盈餘</span></div>
        <h2 className="text-3xl font-bold">{formatCurrency(netAmount)}</h2>
        <p className="text-xs mt-2 opacity-70">儲蓄率: {totalIncome > 0 ? ((netAmount / totalIncome) * 100).toFixed(1) : 0}%</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2：FlowFilterBar.tsx**

```tsx
// src/components/cashflow/FlowFilterBar.tsx
"use client";
import { Search, X } from 'lucide-react';

export function FlowFilterBar({ filterType, setFilterType, filterKeyword, setFilterKeyword }: {
  filterType: 'all' | 'income' | 'expense';
  setFilterType: (t: 'all' | 'income' | 'expense') => void;
  filterKeyword: string;
  setFilterKeyword: (k: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl text-sm">
        {(['all', 'income', 'expense'] as const).map(t => (
          <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${filterType === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'all' ? '全部' : t === 'income' ? '收入' : '支出'}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 flex-1 min-w-[160px] bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input type="text" placeholder="搜尋項目名稱..." value={filterKeyword} onChange={e => setFilterKeyword(e.target.value)} className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400 bg-transparent" />
        {filterKeyword && <button onClick={() => setFilterKeyword('')} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3：FixedItemsSection.tsx**

```tsx
// src/components/cashflow/FixedItemsSection.tsx
"use client";
import { Plus } from 'lucide-react';
import type { CashFlowItem } from '../../context/AppContext';
import { CashFlowRow } from './CashFlowRow';
import { AddFixedItemRow } from './AddFixedItemRow';
import { AutoStakingIncomeRow, AutoStakingExpenseRow, AutoLoanExpenseRows } from './AutoItemRows';

export function FixedItemsSection({ incomeItems, expenseItems, isAddingIncome, isAddingExpense, setIsAddingIncome, setIsAddingExpense, filterType, debouncedKeyword, customCategories, showValues, viewBaseExpense, onAddIncome, onAddExpense, onUpdateItem, onDeleteItem, formatCurrency }: {
  incomeItems: CashFlowItem[]; expenseItems: CashFlowItem[];
  isAddingIncome: boolean; isAddingExpense: boolean;
  setIsAddingIncome: (v: boolean) => void; setIsAddingExpense: (v: boolean) => void;
  filterType: 'all' | 'income' | 'expense'; debouncedKeyword: string;
  customCategories: string[]; showValues: boolean; viewBaseExpense: number;
  onAddIncome: (name: string, amount: number, cat?: string) => void;
  onAddExpense: (name: string, amount: number, cat?: string) => void;
  onUpdateItem: (type: 'income' | 'expense', id: string, name: string, amount: number, cat?: string) => void;
  onDeleteItem: (type: 'income' | 'expense', id: string) => void;
  formatCurrency: (n: number) => string;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      {filterType !== 'expense' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-600">固定收入</h3>
            <button onClick={() => setIsAddingIncome(true)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> 新增</button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="divide-y divide-gray-50">
              {isAddingIncome && <AddFixedItemRow type="income" customCategories={customCategories} onConfirm={onAddIncome} onCancel={() => setIsAddingIncome(false)} />}
              {incomeItems.filter(i => !debouncedKeyword || i.name.toLowerCase().includes(debouncedKeyword.toLowerCase())).map(item => (
                <CashFlowRow key={item.id} item={item} type="income" customCategories={customCategories} onUpdate={(n, a, c) => onUpdateItem('income', item.id, n, a, c)} onDelete={() => onDeleteItem('income', item.id)} showValues={showValues} />
              ))}
              <AutoStakingIncomeRow />
              {incomeItems.length === 0 && !isAddingIncome && <div className="p-8 text-center text-gray-400 text-sm">尚無固定收入項目</div>}
            </div>
          </div>
        </div>
      )}
      {filterType !== 'income' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-600">固定支出</h3>
            <button onClick={() => setIsAddingExpense(true)} className="text-xs font-medium text-rose-600 hover:text-rose-800 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> 新增</button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="divide-y divide-gray-50">
              {isAddingExpense && <AddFixedItemRow type="expense" customCategories={customCategories} onConfirm={onAddExpense} onCancel={() => setIsAddingExpense(false)} />}
              {expenseItems.filter(i => !debouncedKeyword || i.name.toLowerCase().includes(debouncedKeyword.toLowerCase())).map(item => (
                <CashFlowRow key={item.id} item={item} type="expense" customCategories={customCategories} onUpdate={(n, a, c) => onUpdateItem('expense', item.id, n, a, c)} onDelete={() => onDeleteItem('expense', item.id)} showValues={showValues} />
              ))}
              <AutoStakingExpenseRow />
              <AutoLoanExpenseRows />
              {expenseItems.length === 0 && !isAddingExpense && <div className="p-8 text-center text-gray-400 text-sm">尚無固定支出項目</div>}
            </div>
            <div className="border-t-2 border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50">
              <span className="text-sm font-bold text-gray-600">固定支出合計</span>
              <span className="text-base font-bold text-rose-600">{formatCurrency(viewBaseExpense)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4：OneTimeEntriesSection.tsx**

```tsx
// src/components/cashflow/OneTimeEntriesSection.tsx
"use client";
import { Plus } from 'lucide-react';
import type { AnnualEntry, AnnualEntryCategory } from '../../context/AppContext';
import { OneTimeEntryRow } from './OneTimeEntryRow';
import { AddOneTimeEntryRow } from './AddOneTimeEntryRow';

export function OneTimeEntriesSection({ selectedYear, selectedMonth, monthOneTimeIncome, monthOneTimeExpense, monthOneTimeIncomeTotal, monthOneTimeExpenseTotal, isAddingOneTimeIncome, isAddingOneTimeExpense, setIsAddingOneTimeIncome, setIsAddingOneTimeExpense, onAdd, onDelete, showValues, formatCurrency }: {
  selectedYear: number; selectedMonth: number;
  monthOneTimeIncome: AnnualEntry[]; monthOneTimeExpense: AnnualEntry[];
  monthOneTimeIncomeTotal: number; monthOneTimeExpenseTotal: number;
  isAddingOneTimeIncome: boolean; isAddingOneTimeExpense: boolean;
  setIsAddingOneTimeIncome: (v: boolean) => void; setIsAddingOneTimeExpense: (v: boolean) => void;
  onAdd: (cat: AnnualEntryCategory, name: string, amount: number) => void;
  onDelete: (id: string) => void;
  showValues: boolean; formatCurrency: (n: number) => string;
}) {
  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-bold text-gray-900">{selectedYear} 年 {selectedMonth} 月 — 一次性記錄</h2>
        <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">本月限定</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-600">本月一次性收入</h3>
            <button onClick={() => setIsAddingOneTimeIncome(true)} className="text-xs font-medium text-emerald-600 hover:text-emerald-800 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> 新增</button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="divide-y divide-gray-50">
              {isAddingOneTimeIncome && <AddOneTimeEntryRow type="income" onConfirm={(name, amount, category) => onAdd(category, name, amount)} onCancel={() => setIsAddingOneTimeIncome(false)} />}
              {monthOneTimeIncome.map(entry => <OneTimeEntryRow key={entry.id} entry={entry} onDelete={() => onDelete(entry.id)} showValues={showValues} />)}
              {monthOneTimeIncome.length === 0 && !isAddingOneTimeIncome && <div className="p-8 text-center text-gray-400 text-sm">本月尚無一次性收入</div>}
            </div>
            {monthOneTimeIncomeTotal > 0 && <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between bg-emerald-50/40"><span className="text-xs font-bold text-gray-500">本月小計</span><span className="text-sm font-bold text-emerald-700">{formatCurrency(monthOneTimeIncomeTotal)}</span></div>}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-600">本月一次性支出</h3>
            <button onClick={() => setIsAddingOneTimeExpense(true)} className="text-xs font-medium text-rose-600 hover:text-rose-800 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> 新增</button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="divide-y divide-gray-50">
              {isAddingOneTimeExpense && <AddOneTimeEntryRow type="expense" onConfirm={(name, amount, category) => onAdd(category, name, amount)} onCancel={() => setIsAddingOneTimeExpense(false)} />}
              {monthOneTimeExpense.map(entry => <OneTimeEntryRow key={entry.id} entry={entry} onDelete={() => onDelete(entry.id)} showValues={showValues} />)}
              {monthOneTimeExpense.length === 0 && !isAddingOneTimeExpense && <div className="p-8 text-center text-gray-400 text-sm">本月尚無一次性支出</div>}
            </div>
            {monthOneTimeExpenseTotal > 0 && <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between bg-rose-50/40"><span className="text-xs font-bold text-gray-500">本月小計</span><span className="text-sm font-bold text-rose-700">{formatCurrency(monthOneTimeExpenseTotal)}</span></div>}
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 5：修改 cashflow/page.tsx — 加 import，替換 4 個 inline 區塊**

新增 import：
```ts
import { CashflowKPICards } from '../../components/cashflow/CashflowKPICards';
import { FlowFilterBar } from '../../components/cashflow/FlowFilterBar';
import { FixedItemsSection } from '../../components/cashflow/FixedItemsSection';
import { OneTimeEntriesSection } from '../../components/cashflow/OneTimeEntriesSection';
```

替換規則（用 Edit 工具）：
1. 刪除 filter bar inline (lines 265-294) → `<FlowFilterBar filterType={filterType} setFilterType={setFilterType} filterKeyword={filterKeyword} setFilterKeyword={setFilterKeyword} />`
2. 刪除 KPI row inline (lines 297-327) → `<CashflowKPICards totalIncome={monthTotalIncome} totalExpense={monthTotalExpense} netAmount={monthNet} oneTimeIncomeTotal={monthOneTimeIncomeTotal} oneTimeExpenseTotal={monthOneTimeExpenseTotal} formatCurrency={formatCurrency} />`
3. 刪除 fixed items grid inline (lines 330-423) → `<FixedItemsSection incomeItems={incomeItems} expenseItems={expenseItems} isAddingIncome={isAddingIncome} isAddingExpense={isAddingExpense} setIsAddingIncome={setIsAddingIncome} setIsAddingExpense={setIsAddingExpense} filterType={filterType} debouncedKeyword={debouncedKeyword} customCategories={customCategories} showValues={showValues} viewBaseExpense={viewBaseExpense} onAddIncome={handleAddFixedIncome} onAddExpense={handleAddFixedExpense} onUpdateItem={handleUpdateFixedItem} onDeleteItem={handleDeleteFixedItem} formatCurrency={formatCurrency} />`
4. 刪除 one-time entries grid inline (lines 425-507) → `<OneTimeEntriesSection selectedYear={selectedYear} selectedMonth={selectedMonth} monthOneTimeIncome={monthOneTimeIncome} monthOneTimeExpense={monthOneTimeExpense} monthOneTimeIncomeTotal={monthOneTimeIncomeTotal} monthOneTimeExpenseTotal={monthOneTimeExpenseTotal} isAddingOneTimeIncome={isAddingOneTimeIncome} isAddingOneTimeExpense={isAddingOneTimeExpense} setIsAddingOneTimeIncome={setIsAddingOneTimeIncome} setIsAddingOneTimeExpense={setIsAddingOneTimeExpense} onAdd={handleAddOneTimeEntry} onDelete={handleDeleteOneTimeEntry} showValues={showValues} formatCurrency={formatCurrency} />`

- [ ] **Step 6：Commit**

```bash
git add src/components/cashflow/ src/app/cashflow/page.tsx
git commit -m "refactor(cashflow): extract 4 remaining inline sections, page 534→150 lines"
```

---

## Task 9：Dashboard 組件提取

**Files:**
- Create: `src/components/dashboard/CashflowSummaryBar.tsx`
- Create: `src/components/dashboard/SnapshotTable.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1：CashflowSummaryBar.tsx**（原 page.tsx lines 232-286）

```tsx
// src/components/dashboard/CashflowSummaryBar.tsx
"use client";
import { TrendingUp, TrendingDown, Wallet, Shield } from 'lucide-react';

export function CashflowSummaryBar({ totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow, runwayMonths, formatCurrency, children }: {
  totalMonthlyIncome: number; totalMonthlyExpense: number; monthlyNetCashFlow: number;
  runwayMonths: number | null; formatCurrency: (n: number) => string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-4">
      <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600"><TrendingUp className="w-5 h-5" /></div>
          <div><p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">本月預計收入</p><p className="font-bold text-gray-900">{formatCurrency(totalMonthlyIncome)}</p></div>
        </div>
        <div className="h-8 w-px bg-gray-100" />
        <div className="flex items-center gap-3">
          <div className="bg-rose-50 p-2 rounded-lg text-rose-600"><TrendingDown className="w-5 h-5" /></div>
          <div><p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">本月預計支出</p><p className="font-bold text-gray-900">{formatCurrency(totalMonthlyExpense)}</p></div>
        </div>
        <div className="h-8 w-px bg-gray-100" />
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${monthlyNetCashFlow >= 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}><Wallet className="w-5 h-5" /></div>
          <div><p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">本月淨現金流</p><p className={`font-bold ${monthlyNetCashFlow >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{formatCurrency(monthlyNetCashFlow)}</p></div>
        </div>
        <div className="h-8 w-px bg-gray-100" />
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${runwayMonths === null ? 'bg-gray-50 text-gray-400' : runwayMonths >= 6 ? 'bg-emerald-50 text-emerald-600' : runwayMonths >= 3 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}><Shield className="w-5 h-5" /></div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">現金彈藥</p>
            <p className={`font-bold ${runwayMonths === null ? 'text-gray-400' : runwayMonths >= 6 ? 'text-emerald-600' : runwayMonths >= 3 ? 'text-amber-600' : 'text-rose-600'}`}>{runwayMonths !== null ? `${runwayMonths.toFixed(1)} 個月` : '—'}</p>
            <p className="text-[10px] text-gray-400">流動資金 / 月支出</p>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2：SnapshotTable.tsx**（原 page.tsx lines 402-457）

```tsx
// src/components/dashboard/SnapshotTable.tsx
"use client";
import { Camera, ChevronDown, Trash2 } from 'lucide-react';
import type { AssetSnapshot } from '../../context/AppContext';

export function SnapshotTable({ snapshots, showValues, onTakeSnapshot, onRequestDelete }: {
  snapshots: AssetSnapshot[]; showValues: boolean;
  onTakeSnapshot: () => void; onRequestDelete: (id: string) => void;
}) {
  return (
    <div className="mt-6">
      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 select-none list-none">
          <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
          快照紀錄（{snapshots.length} 筆）
          <button onClick={e => { e.preventDefault(); onTakeSnapshot(); }} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors">
            <Camera className="w-4 h-4" />拍快照
          </button>
        </summary>
        <div className="mt-3 rounded-xl border border-gray-100 overflow-hidden">
          {snapshots.length === 0 ? (
            <p className="p-4 text-sm text-gray-400 text-center">尚無快照，點擊「拍快照」開始紀錄</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-500 font-medium">日期</th>
                  <th className="px-4 py-2 text-right text-gray-500 font-medium">總資產</th>
                  <th className="px-4 py-2 text-right text-gray-500 font-medium">總負債</th>
                  <th className="px-4 py-2 text-right text-gray-500 font-medium">淨資產</th>
                  <th className="px-4 py-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {[...snapshots].reverse().map(snap => (
                  <tr key={snap.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{snap.date}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-800">{showValues ? `NT$${snap.totalAssets.toLocaleString()}` : '●●●●●'}</td>
                    <td className="px-4 py-2 text-right font-mono text-rose-600">{showValues ? `NT$${snap.totalLiabilities.toLocaleString()}` : '●●●●●'}</td>
                    <td className="px-4 py-2 text-right font-mono text-indigo-600">{showValues ? `NT$${snap.netWorth.toLocaleString()}` : '●●●●●'}</td>
                    <td className="px-4 py-2 text-right"><button onClick={() => onRequestDelete(snap.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </details>
    </div>
  );
}
```

- [ ] **Step 3：修改 src/app/page.tsx**

新增 import：
```ts
import { CashflowSummaryBar } from '../components/dashboard/CashflowSummaryBar';
import { SnapshotTable } from '../components/dashboard/SnapshotTable';
```

替換 cashflow bar 區塊（原 lines 232-288）：
```tsx
<CashflowSummaryBar totalMonthlyIncome={totalMonthlyIncome} totalMonthlyExpense={totalMonthlyExpense} monthlyNetCashFlow={monthlyNetCashFlow} runwayMonths={runwayMonths} formatCurrency={formatCurrency}>
  <HealthScoreCard />
</CashflowSummaryBar>
```
（同時刪除原本獨立的 `<HealthScoreCard />` 行）

替換 snapshot section（原 lines 402-458）：
```tsx
<SnapshotTable snapshots={snapshots} showValues={showValues} onTakeSnapshot={takeSnapshot} onRequestDelete={setSnapshotToDelete} />
```

移除不再直接使用的 import：`TrendingUp`, `TrendingDown`, `Wallet`, `Shield`, `Camera`, `ChevronDown`（若其他地方無用）

- [ ] **Step 4：Commit**

```bash
git add src/components/dashboard/ src/app/page.tsx
git commit -m "refactor(dashboard): extract CashflowSummaryBar + SnapshotTable, page shrunk"
```

---

## Task 10：修復 next.config.mjs build 設定

**Files:**
- Modify: `next.config.mjs`

- [ ] **Step 1：移除 ignoreBuildErrors 和 ignoreDuringBuilds**

在 `next.config.mjs` 中刪除：
```js
eslint: { ignoreDuringBuilds: true },
typescript: { ignoreBuildErrors: true },
```

- [ ] **Step 2：執行 TypeScript 型別檢查**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -50
```

- [ ] **Step 3：修復所有 TypeScript 錯誤後，執行完整 build**

```bash
npx next build 2>&1 | tail -30
```

- [ ] **Step 4：Commit**

```bash
git add next.config.mjs
git commit -m "fix(build): remove ignoreBuildErrors and ignoreDuringBuilds, fix TS errors"
```

---

## 完成後驗證清單

- [ ] `src/app/debt/page.tsx` ≤ 300 行
- [ ] `src/app/stocks/page.tsx` ≤ 270 行
- [ ] `src/app/cashflow/page.tsx` ≤ 160 行
- [ ] `src/app/page.tsx` ≤ 220 行
- [ ] `npx next build` 無 TypeScript 錯誤
- [ ] 四個頁面在瀏覽器中功能正常（新增、編輯、刪除操作）
