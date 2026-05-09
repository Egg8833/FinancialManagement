"use client";

import { useState, useMemo } from 'react';
import {
  Plus, X, Trash2, ChevronLeft, ChevronRight,
  TableProperties, BarChart3, TrendingUp, TrendingDown, Wallet,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { useAppContext, type AnnualEntry, type AnnualEntryCategory } from '../../context/AppContext';

// ─── 常數 ─────────────────────────────────────────────────────────────────────

const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

const INCOME_CATS = [
  { key: 'dividend'     as AnnualEntryCategory, label: '股利收入', color: 'text-emerald-600', bar: '#10b981' },
  { key: 'bonus'        as AnnualEntryCategory, label: '業績獎金', color: 'text-blue-600',    bar: '#3b82f6' },
  { key: 'other_income' as AnnualEntryCategory, label: '其他收入', color: 'text-violet-600',  bar: '#8b5cf6' },
] as const;

const EXPENSE_CATS = [
  { key: 'one_time_expense' as AnnualEntryCategory, label: '一次性支出', color: 'text-rose-600', bar: '#f43f5e' },
] as const;

// ─── 小工具 ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n === 0 ? '—' : n.toLocaleString('en-US');
}

function fmtSigned(n: number) {
  if (n === 0) return <span className="text-gray-400">—</span>;
  return n > 0
    ? <span className="text-emerald-600 font-bold">+{n.toLocaleString('en-US')}</span>
    : <span className="text-rose-600 font-bold">{n.toLocaleString('en-US')}</span>;
}

// ─── Cell Modal ────────────────────────────────────────────────────────────────

