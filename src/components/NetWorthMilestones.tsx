'use client';

import { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const MILESTONES = [
  { amount: 1_000_000,   label: '百萬', emoji: '🥉' },
  { amount: 3_000_000,   label: '三百萬', emoji: '🥈' },
  { amount: 5_000_000,   label: '五百萬', emoji: '🥇' },
  { amount: 10_000_000,  label: '千萬', emoji: '💎' },
  { amount: 20_000_000,  label: '兩千萬', emoji: '🚀' },
  { amount: 50_000_000,  label: '五千萬', emoji: '👑' },
];

function etaLabel(months: number): string {
  if (months < 1) return '即將達成';
  if (months < 12) return `約 ${Math.round(months)} 個月`;
  const years = Math.floor(months / 12);
  const rem = Math.round(months % 12);
  return rem > 0 ? `約 ${years} 年 ${rem} 月` : `約 ${years} 年`;
}

export function NetWorthMilestones() {
  const { netWorth, monthlyNetCashFlow, showValues } = useAppContext();

  const milestones = useMemo(() =>
    MILESTONES.map(m => {
      const achieved = netWorth >= m.amount;
      const progress = Math.min(100, netWorth > 0 ? (netWorth / m.amount) * 100 : 0);
      let eta: string | null = null;
      if (!achieved && monthlyNetCashFlow > 0) {
        const months = (m.amount - netWorth) / monthlyNetCashFlow;
        if (months < 600) eta = etaLabel(months);
      }
      return { ...m, achieved, progress, eta };
    }),
  [netWorth, monthlyNetCashFlow]);

  const achievedCount = milestones.filter(m => m.achieved).length;
  const nextMilestone = milestones.find(m => !m.achieved);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-gray-900">淨資產里程碑</h3>
        </div>
        <div className="flex items-center gap-2">
          {achievedCount > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-bold">
              已達成 {achievedCount} / {MILESTONES.length}
            </span>
          )}
          {nextMilestone && (
            <span className="text-xs text-gray-400">
              下一目標：{nextMilestone.label}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        {milestones.map(m => {
          if (m.achieved) {
            return (
              <div
                key={m.amount}
                className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-100"
              >
                <span className="text-xl w-8 text-center">{m.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-amber-800">{m.label}</span>
                    <span className="text-xs bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded font-bold">✓ 已達成</span>
                  </div>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {showValues ? `NT$${(m.amount / 10000).toFixed(0)}萬` : '****'}
                  </p>
                </div>
                <div className="w-16 text-right">
                  <div className="h-1.5 bg-amber-200 rounded-full overflow-hidden">
                    <div className="h-full w-full bg-amber-400 rounded-full" />
                  </div>
                  <p className="text-[10px] text-amber-600 mt-0.5">100%</p>
                </div>
              </div>
            );
          }

          const isNext = m === nextMilestone;

          return (
            <div
              key={m.amount}
              className={`flex items-center gap-3 p-3.5 rounded-xl border ${
                isNext ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100 bg-gray-50'
              }`}
            >
              <span className={`text-xl w-8 text-center ${isNext ? '' : 'opacity-30'}`}>{m.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${isNext ? 'text-indigo-800' : 'text-gray-500'}`}>
                      {m.label}
                    </span>
                    {isNext && (
                      <span className="text-[10px] bg-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded font-bold">
                        下一個
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-bold ${isNext ? 'text-indigo-600' : 'text-gray-400'}`}>
                    {m.progress.toFixed(1)}%
                  </span>
                </div>
                <div className={`h-1.5 rounded-full overflow-hidden ${isNext ? 'bg-indigo-100' : 'bg-gray-200'}`}>
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isNext
                        ? 'bg-gradient-to-r from-indigo-400 to-indigo-600'
                        : 'bg-gray-300'
                    }`}
                    style={{ width: `${m.progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-gray-400">
                    {showValues 
                      ? `${(netWorth / 10000).toFixed(0)}萬 → ${(m.amount / 10000).toFixed(0)}萬` 
                      : '**** → ****'}
                  </span>
                  {m.eta && (
                    <span className={`text-[10px] font-bold ${isNext ? 'text-indigo-500' : 'text-gray-400'}`}>
                      {m.eta}
                    </span>
                  )}
                  {!m.eta && monthlyNetCashFlow <= 0 && (
                    <span className="text-[10px] text-gray-400">需正現金流才能估算</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-400 mt-4 text-center">
        ETA 依目前月淨現金流 {showValues ? `NT$${monthlyNetCashFlow.toLocaleString()}` : '****'} 估算，假設報酬率不計入資產增值。
      </p>
    </div>
  );
}
