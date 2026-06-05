"use client";
import { useState } from 'react';
import { Check, X } from 'lucide-react';

interface Props {
  type: 'income' | 'expense';
  onConfirm: (name: string, amount: number, customCategory?: string) => void;
  onCancel: () => void;
  customCategories: string[];
}

export function AddFixedItemRow({ type, onConfirm, onCancel, customCategories }: Props) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [customCategory, setCustomCategory] = useState<string | undefined>(undefined);

  const submit = () => onConfirm(name.trim(), Number(amount) || 0, customCategory);

  return (
    <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <input
          autoFocus
          type="text"
          placeholder="項目名稱"
          value={name}
          onChange={e => setName(e.target.value)}
          className="flex-1 min-w-0 border border-indigo-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-400 bg-white"
        />
        <input
          type="number"
          placeholder="金額"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          className="w-28 border border-indigo-200 rounded-lg px-3 py-1.5 text-sm text-right outline-none focus:border-indigo-400 bg-white"
        />
        {type === 'expense' && customCategories.length > 0 && (
          <select
            value={customCategory ?? ''}
            onChange={e => setCustomCategory(e.target.value || undefined)}
            className="shrink-0 text-xs border border-indigo-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400 bg-white text-gray-600"
          >
            <option value="">不分類</option>
            {customCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        )}
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
