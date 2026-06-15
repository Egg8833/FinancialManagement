"use client";
import { History, RotateCw, Trash2 } from 'lucide-react';
import type { SoldStockItem } from '../../types';
import { useNameLookup } from '../../hooks/useNameLookup';
import { StockAvatar } from './StockAvatar';
import { getMarket } from '../../lib/stockUtils';

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function holdingDuration(purchase?: string, removed?: string) {
  if (!purchase || !removed) return '—';
  const start = new Date(purchase).getTime();
  const end = new Date(removed).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '—';
  const days = Math.floor((end - start) / 86_400_000);
  if (days < 30) return `${days} 天`;
  if (days < 365) return `${Math.floor(days / 30)} 個月`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  return months > 0 ? `${years} 年 ${months} 個月` : `${years} 年`;
}

function SoldRow({ sold, onRestore, onPurge }: {
  sold: SoldStockItem;
  onRestore: (s: SoldStockItem) => void;
  onPurge: (s: SoldStockItem) => void;
}) {
  const name = useNameLookup(sold.symbol);
  // avgCost 為總買入金額；exitPrice 為移除當下每股市價
  const realized = sold.exitPrice != null ? sold.exitPrice * sold.shares - sold.avgCost : null;
  const realizedPct = realized != null && sold.avgCost > 0 ? (realized / sold.avgCost) * 100 : null;

  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <StockAvatar symbol={sold.symbol} market={getMarket(sold.symbol)} displayName={name || sold.symbol} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-gray-900 truncate">
          {sold.symbol}{name ? <span className="text-gray-400 font-normal"> · {name}</span> : ''}
        </p>
        <p className="text-xs text-gray-400">
          {sold.platform || '未分類'} · {sold.shares.toLocaleString()} 股
          {sold.purchaseDate ? ` · 買於 ${fmtDate(sold.purchaseDate)}` : ''}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-400">移除於</p>
        <p className="text-sm font-medium text-gray-700">{fmtDate(sold.removedDate)}</p>
        <p className="text-[11px] text-gray-400">持有 {holdingDuration(sold.purchaseDate, sold.removedDate)}</p>
      </div>
      <div className="text-right w-28">
        <p className="text-xs text-gray-400">估算已實現</p>
        {realized != null ? (
          <p className={`text-sm font-bold ${realized >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {realized >= 0 ? '+' : ''}{Math.round(realized).toLocaleString()}
            {realizedPct != null && (
              <span className="block text-[11px] font-medium">
                {realized >= 0 ? '+' : ''}{realizedPct.toFixed(1)}%
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm text-gray-300">—</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onRestore(sold)}
          title="還原至持倉"
          className="p-1.5 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPurge(sold)}
          title="永久刪除紀錄"
          className="p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function SoldStocksTable({ soldStocks, onRestore, onPurge }: {
  soldStocks: SoldStockItem[];
  onRestore: (s: SoldStockItem) => void;
  onPurge: (s: SoldStockItem) => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
        <History className="w-5 h-5 text-gray-400" />
        <h3 className="font-bold text-gray-900">歷史持有股票</h3>
        <span className="text-xs text-gray-400">已移除 {soldStocks.length} 檔</span>
      </div>
      {soldStocks.length === 0 ? (
        <div className="p-8 text-center text-gray-500 text-sm">
          目前沒有歷史持有紀錄。在「持倉」分頁移除股票後，會出現在這裡。
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {soldStocks.map(sold => (
            <SoldRow key={sold.id} sold={sold} onRestore={onRestore} onPurge={onPurge} />
          ))}
        </div>
      )}
    </div>
  );
}
