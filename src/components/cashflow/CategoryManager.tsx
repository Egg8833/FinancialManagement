"use client";
import { useState } from 'react';
import { Plus, Pencil, Check, X } from 'lucide-react';
import { CATEGORY_COLORS } from '../../lib/categoryUtils';
import { type CashFlowItem } from '../../context/AppContext';

interface Props {
  customCategories: string[];
  setCustomCategories: (cats: string[] | ((prev: string[]) => string[])) => void;
  setExpenseItems: (fn: (prev: CashFlowItem[]) => CashFlowItem[]) => void;
}

export function CategoryManager({ customCategories, setCustomCategories, setExpenseItems }: Props) {
  const [newCat, setNewCat] = useState('');
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleAdd = () => {
    const trimmed = newCat.trim();
    if (!trimmed || customCategories.includes(trimmed)) return;
    setCustomCategories(prev => [...prev, trimmed]);
    setNewCat('');
  };

  const handleDelete = (cat: string) => {
    setCustomCategories(prev => prev.filter(c => c !== cat));
    setExpenseItems(prev => prev.map(item =>
      item.customCategory === cat ? { ...item, customCategory: undefined } : item
    ));
  };

  const handleRename = (oldName: string) => {
    const trimmed = editValue.trim();
    if (!trimmed || (trimmed !== oldName && customCategories.includes(trimmed))) return;
    setCustomCategories(prev => prev.map(c => c === oldName ? trimmed : c));
    setExpenseItems(prev => prev.map(item =>
      item.customCategory === oldName ? { ...item, customCategory: trimmed } : item
    ));
    setEditingCat(null);
  };

  return (
    <div className="mb-6">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">類別管理</p>
      <div className="flex flex-wrap gap-2 items-center">
        {customCategories.map((cat, i) =>
          editingCat === cat ? (
            <div key={cat} className="flex items-center gap-1">
              <input
                autoFocus
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRename(cat);
                  if (e.key === 'Escape') setEditingCat(null);
                }}
                className="text-xs border border-indigo-300 rounded px-2 py-0.5 w-20 outline-none"
              />
              <button onClick={() => handleRename(cat)} className="text-indigo-600 hover:text-indigo-800">
                <Check className="w-3 h-3" />
              </button>
              <button onClick={() => setEditingCat(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div
              key={cat}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}20`,
                color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
              }}
            >
              <span className="cursor-pointer" onDoubleClick={() => { setEditingCat(cat); setEditValue(cat); }}>
                {cat}
              </span>
              <button onClick={() => { setEditingCat(cat); setEditValue(cat); }} className="opacity-50 hover:opacity-100 ml-0.5">
                <Pencil className="w-2.5 h-2.5" />
              </button>
              <button onClick={() => handleDelete(cat)} className="opacity-50 hover:opacity-100">
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )
        )}
        <div className="flex items-center gap-1">
          <input
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="新增類別"
            className="text-xs border border-gray-200 rounded px-2 py-0.5 w-20 outline-none focus:border-indigo-300"
          />
          <button onClick={handleAdd} className="text-indigo-600 hover:text-indigo-800">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
