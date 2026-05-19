# CSV / Excel 批量匯入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CSV/Excel batch import for stocks, assets, income, and expenses via a 3-step modal (type select → file upload → preview/confirm), and fix the existing DataManager nested-function + missing-readAsText bugs.

**Architecture:** New `ImportModal.tsx` contains all parse logic, template download, and 3-step UI. `DataManager.tsx` is rewritten to fix bugs and trigger the modal. SheetJS (`xlsx`) handles both CSV and .xlsx parsing uniformly.

**Tech Stack:** SheetJS (xlsx), React 19, TypeScript, Tailwind CSS, lucide-react

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/ImportModal.tsx` | Create | All parse logic, step UI, confirm logic |
| `src/components/DataManager.tsx` | Rewrite | Fix bugs; remove old CSV button; add Import button |
| `package.json` / `package-lock.json` | Modify | Add xlsx dependency |

---

### Task 1: Install xlsx

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install xlsx
```

- [ ] **Step 2: Verify**

```bash
npm run build 2>&1 | head -5
```

Expected: Build starts (may fail on other issues — just confirm xlsx doesn't cause an immediate import error).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add xlsx (SheetJS) for CSV/Excel parsing"
```

---

### Task 2: Fix and rewrite DataManager.tsx

**Files:**
- Modify: `src/components/DataManager.tsx`

Bugs being fixed:
1. `handleCSVImport` is defined inside `handleImport`'s `reader.onload` (nested function — unreachable)
2. `handleImport` never calls `reader.readAsText(file)` → JSON restore is silently broken

- [ ] **Step 1: Rewrite the file**

```typescript
"use client";

import { useRef, useState } from 'react';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { ImportModal } from './ImportModal';

export function DataManager() {
  const ctx = useAppContext();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const handleExport = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      assets: ctx.assets,
      liabilities: ctx.liabilities,
      stakingItems: ctx.stakingItems,
      loans: ctx.loans,
      stockItems: ctx.stockItems,
      incomeItems: ctx.incomeItems,
      expenseItems: ctx.expenseItems,
      annualEntries: ctx.annualEntries,
      snapshots: ctx.snapshots,
      borrowingLimits: ctx.borrowingLimits,
      customCategories: ctx.customCategories,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assetdash-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    ctx.setLastExportDate(new Date().toISOString());
    toast('資料已匯出');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.assets)           ctx.setAssets(data.assets);
        if (data.liabilities)      ctx.setLiabilities(data.liabilities);
        if (data.stakingItems)     ctx.setStakingItems(data.stakingItems);
        if (data.loans)            ctx.setLoans(data.loans);
        if (data.stockItems)       ctx.setStockItems(data.stockItems);
        if (data.incomeItems)      ctx.setIncomeItems(data.incomeItems);
        if (data.expenseItems)     ctx.setExpenseItems(data.expenseItems);
        if (data.annualEntries)    ctx.setAnnualEntries(data.annualEntries);
        if (data.snapshots)        ctx.setSnapshots(data.snapshots);
        if (data.borrowingLimits != null) ctx.setBorrowingLimits(data.borrowingLimits);
        if (data.customCategories) ctx.setCustomCategories(data.customCategories);
        toast('資料匯入成功');
      } catch {
        toast('匯入失敗：檔案格式不正確', 'error');
      } finally {
        setImporting(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
          title="匯出資料"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">匯出</span>
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          title="JSON 備份匯入"
          disabled={importing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">備份匯入</span>
        </button>
        <button
          onClick={() => setShowImportModal(true)}
          title="CSV / Excel 批量匯入"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">匯入</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
      </div>
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} />}
    </>
  );
}
```

- [ ] **Step 2: Type check (ImportModal not yet created — expected error)**

```bash
npx tsc --noEmit 2>&1 | grep -v "ImportModal"
```

Expected: Only error is `Cannot find module './ImportModal'`. All other lines clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/DataManager.tsx
git commit -m "fix(data-manager): fix nested handleCSVImport bug and missing readAsText; add import button"
```

