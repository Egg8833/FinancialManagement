"use client";
import { useState, memo } from 'react';
import { Trash2, Check, X, Pencil } from 'lucide-react';
import { useAppContext, type StakingItem, type StakingType } from '../../context/AppContext';

export const StakingRow = memo(function StakingRow({ item, type, onUpdate, onDelete }: {
  item: StakingItem; type: StakingType;
  onUpdate: (d: Partial<StakingItem>) => void; onDelete: () => void;
}) {
  const { showValues } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [eName, setEName] = useState(item.name);
  const [eProtocol, setEProtocol] = useState(item.protocol);
  const [eAmount, setEAmount] = useState(item.amount.toString());
  const [eValue, setEValue] = useState(item.value.toString());
  const [eApy, setEApy] = useState(item.apy.toString());
  const [eBorrowDate, setEBorrowDate] = useState(item.borrowDate || '');
  const [eRepayDate, setERepayDate] = useState(item.repayDate || '');

  const isBorrow = type === 'borrow';
  const monthly = Math.round(item.value * item.apy / 100 / 12);

  const handleSave = () => {
    onUpdate({ name: eName, protocol: eProtocol, amount: Number(eAmount) || 0, value: Number(eValue) || 0, apy: Number(eApy) || 0, borrowDate: eBorrowDate, repayDate: eRepayDate });
    setIsEditing(false);
  };

  if (isEditing) return (
    <div className="p-5 bg-gray-50 border-b border-gray-100">
      <div className="flex justify-between mb-3">
        <span className="text-sm font-bold text-gray-700">編輯</span>
        <button onClick={onDelete} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="col-span-2 lg:col-span-1"><label className="block text-xs text-gray-500 mb-1">名稱</label><input type="text" value={eName} onChange={e => setEName(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">平台</label><input type="text" value={eProtocol} onChange={e => setEProtocol(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">數量</label><input type="number" value={eAmount} onChange={e => setEAmount(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">{isBorrow ? '借款金額' : '存入金額'}</label><input type="number" value={eValue} onChange={e => setEValue(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">{isBorrow ? '借款利率' : '收益率'} (%)</label><input type="number" value={eApy} onChange={e => setEApy(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">{isBorrow ? '借款日' : '開始日'}</label><input type="date" value={eBorrowDate} onChange={e => setEBorrowDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        {isBorrow && <div><label className="block text-xs text-gray-500 mb-1">償還日</label><input type="date" value={eRepayDate} onChange={e => setERepayDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>}
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 flex items-center gap-1"><Check className="w-4 h-4" /> 儲存</button>
        <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm flex items-center gap-1"><X className="w-4 h-4" /> 取消</button>
      </div>
    </div>
  );

  return (
    <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
      <div className="flex items-start gap-3 mb-3 xl:mb-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${isBorrow ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
          {item.name.charAt(0)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">{item.name}</span>
            <span className="text-xs text-gray-400">via {item.protocol}</span>
          </div>
          {(item.borrowDate || item.repayDate) && (
            <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
              {item.borrowDate && <span>{isBorrow ? '借款' : '開始'}: {item.borrowDate}</span>}
              {item.repayDate && <span>償還: {item.repayDate}</span>}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0 shrink-0">
        <div className="w-16 px-2"><p className="text-xs text-gray-500">數量</p><p className="font-medium tabular-nums">{item.amount.toLocaleString()}</p></div>
        <div className="w-28 px-2"><p className="text-xs text-gray-500">{isBorrow ? '借款金額' : '存入金額'}</p><p className="font-medium tabular-nums">{showValues ? `${(item.value / 10000).toLocaleString('zh-TW', { maximumFractionDigits: 1 })} 萬` : '****'}</p></div>
        <div className="w-20 px-2"><p className="text-xs text-gray-500">{isBorrow ? '借款利率' : '收益率'}</p><p className={`font-bold ${isBorrow ? 'text-rose-600' : 'text-emerald-600'}`}>{item.apy}%</p></div>
        <div className="w-24 px-2"><p className="text-xs text-gray-500">{isBorrow ? '月利息支出' : '月收益'}</p><p className={`font-bold tabular-nums ${isBorrow ? 'text-rose-600' : 'text-emerald-600'}`}>{showValues ? monthly.toLocaleString('en-US') : '****'}</p></div>
        <div className="px-2">
          <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 border border-indigo-200 text-indigo-600 rounded-lg text-sm hover:bg-indigo-50 flex items-center gap-1">
            <Pencil className="w-3.5 h-3.5" /> 管理
          </button>
        </div>
      </div>
    </div>
  );
});
