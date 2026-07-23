'use client';

import Link from 'next/link';
import { useAppContext } from '../context/AppContext';
import { calculateHealthScore, type HealthScoreResult } from '../lib/healthScore';
import { Skeleton } from './ui/Skeleton';

const GRADE_COLOR: Record<HealthScoreResult['grade'], string> = {
  '優秀': '#10b981',
  '良好': '#3b82f6',
  '普通': '#eab308',
  '警示': '#f97316',
  '危險': '#ef4444',
};

const GRADE_BADGE: Record<HealthScoreResult['grade'], string> = {
  '優秀': 'bg-emerald-100 text-emerald-700',
  '良好': 'bg-blue-100 text-blue-700',
  '普通': 'bg-yellow-100 text-yellow-700',
  '警示': 'bg-orange-100 text-orange-700',
  '危險': 'bg-red-100 text-red-700',
};

function MiniGauge({ score, color }: { score: number; color: string }) {
  const r = 36;
  const circumference = Math.PI * r;
  return (
    <svg width="90" height="52" viewBox="0 0 90 52">
      <path d={`M 9 46 A ${r} ${r} 0 0 1 81 46`} fill="none" stroke="#e2e8f0" strokeWidth="9" strokeLinecap="round" />
      <path
        d={`M 9 46 A ${r} ${r} 0 0 1 81 46`}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - score / 100)}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x="45" y="44" textAnchor="middle" fontSize="18" fontWeight="800" fill="#1e293b">{score}</text>
    </svg>
  );
}

export function HealthScoreCard() {
  const {
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
    totalAssets, totalLiabilities, assets, combinedAssets, snapshots,
    assetsLoading,
  } = useAppContext();

  // 雲端資料載入中：避免用空資料算出誤導性的評分等級與顏色
  if (assetsLoading) {
    return (
      <div className="flex-1 min-w-50 bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
        <Skeleton className="w-22.5 h-13 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </div>
    );
  }

  const liquidAssets = assets.find(c => c.id === 'liquid')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
  const investmentAssets = combinedAssets.find(c => c.id === 'investment')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;

  const result = calculateHealthScore({
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
    totalAssets, totalLiabilities, liquidAssets, investmentAssets, snapshots,
  });

  const color = GRADE_COLOR[result.grade];

  return (
    <div className="flex-1 min-w-50 bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-2">
        <MiniGauge score={result.totalScore} color={color} />
        <div>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">財務健康</p>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold ${GRADE_BADGE[result.grade]}`}>{result.grade}</span>
        </div>
      </div>
      <Link href="/health" className="text-xs text-gray-400 hover:text-indigo-600 transition-colors whitespace-nowrap">
        詳情 →
      </Link>
    </div>
  );
}
