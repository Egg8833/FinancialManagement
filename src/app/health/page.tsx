'use client';

import { useMemo } from 'react';
import { Heart, PiggyBank, ShieldCheck, CreditCard, TrendingUp, Wallet, BarChart2, Target, ArrowRight } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
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
        fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"
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
    metric.score >= 40 ? 'bg-yellow-400' : 'bg-red-500';

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
        <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${metric.score}%` }} />
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

function gradeColor(score: number | undefined): string {
  if (score === undefined) return '#94a3b8';
  if (score >= 90) return '#10b981';
  if (score >= 75) return '#3b82f6';
  if (score >= 60) return '#eab308';
  if (score >= 40) return '#f97316';
  return '#ef4444';
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
};

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
                      {item.isMonthly ? '每月 ' : ''}
                      NT${Math.round(item.amount).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">總分提升</p>
                    <p className="text-base font-black text-emerald-600">+{item.scoreGain} 分</p>
                  </div>
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
