"use client";

import { useState } from 'react';
import { Wallet, Plus, Trash2, Pencil, Check, X, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { useAppContext, type CashFlowItem, type LoanItem } from '../../context/AppContext';
import { formatCurrency as _fmt } from '../../lib/utils';
import { AnnualTracker } from '../../components/AnnualTracker';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../context/ToastContext';

export default function CashFlowPage() {
  const { 
    incomeItems, setIncomeItems, 
    expenseItems, setExpenseItems, 
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
    showValues
  } = useAppContext();

  const [isAddingIncome, setIsAddingIncome] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  const formatCurrency = (amount: number) => _fmt(amount, showValues);

  const handleAddItem = (type: 'income' | 'expense', name: string, amount: number) => {
    const newItem: CashFlowItem = {
      id: Date.now().toString(),
      name,
      amount,
      category: 'General',
      isRecurring: true
    };
    if (type === 'income') setIncomeItems(prev => [...prev, newItem]);
    else setExpenseItems(prev => [...prev, newItem]);
  };

  const handleDeleteItem = (type: 'income' | 'expense', id: string) => {
    if (type === 'income') setIncomeItems(prev => prev.filter(item => item.id !== id));
    else setExpenseItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateItem = (type: 'income' | 'expense', id: string, name: string, amount: number) => {
    const updateFn = (prev: CashFlowItem[]) => prev.map(item => item.id === id ? { ...item, name, amount } : item);
    if (type === 'income') setIncomeItems(updateFn);
    else setExpenseItems(updateFn);
  };

  return (
    <>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">收支管理 (Cash Flow)</h1>
          <p className="text-sm text-gray-500 mt-1">追蹤每月的收入與支出流量</p>
        </div>
      </div>

      {/* Summary KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <ArrowUpCircle className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">每月總收入</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">{formatCurrency(totalMonthlyIncome)}</h2>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-rose-600 mb-2">
            <ArrowDownCircle className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">每月總支出</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">{formatCurrency(totalMonthlyExpense)}</h2>
        </div>

        <div className={`rounded-2xl p-6 shadow-lg text-white ${monthlyNetCashFlow >= 0 ? 'bg-gradient-to-br from-indigo-500 to-indigo-700' : 'bg-gradient-to-br from-rose-500 to-rose-700'}`}>
          <div className="flex items-center gap-2 mb-2 opacity-80">
            <Wallet className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">每月預計盈餘</span>
          </div>
          <h2 className="text-3xl font-bold">{formatCurrency(monthlyNetCashFlow)}</h2>
          <p className="text-xs mt-2 opacity-70">儲蓄率: {totalMonthlyIncome > 0 ? ((monthlyNetCashFlow / totalMonthlyIncome) * 100).toFixed(1) : 0}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Income Column */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">收入項目</h3>
            <button onClick={() => setIsAddingIncome(true)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> 新增收入
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="divide-y divide-gray-50">
              {isAddingIncome && (
                <AddItemRow onConfirm={(n, a) => { handleAddItem('income', n, a); setIsAddingIncome(false); }} onCancel={() => setIsAddingIncome(false)} />
              )}
              {incomeItems.map(item => (
                <CashFlowRow key={item.id} item={item} onUpdate={(n, a) => handleUpdateItem('income', item.id, n, a)} onDelete={() => handleDeleteItem('income', item.id)} showValues={showValues} />
              ))}
              {/* Auto Staking Earn Income (Display Only) */}
              <AutoStakingIncomeRow />
              {incomeItems.length === 0 && !isAddingIncome && <div className="p-8 text-center text-gray-400 text-sm">尚無手動收入項目</div>}
            </div>
          </div>
        </div>

        {/* Expense Column */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">支出項目</h3>
            <button onClick={() => setIsAddingExpense(true)} className="text-xs font-medium text-rose-600 hover:text-rose-800 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> 新增支出
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="divide-y divide-gray-50">
              {isAddingExpense && (
                <AddItemRow onConfirm={(n, a) => { handleAddItem('expense', n, a); setIsAddingExpense(false); }} onCancel={() => setIsAddingExpense(false)} />
              )}
              {expenseItems.map(item => (
                <CashFlowRow key={item.id} item={item} onUpdate={(n, a) => handleUpdateItem('expense', item.id, n, a)} onDelete={() => handleDeleteItem('expense', item.id)} showValues={showValues} />
              ))}
              {/* Auto Staking Interest (Display Only) */}
              <AutoStakingExpenseRow />
              {/* Auto Loan Payments (Display Only) */}
              <AutoLoanExpenseRow />
              {expenseItems.length === 0 && !isAddingExpense && <div className="p-8 text-center text-gray-400 text-sm">尚無手動支出項目</div>}
            </div>
            {/* Total */}
            <div className="border-t-2 border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50">
              <span className="text-sm font-bold text-gray-600">支出合計</span>
              <span className="text-base font-bold text-rose-600">{formatCurrency(totalMonthlyExpense)}</span>
            </div>
          </div>
        </div>
      </div>

      <AnnualTracker />
    </>
  );
}

function CashFlowRow({ item, onUpdate, onDelete, showValues }: { item: CashFlowItem, onUpdate: (n: string, a: number) => void, onDelete: () => void, showValues: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(item.amount.toString());
  const { toast } = useToast();

  const handleSave = () => {
    onUpdate(name, Number(amount) || 0);
    setIsEditing(false);
    toast('已更新項目');
  };

  const handleDelete = () => {
    onDelete();
    toast(`已刪除「${item.name}」`, 'info');
  };

  if (isEditing) {
    return (
      <div className="p-4 bg-gray-50 flex items-center gap-3">
        <input type="text" value={name} onChange={e => setName(e.target.value)} className="flex-1 border rounded px-2 py-1 text-sm" />
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-24 border rounded px-2 py-1 text-sm text-right" />
        <button onClick={handleSave} className="text-indigo-600"><Check className="w-4 h-4" /></button>
        <button onClick={() => setIsEditing(false)} className="text-gray-400"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  return (
    <div className="p-4 flex items-center justify-between hover:bg-gray-50 group transition-colors">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-700">{item.name}</span>
        <span className="text-[10px] text-gray-400 uppercase tracking-tighter">每月固定</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-bold text-gray-900 text-sm">{showValues ? item.amount.toLocaleString() : '****'}</span>
        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
          <button onClick={() => setIsEditing(true)} className="p-1 text-gray-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => setConfirmDelete(true)} className="p-1 text-gray-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          message={`確定要刪除「${item.name}」嗎？`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

function AddItemRow({ onConfirm, onCancel }: { onConfirm: (n: string, a: number) => void, onCancel: () => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  return (
    <div className="p-4 bg-indigo-50 flex items-center gap-3">
      <input type="text" placeholder="名稱" value={name} onChange={e => setName(e.target.value)} className="flex-1 border border-indigo-200 rounded px-2 py-1 text-sm outline-none" autoFocus />
      <input type="number" placeholder="金額" value={amount} onChange={e => setAmount(e.target.value)} className="w-24 border border-indigo-200 rounded px-2 py-1 text-sm text-right outline-none" />
      <button onClick={() => onConfirm(name, Number(amount) || 0)} className="text-indigo-600 font-bold"><Check className="w-4 h-4" /></button>
      <button onClick={onCancel} className="text-gray-400"><X className="w-4 h-4" /></button>
    </div>
  );
}

function AutoStakingIncomeRow() {
  const { stakingItems, showValues } = useAppContext();
  const earnItems = stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'earn');
  const totalIncome = earnItems.reduce((sum, item) => sum + (item.value * item.apy / 100 / 12), 0);

  if (totalIncome === 0) return null;

  return (
    <div className="p-4 flex items-center justify-between bg-emerald-50/50">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-700">活存/Earn 收益</span>
        <span className="text-[10px] text-emerald-600 flex items-center gap-1">
          <span className="px-1 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-bold rounded uppercase animate-pulse">Auto</span>
          同步自質押管理分頁
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-bold text-emerald-700 text-sm">{showValues ? Math.round(totalIncome).toLocaleString() : '****'}</span>
        <div className="invisible flex gap-1">
          <button className="p-1"><Pencil className="w-3.5 h-3.5" /></button>
          <button className="p-1"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

function AutoLoanExpenseRow() {
  const { loans, showValues } = useAppContext();
  const activeLoans = loans.filter(l => l.principal > 0);
  if (activeLoans.length === 0) return null;

  return (
    <>
      {activeLoans.map((loan: LoanItem) => (
        <div key={loan.id} className="p-4 flex items-center justify-between bg-rose-50/30">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-700">{loan.name}（{loan.bank}）月繳</span>
            <span className="text-[10px] text-rose-500 flex items-center gap-1">
              <span className="px-1 py-0.5 bg-rose-100 text-rose-500 text-[9px] font-bold rounded uppercase animate-pulse">Auto</span>
              同步自借貸管理分頁
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-bold text-rose-700 text-sm">{showValues ? loan.monthlyPayment.toLocaleString('en-US') : '****'}</span>
            <div className="invisible flex gap-1">
              <button className="p-1"><Pencil className="w-3.5 h-3.5" /></button>
              <button className="p-1"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function AutoStakingExpenseRow() {
  const { stakingItems, showValues } = useAppContext();
  const borrowItems = stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'borrow');
  const totalInterest = borrowItems.reduce((sum, item) => sum + (item.value * item.apy / 100 / 12), 0);

  if (totalInterest === 0) return null;

  return (
    <div className="p-4 flex items-center justify-between bg-rose-50/50">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-700">質押利息支出</span>
        <span className="text-[10px] text-rose-500 flex items-center gap-1">
          <span className="px-1 py-0.5 bg-rose-100 text-rose-500 text-[9px] font-bold rounded uppercase animate-pulse">Auto</span>
          同步自質押管理分頁
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-bold text-rose-700 text-sm">{showValues ? Math.round(totalInterest).toLocaleString() : '****'}</span>
        {/* invisible spacer — matches the edit/delete button area in CashFlowRow */}
        <div className="invisible flex gap-1">
          <button className="p-1"><Pencil className="w-3.5 h-3.5" /></button>
          <button className="p-1"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );
}
