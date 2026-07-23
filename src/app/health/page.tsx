'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Heart, PiggyBank, ShieldCheck, CreditCard, TrendingUp, Wallet, BarChart2, Target, ArrowRight } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useAppContext } from '../../context/AppContext';
import { calculateHealthScore, type HealthScoreResult, type MetricResult } from '../../lib/healthScore';
import { Skeleton } from '../../components/ui/Skeleton';
import type { LucideIcon } from 'lucide-react';

const GRADE_BG: Record<HealthScoreResult['grade'], string> = {
  '優秀': 'from-emerald-400 via-teal-500 to-cyan-600',
  '良好': 'from-blue-500 via-indigo-500 to-violet-600',
  '普通': 'from-amber-400 via-orange-400 to-amber-500',
  '警示': 'from-orange-500 via-rose-500 to-pink-600',
  '危險': 'from-red-600 via-rose-700 to-red-800',
};

const METRIC_ICON: Record<string, LucideIcon> = {
  savings: PiggyBank,
  liquidity: ShieldCheck,
  debt: CreditCard,
  investment: TrendingUp,
  cashflow: Wallet,
  growth: BarChart2,
};

function CircularScore({ score }: { score: number }) {
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);
  return (
    <div className="relative w-40 h-40 md:w-52 md:h-52 shrink-0">
      <svg width="100%" height="100%" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="14" />
        <circle
          cx="80" cy="80" r={r} fill="none"
          stroke="white" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-white leading-none">{score}</span>
        <span className="text-white/60 text-xs mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

const METRIC_ACCENT: Record<string, { iconBg: string; iconText: string; bar: string; stripe: string }> = {
  savings:    { iconBg: 'bg-emerald-50', iconText: 'text-emerald-600', bar: 'bg-emerald-500', stripe: 'bg-emerald-400' },
  liquidity:  { iconBg: 'bg-sky-50',     iconText: 'text-sky-600',     bar: 'bg-sky-500',     stripe: 'bg-sky-400' },
  debt:       { iconBg: 'bg-rose-50',    iconText: 'text-rose-500',    bar: 'bg-rose-500',    stripe: 'bg-rose-400' },
  investment: { iconBg: 'bg-violet-50',  iconText: 'text-violet-600',  bar: 'bg-violet-500',  stripe: 'bg-violet-400' },
  cashflow:   { iconBg: 'bg-amber-50',   iconText: 'text-amber-600',   bar: 'bg-amber-500',   stripe: 'bg-amber-400' },
  growth:     { iconBg: 'bg-teal-50',    iconText: 'text-teal-600',    bar: 'bg-teal-500',    stripe: 'bg-teal-400' },
};

const DEFAULT_ACCENT = { iconBg: 'bg-gray-50', iconText: 'text-gray-500', bar: 'bg-gray-400', stripe: 'bg-gray-300' };

function MetricCard({ metric }: { metric: MetricResult }) {
  const Icon = METRIC_ICON[metric.key] ?? Heart;
  const accent = METRIC_ACCENT[metric.key] ?? DEFAULT_ACCENT;

  const scoreColor =
    metric.score >= 75 ? 'text-emerald-600' :
    metric.score >= 60 ? 'text-blue-600' :
    metric.score >= 40 ? 'text-amber-600' : 'text-rose-500';

  const displayValue = (() => {
    if (metric.key === 'savings' || metric.key === 'debt' || metric.key === 'investment') {
      return `${(metric.rawValue * 100).toFixed(1)}%`;
    }
    if (metric.key === 'liquidity') return `${metric.rawValue.toFixed(1)} 個月`;
    if (metric.key === 'cashflow') return `${metric.rawValue >= 0 ? '+' : ''}${metric.rawValue.toLocaleString()} / 月`;
    return metric.rawValue > 0 ? `最近 ${metric.rawValue} 筆快照` : '尚無資料';
  })();

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      {/* 頂部色條：各指標固定色 */}
      <div className={`h-1 w-full ${accent.stripe}`} />
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2.5 ${accent.iconBg} rounded-xl ${accent.iconText} shrink-0`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800">{metric.label}</p>
            <p className="text-xs text-gray-400 truncate">{metric.benchmark}</p>
          </div>
          <span className={`text-xl font-black ${scoreColor} shrink-0`}>{metric.score}</span>
        </div>
        <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${accent.bar}`}
            style={{ width: `${metric.score}%` }}
          />
        </div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">當前：{displayValue}</span>
          <span className={`font-semibold ${scoreColor}`}>{metric.score} / 100</span>
        </div>
        {metric.advice && (
          <p className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2 mt-3">{metric.advice}</p>
        )}
      </div>
    </div>
  );
}

