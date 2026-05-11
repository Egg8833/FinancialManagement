"use client";

import { AlertTriangle, AlertOctagon, X } from 'lucide-react';
import { useState } from 'react';

interface PledgeAlertBannerProps {
  level: 'warning' | 'danger';
  platformName: string;
  ratio: number;
}

export function PledgeAlertBanner({ level, platformName, ratio }: PledgeAlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const isDanger = level === 'danger';
  const Icon = isDanger ? AlertOctagon : AlertTriangle;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-6 ${
      isDanger
        ? 'bg-red-50 border-red-300 text-red-800'
        : 'bg-yellow-50 border-yellow-300 text-yellow-800'
    }`}>
      <Icon className={`w-5 h-5 shrink-0 ${isDanger ? 'text-red-600' : 'text-yellow-600'}`} />
      <p className="flex-1 text-sm font-medium">
        {isDanger
          ? `⚠️ 緊急：${platformName} 質押維持率 ${ratio.toFixed(1)}% 低於 167%，請立即補充保證金`
          : `⚡ 注意：${platformName} 質押維持率 ${ratio.toFixed(1)}% 低於 200%，建議提高維持率`}
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors"
        aria-label="關閉提示"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
