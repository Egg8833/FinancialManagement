"use client";

import { useState } from 'react';
import { Building2, CreditCard, Pencil, Trash2, Plus } from 'lucide-react';
import type { LiabilityItem } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from '../context/ToastContext';

interface EditableLiabilityRowProps {
  item: LiabilityItem;
  showValues: boolean;
  onUpdate: (name: string, amount: number) => void;
  onDelete: () => void;
}

export function EditableLiabilityRow({ item, showValues, onUpdate, onDelete }: EditableLiabilityRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editAmount, setEditAmount] = useState(item.amount.toString());
  const { toast } = useToast();

  const handleSave = () => {
    onUpdate(editName, Number(editAmount) || 0);
    setIsEditing(false);
    toast('已更新負債項目');
  };

  const handleDelete = () => {
    onDelete();
    toast(`已刪除「${item.name}」`, 'info');
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 p-4 rounded-xl border border-indigo-200 bg-indigo-50">
        <div>
          <label className="block text-xs text-gray-500 mb-1">負債名稱</label>
          <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none focus:border-indigo-500" placeholder="負債名稱" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">金額</label>
          <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none focus:border-indigo-500" placeholder="金額" />
        </div>
        <div className="flex justify-end gap-2 mt-1">
          <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded">取消</button>
          <button onClick={handleSave} className="px-3 py-1 text-xs bg-indigo-600 text-white hover:bg-indigo-700 rounded">儲存</button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white hover:border-indigo-200 transition-colors relative">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${item.icon === 'building' ? 'bg-sky-100 text-sky-600' : 'bg-violet-100 text-violet-600'}`}>
          {item.icon === 'building' ? <Building2 className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h5 className="font-bold text-gray-900 text-sm">{item.name}</h5>
            {item.id.startsWith('auto-') && (
              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded uppercase tracking-wider animate-pulse">Live</span>
            )}
          </div>
          <p className="text-xs text-gray-500">{item.description}</p>
        </div>
      </div>
      <div className="text-right">
        <div className="font-bold text-gray-900">{showValues ? item.amount.toLocaleString('en-US') : '****'}</div>
      </div>
      
      {!item.id.startsWith('auto-') && (
        <div className="absolute right-2 -top-3 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity bg-white shadow-sm border border-gray-100 rounded-lg p-1">
          <button onClick={() => setIsEditing(true)} className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => setConfirmDelete(true)} className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      )}
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

interface AddLiabilityRowProps {
  onAdd: (name: string, amount: number) => void;
}

export function AddLiabilityRow({ onAdd }: AddLiabilityRowProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const handleAdd = () => {
    if (!name.trim() || !amount) return;
    onAdd(name, Number(amount));
    setName('');
    setAmount('');
    setIsAdding(false);
  };

  if (!isAdding) {
    return (
      <button 
        onClick={() => setIsAdding(true)}
        className="w-full mt-2 py-3 flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-dashed border-indigo-200"
      >
        <Plus className="w-4 h-4" /> 新增負債項目
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl border border-indigo-200 bg-indigo-50">
      <div>
        <label className="block text-xs text-gray-500 mb-1">負債名稱</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none focus:border-indigo-500" placeholder="負債名稱 (如: 車貸)" autoFocus />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">金額</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none focus:border-indigo-500" placeholder="金額" />
      </div>
      <div className="flex justify-end gap-2 mt-1">
        <button onClick={() => setIsAdding(false)} className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded">取消</button>
        <button onClick={handleAdd} className="px-3 py-1 text-xs bg-indigo-600 text-white hover:bg-indigo-700 rounded">新增</button>
      </div>
    </div>
  );
}

interface LiabilitiesCardProps {
  liabilities: LiabilityItem[];
  totalLiabilities: number;
  showValues: boolean;
  formatCurrency: (amount: number) => string;
  onUpdateLiability: (itemId: string, name: string, amount: number) => void;
  onDeleteLiability: (itemId: string) => void;
  onAddLiability: (name: string, amount: number) => void;
}

export function LiabilitiesCard({
  liabilities,
  totalLiabilities,
  showValues,
  formatCurrency,
  onUpdateLiability,
  onDeleteLiability,
  onAddLiability
}: LiabilitiesCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100 overflow-hidden">
      <div className="bg-slate-50 p-6 border-b border-gray-100">
        <p className="text-sm text-gray-500 mb-1">目前負債總額</p>
        <h4 className="text-3xl font-bold text-gray-900">{formatCurrency(totalLiabilities)}</h4>
      </div>
      
      <div className="p-4 space-y-3">
        {liabilities.map((item) => (
          <EditableLiabilityRow 
            key={item.id} 
            item={item} 
            showValues={showValues}
            onUpdate={(name, amount) => onUpdateLiability(item.id, name, amount)}
            onDelete={() => onDeleteLiability(item.id)}
          />
        ))}
        
        <AddLiabilityRow onAdd={onAddLiability} />
      </div>
    </div>
  );
}
