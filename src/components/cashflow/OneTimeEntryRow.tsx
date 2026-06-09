"use client";
import { useState, memo } from 'react';
import { Trash2 } from 'lucide-react';
import { type AnnualEntry, type AnnualEntryCategory } from '../../context/AppContext';
import { ConfirmDialog } from '../ConfirmDialog';

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
  entry: AnnualEntry;
  onDelete: () => void;
  showValues: boolean;
}

export const OneTimeEntryRow = memo(function OneTimeEntryRow({ entry, onDelete, showValues }: Props) {
  const [confirm, setConfirm] = useState(false);
  const catLabel = [
    ...INCOME_ENTRY_CATS,
    ...EXPENSE_ENTRY_CATS,
  ].find(c => c.key === entry.category)?.label ?? entry.category;

  return (
    <div className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 group transition-colors">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-sm font-medium text-gray-800 truncate">{entry.name}</span>
        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
          {catLabel}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-bold text-sm tabular-nums text-gray-900">
          {showValues ? entry.amount.toLocaleString('en-US') : '****'}
        </span>
        <div className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setConfirm(true)}
            className="p-1.5 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {confirm && (
        <ConfirmDialog
          message={`確定要刪除「${entry.name}」嗎？`}
          onConfirm={onDelete}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
});
