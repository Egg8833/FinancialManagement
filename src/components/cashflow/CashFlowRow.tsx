"use client";
import { useState, memo } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { type CashFlowItem } from '../../context/AppContext';
import { getCategoryColor } from '../../lib/categoryUtils';
import { ConfirmDialog } from '../ConfirmDialog';
import { useToast } from '../../context/ToastContext';

interface Props {
  item: CashFlowItem;
  type: 'income' | 'expense';
  onUpdate: (name: string, amount: number, customCategory?: string) => void;
  onDelete: () => void;
  showValues: boolean;
  customCategories: string[];
}

export const CashFlowRow = memo(function CashFlowRow({ item, type, onUpdate, onDelete, showValues, customCategories }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(item.amount.toString());
  const [customCategory, setCustomCategory] = useState<string | undefined>(item.customCategory);
  const { toast } = useToast();

  const handleSave = () => {
    onUpdate(name, Number(amount) || 0, customCategory);
    setIsEditing(false);
    toast('已更新項目');
  };

  const handleDelete = () => {
    onDelete();
    toast(`已刪除「${item.name}」`, 'info');
  };

  if (isEditing) {
    return (
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-400 bg-white"
            placeholder="項目名稱"
          />
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-right outline-none focus:border-indigo-400 bg-white"
            placeholder="金額"
          />
          {type === 'expense' && customCategories.length > 0 && (
            <select
              value={customCategory ?? ''}
              onChange={e => setCustomCategory(e.target.value || undefined)}
              className="shrink-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400 bg-white text-gray-600"
            >
              <option value="">不分類</option>
              {customCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          )}
          <button onClick={handleSave} className="p-1.5 text-indigo-600 hover:text-indigo-800 shrink-0">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => setIsEditing(false)} className="p-1.5 text-gray-400 hover:text-gray-600 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 hover:bg-gray-50 group transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm font-medium text-gray-800 truncate">{item.name}</span>
          {item.customCategory && (
            <span
              className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold"
              style={{
                backgroundColor: `${getCategoryColor(item.customCategory, customCategories)}20`,
                color: getCategoryColor(item.customCategory, customCategories),
              }}
            >
              {item.customCategory}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-bold text-sm tabular-nums text-gray-900">
            {showValues ? item.amount.toLocaleString('en-US') : '****'}
          </span>
          <div className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 flex gap-0.5 transition-opacity">
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
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
});
