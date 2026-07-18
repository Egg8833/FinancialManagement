"use client";

import { useEffect, useState } from 'react';
import { CloudUpload } from 'lucide-react';
import { useRepositories, LOCAL_KEYS, initialAssets } from '../context/RepositoryContext';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import type { AssetCategory, LiabilityItem, AssetSnapshot } from '../types';

function readLocal<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch { return []; }
}

/** 本地是否有「非示範預設」的實際資料 */
function hasMeaningfulLocalData(): boolean {
  const assets = readLocal<AssetCategory>(LOCAL_KEYS.assets);
  const liabilities = readLocal<LiabilityItem>(LOCAL_KEYS.liabilities);
  const snapshots = readLocal<AssetSnapshot>(LOCAL_KEYS.snapshots);
  const isDefaultAssets = JSON.stringify(assets) === JSON.stringify(initialAssets);
  return (!isDefaultAssets && assets.length > 0) || liabilities.length > 0 || snapshots.length > 0;
}

export function ImportPromptModal() {
  const { mode } = useRepositories();
  const { replaceAssets, replaceLiabilities, replaceSnapshots } = useAppContext();
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [importing, setImporting] = useState(false);
  const [checkedFor, setCheckedFor] = useState<'guest' | 'cloud'>('guest');

  useEffect(() => {
    if (mode !== 'cloud' || checkedFor === 'cloud') return;
    setCheckedFor('cloud');
    (async () => {
      try {
        const res = await fetch('/api/user/summary');
        if (!res.ok) return;
        const summary = await res.json() as { assets: boolean; liabilities: boolean; snapshots: boolean };
        const cloudEmpty = !summary.assets && !summary.liabilities && !summary.snapshots;
        if (cloudEmpty && hasMeaningfulLocalData()) setShow(true);
      } catch { /* 靜默:下次登入再問 */ }
    })();
  }, [mode, checkedFor]);

  if (!show) return null;

  const handleImport = async () => {
    setImporting(true);
    try {
      await replaceAssets(readLocal<AssetCategory>(LOCAL_KEYS.assets));
      await replaceLiabilities(readLocal<LiabilityItem>(LOCAL_KEYS.liabilities));
      await replaceSnapshots(readLocal<AssetSnapshot>(LOCAL_KEYS.snapshots));
      toast('本地資料已匯入帳號');
      setShow(false);
    } catch {
      toast('匯入失敗，請稍後再試', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
            <CloudUpload className="text-indigo-500" size={20} />
          </div>
          <h2 className="text-lg font-bold text-gray-900">匯入本地資料?</h2>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          偵測到這台電腦有既有的資產/負債資料,而你的帳號目前是空的。要把本地資料匯入帳號、開始雲端同步嗎?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setShow(false)}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            disabled={importing}
          >
            從空帳號開始
          </button>
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
          >
            {importing ? '匯入中…' : '匯入資料'}
          </button>
        </div>
      </div>
    </div>
  );
}
