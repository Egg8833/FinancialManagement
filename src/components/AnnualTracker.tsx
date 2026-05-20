"use client";

import { useState, useMemo } from 'react';
import { Plus, X, Trash2, ChevronLeft, ChevronRight, RotateCcw, Pencil } from 'lucide-react';
import { useAppContext, type AnnualEntry, type AnnualEntryCategory } from '../context/AppContext';
import { useStickyState } from '../hooks/useStickyState';

type MonthlyOverrides = Record<string, { fixedIncome?: number; fixedExpense?: number }>;

// ─── 常數 ──────────────────────────────────────────────────────────────────────

const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

const ONE_TIME_INCOME_CATS: { key: AnnualEntryCategory; label: string; color: string }[] = [
  { key: 'dividend',     label: '股利',   color: 'text-emerald-600' },
  { key: 'bonus',        label: '獎金',   color: 'text-blue-600'    },
  { key: 'other_income', label: '其他收入', color: 'text-violet-600' },
];

// ─── Cell Modal（一次性項目新增/刪除）─────────────────────────────────────────

interface CellModalProps {
  year: number; month: number; label: string;
  entries: AnnualEntry[];
  onAdd: (name: string, amount: number) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function CellModal({ year, month, label, entries, onAdd, onDelete, onClose }: CellModalProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const submit = () => {
    const n = Number(amount);
    if (!name.trim() || !n) return;
    onAdd(name.trim(), n);
    setName(''); setAmount('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-gray-400">{year} 年 {month} 月</p>
            <h3 className="font-bold text-gray-900">{label}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="space-y-2 mb-4 max-h-52 overflow-y-auto">
          {entries.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">尚無記錄</p>
          )}
          {entries.map(e => (
            <div key={e.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-sm text-gray-700 flex-1 truncate">{e.name}</span>
              <span className="text-sm font-bold text-gray-900 shrink-0">
                {e.amount.toLocaleString('en-US')}
              </span>
              <button
                onClick={() => onDelete(e.id)}
                className="p-0.5 text-gray-300 hover:text-rose-500 transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="名稱"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
            autoFocus
          />
          <input
            type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="金額"
            className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 text-right"
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          />
          <button
            onClick={submit}
            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {entries.length > 0 && (
          <p className="text-right text-xs text-gray-500 font-medium mt-3">
            小計　{entries.reduce((s, e) => s + e.amount, 0).toLocaleString('en-US')}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── 可編輯固定金額格 ───────────────────────────────────────────────────────────

interface EditableFixedCellProps {
  defaultValue: number;
  override: number | undefined;
  showValues: boolean;
  onSave: (v: number) => void;
  onReset: () => void;
}

function EditableFixedCell({ defaultValue, override, showValues, onSave, onReset }: EditableFixedCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const isOverridden = override !== undefined;
  const displayValue = isOverridden ? override : defaultValue;

  const commit = () => {
    const n = Number(draft);
    if (!isNaN(n) && n >= 0) onSave(n);
    setEditing(false);
  };

  if (editing) {
    return (
      <td className="px-2 py-1.5 text-right">
        <input
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          className="w-24 text-sm text-right border border-indigo-300 rounded px-2 py-1 outline-none focus:border-indigo-500 bg-indigo-50"
          autoFocus
        />
      </td>
    );
  }

  return (
    <td className="px-3 py-2.5 text-right group/cell">
      <div className="flex items-center justify-end gap-1">
        {isOverridden && (
          <button
            onClick={onReset}
            title="還原預設值"
            className="opacity-0 group-hover/cell:opacity-100 p-0.5 text-gray-300 hover:text-rose-400 transition-opacity"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
        <span
          onClick={() => { setDraft(displayValue.toString()); setEditing(true); }}
          className={`text-sm cursor-pointer flex items-center gap-1 ${
            isOverridden ? 'text-indigo-600 font-semibold' : 'text-gray-400'
          } hover:text-indigo-500 transition-colors`}
          title="點擊修改此月金額"
        >
          {showValues ? displayValue.toLocaleString('en-US') : '****'}
          <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/cell:opacity-60 transition-opacity" />
        </span>
        {isOverridden && (
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" title="已覆寫" />
        )}
      </div>
    </td>
  );
}

// ─── 可點擊一次性金額格 ─────────────────────────────────────────────────────────

function ClickableCell({
  value, showValues, onClick,
}: { value: number; showValues: boolean; onClick: () => void }) {
  return (
    <td
      className="px-3 py-2.5 text-right cursor-pointer hover:bg-indigo-50 transition-colors group/cc"
      onClick={onClick}
    >
      <span className={`text-sm transition-colors group-hover/cc:text-indigo-600 ${value > 0 ? 'text-gray-800 font-medium' : 'text-gray-300'}`}>
        {showValues ? (value > 0 ? value.toLocaleString('en-US') : '+ 新增') : (value > 0 ? '****' : '—')}
      </span>
    </td>
  );
}

// ─── 主元件 ────────────────────────────────────────────────────────────────────

export function AnnualTracker() {
  const {
    annualEntries, setAnnualEntries,
    cashflowTemplate,
    showValues,
  } = useAppContext();

  const [monthlyOverrides, setMonthlyOverrides] = useStickyState<MonthlyOverrides>({}, 'app-monthly-overrides-v1');

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [modal, setModal] = useState<{ month: number; cat: AnnualEntryCategory; label: string } | null>(null);

  // 預設固定月收入 / 月支出
  const defaultFixedIncome  = useMemo(() => cashflowTemplate.income.reduce( (s, i) => s + i.amount, 0), [cashflowTemplate.income]);
  const defaultFixedExpense = useMemo(() => cashflowTemplate.expense.reduce((s, i) => s + i.amount, 0), [cashflowTemplate.expense]);

  const overrideKey = (month: number) => `${year}-${month}`;

  const getFixedIncome  = (m: number) => monthlyOverrides[overrideKey(m)]?.fixedIncome  ?? defaultFixedIncome;
  const getFixedExpense = (m: number) => monthlyOverrides[overrideKey(m)]?.fixedExpense ?? defaultFixedExpense;

  const saveOverride = (m: number, field: 'fixedIncome' | 'fixedExpense', val: number) => {
    setMonthlyOverrides(prev => ({
      ...prev,
      [overrideKey(m)]: { ...prev[overrideKey(m)], [field]: val },
    }));
  };

  const resetOverride = (m: number, field: 'fixedIncome' | 'fixedExpense') => {
    setMonthlyOverrides(prev => {
      const entry = { ...prev[overrideKey(m)] };
      delete entry[field];
      return Object.keys(entry).length > 0
        ? { ...prev, [overrideKey(m)]: entry }
        : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== overrideKey(m)));
    });
  };

  // one-time entries
  const yearEntries = useMemo(() => annualEntries.filter(e => e.year === year), [annualEntries, year]);
  const getEntries = (m: number, cat: AnnualEntryCategory) => yearEntries.filter(e => e.month === m && e.category === cat);
  const getTotal   = (m: number, cat: AnnualEntryCategory) => getEntries(m, cat).reduce((s, e) => s + e.amount, 0);

  const addEntry = (m: number, cat: AnnualEntryCategory, name: string, amount: number) => {
    setAnnualEntries(prev => [...prev, { id: Date.now().toString(), year, month: m, name, amount, category: cat }]);
  };
  const deleteEntry = (id: string) => setAnnualEntries(prev => prev.filter(e => e.id !== id));

  // 月資料
  const rows = useMemo(() => MONTH_LABELS.map((label, idx) => {
    const m           = idx + 1;
    const fixedInc    = getFixedIncome(m);
    const fixedExp    = getFixedExpense(m);
    const dividend    = getTotal(m, 'dividend');
    const bonus       = getTotal(m, 'bonus');
    const otherInc    = getTotal(m, 'other_income');
    const oneTimeExp  = getTotal(m, 'one_time_expense');
    const totalInc    = fixedInc + dividend + bonus + otherInc;
    const totalExp    = fixedExp + oneTimeExp;
    return { label, m, fixedInc, fixedExp, dividend, bonus, otherInc, oneTimeExp, totalInc, totalExp, net: totalInc - totalExp };
  }), [yearEntries, monthlyOverrides, defaultFixedIncome, defaultFixedExpense]);

  // 全年合計
  const totals = useMemo(() => ({
    fixedInc:   rows.reduce((s, r) => s + r.fixedInc,   0),
    dividend:   rows.reduce((s, r) => s + r.dividend,   0),
    bonus:      rows.reduce((s, r) => s + r.bonus,      0),
    otherInc:   rows.reduce((s, r) => s + r.otherInc,   0),
    totalInc:   rows.reduce((s, r) => s + r.totalInc,   0),
    fixedExp:   rows.reduce((s, r) => s + r.fixedExp,   0),
    oneTimeExp: rows.reduce((s, r) => s + r.oneTimeExp, 0),
    totalExp:   rows.reduce((s, r) => s + r.totalExp,   0),
    net:        rows.reduce((s, r) => s + r.net,        0),
  }), [rows]);

  const fmt = (n: number) => (showValues ? n.toLocaleString('en-US') : '****');
  const fmtOpt = (n: number) => n === 0 ? (showValues ? '—' : '—') : fmt(n);
  const netCell = (n: number) => {
    if (!showValues) return <span className="text-gray-400">****</span>;
    if (n === 0) return <span className="text-gray-400">—</span>;
    return n > 0
      ? <span className="font-bold text-emerald-600">+{n.toLocaleString('en-US')}</span>
      : <span className="font-bold text-rose-600">{n.toLocaleString('en-US')}</span>;
  };

  return (
    <div className="mt-10">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">年度現金流追蹤</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            固定收支自動帶入每月，可按月調整 &bull; ✦ 欄可點擊新增一次性項目
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <button onClick={() => setYear(y => y - 1)} className="p-1 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <span className="font-bold text-gray-900 w-12 text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="p-1 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
              <th className="px-4 py-3 text-left font-semibold text-gray-700">月份</th>
              <th className="px-3 py-3 text-right font-semibold">固定收入 ✎</th>
              <th className="px-3 py-3 text-right font-semibold text-emerald-600">股利 ✦</th>
              <th className="px-3 py-3 text-right font-semibold text-blue-600">獎金 ✦</th>
              <th className="px-3 py-3 text-right font-semibold text-violet-600">其他收入 ✦</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700 bg-emerald-50/40">收入小計</th>
              <th className="px-3 py-3 text-right font-semibold">固定支出 ✎</th>
              <th className="px-3 py-3 text-right font-semibold text-rose-600">一次性支出 ✦</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700 bg-rose-50/40">支出小計</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700 bg-indigo-50/40">月淨結餘</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {rows.map(row => {
              const ov = monthlyOverrides[overrideKey(row.m)];
              return (
                <tr key={row.m} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-2.5 font-bold text-gray-700 whitespace-nowrap">{row.label}</td>

                  {/* 固定收入（可編輯） */}
                  <EditableFixedCell
                    defaultValue={defaultFixedIncome}
                    override={ov?.fixedIncome}
                    showValues={showValues}
                    onSave={v => saveOverride(row.m, 'fixedIncome', v)}
                    onReset={() => resetOverride(row.m, 'fixedIncome')}
                  />

                  {/* 一次性收入（彈窗） */}
                  {ONE_TIME_INCOME_CATS.map(cat => (
                    <ClickableCell
                      key={cat.key}
                      value={getTotal(row.m, cat.key)}
                      showValues={showValues}
                      onClick={() => setModal({ month: row.m, cat: cat.key, label: cat.label })}
                    />
                  ))}

                  {/* 收入小計 */}
                  <td className="px-3 py-2.5 text-right font-bold text-emerald-700 bg-emerald-50/20">
                    {fmt(row.totalInc)}
                  </td>

                  {/* 固定支出（可編輯） */}
                  <EditableFixedCell
                    defaultValue={defaultFixedExpense}
                    override={ov?.fixedExpense}
                    showValues={showValues}
                    onSave={v => saveOverride(row.m, 'fixedExpense', v)}
                    onReset={() => resetOverride(row.m, 'fixedExpense')}
                  />

                  {/* 一次性支出（彈窗） */}
                  <ClickableCell
                    value={row.oneTimeExp}
                    showValues={showValues}
                    onClick={() => setModal({ month: row.m, cat: 'one_time_expense', label: '一次性支出' })}
                  />

                  {/* 支出小計 */}
                  <td className="px-3 py-2.5 text-right font-bold text-rose-700 bg-rose-50/20">
                    {fmt(row.totalExp)}
                  </td>

                  {/* 月淨結餘 */}
                  <td className="px-3 py-2.5 text-right bg-indigo-50/20">
                    {netCell(row.net)}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* 全年合計 */}
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 text-sm font-bold">
              <td className="px-4 py-3 text-gray-900 text-xs uppercase tracking-wider">全年合計</td>
              <td className="px-3 py-3 text-right text-gray-700">{fmt(totals.fixedInc)}</td>
              <td className="px-3 py-3 text-right text-emerald-700">{fmtOpt(totals.dividend)}</td>
              <td className="px-3 py-3 text-right text-blue-700">{fmtOpt(totals.bonus)}</td>
              <td className="px-3 py-3 text-right text-violet-700">{fmtOpt(totals.otherInc)}</td>
              <td className="px-3 py-3 text-right text-emerald-800 bg-emerald-50">{fmt(totals.totalInc)}</td>
              <td className="px-3 py-3 text-right text-gray-700">{fmt(totals.fixedExp)}</td>
              <td className="px-3 py-3 text-right text-rose-700">{fmtOpt(totals.oneTimeExp)}</td>
              <td className="px-3 py-3 text-right text-rose-800 bg-rose-50">{fmt(totals.totalExp)}</td>
              <td className="px-3 py-3 text-right bg-indigo-50">{netCell(totals.net)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <CellModal
          year={year}
          month={modal.month}
          label={modal.label}
          entries={getEntries(modal.month, modal.cat)}
          onAdd={(name, amount) => addEntry(modal.month, modal.cat, name, amount)}
          onDelete={deleteEntry}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