interface CellModalProps {
  year: number;
  month: number;
  catLabel: string;
  entries: AnnualEntry[];
  onAdd: (name: string, amount: number) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function CellModal({ year, month, catLabel, entries, onAdd, onDelete, onClose }: CellModalProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const handleAdd = () => {
    const n = Number(amount);
    if (!name.trim() || !n) return;
    onAdd(name.trim(), n);
    setName('');
    setAmount('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-gray-500">{year} 年 {month} 月</p>
            <h3 className="font-bold text-gray-900">{catLabel}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        {/* 現有項目 */}
        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {entries.length === 0 && <p className="text-sm text-gray-400 text-center py-4">尚無記錄</p>}
          {entries.map(e => (
            <div key={e.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-sm text-gray-700 flex-1 truncate">{e.name}</span>
              <span className="text-sm font-bold text-gray-900 mx-3">{e.amount.toLocaleString('en-US')}</span>
              <button onClick={() => onDelete(e.id)} className="p-0.5 text-gray-300 hover:text-rose-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>

        {/* 新增列 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="名稱"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="金額"
            className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 text-right"
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          />
          <button
            onClick={handleAdd}
            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {entries.length > 0 && (
          <p className="text-right text-xs font-bold text-gray-500 mt-3">
            小計 {entries.reduce((s, e) => s + e.amount, 0).toLocaleString('en-US')}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── 主頁面 ────────────────────────────────────────────────────────────────────

export default function AnnualPage() {
  const { annualEntries, setAnnualEntries, incomeItems, expenseItems, showValues } = useAppContext();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [view, setView] = useState<'table' | 'chart'>('table');
  const [modal, setModal] = useState<{ month: number; cat: AnnualEntryCategory; label: string } | null>(null);

  // 固定月收入 / 月支出（來自收支管理）
  const fixedIncome  = useMemo(() => incomeItems.reduce((s, i) => s + i.amount, 0), [incomeItems]);
  const fixedExpense = useMemo(() => expenseItems.reduce((s, i) => s + i.amount, 0), [expenseItems]);

  // 依年份過濾
  const yearEntries = useMemo(() => annualEntries.filter(e => e.year === year), [annualEntries, year]);

  // 取得某月某類別的 entries
  const getEntries = (month: number, cat: AnnualEntryCategory) =>
    yearEntries.filter(e => e.month === month && e.category === cat);

  // 取得某月某類別的合計
  const getTotal = (month: number, cat: AnnualEntryCategory) =>
    getEntries(month, cat).reduce((s, e) => s + e.amount, 0);

  // 新增 entry
  const handleAdd = (month: number, cat: AnnualEntryCategory, name: string, amount: number) => {
    setAnnualEntries(prev => [...prev, { id: Date.now().toString(), year, month, name, amount, category: cat }]);
  };

  // 刪除 entry
  const handleDelete = (id: string) => {
    setAnnualEntries(prev => prev.filter(e => e.id !== id));
  };

  // 每月的行資料
  const monthRows = useMemo(() => {
    return MONTH_LABELS.map((label, idx) => {
      const m = idx + 1;
      const dividend    = getTotal(m, 'dividend');
      const bonus       = getTotal(m, 'bonus');
      const otherIncome = getTotal(m, 'other_income');
      const oneTimeExp  = getTotal(m, 'one_time_expense');

      const totalIncome  = fixedIncome + dividend + bonus + otherIncome;
      const totalExpense = fixedExpense + oneTimeExp;
      const net          = totalIncome - totalExpense;

      return { label, m, dividend, bonus, otherIncome, oneTimeExp, totalIncome, totalExpense, net };
    });
  }, [yearEntries, fixedIncome, fixedExpense]);

  // 年度合計
  const yearTotals = useMemo(() => ({
    fixedIncome:  fixedIncome * 12,
    dividend:     monthRows.reduce((s, r) => s + r.dividend, 0),
    bonus:        monthRows.reduce((s, r) => s + r.bonus, 0),
    otherIncome:  monthRows.reduce((s, r) => s + r.otherIncome, 0),
    totalIncome:  monthRows.reduce((s, r) => s + r.totalIncome, 0),
    fixedExpense: fixedExpense * 12,
    oneTimeExp:   monthRows.reduce((s, r) => s + r.oneTimeExp, 0),
    totalExpense: monthRows.reduce((s, r) => s + r.totalExpense, 0),
    net:          monthRows.reduce((s, r) => s + r.net, 0),
  }), [monthRows, fixedIncome, fixedExpense]);

  // Recharts 資料
  const chartData = monthRows.map(r => ({
    name: r.label,
    收入: r.totalIncome,
    支出: r.totalExpense,
    淨結餘: r.net,
  }));

  // ── 可點擊的 cell ──────────────────────────────────────────────────────────

  const ClickableCell = ({ month, cat, label, value }: { month: number; cat: AnnualEntryCategory; label: string; value: number }) => (
    <td
      className="px-3 py-2.5 text-right cursor-pointer hover:bg-indigo-50 transition-colors group"
      onClick={() => setModal({ month, cat, label })}
    >
      <span className={`text-sm ${value > 0 ? 'text-gray-800 font-medium' : 'text-gray-300'} group-hover:text-indigo-600`}>
        {showValues ? (value > 0 ? value.toLocaleString('en-US') : '+ 新增') : (value > 0 ? '****' : '—')}
      </span>
    </td>
  );

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">年度收支追蹤</h1>
          <p className="text-sm text-gray-500 mt-1">依月份記錄股利、獎金等一次性收支，與固定項目合計呈現全年現金流</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Year selector */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <button onClick={() => setYear(y => y - 1)} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
            <span className="font-bold text-gray-900 w-12 text-center">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
          </div>

          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1">
            <button onClick={() => setView('table')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'table' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <TableProperties className="w-4 h-4" /> 表格
            </button>
            <button onClick={() => setView('chart')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'chart' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <BarChart3 className="w-4 h-4" /> 圖表
            </button>
          </div>
        </div>
      </div>

      {/* Year KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-2.5 bg-emerald-50 rounded-xl"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">全年總收入</p>
            <p className="text-xl font-bold text-gray-900">{showValues ? yearTotals.totalIncome.toLocaleString('en-US') : '****'}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-2.5 bg-rose-50 rounded-xl"><TrendingDown className="w-5 h-5 text-rose-600" /></div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">全年總支出</p>
            <p className="text-xl font-bold text-gray-900">{showValues ? yearTotals.totalExpense.toLocaleString('en-US') : '****'}</p>
          </div>
        </div>
        <div className={`rounded-2xl p-5 border shadow-sm flex items-center gap-4 ${yearTotals.net >= 0 ? 'bg-indigo-600 border-indigo-500' : 'bg-rose-600 border-rose-500'}`}>
          <div className="p-2.5 bg-white/20 rounded-xl"><Wallet className="w-5 h-5 text-white" /></div>
          <div>
            <p className="text-xs text-white/70 font-medium uppercase tracking-wider">全年淨結餘</p>
            <p className="text-xl font-bold text-white">{showValues ? yearTotals.net.toLocaleString('en-US') : '****'}</p>
          </div>
        </div>
      </div>

      {/* ── TABLE VIEW ─────────────────────────────────────────────────────── */}
      {view === 'table' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left font-semibold text-gray-700 w-16">月份</th>
                {/* Income */}
                <th className="px-3 py-3 text-right font-semibold text-gray-500 text-xs">固定收入</th>
                <th className="px-3 py-3 text-right font-semibold text-emerald-600 text-xs">股利收入 ✦</th>
                <th className="px-3 py-3 text-right font-semibold text-blue-600 text-xs">業績獎金 ✦</th>
                <th className="px-3 py-3 text-right font-semibold text-violet-600 text-xs">其他收入 ✦</th>
                <th className="px-3 py-3 text-right font-semibold text-gray-700 text-xs bg-emerald-50/50">收入小計</th>
                {/* Expense */}
                <th className="px-3 py-3 text-right font-semibold text-gray-500 text-xs">固定支出</th>
                <th className="px-3 py-3 text-right font-semibold text-rose-600 text-xs">一次性支出 ✦</th>
                <th className="px-3 py-3 text-right font-semibold text-gray-700 text-xs bg-rose-50/50">支出小計</th>
                {/* Net */}
                <th className="px-3 py-3 text-right font-semibold text-gray-700 text-xs bg-indigo-50/50">月淨結餘</th>
              </tr>
              <tr className="border-b border-gray-100">
                <td colSpan={10} className="px-4 py-1.5 text-[10px] text-gray-400">✦ 點擊儲存格可新增／編輯一次性項目</td>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {monthRows.map(row => (
                <tr key={row.m} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2.5 font-bold text-gray-700">{row.label}</td>
                  {/* Fixed income */}
                  <td className="px-3 py-2.5 text-right text-sm text-gray-400">{showValues ? fixedIncome.toLocaleString('en-US') : '****'}</td>
                  {/* One-time income */}
                  <ClickableCell month={row.m} cat="dividend"     label="股利收入" value={row.dividend} />
                  <ClickableCell month={row.m} cat="bonus"        label="業績獎金" value={row.bonus} />
                  <ClickableCell month={row.m} cat="other_income" label="其他收入" value={row.otherIncome} />
                  {/* Income subtotal */}
                  <td className="px-3 py-2.5 text-right text-sm font-bold text-emerald-700 bg-emerald-50/30">
                    {showValues ? row.totalIncome.toLocaleString('en-US') : '****'}
                  </td>
                  {/* Fixed expense */}
                  <td className="px-3 py-2.5 text-right text-sm text-gray-400">{showValues ? fixedExpense.toLocaleString('en-US') : '****'}</td>
                  {/* One-time expense */}
                  <ClickableCell month={row.m} cat="one_time_expense" label="一次性支出" value={row.oneTimeExp} />
                  {/* Expense subtotal */}
                  <td className="px-3 py-2.5 text-right text-sm font-bold text-rose-700 bg-rose-50/30">
                    {showValues ? row.totalExpense.toLocaleString('en-US') : '****'}
                  </td>
                  {/* Net */}
                  <td className="px-3 py-2.5 text-right bg-indigo-50/20">
                    {showValues ? fmtSigned(row.net) : '****'}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* 全年合計 */}
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="px-4 py-3 font-bold text-gray-900 text-xs uppercase tracking-wider">全年</td>
                <td className="px-3 py-3 text-right text-sm font-bold text-gray-700">{showValues ? yearTotals.fixedIncome.toLocaleString('en-US') : '****'}</td>
                <td className="px-3 py-3 text-right text-sm font-bold text-emerald-700">{showValues ? fmt(yearTotals.dividend) : '****'}</td>
                <td className="px-3 py-3 text-right text-sm font-bold text-blue-700">{showValues ? fmt(yearTotals.bonus) : '****'}</td>
                <td className="px-3 py-3 text-right text-sm font-bold text-violet-700">{showValues ? fmt(yearTotals.otherIncome) : '****'}</td>
                <td className="px-3 py-3 text-right text-sm font-bold text-emerald-800 bg-emerald-50">{showValues ? yearTotals.totalIncome.toLocaleString('en-US') : '****'}</td>
                <td className="px-3 py-3 text-right text-sm font-bold text-gray-700">{showValues ? yearTotals.fixedExpense.toLocaleString('en-US') : '****'}</td>
                <td className="px-3 py-3 text-right text-sm font-bold text-rose-700">{showValues ? fmt(yearTotals.oneTimeExp) : '****'}</td>
                <td className="px-3 py-3 text-right text-sm font-bold text-rose-800 bg-rose-50">{showValues ? yearTotals.totalExpense.toLocaleString('en-US') : '****'}</td>
                <td className="px-3 py-3 text-right bg-indigo-50">{showValues ? fmtSigned(yearTotals.net) : '****'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── CHART VIEW ─────────────────────────────────────────────────────── */}
      {view === 'chart' && (
        <div className="space-y-6">
          {/* Stacked income breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-4">月度收入結構</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthRows.map(r => ({
                name: r.label,
                固定收入: r.totalIncome - r.dividend - r.bonus - r.otherIncome,
                股利: r.dividend,
                業績獎金: r.bonus,
                其他收入: r.otherIncome,
              }))} margin={{ left: 20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip formatter={(v: number) => v.toLocaleString('en-US')} />
                <Legend />
                <Bar dataKey="固定收入"  stackId="a" fill="#94a3b8" radius={[0,0,0,0]} />
                <Bar dataKey="股利"      stackId="a" fill="#10b981" />
                <Bar dataKey="業績獎金"  stackId="a" fill="#3b82f6" />
                <Bar dataKey="其他收入"  stackId="a" fill="#8b5cf6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Income vs Expense + Net */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-4">月度收支與淨結餘</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ left: 20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip formatter={(v: number) => v.toLocaleString('en-US')} />
                <Legend />
                <Bar dataKey="收入"   fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="支出"   fill="#f43f5e" radius={[4,4,0,0]} />
                <Bar dataKey="淨結餘" fill="#6366f1" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <CellModal
          year={year}
          month={modal.month}
          catLabel={modal.label}
          entries={getEntries(modal.month, modal.cat)}
          onAdd={(name, amount) => handleAdd(modal.month, modal.cat, name, amount)}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