type ActionItem = {
  key: string;
  Icon: LucideIcon;
  label: string;
  current: string;
  target: string;
  action: string;
  amount: number;
  isMonthly: boolean;
  scoreGain: number;
  priority: '高' | '中' | '低';
  href: string;
  ctaLabel: string;
};

export default function HealthPage() {
  const {
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
    totalAssets, totalLiabilities, assets, combinedAssets, snapshots, showValues,
    assetsLoading,
  } = useAppContext();

  const liquidAssets = assets.find(c => c.id === 'liquid')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
  const investmentAssets = combinedAssets.find(c => c.id === 'investment')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;

  const result = calculateHealthScore({
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
    totalAssets, totalLiabilities, liquidAssets, investmentAssets, snapshots,
  });

  const actionItems = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = [];

    // Liquidity: score = toScore(months, 1, 6); target 100 = 6 months
    const liquidMonths = totalMonthlyExpense > 0 ? liquidAssets / totalMonthlyExpense : 0;
    if (liquidMonths < 6) {
      const needed = Math.max(0, 6 * totalMonthlyExpense - liquidAssets);
      // score impact: from current to 100 (fully funded)
      const currentScore = Math.max(0, Math.min(100, Math.round(((liquidMonths - 1) / 5) * 100)));
      const scoreGain = Math.round((100 - currentScore) * 0.20); // weight 0.20
      items.push({
        key: 'liquidity', Icon: ShieldCheck, label: '緊急備用金',
        current: `${liquidMonths.toFixed(1)} 個月`,
        target: '6 個月',
        action: '一次性存入流動帳戶',
        amount: needed, isMonthly: false,
        scoreGain,
        priority: liquidMonths < 3 ? '高' : '中',
        href: '/', ctaLabel: '管理資產',
      });
    }

    // Debt: score = toScore(ratio, 0.7, 0.2) — INVERSE; target ≤ 20%
    const debtRatio = totalAssets > 0 ? totalLiabilities / totalAssets : 0;
    if (debtRatio > 0.20) {
      const needed = Math.max(0, totalLiabilities - 0.20 * totalAssets);
      const currentScore = Math.max(0, Math.min(100, Math.round(((0.7 - debtRatio) / (0.7 - 0.2)) * 100)));
      const scoreGain = Math.round((100 - currentScore) * 0.25); // weight 0.25
      items.push({
        key: 'debt', Icon: CreditCard, label: '負債比率',
        current: `${(debtRatio * 100).toFixed(1)}%`,
        target: '≤ 20%',
        action: '還清部分債務',
        amount: needed, isMonthly: false,
        scoreGain,
        priority: debtRatio > 0.5 ? '高' : '中',
        href: '/staking', ctaLabel: '管理負債',
      });
    }

    // Investment: score = toScore(ratio, 0, 0.4); target ≥ 40%
    const investRatio = totalAssets > 0 ? investmentAssets / totalAssets : 0;
    if (investRatio < 0.40) {
      const needed = Math.max(0, 0.40 * totalAssets - investmentAssets);
      const currentScore = Math.max(0, Math.min(100, Math.round((investRatio / 0.4) * 100)));
      const scoreGain = Math.round((100 - currentScore) * 0.15); // weight 0.15
      items.push({
        key: 'investment', Icon: TrendingUp, label: '投資比率',
        current: `${(investRatio * 100).toFixed(1)}%`,
        target: '≥ 40%',
        action: '將閒置現金轉入投資',
        amount: needed, isMonthly: false,
        scoreGain,
        priority: investRatio < 0.15 ? '中' : '低',
        href: '/stocks', ctaLabel: '管理投資',
      });
    }

    // Savings: score = toScore(rate, 0, 0.3); target ≥ 30%
    const savingsRate = totalMonthlyIncome > 0 ? monthlyNetCashFlow / totalMonthlyIncome : 0;
    if (savingsRate < 0.30) {
      const needed = Math.max(0, 0.30 * totalMonthlyIncome - monthlyNetCashFlow);
      const currentScore = Math.max(0, Math.min(100, Math.round((savingsRate / 0.3) * 100)));
      const scoreGain = Math.round((100 - currentScore) * 0.25); // weight 0.25
      items.push({
        key: 'savings', Icon: PiggyBank, label: '儲蓄率',
        current: `${(savingsRate * 100).toFixed(1)}%`,
        target: '≥ 30%',
        action: '每月增加儲蓄 / 減少支出',
        amount: needed, isMonthly: true,
        scoreGain,
        priority: savingsRate < 0 ? '高' : monthlyNetCashFlow < 0.1 * totalMonthlyIncome ? '中' : '低',
        href: '/cashflow', ctaLabel: '管理收支',
      });
    }

    return items.sort((a, b) => {
      const ord = { '高': 0, '中': 1, '低': 2 };
      return ord[a.priority] - ord[b.priority];
    });
  }, [liquidAssets, totalMonthlyExpense, totalLiabilities, totalAssets, investmentAssets, totalMonthlyIncome, monthlyNetCashFlow]);

  const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });

  // 健康分數趨勢資料（近 30 筆快照）
  const scoreTrend = snapshots
    .filter(s => s.healthScore !== undefined)
    .slice(-30)
    .map(s => ({
      date: s.date.slice(5), // MM-DD
      score: s.healthScore!,
    }));

  const hasScoreTrend = scoreTrend.length >= 2;

  // 雲端資料載入中：所有 hooks 已呼叫完畢，這裡才決定渲染 skeleton 而非誤導性的評分結果
  if (assetsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-56 rounded-3xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">財務健康評分</h1>
        <p className="text-sm text-gray-500 mt-1">根據你的財務資料自動計算，更新於 {today}</p>
      </div>

      {/* 頂部評分卡 */}
      <div className={`relative rounded-3xl p-8 mb-8 bg-gradient-to-br ${GRADE_BG[result.grade]} text-white shadow-xl overflow-hidden`}>
        {/* 裝飾背景圓 */}
        <div className="absolute -top-12 -right-12 w-52 h-52 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-16 -left-8 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-6 right-28 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-center gap-8">
          <CircularScore score={result.totalScore} />
          <div className="flex-1 text-center sm:text-left">
            <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">整體財務健康</p>
            <p className="text-5xl font-black mb-2 leading-none">{result.grade}</p>
            <p className="text-white/80 text-sm max-w-xs mb-5">
              {result.totalScore >= 75
                ? '你的財務狀況良好，持續保持良好習慣。'
                : result.totalScore >= 60
                ? '財務狀況尚可，部分指標有改善空間。'
                : '有幾項財務指標需要優先關注，請查看下方建議。'}
            </p>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              {result.metrics.map(m => (
                <span
                  key={m.key}
                  className="bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold text-white/90 border border-white/10"
                >
                  {m.label} · {m.score}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 健康分數趨勢圖 */}
      {hasScoreTrend && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm mb-8">
          <h2 className="text-base font-bold text-gray-900 mb-4">健康分數歷史趨勢</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={scoreTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip
                formatter={(v: unknown) => [`${v} 分`, '健康分數']}
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              {/* 等級參考線 */}
              {[
                { y: 90, label: '優秀', color: '#10b981' },
                { y: 75, label: '良好', color: '#3b82f6' },
                { y: 60, label: '普通', color: '#eab308' },
              ].map(ref => (
                <ReferenceLine
                  key={ref.y} y={ref.y}
                  stroke={ref.color} strokeDasharray="4 2"
                  label={{ value: ref.label, position: 'insideTopRight', fontSize: 9, fill: ref.color }}
                />
              ))}
              <Line
                type="monotone" dataKey="score"
                stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-400 mt-2 text-center">每日自動快照時記錄，顯示最近 {scoreTrend.length} 筆</p>
        </div>
      )}

      {/* 六指標卡片 */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">各項指標詳情</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {result.metrics.map(metric => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
      </div>

      {/* 升級行動計畫 */}
      {actionItems.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm mt-8">
          <div className="flex items-center gap-2 mb-5">
            <Target className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-bold text-gray-900">升級行動計畫</h2>
            <span className="text-sm text-gray-400 hidden sm:inline">— 達到滿分所需的具體步驟</span>
          </div>
          <div className="space-y-3">
            {actionItems.map(item => (
              <div key={item.key} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2 bg-white rounded-lg shadow-sm shrink-0">
                    <item.Icon className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-800">{item.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        item.priority === '高' ? 'bg-red-100 text-red-600' :
                        item.priority === '中' ? 'bg-amber-100 text-amber-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>{item.priority}優先</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5 flex-wrap">
                      <span>{item.current}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="text-indigo-500 font-medium">{item.target}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{item.action}</p>
                    <p className="text-base font-black text-gray-900">
                      {showValues ? <>{item.isMonthly ? '每月 ' : ''}NT${Math.round(item.amount).toLocaleString()}</> : '****'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">總分提升</p>
                    <p className="text-base font-black text-emerald-600">+{item.scoreGain} 分</p>
                  </div>
                  <Link
                    href={item.href}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    {item.ctaLabel} <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            * 分數提升為單項改善後的估算，實際分數以當時全部指標加權計算為準。
          </p>
        </div>
      )}
    </>
  );
}