---

### Task 3: Create ImportModal.tsx

**Files:**
- Create: `src/components/ImportModal.tsx`

This file contains: types, parse utilities, template download, 3 step components, and the modal shell.

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import type { StockItem, StockSector, CashFlowItem } from '../context/AppContext';
import type { AssetCategory, AssetItem } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportType = 'stocks' | 'assets' | 'income' | 'expense';

type ParsedStock = Omit<StockItem, 'id'>;

type ParsedAsset = {
  categoryId: string;
  categoryTitle: string;
  item: Omit<AssetItem, 'id'>;
};

type ParsedCashflow = Omit<CashFlowItem, 'id'>;

type ValidRow<T> = { valid: true; data: T };
type InvalidRow = { valid: false; data: Record<string, string>; reason: string };
type ParsedRow<T> = ValidRow<T> | InvalidRow;

type ParseResult<T> = {
  rows: ParsedRow<T>[];
  validCount: number;
  invalidCount: number;
};

// ─── File reader ──────────────────────────────────────────────────────────────

function readFileAsRows(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
        resolve(rows as string[][]);
      } catch {
        reject(new Error('無法解析檔案，請確認格式為 CSV 或 xlsx'));
      }
    };
    reader.onerror = () => reject(new Error('檔案讀取失敗'));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Parse functions ──────────────────────────────────────────────────────────

const VALID_SECTORS: StockSector[] = [
  '科技', '金融', '醫療', '消費', '工業', '能源', '原物料', '房地產', '公用事業', '通訊', '其他',
];

function parseStocks(rows: string[][]): ParseResult<ParsedStock> {
  const dataRows = rows.slice(1).filter(r => r.some(c => String(c).trim()));
  const parsed: ParsedRow<ParsedStock>[] = dataRows.map(row => {
    const [symbol, , sharesRaw, avgCostRaw, platform, collateralRaw, sectorRaw, notes, purchaseDate] =
      row.map(c => String(c).trim());
    const raw = { symbol, shares: sharesRaw, avgCost: avgCostRaw };
    if (!symbol) return { valid: false, data: raw, reason: '代號為必填' };
    const shares = Number(sharesRaw);
    if (!sharesRaw || isNaN(shares) || shares < 0)
      return { valid: false, data: raw, reason: '股數格式錯誤' };
    const avgCost = avgCostRaw ? Number(avgCostRaw) : 0;
    if (isNaN(avgCost)) return { valid: false, data: raw, reason: '平均成本格式錯誤' };
    const collateralShares = collateralRaw ? Number(collateralRaw) : undefined;
    const sector = VALID_SECTORS.includes(sectorRaw as StockSector)
      ? (sectorRaw as StockSector) : undefined;
    return {
      valid: true,
      data: {
        symbol, shares, avgCost,
        platform: platform || undefined,
        collateralShares: collateralShares !== undefined && !isNaN(collateralShares) ? collateralShares : undefined,
        sector,
        notes: notes || undefined,
        purchaseDate: purchaseDate || undefined,
      },
    };
  });
  return {
    rows: parsed,
    validCount: parsed.filter(r => r.valid).length,
    invalidCount: parsed.filter(r => !r.valid).length,
  };
}

function parseAssets(rows: string[][], categories: AssetCategory[]): ParseResult<ParsedAsset> {
  const dataRows = rows.slice(1).filter(r => r.some(c => String(c).trim()));
  const parsed: ParsedRow<ParsedAsset>[] = dataRows.map(row => {
    const [categoryTitle, name, amountRaw] = row.map(c => String(c).trim());
    const raw = { categoryTitle, name, amount: amountRaw };
    if (!categoryTitle) return { valid: false, data: raw, reason: '類別為必填' };
    if (!name)          return { valid: false, data: raw, reason: '名稱為必填' };
    const amount = Number(amountRaw);
    if (!amountRaw || isNaN(amount) || amount < 0)
      return { valid: false, data: raw, reason: '金額格式錯誤' };
    const category = categories.find(c => c.title === categoryTitle);
    if (!category)
      return { valid: false, data: raw, reason: `類別「${categoryTitle}」不存在` };
    return {
      valid: true,
      data: { categoryId: category.id, categoryTitle: category.title, item: { name, amount } },
    };
  });
  return {
    rows: parsed,
    validCount: parsed.filter(r => r.valid).length,
    invalidCount: parsed.filter(r => !r.valid).length,
  };
}

