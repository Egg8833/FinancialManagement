'use client'

import Link from 'next/link'
import { Heart, Wallet, Flame, TrendingUp, TrendingDown } from 'lucide-react'
import { useAppContext } from '../context/AppContext'

export default function DashboardSummaryRow() {
  const {
    snapshots,
    netWorth,
    totalMonthlyIncome,
    totalMonthlyExpense,
    monthlyNetCashFlow,
    fireSettings,
    showValues,
  } = useAppContext()

  // Health score — taken from the most recent snapshot that has it
  const snapsWithScore = (snapshots ?? []).filter(s => s.healthScore != null)
  const latestScore = snapsWithScore.length > 0
    ? snapsWithScore[snapsWithScore.length - 1].healthScore!
    : null
  const prevScore = snapsWithScore.length >= 2
    ? snapsWithScore[snapsWithScore.length - 2].healthScore!
    : null
  const scoreDiff = latestScore != null && prevScore != null ? latestScore - prevScore : 0

  const healthGrade =
    latestScore == null ? '—'
    : latestScore >= 80 ? '優秀'
    : latestScore >= 60 ? '良好'
    : latestScore >= 40 ? '普通'
    : '危險'

  // Monthly cashflow — already computed in context
  const savingsRate =
    totalMonthlyIncome > 0
      ? Math.round((monthlyNetCashFlow / totalMonthlyIncome) * 100)
      : 0

  // FIRE progress — compute fireNumber from retirementMonthlyExpense and swr
  const retirementExpense =
    fireSettings?.retirementMonthlyExpense ?? totalMonthlyExpense
  const swr = fireSettings?.swr ?? 4
  const fireNumber = retirementExpense > 0 && swr > 0
    ? (retirementExpense * 12) / (swr / 100)
    : 0

  // Use saved currentNetWorth from fireSettings if set, otherwise live netWorth
  const currentNW = fireSettings?.currentNetWorth ?? netWorth

  const fireProgress =
    fireNumber > 0 ? Math.min(100, Math.round((currentNW / fireNumber) * 100)) : 0
  const fireGap = Math.max(0, fireNumber - currentNW)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6">
      {/* Health Score Card */}
      <Link
        href="/health"
        className="block rounded-xl p-4 bg-green-50 hover:bg-green-100 transition-colors cursor-pointer border border-green-100"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-green-700">
            <Heart className="w-4 h-4" />
            <span className="text-sm font-medium">健康分數</span>
          </div>
          <span className="text-xs text-green-600 opacity-70">查看詳情 →</span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-green-700">
            {latestScore != null ? latestScore : '—'}
          </span>
          <span className="text-sm font-medium text-green-600 mb-1">{healthGrade}</span>
        </div>
        {scoreDiff !== 0 && (
          <div className="flex items-center gap-1 mt-1 text-sm text-green-600">
            {scoreDiff > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>
              {scoreDiff > 0 ? '+' : ''}
              {scoreDiff} 較上次
            </span>
          </div>
        )}
        {latestScore == null && (
          <p className="text-xs text-green-500 mt-1">拍攝快照後顯示分數</p>
        )}
      </Link>

      {/* Monthly Cashflow Card */}
      <Link
        href="/cashflow"
        className="block rounded-xl p-4 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer border border-blue-100"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-blue-700">
            <Wallet className="w-4 h-4" />
            <span className="text-sm font-medium">本月現金流</span>
          </div>
          <span className="text-xs text-blue-600 opacity-70">查看明細 →</span>
        </div>
        <div className="flex items-end gap-1 mb-1">
          <span
            className={`text-2xl font-bold ${
              monthlyNetCashFlow >= 0 ? 'text-blue-700' : 'text-red-600'
            }`}
          >
            {showValues
              ? `${monthlyNetCashFlow >= 0 ? '+' : ''}NT$${monthlyNetCashFlow.toLocaleString()}`
              : '●●●●'}
          </span>
        </div>
        <div className="text-sm text-blue-600 opacity-80">
          {showValues
            ? `收 ${totalMonthlyIncome.toLocaleString()} / 支 ${totalMonthlyExpense.toLocaleString()}`
            : '●●●●'}
        </div>
        <div className="text-sm mt-1">
          儲蓄率{' '}
          <span
            className={`font-medium ${
              savingsRate >= 30
                ? 'text-green-700'
                : savingsRate >= 15
                ? 'text-yellow-700'
                : 'text-red-700'
            }`}
          >
            {savingsRate}%
          </span>
        </div>
      </Link>

      {/* FIRE Progress Card */}
      <Link
        href="/fire"
        className="block rounded-xl p-4 bg-orange-50 hover:bg-orange-100 transition-colors cursor-pointer border border-orange-100"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-orange-700">
            <Flame className="w-4 h-4" />
            <span className="text-sm font-medium">FIRE 進度</span>
          </div>
          <span className="text-xs text-orange-600 opacity-70">查看計畫 →</span>
        </div>
        {fireNumber > 0 ? (
          <>
            <div className="flex items-end gap-1 mb-2">
              <span className="text-3xl font-bold text-orange-700">{fireProgress}%</span>
            </div>
            <div className="w-full bg-orange-200 rounded-full h-2 mb-1">
              <div
                className="bg-orange-500 h-2 rounded-full transition-all"
                style={{ width: `${fireProgress}%` }}
              />
            </div>
            {fireGap > 0 ? (
              <p className="text-sm text-orange-600">
                {showValues
                  ? `距目標 NT$${fireGap.toLocaleString()}`
                  : '●●●●'}
              </p>
            ) : (
              <p className="text-sm font-medium text-green-700">已達 FIRE 目標！</p>
            )}
          </>
        ) : (
          <>
            <div className="flex items-end gap-1 mb-2">
              <span className="text-3xl font-bold text-orange-400">—</span>
            </div>
            <p className="text-sm text-orange-500">請在 FIRE 頁面設定退休月支出</p>
          </>
        )}
      </Link>
    </div>
  )
}
