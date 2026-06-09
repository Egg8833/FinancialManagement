"use client";
import { useState } from 'react';
import { Check, X, ShieldCheck } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

export function QuotaBar({ limit, setLimit, totalBorrow }: {
  limit: number;
  setLimit: (v: number) => void;
  totalBorrow: number;
}) {
  const { showValues } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [input, setInput] = useState((limit / 10000).toString());
  const available = limit - totalBorrow;
  const availableWan = (Math.abs(available) / 10000).toLocaleString('zh-TW', { maximumFractionDigits: 1 });
  const limitWan = (limit / 10000).toLocaleString('zh-TW', { maximumFractionDigits: 1 });

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2 text-indigo-600">
        <ShieldCheck className="w-4 h-4" />
        <span className="text-sm font-medium">剩餘可借款額度</span>
        {limit > 0 && (
          <span className={`text-lg font-bold ${available < 0 ? 'text-rose-600' : 'text-indigo-700'}`}>
            {showValues ? `${available < 0 ? '−' : ''}${availableWan} 萬` : '****'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm text-indigo-500">
        <span>總額度：</span>
        {isEditing ? (
          <>
            <input
              type="number"
              value={input}
              onChange={e => setInput(e.target.value)}
              className="w-20 border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white outline-none"
              autoFocus
              placeholder="萬"
            />
            <span className="text-xs text-indigo-400">萬</span>
            <button onClick={() => { setLimit((Number(input) || 0) * 10000); setIsEditing(false); }} className="text-indigo-600">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => setIsEditing(false)} className="text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            onClick={() => { setInput((limit / 10000).toString()); setIsEditing(true); }}
            className="font-bold text-indigo-700 hover:underline"
          >
            {limit > 0 ? `${limitWan} 萬` : '點擊設定'}
          </button>
        )}
      </div>
    </div>
  );
}
