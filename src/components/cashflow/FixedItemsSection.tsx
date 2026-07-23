"use client";
import { Plus } from 'lucide-react';
import { type CashFlowItem } from '../../context/AppContext';
import { CashFlowRow } from './CashFlowRow';
import { AddFixedItemRow } from './AddFixedItemRow';
import { AutoStakingIncomeRow, AutoStakingExpenseRow, AutoLoanExpenseRows } from './AutoItemRows';

interface Props {
  filterType: 'all' | 'income' | 'expense';
  incomeItems: CashFlowItem[];
  expenseItems: CashFlowItem[];
  isAddingIncome: boolean;
  setIsAddingIncome: (v: boolean) => void;
  isAddingExpense: boolean;
  setIsAddingExpense: (v: boolean) => void;
  debouncedKeyword: string;
  customCategories: string[];
  showValues: boolean;
  viewBaseExpense: number;
  formatCurrency: (n: number) => string;
  onAddIncome: (name: string, amount: number, customCategory?: string) => void;
  onAddExpense: (name: string, amount: number, customCategory?: string) => void;
  onUpdate: (type: 'income' | 'expense', id: string, name: string, amount: number, customCategory?: string) => void;
  onDelete: (type: 'income' | 'expense', id: string) => void;
}

export function FixedItemsSection({
  filterType, incomeItems, expenseItems,
  isAddingIncome, setIsAddingIncome,
  isAddingExpense, setIsAddingExpense,
  debouncedKeyword, customCategories, showValues,
  viewBaseExpense, formatCurrency,
  onAddIncome, onAddExpense, onUpdate, onDelete,
}: Props) {
  const filtered = (items: CashFlowItem[]) =>
    items.filter(item => !debouncedKeyword || item.name.toLowerCase().includes(debouncedKeyword.toLowerCase()));

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-bold text-gray-900">本月收支項目</h2>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">本月獨立記錄</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {filterType !== 'expense' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600">固定收入</h3>
              <button onClick={() => setIsAddingIncome(true)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> 新增
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="divide-y divide-gray-50">
                {isAddingIncome && (
                  <AddFixedItemRow type="income" customCategories={customCategories} onConfirm={onAddIncome} onCancel={() => setIsAddingIncome(false)} />
                )}
                {filtered(incomeItems).map(item => (
                  <CashFlowRow key={item.id} item={item} type="income" customCategories={customCategories} showValues={showValues}
                    onUpdate={(n, a, c) => onUpdate('income', item.id, n, a, c)}
                    onDelete={() => onDelete('income', item.id)}
                  />
                ))}
                <AutoStakingIncomeRow />
                {incomeItems.length === 0 && !isAddingIncome && (
                  <div className="p-8 text-center text-gray-400 text-sm">尚無固定收入項目</div>
                )}
              </div>
            </div>
          </div>
        )}

        {filterType !== 'income' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600">固定支出</h3>
              <button onClick={() => setIsAddingExpense(true)} className="text-xs font-medium text-emerald-600 hover:text-emerald-800 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> 新增
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="divide-y divide-gray-50">
                {isAddingExpense && (
                  <AddFixedItemRow type="expense" customCategories={customCategories} onConfirm={onAddExpense} onCancel={() => setIsAddingExpense(false)} />
                )}
                {filtered(expenseItems).map(item => (
                  <CashFlowRow key={item.id} item={item} type="expense" customCategories={customCategories} showValues={showValues}
                    onUpdate={(n, a, c) => onUpdate('expense', item.id, n, a, c)}
                    onDelete={() => onDelete('expense', item.id)}
                  />
                ))}
                <AutoStakingExpenseRow />
                <AutoLoanExpenseRows />
                {expenseItems.length === 0 && !isAddingExpense && (
                  <div className="p-8 text-center text-gray-400 text-sm">尚無固定支出項目</div>
                )}
              </div>
              <div className="border-t-2 border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50">
                <span className="text-sm font-bold text-gray-600">固定支出合計</span>
                <span className="text-base font-bold text-emerald-600">{formatCurrency(viewBaseExpense)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
