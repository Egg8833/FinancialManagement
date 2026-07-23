"use client";
import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { type AnnualEntryCategory } from '../../context/AppContext';

const INCOME_ENTRY_CATS: { key: AnnualEntryCategory; label: string }[] = [
  { key: 'other_income', label: '其他收入' },
  { key: 'bonus',        label: '業績獎金' },
  { key: 'dividend',     label: '股利收入' },
];

const EXPENSE_ENTRY_CATS: { key: AnnualEntryCategory; label: string }[] = [
  { key: 'one_time_expense', label: '其他支出' },
  { key: 'travel',           label: '旅遊'     },
  { key: 'medical',          label: '醫療/健康' },
  { key: 'equipment',        label: '設備購置' },
];

interface Props {
  type: 'income' | 'expense';
  onConfirm: (name: string, amount: number, category: AnnualEntryCategory) => void;
  onCancel: () => void;
}

export function AddOneTimeEntryRow({ type, onConfirm, onCancel }: Props) {
  const cats = type === 'income' ? INCOME_ENTRY_CATS : EXPENSE_ENTRY_CATS;
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<AnnualEntryCategory>(cats[0].key);

  const submit = () => onConfirm(name.trim(), Number(amount) || 0, category);
  const bgClass = type === 'income' ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100';
  const borderColor = type === 'income' ? 'border-rose-200' : 'border-emerald-200';
  const focusColor = type === 'income' ? 'focus:border-rose-400' : 'focus:border-emerald-400';

  return (
    <div className={`px-4 py-3 ${bgClass} border-b`}>
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <input
          autoFocus
          type="text"
          placeholder="項目名稱"
          value={name}
          onChange={e => setName(e.target.value)}
          className={`flex-1 min-w-0 border ${borderColor} rounded-lg px-3 py-1.5 text-sm outline-none ${focusColor} bg-white`}
        />
        <input
          type="number"
          placeholder="金額"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          className={`w-28 border ${borderColor} rounded-lg px-3 py-1.5 text-sm text-right outline-none ${focusColor} bg-white`}
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value as AnnualEntryCategory)}
          className={`shrink-0 text-xs border ${borderColor} rounded-lg px-2 py-1.5 outline-none ${focusColor} bg-white text-gray-600`}
        >
          {cats.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <button onClick={submit} className="p-1.5 text-indigo-600 hover:text-indigo-800 shrink-0">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={onCancel} className="p-1.5 text-gray-400 hover:text-gray-600 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