function parseCashflow(rows: string[][], type: 'income' | 'expense'): ParseResult<ParsedCashflow> {
  const dataRows = rows.slice(1).filter(r => r.some(c => String(c).trim()));
  const parsed: ParsedRow<ParsedCashflow>[] = dataRows.map(row => {
    const [rowType, name, amountRaw, category, recurringRaw, budgetRaw] =
      row.map(c => String(c).trim());
    const raw = { type: rowType, name, amount: amountRaw };
    if (rowType !== type) return { valid: false, data: raw, reason: `類型須為「${type}」` };
    if (!name)            return { valid: false, data: raw, reason: '名稱為必填' };
    const amount = Number(amountRaw);
    if (!amountRaw || isNaN(amount) || amount < 0)
      return { valid: false, data: raw, reason: '金額格式錯誤' };
    const isRecurring = recurringRaw.toLowerCase() !== 'false';
    const budget = budgetRaw ? Number(budgetRaw) : undefined;
    return {
      valid: true,
      data: {
        name, amount,
        category: category || '',
        isRecurring,
        budget: budget !== undefined && !isNaN(budget) ? budget : undefined,
      },
    };
  });
  return {
    rows: parsed,
    validCount: parsed.filter(r => r.valid).length,
    invalidCount: parsed.filter(r => !r.valid).length,
  };
}

// ─── Template download ─────────────────────────────────────────────────────────

const CSV_TEMPLATES: Record<ImportType, string> = {
  stocks:  '代號,名稱,股數,平均成本,平台,質押股數,產業,備注,購買日期\n2330.TW,台積電,2000,600,元大,500,科技,,2023-01-15\nAAPL,Apple,100,150,,,科技,,\n',
  assets:  '類別,名稱,金額\n流動資金,銀行活存,300000\n投資,台股基金,100000\n固定資產,自用住宅,1200000\n',
  income:  '類型,名稱,金額,類別,週期性,月預算\nincome,薪資收入,80000,Salary,true,\nincome,兼職收入,20000,Freelance,true,\n',
  expense: '類型,名稱,金額,類別,週期性,月預算\nexpense,房租,20000,Housing,true,25000\nexpense,伙食費,15000,Food,true,\n',
};

