"use client";

import { useEffect, useState } from 'react';
import { CloudUpload } from 'lucide-react';
import { useRepositories, LOCAL_KEYS, initialAssets, initialLiabilities } from '../context/RepositoryContext';
import { useAppContext } from '../context/AppContext';
import { useAppStateContext } from '../context/AppStateContext';
import { useToast } from '../context/ToastContext';
import type { AssetCategory, LiabilityItem, AssetSnapshot } from '../types';

/**
 * 其餘雲端同步網域（貸款、股票、現金流、目標、FIRE 設定…）對應的 app_state 鍵名與
 * 現有 localStorage key。這裡刻意不做「是否為示範資料」的過濾——不像 assets/liabilities
 * 有明確的預設值可比對，這 19 項形狀各異；直接原樣帶上雲端，最壞情況只是多帶了幾筆
 * 未修改過的示範資料（可自行刪除），比起誤判漏掉真實資料安全得多。
 */
const EXTRA_STATE_KEYS: { key: string; localStorageKey: string }[] = [
  { key: 'loans', localStorageKey: 'app-loans-v5' },
  { key: 'stakingItems', localStorageKey: 'app-staking-v5' },
  { key: 'borrowingLimits', localStorageKey: 'app-borrowing-limits-v1' },
  { key: 'stockItems', localStorageKey: 'app-stocks-v1' },
  { key: 'soldStocks', localStorageKey: 'app-sold-stocks-v1' },
  { key: 'dividendRecords', localStorageKey: 'app-dividends-v1' },
  { key: 'monthlyRecords', localStorageKey: 'app-monthly-records-v1' },
  { key: 'cashflowTemplate', localStorageKey: 'app-cashflow-template-v1' },
  { key: 'annualEntries', localStorageKey: 'app-annual-v1' },
  { key: 'categoryBudgets', localStorageKey: 'assetdash-category-budgets' },
  { key: 'customCategories', localStorageKey: 'app-custom-categories-v1' },
  { key: 'goals', localStorageKey: 'app-goals-v1' },
  { key: 'netWorthGoal', localStorageKey: 'app-net-worth-goal-v1' },
  { key: 'usdToTwd', localStorageKey: 'app-usd-twd-v1' },
  { key: 'reportSchedule', localStorageKey: 'app-report-schedule-v1' },
  { key: 'fireSettings', localStorageKey: 'app-fire-settings-v1' },
  { key: 'lifeEvents', localStorageKey: 'app-life-events-v1' },
  { key: 'enablePledgeTracking', localStorageKey: 'app-enable-pledge-tracking-v1' },
  { key: 'pledgeAlertLastSent', localStorageKey: 'app-pledge-alert-v1' },
];

function readLocal<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch { return []; }
}

interface MeaningfulLocalData {
  assets: AssetCategory[];
  liabilities: LiabilityItem[];
  snapshots: AssetSnapshot[];
  hasAny: boolean;
}

/** 讀取本地資料,並排除「示範預設」的資產/負債;快照僅在資產或負債有實際資料時才視為有意義 */
function readMeaningfulLocalData(): MeaningfulLocalData {
  const rawAssets = readLocal<AssetCategory>(LOCAL_KEYS.assets);
  const rawLiabilities = readLocal<LiabilityItem>(LOCAL_KEYS.liabilities);
  const rawSnapshots = readLocal<AssetSnapshot>(LOCAL_KEYS.snapshots);

  const isDefaultAssets = JSON.stringify(rawAssets) === JSON.stringify(initialAssets);
  const isDefaultLiabilities = JSON.stringify(rawLiabilities) === JSON.stringify(initialLiabilities);

  const meaningfulAssets = (!isDefaultAssets && rawAssets.length > 0) ? rawAssets : [];
  const meaningfulLiabilities = (!isDefaultLiabilities && rawLiabilities.length > 0) ? rawLiabilities : [];
  const hasAny = meaningfulAssets.length > 0 || meaningfulLiabilities.length > 0;

  return {
    assets: meaningfulAssets,
    liabilities: meaningfulLiabilities,
    snapshots: hasAny ? rawSnapshots : [],
    hasAny,
  };
}

/** 本地是否有「非示範預設」的實際資料 */
function hasMeaningfulLocalData(): boolean {
  return readMeaningfulLocalData().hasAny;
}

export function ImportPromptModal() {
  const { mode } = useRepositories();
  const { replaceAssets, replaceLiabilities, replaceSnapshots } = useAppContext();
  const appState = useAppStateContext();
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

  useEffect(() => {
    if (mode === 'guest') setCheckedFor('guest');
  }, [mode]);

  if (!show) return null;

  const handleImport = async () => {
    setImporting(true);
    try {
      const data = readMeaningfulLocalData();
      await replaceAssets(data.assets);
      await replaceLiabilities(data.liabilities);
      await replaceSnapshots(data.snapshots);

      let extraFailures = 0;
      for (const { key, localStorageKey } of EXTRA_STATE_KEYS) {
        const raw = localStorage.getItem(localStorageKey);
        if (raw === null) continue;
        try {
          const ok = await appState.setValue(key, JSON.parse(raw));
          if (!ok) extraFailures++;
        } catch { /* 忽略無法解析的殘留資料 */ }
      }

      toast(extraFailures === 0 ? '本地資料已匯入帳號' : '本地資料已匯入，但部分項目同步失敗，請稍後於各頁面重新儲存', extraFailures === 0 ? 'success' : 'error');
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
