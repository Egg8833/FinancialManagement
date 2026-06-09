"use client";
import { Plus } from 'lucide-react';
import { type AnnualEntry, type AnnualEntryCategory } from '../../context/AppContext';
import { OneTimeEntryRow } from './OneTimeEntryRow';
import { AddOneTimeEntryRow } from './AddOneTimeEntryRow';

interface Props {
  selectedYear: number;
  selectedMonth: number;
  monthOneTimeIncome: AnnualEntry[];
  monthOneTimeExpense: AnnualEntry[];
  monthOneTimeIncomeTotal: number;
  monthOneTimeExpenseTotal: number;
  isAddingOneTimeIncome: boolean;
  setIsAddingOneTimeIncome: (v: boolean) => void;
  isAddingOneTimeExpense: boolean;
  setIsAddingOneTimeExpense: (v: boolean) => void;
  showValues: boolean;
  formatCurrency: (n: number) => string;
  onAddEntry: (category: AnnualEntryCategory, name: string, amount: number) => void;
  onDeleteEntry: (id: string) => void;
}

export function OneTimeEntriesSection({
  selectedYear, selectedMonth,
  monthOneTimeIncome, monthOneTimeExpense,
  monthOneTimeIncomeTotal, monthOneTimeExpenseTotal,
  isAddingOneTimeIncome, setIsAddingOneTimeIncome,
  isAddingOneTimeExpense, setIsAddingOneTimeExpense,
  showValues, formatCurrency,
  onAddEntry, onDeleteEntry,
}: Props) {
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
            <button onClick={() => setIsAddingOneTimeIncome(true)} className="text-xs font-medium text-emerald-600 hover:text-emerald-800 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> 新增
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="divide-y divide-gray-50">
              {isAddingOneTimeIncome && (
                <AddOneTimeEntryRow type="income" onConfirm={(name, amount, category) => onAddEntry(category, name, amount)} onCancel={() => setIsAddingOneTimeIncome(false)} />
              )}
              {monthOneTimeIncome.map(entry => (
                <OneTimeEntryRow key={entry.id} entry={entry} onDelete={() => onDeleteEntry(entry.id)} showValues={showValues} />
              ))}
              {monthOneTimeIncome.length === 0 && !isAddingOneTimeIncome && (
                <div className="p-8 text-center text-gray-400 text-sm">本月尚無一次性收入</div>
              )}
            </div>
            {monthOneTimeIncomeTotal > 0 && (
              <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between bg-emerald-50/40">
                <span className="text-xs font-bold text-gray-500">本月小計</span>
                <span className="text-sm font-bold text-emerald-700">{formatCurrency(monthOneTimeIncomeTotal)}</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-600">本月一次性支出</h3>
            <button onClick={() => setIsAddingOneTimeExpense(true)} className="text-xs font-medium text-rose-600 hover:text-rose-800 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> 新增
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="divide-y divide-gray-50">
              {isAddingOneTimeExpense && (
                <AddOneTimeEntryRow type="expense" onConfirm={(name, amount, category) => onAddEntry(category, name, amount)} onCancel={() => setIsAddingOneTimeExpense(false)} />
              )}
              {monthOneTimeExpense.map(entry => (
                <OneTimeEntryRow key={entry.id} entry={entry} onDelete={() => onDeleteEntry(entry.id)} showValues={showValues} />
              ))}
              {monthOneTimeExpense.length === 0 && !isAddingOneTimeExpense && (
                <div className="p-8 text-center text-gray-400 text-sm">本月尚無一次性支出</div>
              )}
            </div>
            {monthOneTimeExpenseTotal > 0 && (
              <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between bg-rose-50/40">
                <span className="text-xs font-bold text-gray-500">本月小計</span>
                <span className="text-sm font-bold text-rose-700">{formatCurrency(monthOneTimeExpenseTotal)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
