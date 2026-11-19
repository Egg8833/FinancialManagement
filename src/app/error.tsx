'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/** 頁面發生未預期錯誤時的畫面:提供重試,避免整頁白屏。 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[page error]', error);
  }, [error]);

  return (
    <div className="max-w-md mx-auto mt-16 bg-white border border-gray-100 rounded-2xl p-8 shadow-sm text-center">
      <h1 className="text-lg font-bold text-gray-900">頁面發生錯誤</h1>
      <p className="text-sm text-gray-500 mt-2">你的資料沒有遺失。請重試，若問題持續請重新整理頁面。</p>
      <div className="flex justify-center gap-3 mt-6">
        <button
          onClick={reset}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
        >
          重試
        </button>
        <Link href="/" className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
          回到總覽
        </Link>
      </div>
    </div>
  );
}
