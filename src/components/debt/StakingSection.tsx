"use client";
import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { type StakingItem, type StakingType } from '../../context/AppContext';
import { SectionHeader } from './SectionHeader';
import { StakingRow } from './StakingRow';

export function StakingSection({ title, accentColor, type, items, onAdd, onUpdate, onDelete, extra }: {
  title: string; accentColor: string; type: StakingType;
  items: StakingItem[];
  onAdd: (item: Omit<StakingItem, 'id'>) => void;
  onUpdate: (id: string, data: Partial<StakingItem>) => void;
  onDelete: (id: string, name: string) => void;
  extra?: React.ReactNode;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState('');
  const [amount, setAmount] = useState('');
  const [value, setValue] = useState('');
  const [apy, setApy] = useState('');
  const [borrowDate, setBorrowDate] = useState('');
  const [repayDate, setRepayDate] = useState('');

  const isBorrow = type === 'borrow';
  const btnColor = isBorrow ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100';
  const confirmColor = isBorrow ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700';

  const handleAdd = () => {
    if (!name.trim() || !value) return;
    onAdd({ name, protocol: protocol || 'Custom', amount: Number(amount) || 0, value: Number(value) || 0, apy: Number(apy) || 0, stakingType: type, borrowDate, repayDate });
    setName(''); setProtocol(''); setAmount(''); setValue(''); setApy(''); setBorrowDate(''); setRepayDate('');
    setIsAdding(false);
  };

  return (
    <div>
      <SectionHeader title={title} color={accentColor}>
        <button onClick={() => setIsAdding(v => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${btnColor}`}>
          <Plus className="w-3.5 h-3.5" /> 新增
        </button>
      </SectionHeader>

      {extra && <div className="mb-4">{extra}</div>}

      {isAdding && (
        <div className={`mb-4 rounded-2xl border p-5 ${isBorrow ? 'bg-indigo-50/50 border-indigo-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="col-span-2 lg:col-span-1"><label className="block text-xs text-gray-500 mb-1">名稱</label><input autoFocus type="text" value={name} onChange={e => setName(e.target.value)} placeholder="名稱" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">平台</label><input type="text" value={protocol} onChange={e => setProtocol(e.target.value)} placeholder="Lido" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">數量</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="數量" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">{isBorrow ? '借款金額' : '存入金額'}</label><input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="TWD" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">{isBorrow ? '借款利率' : '年化收益率'} (%)</label><input type="number" value={apy} onChange={e => setApy(e.target.value)} placeholder="APY" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">{isBorrow ? '借款日' : '開始日'}</label><input type="date" value={borrowDate} onChange={e => setBorrowDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm text-gray-600" /></div>
            {isBorrow && <div><label className="block text-xs text-gray-500 mb-1">最後償還日</label><input type="date" value={repayDate} onChange={e => setRepayDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm text-gray-600" /></div>}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleAdd} className={`px-4 py-2 text-white rounded-lg text-sm flex items-center gap-1 ${confirmColor}`}><Check className="w-4 h-4" /> 確認新增</button>
            <button onClick={() => setIsAdding(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm">取消</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {items.map(item => (
          <StakingRow key={item.id} item={item} type={type} onUpdate={data => onUpdate(item.id, data)} onDelete={() => onDelete(item.id, item.name)} />
        ))}
        {items.length === 0 && !isAdding && (
          <div className="py-8 text-center text-gray-400 text-sm">尚無項目</div>
        )}
      </div>
    </div>
  );
}