function downloadTemplate(type: ImportType) {
  const blob = new Blob([CSV_TEMPLATES[type]], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `assetdash-template-${type}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Step 1: Type selection ────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: ImportType; label: string; desc: string }[] = [
  { value: 'stocks',  label: '股票庫存', desc: '代號、股數、平均成本' },
  { value: 'assets',  label: '資產項目', desc: '類別、名稱、金額' },
  { value: 'income',  label: '收入項目', desc: '名稱、金額、類別' },
  { value: 'expense', label: '支出項目', desc: '名稱、金額、類別、預算' },
];

function Step1TypeSelect({
  selected,
  onSelect,
}: {
  selected: ImportType | null;
  onSelect: (t: ImportType) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">選擇要匯入的資料類型：</p>
      <div className="grid grid-cols-2 gap-3">
        {TYPE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className={`rounded-xl border p-4 text-left transition-all ${
              selected === opt.value
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-indigo-300'
            }`}
          >
            <p className={`text-sm font-bold ${selected === opt.value ? 'text-indigo-700' : 'text-gray-800'}`}>
              {opt.label}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: File upload ───────────────────────────────────────────────────────

function Step2Upload({
  importType,
  onParsed,
  onError,
}: {
  importType: ImportType;
  onParsed: (result: ParseResult<ParsedStock> | ParseResult<ParsedAsset> | ParseResult<ParsedCashflow>) => void;
  onError: (msg: string) => void;
}) {
  const { assets } = useAppContext();
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setParsing(true);
    try {
      const rows = await readFileAsRows(file);
      if (rows.length < 2) {
        onError('檔案沒有資料行（只有標題或空白）');
        return;
      }
      let result: ParseResult<ParsedStock> | ParseResult<ParsedAsset> | ParseResult<ParsedCashflow>;
      if (importType === 'stocks') {
        result = parseStocks(rows);
      } else if (importType === 'assets') {
        result = parseAssets(rows, assets);
      } else {
        result = parseCashflow(rows, importType);
      }
      onParsed(result);
    } catch (e) {
      onError(e instanceof Error ? e.message : '解析失敗');
    } finally {
      setParsing(false);
    }
  }, [importType, assets, onParsed, onError]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">上傳 CSV 或 Excel (.xlsx) 檔案</p>
        <button
          onClick={() => downloadTemplate(importType)}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
        >
          <Download className="w-3 h-3" />
          下載模板
        </button>
      </div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'
        }`}
      >
        {parsing ? (
          <p className="text-sm text-gray-400">解析中...</p>
        ) : (
          <>
            <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-600">拖曳檔案至此，或點擊選擇</p>
            <p className="text-xs text-gray-400 mt-1">支援 .csv 和 .xlsx 格式</p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
    </div>
  );
}

// ─── Step 3: Preview + confirm ─────────────────────────────────────────────────

const PREVIEW_HEADERS: Record<ImportType, string[]> = {
  stocks:  ['代號', '股數', '平均成本', '平台', '產業'],
  assets:  ['類別', '名稱', '金額'],
  income:  ['名稱', '金額', '類別', '週期性'],
  expense: ['名稱', '金額', '類別', '週期性', '月預算'],
};

function getRowCells(
  row: ParsedRow<ParsedStock | ParsedAsset | ParsedCashflow>,
  importType: ImportType,
): string[] {
  if (!row.valid) return Object.values(row.data).map(String);
  if (importType === 'stocks') {
    const d = (row as ValidRow<ParsedStock>).data;
    return [d.symbol, String(d.shares), String(d.avgCost), d.platform ?? '—', d.sector ?? '—'];
  }
  if (importType === 'assets') {
    const d = (row as ValidRow<ParsedAsset>).data;
    return [d.categoryTitle, d.item.name, d.item.amount.toLocaleString()];
  }
  const d = (row as ValidRow<ParsedCashflow>).data;
  const cells = [d.name, d.amount.toLocaleString(), d.category, d.isRecurring ? '是' : '否'];
  if (importType === 'expense') cells.push(d.budget ? d.budget.toLocaleString() : '—');
  return cells;
}

function Step3Preview({
  importType,
  result,
  onConfirm,
}: {
  importType: ImportType;
  result: ParseResult<ParsedStock> | ParseResult<ParsedAsset> | ParseResult<ParsedCashflow>;
  onConfirm: () => void;
}) {
  const DISPLAY_LIMIT = 50;
  const shown = result.rows.slice(0, DISPLAY_LIMIT);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${
        result.invalidCount > 0 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'
      }`}>
        {result.invalidCount > 0
          ? <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          : <CheckCircle className="w-4 h-4 flex-shrink-0" />}
        共解析 {result.rows.length} 筆
        {result.invalidCount > 0 && (
          <span className="font-bold text-red-600">，{result.invalidCount} 筆有誤</span>
        )}
        ，將匯入 <span className="font-bold ml-1">{result.validCount} 筆</span>有效資料
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-xl border border-gray-100">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-gray-500 font-medium w-8">#</th>
              {PREVIEW_HEADERS[importType].map(h => (
                <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
              ))}
              <th className="px-3 py-2 text-left text-gray-500 font-medium">狀態</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {shown.map((row, i) => (
              <tr key={i} className={row.valid ? '' : 'bg-red-50'}>
                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                {getRowCells(row, importType).map((cell, j) => (
                  <td key={j} className={`px-3 py-2 ${row.valid ? 'text-gray-700' : 'text-red-600'}`}>
                    {cell}
                  </td>
                ))}
                <td className="px-3 py-2">
                  {row.valid
                    ? <span className="text-emerald-600 font-bold">✓</span>
                    : <span className="text-red-500 text-[10px] font-bold" title={row.reason}>
                        ⚠ {row.reason}
                      </span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.rows.length > DISPLAY_LIMIT && (
          <p className="text-center text-xs text-gray-400 py-2">
            ...以及 {result.rows.length - DISPLAY_LIMIT} 筆更多
          </p>
        )}
      </div>

      {/* Confirm */}
      <button
        onClick={onConfirm}
        disabled={result.validCount === 0}
        className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        確認匯入 {result.validCount} 筆有效資料
      </button>
    </div>
  );
}

// ─── Main modal ────────────────────────────────────────────────────────────────

export function ImportModal({ onClose }: { onClose: () => void }) {
  const { assets, setAssets, setStockItems, setIncomeItems, setExpenseItems } = useAppContext();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [importType, setImportType] = useState<ImportType | null>(null);
  const [parseResult, setParseResult] = useState<
    ParseResult<ParsedStock> | ParseResult<ParsedAsset> | ParseResult<ParsedCashflow> | null
  >(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const genId = () => `csv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const handleConfirm = () => {
    if (!parseResult || !importType) return;

    if (importType === 'stocks') {
      const validRows = (parseResult as ParseResult<ParsedStock>).rows
        .filter((r): r is ValidRow<ParsedStock> => r.valid)
        .map(r => r.data);
      setStockItems(prev => {
        const updated = [...prev];
        for (const row of validRows) {
          const idx = updated.findIndex(s => s.symbol === row.symbol);
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], shares: row.shares, avgCost: row.avgCost };
          } else {
            updated.push({ ...row, id: genId() });
          }
        }
        return updated;
      });
      toast(`已匯入 ${validRows.length} 筆股票`);
    } else if (importType === 'assets') {
      const validRows = (parseResult as ParseResult<ParsedAsset>).rows
        .filter((r): r is ValidRow<ParsedAsset> => r.valid)
        .map(r => r.data);
      setAssets(prev => prev.map(cat => {
        const toAdd = validRows.filter(r => r.categoryId === cat.id);
        if (toAdd.length === 0) return cat;
        return {
          ...cat,
          items: [...cat.items, ...toAdd.map(r => ({ id: genId(), ...r.item }))],
        };
      }));
      toast(`已匯入 ${validRows.length} 筆資產`);
    } else {
      const validRows = (parseResult as ParseResult<ParsedCashflow>).rows
        .filter((r): r is ValidRow<ParsedCashflow> => r.valid)
        .map(r => r.data);
      const setter = importType === 'income' ? setIncomeItems : setExpenseItems;
      setter(prev => [...prev, ...validRows.map(r => ({ ...r, id: genId() }))]);
      toast(`已匯入 ${validRows.length} 筆${importType === 'income' ? '收入' : '支出'}`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">CSV / Excel 批量匯入</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              步驟 {step} / 3 — {step === 1 ? '選擇類型' : step === 2 ? '上傳檔案' : '確認匯入'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {step === 1 && (
            <Step1TypeSelect
              selected={importType}
              onSelect={t => {
                setImportType(t);
                setParseResult(null);
                setParseError(null);
                setStep(2);
              }}
            />
          )}
          {step === 2 && importType && (
            <>
              {parseError && (
                <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {parseError}
                </div>
              )}
              <Step2Upload
                importType={importType}
                onParsed={r => { setParseResult(r); setParseError(null); setStep(3); }}
                onError={msg => setParseError(msg)}
              />
            </>
          )}
          {step === 3 && importType && parseResult && (
            <Step3Preview importType={importType} result={parseResult} onConfirm={handleConfirm} />
          )}
        </div>

        {/* Back nav */}
        {step > 1 && (
          <div className="px-6 pb-5">
            <button
              onClick={() => setStep(prev => (prev - 1) as 1 | 2 | 3)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← 返回上一步
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ImportModal.tsx
git commit -m "feat(import): add ImportModal with 3-step CSV/Excel import flow"
```

---

### Task 4: Manual testing

**Files:** No code changes — verification only.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test JSON restore (bug fix)**

1. Click「匯出」→ download JSON backup
2. Click「備份匯入」→ select the JSON file
3. Expected: toast「資料匯入成功」(previously this was broken — no readAsText was called)

- [ ] **Step 3: Test stocks import — happy path**

1. Click「匯入」→ modal opens at Step 1
2. Select「股票庫存」→ auto-advances to Step 2
3. Click「下載模板」→ `assetdash-template-stocks.csv` downloads
4. Upload the template file
5. Step 3 shows 2 valid rows (2330.TW, AAPL), 0 errors
6. Click「確認匯入 2 筆有效資料」
7. Navigate to `/stocks` — verify 2330.TW shares updated to 2000 (not duplicated)

- [ ] **Step 4: Test assets import**

1. Open modal → select「資產項目」→「下載模板」→ upload template
2. Step 3: 3 valid rows (流動資金, 投資, 固定資產)
3. Confirm → verify items appear on Dashboard

- [ ] **Step 5: Test income/expense import**

1. Open modal → select「收入項目」→ download and upload income template
2. Step 3: 2 valid rows
3. Confirm → navigate to `/cashflow` to verify items appear

- [ ] **Step 6: Test invalid row highlighting**

Create a test file `test-bad.csv` with content:
```
類別,名稱,金額
不存在的類別,測試,10000
流動資金,,50000
流動資金,測試帳戶,abc
```

Upload to「資產項目」import. Expected:
- Step 3 shows 3 rows, all red
- Summary says「3 筆有誤」
- Confirm button disabled (0 valid rows)
- Row 1 error: `類別「不存在的類別」不存在`
- Row 2 error: `名稱為必填`
- Row 3 error: `金額格式錯誤`

- [ ] **Step 7: Test xlsx format**

Open the downloaded template CSV in Excel, save as .xlsx, then upload the .xlsx file to the modal. Expected: parses identically to CSV.

- [ ] **Step 8: Test back navigation**

Open modal → select type → Step 2 → click「← 返回上一步」→ back to Step 1 with previous type still selected.

---

### Task 5: Build check

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: Build completes. Next.js will warn about bundle size increase from xlsx (~250 KB) — acceptable, this is a client-only component.

- [ ] **Step 2: If build fails with xlsx SSR error**

If you see `"xlsx" is not supported in Edge Runtime` or similar, verify `ImportModal.tsx` has `"use client"` at line 1 — it should, as written in Task 3.

- [ ] **Step 3: Final commit if any adjustments made**

```bash
git add -A
git commit -m "fix: resolve build issues from CSV/Excel import"
```

---

## Self-Review Checklist

### Spec coverage
| Requirement | Task |
|-------------|------|
| Install xlsx | Task 1 |
| Fix DataManager nested-function bug | Task 2 |
| Fix DataManager missing readAsText | Task 2 |
| Remove old CSV button | Task 2 |
| 3-step modal (type → upload → preview) | Task 3 |
| Stocks: update on duplicate symbol | Task 3 (handleConfirm stocks branch) |
| Assets: append to matching category | Task 3 (handleConfirm assets branch) |
| Income/expense: append | Task 3 (handleConfirm cashflow branch) |
| Invalid rows highlighted red | Task 3 (Step3Preview) |
| Summary line (N parsed, M invalid) | Task 3 (Step3Preview) |
| Confirm button disabled when 0 valid | Task 3 (disabled prop) |
| Template download per type | Task 3 (CSV_TEMPLATES + downloadTemplate) |
| Drag & drop upload | Task 3 (Step2Upload) |
| xlsx format support | Task 3 (readFileAsRows via SheetJS) |
| Back navigation between steps | Task 3 (footer nav) |
| Manual test all paths | Task 4 |
| Build passes | Task 5 |
