'use client';

import { Heart, PiggyBank, ShieldCheck, CreditCard, TrendingUp, Wallet, BarChart2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { calculateHealthScore, type HealthScoreResult, type MetricResult } from '../../lib/healthScore';
import type { LucideIcon } from 'lucide-react';

const GRADE_COLOR: Record<HealthScoreResult['grade'], string> = {
  '優秀': '#10b981', '良好': '#3b82f6', '普通': '#eab308', '警示': '#f97316', '危險': '#ef4444',
};

const GRADE_BG: Record<HealthScoreResult['grade'], string> = {
  '優秀': 'from-emerald-500 to-emerald-600',
  '良好': 'from-blue-500 to-blue-600',
  '普通': 'from-yellow-400 to-yellow-500',
  '警示': 'from-orange-400 to-orange-500',
  '危險': 'from-red-500 to-red-600',
};

const METRIC_ICON: Record<string, LucideIcon> = {
  savings: PiggyBank,
  liquidity: ShieldCheck,
  debt: CreditCard,
  investment: TrendingUp,
  cashflow: Wallet,
  growth: BarChart2,
};

function LargeGauge({ score, grade }: { score: number; grade: HealthScoreResult['grade'] }) {
  const r = 80;
  const circumference = Math.PI * r;
  const color = GRADE_COLOR[grade];
  return (
    <svg width="200" height="115" viewBox="0 0 200 115">
      <path d={`M 20 100 A ${r} ${r} 0 0 1 180 100`} fill="none" stroke="#e2e8f0" strokeWidth="16" strokeLinecap="round" />
      <path
        d={`M 20 100 A ${r} ${r} 0 0 1 180 100`}
        fill="none"
        stroke={color}
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - score / 100)}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x="100" y="95" textAnchor="middle" fontSize="36" fontWeight="900" fill="#1e293b">{score}</text>
      <text x="100" y="112" textAnchor="middle" fontSize="12" fill="#64748b">/ 100</text>
    </svg>
  );
}

function MetricCard({ metric }: { metric: MetricResult }) {
  const Icon = METRIC_ICON[metric.key] ?? Heart;
  const barColor =
    metric.score >= 75 ? 'bg-emerald-500' :
    metric.score >= 60 ? 'bg-blue-500' :
    metric.score >= 40 ? 'bg-yellow-400' :
    'bg-red-500';

  const displayValue = (() => {
    if (metric.key === 'savings' || metric.key === 'debt' || metric.key === 'investment') {
      return `${(metric.rawValue * 100).toFixed(1)}%`;
    }
    if (metric.key === 'liquidity') return `${metric.rawValue.toFixed(1)} 個月`;
    if (metric.key === 'cashflow') return `${metric.rawValue >= 0 ? '+' : ''}${metric.rawValue.toLocaleString()} / 月`;
    return metric.rawValue > 0 ? `最近 ${metric.rawValue} 筆快照` : '尚無資料';
  })();

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gray-50 rounded-lg text-gray-500">
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-800">{metric.label}</p>
          <p className="text-xs text-gray-400">{metric.benchmark}</p>
        </div>
        <span className="text-lg font-black text-gray-900">{metric.score}</span>
      </div>

      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${metric.score}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-400 mb-2">
        <span>當前：{displayValue}</span>
        <span>{metric.score} / 100 分</span>
      </div>

      {metric.advice && (
        <p className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2 mt-3">{metric.advice}</p>
      )}
    </div>
  );
}

export default function HealthPage() {
  const {
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
    totalAssets, totalLiabilities, assets, combinedAssets, snapshots,
  } = useAppContext();

  const liquidAssets = assets.find(c => c.id === 'liquid')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
  const investmentAssets = combinedAssets.find(c => c.id === 'investment')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;

  const result = calculateHealthScore({
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
    totalAssets, totalLiabilities, liquidAssets, investmentAssets, snapshots,
  });

  const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">財務健康評分</h1>
        <p className="text-sm text-gray-500 mt-1">根據你的財務資料自動計算，更新於 {today}</p>
      </div>

      {/* 頂部評分卡 */}
      <div className={`rounded-3xl p-8 mb-8 bg-gradient-to-br ${GRADE_BG[result.grade]} text-white shadow-lg`}>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <LargeGauge score={result.totalScore} grade={result.grade} />
          <div>
            <p className="text-white/70 text-sm font-bold uppercase tracking-widest mb-1">整體財務健康</p>
            <p className="text-4xl font-black mb-2">{result.grade}</p>
            <p className="text-white/80 text-sm max-w-xs">
              {result.totalScore >= 75
                ? '你的財務狀況良好，持續保持良好習慣。'
                : result.totalScore >= 60
                ? '財務狀況尚可，部分指標有改善空間。'
                : '有幾項財務指標需要優先關注，請查看下方建議。'}
            </p>
          </div>
        </div>
      </div>

      {/* 六指標卡片 */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">各項指標詳情</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {result.metrics.map(metric => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
      </div>
    </>
  );
}
