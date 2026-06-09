"use client";
import { type Market } from '../../lib/stockUtils';

export function MarketSelector({ value, onChange }: { value: Market; onChange: (m: Market) => void }) {
  const options: Market[] = ['台股', '美股', '其他'];
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium w-fit">
      {options.map(m => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`px-3 py-1.5 transition-colors ${value === m ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
