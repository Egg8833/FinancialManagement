"use client";
import { Camera, Trash2, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '../ConfirmDialog';
import { type AssetSnapshot } from '../../context/AppContext';

export function SnapshotTable({
  snapshots,
  showValues,
  takeSnapshot,
  onDelete,
  loading = false,
}: {
  snapshots: AssetSnapshot[];
  showValues: boolean;
  takeSnapshot: () => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}) {
  const [toDelete, setToDelete] = useState<string | null>(null);

  return (
    <div className="mt-6">
      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 select-none list-none">
          <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
          快照紀錄（{loading ? '載入中…' : `${snapshots.length} 筆`}）
          <button
            onClick={e => { e.preventDefault(); takeSnapshot(); }}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Camera className="w-4 h-4" />
            拍快照
          </button>
        </summary>
        <div className="mt-3 rounded-xl border border-gray-100 overflow-hidden">
          {loading ? (
            <p className="p-4 text-sm text-gray-400 text-center">雲端資料載入中…</p>
          ) : snapshots.length === 0 ? (
            <p className="p-4 text-sm text-gray-400 text-center">尚無快照，點擊「拍快照」開始紀錄</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-500 font-medium">日期</th>
                  <th className="px-4 py-2 text-right text-gray-500 font-medium">總資產</th>
                  <th className="px-4 py-2 text-right text-gray-500 font-medium">總負債</th>
                  <th className="px-4 py-2 text-right text-gray-500 font-medium">淨資產</th>
                  <th className="px-4 py-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {[...snapshots].reverse().map(snap => (
                  <tr key={snap.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{snap.date}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-800">
                      {showValues ? `NT$${snap.totalAssets.toLocaleString()}` : '●●●●●'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-rose-600">
                      {showValues ? `NT$${snap.totalLiabilities.toLocaleString()}` : '●●●●●'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-indigo-600">
                      {showValues ? `NT$${snap.netWorth.toLocaleString()}` : '●●●●●'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => setToDelete(snap.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </details>

      {toDelete && (
        <ConfirmDialog
          message={`確定刪除 ${snapshots.find(s => s.id === toDelete)?.date} 的快照？`}
          onConfirm={() => { onDelete(toDelete); setToDelete(null); }}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
