"use client";

import { useState, useMemo, useEffect } from 'react';
import { AlertTriangle, AlertOctagon } from 'lucide-react';
import {
  useAppContext,
  type StakingItem, type LoanItem,
} from '../../context/AppContext';
import { PledgeAlertBanner } from '../../components/PledgeAlertBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import dynamic from 'next/dynamic';
import { ChartSkeleton } from '../../components/ui/Skeleton';
import { ErrorBoundary } from '../../components/ErrorBoundary';

const LoanRefinanceCalc = dynamic(
  () => import('../../components/LoanRefinanceCalc').then(m => ({ default: m.LoanRefinanceCalc })),
  { loading: () => <ChartSkeleton />, ssr: false }
);
const LoanPayoffTimeline = dynamic(
  () => import('../../components/LoanPayoffTimeline').then(m => ({ default: m.LoanPayoffTimeline })),
  { loading: () => <ChartSkeleton />, ssr: false }
);
import { isPaymentDue } from '../../lib/loanUtils';
import { LoanSection } from '../../components/debt/LoanSection';
import { BorrowSection } from '../../components/debt/BorrowSection';
import { StakingSection } from '../../components/debt/StakingSection';
import { PaymentDueDialog } from '../../components/debt/PaymentDueDialog';

export default function BorrowingPage() {
  const {
    loans, setLoans, recordLoanPayment,
    stakingItems, setStakingItems,
    borrowingLimits, setBorrowingLimits,
    stockItems, stockQuotes,
    usdToTwd,
    pledgeAlertLastSent, setPledgeAlertLastSent,
    userEmail,
    showValues,
    enablePledgeTracking,
  } = useAppContext();
  const { toast } = useToast();

  const [deleteTarget, setDeleteTarget] = useState<{ label: string; action: () => void } | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const installmentLoans = loans.filter(l => l.loanType === 'installment');
  const revolvingLoans = loans.filter(l => l.loanType === 'revolving');
  const borrowStaking = stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'borrow');
  const earnStaking = stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'earn');

  const dueLoans = useMemo(() =>
    installmentLoans.filter(l => l.principal > 0 && l.remainingPeriods > 0 && isPaymentDue(l.nextPaymentDate)),
    [installmentLoans]
  );

  useEffect(() => {
    if (dueLoans.length > 0) setShowPaymentDialog(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const expiringItems = useMemo(() => {
    const today = new Date();
    return borrowStaking
      .filter(item => !!item.repayDate)
      .map(item => {
        const daysLeft = Math.ceil(
          (new Date(item.repayDate!).getTime() - today.getTime()) / 86400000
        );
        return { ...item, daysLeft };
      })
      .filter(item => item.daysLeft <= 30)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [borrowStaking]);

  const totalLoanPrincipal = loans.reduce((s, l) => s + l.principal, 0);
  const totalLoanMonthly = loans.reduce((s, l) => s + l.monthlyPayment, 0);
  const totalBorrowValue = borrowStaking.reduce((s, i) => s + i.value, 0);
  const totalBorrowInterest = borrowStaking.reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0);
  const totalEarnValue = earnStaking.reduce((s, i) => s + i.value, 0);
  const totalEarnIncome = earnStaking.reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0);

  const borrowByPlatform = useMemo(() => {
    const map: Record<string, StakingItem[]> = {};
    for (const item of borrowStaking) {
      const p = (item.protocol || '未分類').trim();
      if (!map[p]) map[p] = [];
      map[p].push(item);
    }
    return map;
  }, [borrowStaking]);

  const pledgePlatforms = useMemo(() => Object.keys(borrowByPlatform), [borrowByPlatform]);

  const collateralByPlatform = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of stockItems) {
      if (!item.collateralShares) continue;
      const quote = stockQuotes[item.symbol];
      if (!quote) continue;
      const value = quote.price * item.collateralShares;
      const twdValue = quote.currency === 'USD' ? value * usdToTwd : value;
      const p = (item.platform || '未分類').trim();
      map[p] = (map[p] || 0) + twdValue;
    }
    return map;
  }, [stockItems, stockQuotes, usdToTwd]);

  const { minRatio, minPlatform, allPlatformRatios } = useMemo(() => {
    let min = Infinity;
    let minP = '';
    const allRatios: Array<{ platform: string; ratio: number; borrowValue: number; collateralValue: number }> = [];
    for (const platform of pledgePlatforms) {
      const borrow = (borrowByPlatform[platform] || []).reduce((s, i) => s + i.value, 0);
      const collateral = collateralByPlatform[platform] || 0;
      const ratio = borrow > 0 ? (collateral / borrow) * 100 : Infinity;
      allRatios.push({ platform, ratio: ratio === Infinity ? 0 : ratio, borrowValue: borrow, collateralValue: collateral });
      if (borrow > 0 && ratio < min) { min = ratio; minP = platform; }
    }
    return {
      minRatio: min === Infinity ? 0 : min,
      minPlatform: minP,
      allPlatformRatios: allRatios,
    };
  }, [pledgePlatforms, borrowByPlatform, collateralByPlatform]);

  const alertLevel: 'warning' | 'danger' | null =
    minRatio > 0 && minPlatform
      ? minRatio < 167 ? 'danger' : minRatio < 200 ? 'warning' : null
      : null;

  useEffect(() => {
    if (!alertLevel || !userEmail || !minPlatform) return;
    const today = new Date().toISOString().split('T')[0];
    if (pledgeAlertLastSent[alertLevel] === today) return;

    fetch('/api/pledge-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientEmail: userEmail,
        alertLevel,
        platformName: minPlatform,
        ratio: minRatio,
        pledgeData: allPlatformRatios,
      }),
    })
      .then(res => {
        if (res.ok) setPledgeAlertLastSent(prev => ({ ...prev, [alertLevel]: today }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertLevel, minRatio, minPlatform]);

  const handleDeleteLoan = (id: string, name: string) =>
    setDeleteTarget({ label: name, action: () => { setLoans(prev => prev.filter(l => l.id !== id)); toast(`已刪除「${name}」`, 'info'); } });
  const handleUpdateLoan = (id: string, data: Partial<LoanItem>) =>
    setLoans(prev => prev.map(l => l.id === id ? { ...l, ...data } : l));
  const handleAddLoan = (loan: Omit<LoanItem, 'id'>) =>
    setLoans(prev => [...prev, { ...loan, id: Date.now().toString() }]);

  const handleDeleteStaking = (id: string, name: string) =>
    setDeleteTarget({ label: name, action: () => { setStakingItems(prev => prev.filter(i => i.id !== id)); toast(`已刪除「${name}」`, 'info'); } });
  const handleUpdateStaking = (id: string, data: Partial<StakingItem>) =>
    setStakingItems(prev => prev.map(i => i.id === id ? { ...i, ...data } : i));
  const handleAddStaking = (item: Omit<StakingItem, 'id'>) =>
    setStakingItems(prev => [...prev, { ...item, id: Date.now().toString() }]);

  return (
    <>
      {enablePledgeTracking && alertLevel && (
        <PledgeAlertBanner level={alertLevel} platformName={minPlatform} ratio={minRatio} />
      )}
      {expiringItems.map(item => {
        const isDanger = item.daysLeft <= 7;
        return (
          <div
            key={`expiry-${item.id}`}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-3 ${
              isDanger ? 'bg-red-50 border-red-300 text-red-800' : 'bg-yellow-50 border-yellow-300 text-yellow-800'
            }`}
          >
            {isDanger
              ? <AlertOctagon className="w-5 h-5 shrink-0 text-red-600" />
              : <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-600" />}
            <p className="flex-1 text-sm font-medium">
              {isDanger
                ? `⚠️ 緊急：「${item.name}」（${item.protocol}）質押借款將於 ${item.daysLeft} 天後到期（${item.repayDate}），請立即安排還款`
                : `⏰ 注意：「${item.name}」（${item.protocol}）質押借款將於 ${item.daysLeft} 天後到期（${item.repayDate}）`}
            </p>
          </div>
        );
      })}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">負債 &amp; 生息資產</h1>
        <p className="text-sm text-gray-500 mt-1">信貸、質押借款與活儲的統整追蹤</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-7 bg-rose-500 rounded-full" />
            <span className="font-bold text-gray-700">信貸</span>
          </div>
          <p className="text-xs text-gray-500">總負債</p>
          <p className="text-xl font-bold text-rose-600 mb-1">{showValues ? totalLoanPrincipal.toLocaleString('en-US') : '****'}</p>
          <p className="text-xs text-gray-500">每月還款 <span className="font-semibold text-gray-800">{showValues ? totalLoanMonthly.toLocaleString('en-US') : '****'}</span></p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-7 bg-indigo-500 rounded-full" />
            <span className="font-bold text-gray-700">質押借款</span>
          </div>
          <p className="text-xs text-gray-500">借款本金</p>
          <p className="text-xl font-bold text-indigo-700 mb-1">{showValues ? totalBorrowValue.toLocaleString('en-US') : '****'}</p>
          <p className="text-xs text-gray-500">每月利息 <span className="font-semibold text-rose-600">{showValues ? Math.round(totalBorrowInterest).toLocaleString('en-US') : '****'}</span></p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-7 bg-emerald-500 rounded-full" />
            <span className="font-bold text-gray-700">活儲 / Earn</span>
          </div>
          <p className="text-xs text-gray-500">存入資產</p>
          <p className="text-xl font-bold text-emerald-600 mb-1">{showValues ? totalEarnValue.toLocaleString('en-US') : '****'}</p>
          <p className="text-xs text-gray-500">每月收益 <span className="font-semibold text-emerald-600">{showValues ? Math.round(totalEarnIncome).toLocaleString('en-US') : '****'}</span></p>
        </div>
      </div>

      <LoanSection
        installmentLoans={installmentLoans}
        revolvingLoans={revolvingLoans}
        onRecord={recordLoanPayment}
        onDelete={handleDeleteLoan}
        onUpdate={handleUpdateLoan}
        onAdd={handleAddLoan}
      />

      <ErrorBoundary><LoanPayoffTimeline /></ErrorBoundary>
      <ErrorBoundary><LoanRefinanceCalc /></ErrorBoundary>

      <div className="my-8 border-t border-gray-100" />

      <BorrowSection
        pledgePlatforms={pledgePlatforms}
        borrowByPlatform={borrowByPlatform}
        collateralByPlatform={collateralByPlatform}
        borrowingLimits={borrowingLimits}
        setBorrowingLimits={setBorrowingLimits}
        onAdd={handleAddStaking}
        onUpdate={handleUpdateStaking}
        onDelete={handleDeleteStaking}
      />

      <div className="my-8 border-t border-gray-100" />

      <StakingSection
        title="活儲 / Earn"
        accentColor="bg-emerald-500"
        type="earn"
        items={earnStaking}
        onAdd={handleAddStaking}
        onUpdate={handleUpdateStaking}
        onDelete={handleDeleteStaking}
      />

      {deleteTarget && (
        <ConfirmDialog
          message={`確定要刪除「${deleteTarget.label}」嗎？`}
          onConfirm={() => { deleteTarget.action(); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {showPaymentDialog && dueLoans.length > 0 && (
        <PaymentDueDialog
          loans={dueLoans}
          onRecord={id => { recordLoanPayment(id); toast('還款已記錄'); }}
          onClose={() => setShowPaymentDialog(false)}
        />
      )}
    </>
  );
}
