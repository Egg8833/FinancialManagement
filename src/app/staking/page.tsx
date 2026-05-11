"use client";

import { useState, useMemo, useEffect } from 'react';
import {
  Coins, Plus, Check, X, Trash2, Pencil, RefreshCw,
  CreditCard, ShieldCheck, ChevronDown,
} from 'lucide-react';
import {
  useAppContext,
  type StakingItem, type StakingType,
  type LoanItem, type LoanType,
} from '../../context/AppContext';
import { AlertTriangle, AlertOctagon, ShieldCheck as ShieldOk } from 'lucide-react';
import { PledgeAlertBanner } from '../../components/PledgeAlertBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../context/ToastContext';

// ─── helpers ──────────────────────────────────────────────────────────────────

function calcEndDate(nextPaymentDate: string | undefined, remainingPeriods: number): string {
  if (remainingPeriods <= 0) return '已到期';
  const base = nextPaymentDate ? new Date(nextPaymentDate) : new Date();
  base.setMonth(base.getMonth() + remainingPeriods - 1);
  return `${base.getFullYear()}/${base.getMonth() + 1}/${base.getDate()}`;
}

type ScheduleRow = {
  period: number;
  date: string;
  payment: number;
  principal: number;
  interest: number;
  beginningBalance: number;
  endingBalance: number;
  isPaid: boolean
};

function generateSchedule(loan: LoanItem): ScheduleRow[] {
  const paidCount = loan.originalPeriods - loan.remainingPeriods;
  const initP = loan.initialPrincipal ?? loan.principal;
  const rows: ScheduleRow[] = [];
  let currentBalance = initP;

  for (let i = 0; i < loan.originalPeriods; i++) {
    let dateStr = '—';
    if (loan.nextPaymentDate) {
      const d = new Date(loan.nextPaymentDate);
      d.setMonth(d.getMonth() + (i - paidCount));
      dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    }

    const beginningBalance = currentBalance;
    const interest = Math.round(beginningBalance * loan.interestRate / 100 / 12);
    let principal = loan.monthlyPayment - interest;

    // Adjust for last payment or if balance is smaller than principal
    if (beginningBalance < principal || i === loan.originalPeriods - 1) {
      principal = beginningBalance;
    }

    currentBalance = Math.max(0, beginningBalance - principal);

    // 關鍵錨點：強制讓「已繳」的最後一期還款後餘額等於目前輸入的 principal
    // 這樣下一期（本期）的起點就會完全正確
    if (i === paidCount - 1) {
      currentBalance = loan.principal;
    }

    rows.push({
      period: i + 1,
      date: dateStr,
      payment: principal + interest,
      principal,
      interest,
      beginningBalance,
      endingBalance: currentBalance,
      isPaid: i < paidCount
    });

    if (currentBalance <= 0 && i >= paidCount) break;
  }
  return rows;
}

function isPaymentDue(nextPaymentDate: string | undefined): boolean {
  if (!nextPaymentDate) return false;
  return new Date(nextPaymentDate) <= new Date();
}

function SectionHeader({ title, color, children }: { title: string; color: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className={`w-1.5 h-6 rounded-full ${color}`} />
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── 質押借款主區塊（按平台分組）─────────────────────────────────────────────────

function BorrowSection({ pledgePlatforms, borrowByPlatform, collateralByPlatform, borrowingLimits, setBorrowingLimits, onAdd, onUpdate, onDelete }: {
  pledgePlatforms: string[];
  borrowByPlatform: Record<string, StakingItem[]>;
  collateralByPlatform: Record<string, number>;
  borrowingLimits: Record<string, number>;
  setBorrowingLimits: (v: Record<string, number> | ((p: Record<string, number>) => Record<string, number>)) => void;
  onAdd: (item: Omit<StakingItem, 'id'>) => void;
  onUpdate: (id: string, data: Partial<StakingItem>) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState('');
  const [amount, setAmount] = useState('');
  const [value, setValue] = useState('');
  const [apy, setApy] = useState('');
  const [borrowDate, setBorrowDate] = useState('');
  const [repayDate, setRepayDate] = useState('');

  const handleAdd = () => {
    if (!name.trim() || !value) return;
    onAdd({ name, protocol: protocol || '未分類', amount: Number(amount) || 0, value: Number(value) || 0, apy: Number(apy) || 0, stakingType: 'borrow', borrowDate, repayDate });
    setName(''); setProtocol(''); setAmount(''); setValue(''); setApy(''); setBorrowDate(''); setRepayDate('');
    setIsAdding(false);
  };

  return (
    <div>
      <SectionHeader title="質押借款" color="bg-indigo-500">
        <button onClick={() => setIsAdding(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors">
          <Plus className="w-3.5 h-3.5" /> 新增
        </button>
      </SectionHeader>

      {isAdding && (
        <div className="mb-6 rounded-2xl border bg-indigo-50/50 border-indigo-100 p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="col-span-2 lg:col-span-1"><label className="block text-xs text-gray-500 mb-1">名稱</label><input autoFocus type="text" value={name} onChange={e => setName(e.target.value)} placeholder="名稱" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">平台</label><input type="text" value={protocol} onChange={e => setProtocol(e.target.value)} placeholder="元大" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">數量</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="數量" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">借款金額</label><input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="TWD" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">借款利率 (%)</label><input type="number" value={apy} onChange={e => setApy(e.target.value)} placeholder="APY" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">借款日</label><input type="date" value={borrowDate} onChange={e => setBorrowDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm text-gray-600" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">最後償還日</label><input type="date" value={repayDate} onChange={e => setRepayDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm text-gray-600" /></div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleAdd} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-indigo-700"><Check className="w-4 h-4" /> 確認新增</button>
            <button onClick={() => setIsAdding(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm">取消</button>
          </div>
        </div>
      )}

      {pledgePlatforms.length === 0 && !isAdding && (
        <div className="py-8 text-center text-gray-400 text-sm bg-white rounded-2xl border border-dashed border-gray-200">尚無質押借款項目</div>
      )}

      {pledgePlatforms.map(platform => {
        const items = borrowByPlatform[platform];
        const platformBorrow = items.reduce((s, i) => s + i.value, 0);
        const platformCollateral = collateralByPlatform[platform] || 0;
        const platformLimit = borrowingLimits[platform] || 0;
        return (
          <div key={platform} className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full">{platform}</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <QuotaBar
              limit={platformLimit}
              setLimit={v => setBorrowingLimits(prev => ({ ...prev, [platform]: v }))}
              totalBorrow={platformBorrow}
            />
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-3">
              {items.map(item => (
                <StakingRow key={item.id} item={item} type="borrow" onUpdate={data => onUpdate(item.id, data)} onDelete={() => onDelete(item.id, item.name)} />
              ))}
            </div>
            <PledgeRatioCard platformName={platform} totalBorrowValue={platformBorrow} totalCollateralValueTWD={platformCollateral} />
          </div>
        );
      })}
    </div>
  );
}

// ─── 質押維持率卡片 ───────────────────────────────────────────────────────────────

function PledgeRatioCard({ platformName, totalBorrowValue, totalCollateralValueTWD }: { platformName: string; totalBorrowValue: number; totalCollateralValueTWD: number }) {
  const [dropPct, setDropPct] = useState(0);

  if (totalBorrowValue <= 0) return null;

  // ── 真實數值 ──
  const ratio    = (totalCollateralValueTWD / totalBorrowValue) * 100;
  const isRed    = ratio < 130;
  const isYellow = ratio >= 130 && ratio < 166;

  const borderClass = isRed ? 'border-rose-200' : isYellow ? 'border-amber-200' : 'border-emerald-100';
  const textClass   = isRed ? 'text-rose-600'   : isYellow ? 'text-amber-600'   : 'text-emerald-600';
  const badgeBg     = isRed ? 'bg-rose-100'     : isYellow ? 'bg-amber-100'     : 'bg-emerald-100';
  const Icon        = isRed ? AlertOctagon       : isYellow ? AlertTriangle      : ShieldOk;
  const statusText  = isRed ? '危險' : isYellow ? '警戒' : '安全';
  const buffer   = Math.round(totalCollateralValueTWD - totalBorrowValue * 1.30);
  const shortage = Math.round(totalBorrowValue * 1.30 - totalCollateralValueTWD);

  // ── 模擬數值 ──
  const simCollateral = totalCollateralValueTWD * (1 - dropPct / 100);
  const simRatio      = totalBorrowValue > 0 ? (simCollateral / totalBorrowValue) * 100 : 0;
  const simIsRed      = simRatio < 130;
  const simIsYellow   = simRatio >= 130 && simRatio < 166;
  const simBuffer     = Math.round(simCollateral - totalBorrowValue * 1.30);
  const simShortage   = Math.round(totalBorrowValue * 1.30 - simCollateral);
  const simTextClass  = simIsRed ? 'text-rose-600' : simIsYellow ? 'text-amber-600' : 'text-emerald-600';
  const simBadgeBg    = simIsRed ? 'bg-rose-100'   : simIsYellow ? 'bg-amber-100'   : 'bg-emerald-100';
  const SimIcon       = simIsRed ? AlertOctagon     : simIsYellow ? AlertTriangle    : ShieldOk;
  const simStatusText = simIsRed ? '危險' : simIsYellow ? '警戒' : '安全';
  const isSimulating  = dropPct > 0;

  // ── 進度條範圍 100%~200% ──
  const BAR_MIN = 100, BAR_MAX = 200;
  const toBarPct  = (v: number) => Math.min(Math.max((v - BAR_MIN) / (BAR_MAX - BAR_MIN) * 100, 0), 100);
  const barPct    = toBarPct(ratio);
  const simBarPct = toBarPct(simRatio);
  const dangerPct = toBarPct(130);
  const warnPct   = toBarPct(166);

  return (
    <div className={`mt-4 bg-white rounded-2xl border ${isSimulating ? 'border-violet-200' : borderClass} p-5 transition-colors`}>

      {/* ── 第一列：狀態 + 大數字 ── */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${badgeBg} ${textClass}`}>
            <Icon className="w-3.5 h-3.5" />
            {statusText}
          </span>
          <span className="text-sm font-semibold text-gray-700">質押維持率</span>
          {platformName && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{platformName}</span>}
        </div>
        <p className={`text-3xl font-bold tabular-nums ${totalCollateralValueTWD <= 0 ? 'text-gray-300' : textClass}`}>
          {totalCollateralValueTWD <= 0 ? '—' : `${ratio.toFixed(1)}%`}
        </p>
      </div>

      {totalCollateralValueTWD <= 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">
          尚未設定此平台的擔保品股票。請至「股票」頁面，在對應股票的「平台」欄位填入「{platformName}」並設定擔保股數。
        </p>
      )}

      {/* ── 第二列：三個關鍵數據 ── */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] text-gray-400 mb-1">擔保品市值</p>
          <p className="text-sm font-bold text-gray-800 tabular-nums">{Math.round(totalCollateralValueTWD).toLocaleString()}</p>
          <p className="text-[10px] text-gray-400">TWD</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] text-gray-400 mb-1">融資借款</p>
          <p className="text-sm font-bold text-gray-800 tabular-nums">{totalBorrowValue.toLocaleString()}</p>
          <p className="text-[10px] text-gray-400">TWD</p>
        </div>
        <div className={`rounded-xl p-3 ${isRed ? 'bg-rose-50' : 'bg-emerald-50'}`}>
          <div className="flex items-center gap-1 mb-1 group relative">
            <p className="text-[10px] text-gray-400">{isRed ? '追繳缺口' : '安全緩衝'}</p>
            <span className="text-[10px] text-gray-300 cursor-default select-none">ⓘ</span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-800 text-white text-[11px] leading-relaxed rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              {isRed
                ? '擔保品市值低於追繳門檻的差額。需補充此金額的擔保品，才能回到安全線 (維持率 130%)。'
                : '擔保品市值跌超過此金額後，維持率將低於 130% 並觸發追繳。數字越大代表越安全。'}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
            </div>
          </div>
          <p className={`text-sm font-bold tabular-nums ${isRed ? 'text-rose-600' : 'text-emerald-600'}`}>
            {isRed ? '-' : '+'}{(isRed ? shortage : buffer).toLocaleString()}
          </p>
          <p className="text-[10px] text-gray-400">TWD</p>
        </div>
      </div>

      {/* ── 進度條 ── */}
      <div className="mb-5">
        <div className="relative h-4 rounded-full overflow-visible bg-gray-100">
          <div className="absolute inset-0 rounded-full overflow-hidden flex">
            <div className="h-full bg-rose-200"  style={{ width: `${dangerPct}%` }} />
            <div className="h-full bg-amber-100" style={{ width: `${warnPct - dangerPct}%` }} />
            <div className="h-full bg-emerald-100 flex-1" />
          </div>
          {/* 模擬後位置（空心圓 + 虛線連接） */}
          {isSimulating && (
            <>
              {/* 模擬位置線 */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-violet-400 opacity-60"
                style={{ left: `${simBarPct}%` }}
              />
              {/* 模擬指標（空心圓） */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 bg-white transition-all ${simIsRed ? 'border-rose-500' : simIsYellow ? 'border-amber-400' : 'border-emerald-500'}`}
                style={{ left: `${simBarPct}%` }}
              />
            </>
          )}
          {/* 目前維持率指標（實心圓） */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md transition-all ${isRed ? 'bg-rose-500' : isYellow ? 'bg-amber-400' : 'bg-emerald-500'}`}
            style={{ left: `${barPct}%` }}
          />
          <div className="absolute top-0 bottom-0 w-0.5 bg-rose-400" style={{ left: `${dangerPct}%` }} />
          <div className="absolute top-0 bottom-0 w-0.5 bg-amber-400" style={{ left: `${warnPct}%` }} />
        </div>
        <div className="relative h-5 mt-1">
          <span className="absolute -translate-x-1/2 text-[10px] text-rose-500 font-medium" style={{ left: `${dangerPct}%` }}>
            ▲ 130%<br />追繳線
          </span>
          <span className="absolute -translate-x-1/2 text-[10px] text-amber-500 font-medium" style={{ left: `${warnPct}%` }}>
            ▲ 166%<br />警戒線
          </span>
        </div>
      </div>

      {/* ── 模擬跌幅滑桿 ── */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
            <span className="text-base">📉</span> 跌幅模擬
          </span>
          <div className="flex items-center gap-2">
            {isSimulating && (
              <button
                onClick={() => setDropPct(0)}
                className="text-[10px] text-violet-500 hover:text-violet-700 font-medium transition-colors"
              >
                重置
              </button>
            )}
            <span className={`text-sm font-bold tabular-nums min-w-[3rem] text-right ${isSimulating ? 'text-violet-600' : 'text-gray-400'}`}>
              {dropPct === 0 ? '無模擬' : `-${dropPct}%`}
            </span>
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={60}
          step={1}
          value={dropPct}
          onChange={e => setDropPct(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-violet-500 bg-gray-200"
        />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-0.5">
          <span>0%</span>
          <span>-15%</span>
          <span>-30%</span>
          <span>-45%</span>
          <span>-60%</span>
        </div>

        {/* 模擬結果面板 */}
        {isSimulating && (
          <div className={`mt-4 rounded-xl border p-4 ${simIsRed ? 'bg-rose-50 border-rose-200' : simIsYellow ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${simBadgeBg} ${simTextClass}`}>
                  <SimIcon className="w-3 h-3" />
                  {simStatusText}
                </span>
                <span className="text-xs text-gray-500">
                  若持股整體下跌 <span className="font-bold text-violet-600">{dropPct}%</span>
                </span>
              </div>
              <span className={`text-2xl font-bold tabular-nums ${simTextClass}`}>
                {simRatio.toFixed(1)}%
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/70 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-400 mb-0.5">模擬擔保品市值</p>
                <p className={`text-xs font-bold tabular-nums ${simTextClass}`}>{Math.round(simCollateral).toLocaleString()}</p>
                <p className="text-[10px] text-gray-400">
                  TWD <span className="text-rose-500">▼ {Math.round(totalCollateralValueTWD - simCollateral).toLocaleString()}</span>
                </p>
              </div>
              <div className="bg-white/70 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-400 mb-0.5">融資借款</p>
                <p className="text-xs font-bold text-gray-700 tabular-nums">{totalBorrowValue.toLocaleString()}</p>
                <p className="text-[10px] text-gray-400">TWD（不變）</p>
              </div>
              <div className="bg-white/70 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-400 mb-0.5">{simIsRed ? '追繳缺口' : '安全緩衝'}</p>
                <p className={`text-xs font-bold tabular-nums ${simIsRed ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {simIsRed ? '-' : '+'}{(simIsRed ? simShortage : simBuffer).toLocaleString()}
                </p>
                <p className="text-[10px] text-gray-400">TWD</p>
              </div>
            </div>

            {simIsRed && !isRed && (
              <p className="mt-3 text-xs text-rose-600 bg-rose-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                持股下跌 {dropPct}% 後將觸發追繳，需補充擔保品 {simShortage.toLocaleString()} TWD 才能回到安全線。
              </p>
            )}
            {simIsYellow && !isRed && !isYellow && (
              <p className="mt-3 text-xs text-amber-600 bg-amber-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                持股下跌 {dropPct}% 後將進入警戒區間，請留意維持率變化。
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function BorrowingPage() {
  const {
    loans, setLoans, recordLoanPayment, undoLoanPayment,
    stakingItems, setStakingItems,
    borrowingLimits, setBorrowingLimits,
    stockItems, stockQuotes,
    usdToTwd,
    pledgeAlertLastSent, setPledgeAlertLastSent,
    userEmail,
  } = useAppContext();
  const { toast } = useToast();

  const [deleteTarget, setDeleteTarget] = useState<{ label: string; action: () => void } | null>(null);

  const installmentLoans = loans.filter(l => l.loanType === 'installment');
  const revolvingLoans = loans.filter(l => l.loanType === 'revolving');
  const borrowStaking = stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'borrow');
  const earnStaking = stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'earn');

  // KPI
  const totalLoanPrincipal = loans.reduce((s, l) => s + l.principal, 0);
  const totalLoanMonthly = loans.reduce((s, l) => s + l.monthlyPayment, 0);
  const totalBorrowValue = borrowStaking.reduce((s, i) => s + i.value, 0);
  const totalBorrowInterest = borrowStaking.reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0);
  const totalEarnValue = earnStaking.reduce((s, i) => s + i.value, 0);
  const totalEarnIncome = earnStaking.reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0);

  // 按平台分組借款
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

  // 按平台分組擔保品市值
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

  // 告警計算：找出最低維持率的平台
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

  // 每日寄送告警 Email
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

  // Loan handlers — 刪除透過確認對話框
  const handleDeleteLoan = (id: string, name: string) =>
    setDeleteTarget({ label: name, action: () => { setLoans(prev => prev.filter(l => l.id !== id)); toast(`已刪除「${name}」`, 'info'); } });
  const handleUpdateLoan = (id: string, data: Partial<LoanItem>) =>
    setLoans(prev => prev.map(l => l.id === id ? { ...l, ...data } : l));
  const handleAddLoan = (loan: Omit<LoanItem, 'id'>) =>
    setLoans(prev => [...prev, { ...loan, id: Date.now().toString() }]);

  // Staking handlers — 刪除透過確認對話框
  const handleDeleteStaking = (id: string, name: string) =>
    setDeleteTarget({ label: name, action: () => { setStakingItems(prev => prev.filter(i => i.id !== id)); toast(`已刪除「${name}」`, 'info'); } });
  const handleUpdateStaking = (id: string, data: Partial<StakingItem>) =>
    setStakingItems(prev => prev.map(i => i.id === id ? { ...i, ...data } : i));
  const handleAddStaking = (item: Omit<StakingItem, 'id'>) =>
    setStakingItems(prev => [...prev, { ...item, id: Date.now().toString() }]);

  return (
    <>
      {alertLevel && (
        <PledgeAlertBanner
          level={alertLevel}
          platformName={minPlatform}
          ratio={minRatio}
        />
      )}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">借貸管理</h1>
        <p className="text-sm text-gray-500 mt-1">信貸、質押借款與活儲的統整追蹤</p>
      </div>

      {/* ── 3-column Summary ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-7 bg-rose-500 rounded-full" />
            <span className="font-bold text-gray-700">信貸</span>
          </div>
          <p className="text-xs text-gray-500">總負債</p>
          <p className="text-xl font-bold text-rose-600 mb-1">{totalLoanPrincipal.toLocaleString('en-US')}</p>
          <p className="text-xs text-gray-500">每月還款 <span className="font-semibold text-gray-800">{totalLoanMonthly.toLocaleString('en-US')}</span></p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-7 bg-indigo-500 rounded-full" />
            <span className="font-bold text-gray-700">質押借款</span>
          </div>
          <p className="text-xs text-gray-500">借款本金</p>
          <p className="text-xl font-bold text-indigo-700 mb-1">{totalBorrowValue.toLocaleString('en-US')}</p>
          <p className="text-xs text-gray-500">每月利息 <span className="font-semibold text-rose-600">{Math.round(totalBorrowInterest).toLocaleString('en-US')}</span></p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-7 bg-emerald-500 rounded-full" />
            <span className="font-bold text-gray-700">活儲 / Earn</span>
          </div>
          <p className="text-xs text-gray-500">存入資產</p>
          <p className="text-xl font-bold text-emerald-600 mb-1">{totalEarnValue.toLocaleString('en-US')}</p>
          <p className="text-xs text-gray-500">每月收益 <span className="font-semibold text-emerald-600">{Math.round(totalEarnIncome).toLocaleString('en-US')}</span></p>
        </div>
      </div>

      {/* ════════════ 信貸 ════════════ */}
      <LoanSection
        installmentLoans={installmentLoans}
        revolvingLoans={revolvingLoans}
        onRecord={recordLoanPayment}
        onDelete={handleDeleteLoan}
        onUpdate={handleUpdateLoan}
        onAdd={handleAddLoan}
      />

      <div className="my-8 border-t border-gray-100" />

      {/* ════════════ 質押借款（按平台分組）════════════ */}
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

      {/* ════════════ 活儲 ════════════ */}
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
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOAN SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function LoanSection({ installmentLoans, revolvingLoans, onRecord, onDelete, onUpdate, onAdd }: {
  installmentLoans: LoanItem[];
  revolvingLoans: LoanItem[];
  onRecord: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onUpdate: (id: string, data: Partial<LoanItem>) => void;
  onAdd: (loan: Omit<LoanItem, 'id'>) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newLoanType, setNewLoanType] = useState<LoanType>('installment');
  const [name, setName] = useState('');
  const [bank, setBank] = useState('');
  const [principal, setPrincipal] = useState('');
  const [initPrincipal, setInitPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [payment, setPayment] = useState('');
  const [payDay, setPayDay] = useState('');
  const [remainPeriods, setRemainPeriods] = useState('');
  const [totalPeriods, setTotalPeriods] = useState('');
  const [nextPayDate, setNextPayDate] = useState('');

  const resetForm = () => {
    setName(''); setBank(''); setPrincipal(''); setInitPrincipal('');
    setRate(''); setPayment(''); setPayDay(''); setRemainPeriods('');
    setTotalPeriods(''); setNextPayDate(''); setNewLoanType('installment');
  };

  const handleAdd = () => {
    if (!name.trim() || !principal) return;
    const rp = Number(remainPeriods) || 0;
    const op = Number(totalPeriods) || rp;
    onAdd({
      name, bank: bank || '未知銀行',
      principal: Number(principal),
      initialPrincipal: initPrincipal ? Number(initPrincipal) : undefined,
      interestRate: Number(rate) || 0,
      monthlyPayment: Number(payment) || 0,
      paymentDay: Number(payDay) || 0,
      remainingPeriods: rp,
      loanType: newLoanType,
      originalPeriods: op,
      nextPaymentDate: nextPayDate || undefined,
    });
    resetForm();
    setIsAdding(false);
  };

  return (
    <div>
      <SectionHeader title="信貸" color="bg-rose-500">
        <button onClick={() => setIsAdding(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-medium hover:bg-rose-100 transition-colors">
          <Plus className="w-3.5 h-3.5" /> 新增信貸
        </button>
      </SectionHeader>

      {isAdding && (
        <div className="mb-4 bg-rose-50/60 rounded-2xl border border-rose-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-medium text-gray-700">類型：</span>
            <div className="flex rounded-lg overflow-hidden border border-rose-200 text-xs font-medium">
              <button onClick={() => setNewLoanType('installment')} className={`px-3 py-1.5 ${newLoanType === 'installment' ? 'bg-rose-500 text-white' : 'bg-white text-gray-600 hover:bg-rose-50'}`}>分期還款</button>
              <button onClick={() => setNewLoanType('revolving')} className={`px-3 py-1.5 ${newLoanType === 'revolving' ? 'bg-rose-500 text-white' : 'bg-white text-gray-600 hover:bg-rose-50'}`}>循環借款</button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="block text-xs text-gray-500 mb-1">名稱</label><input autoFocus type="text" value={name} onChange={e => setName(e.target.value)} placeholder="信貸A" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">銀行</label><input type="text" value={bank} onChange={e => setBank(e.target.value)} placeholder="樂天" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">初始貸款金額</label><input type="number" value={initPrincipal} onChange={e => setInitPrincipal(e.target.value)} placeholder="1000000" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">目前餘額</label><input type="number" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="800000" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">年利率 (%)</label><input type="number" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="2.08" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">每月{newLoanType === 'installment' ? '還款額' : '利息'}</label><input type="number" value={payment} onChange={e => setPayment(e.target.value)} placeholder="10242" className="w-full border rounded-lg p-2 text-sm" /></div>
            {newLoanType === 'installment' && <>
              <div><label className="block text-xs text-gray-500 mb-1">繳款日（幾號）</label><input type="number" value={payDay} onChange={e => setPayDay(e.target.value)} placeholder="11" min="1" max="31" className="w-full border rounded-lg p-2 text-sm" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">剩餘期數</label><input type="number" value={remainPeriods} onChange={e => setRemainPeriods(e.target.value)} placeholder="68" className="w-full border rounded-lg p-2 text-sm" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">初始總期數</label><input type="number" value={totalPeriods} onChange={e => setTotalPeriods(e.target.value)} placeholder="84" className="w-full border rounded-lg p-2 text-sm" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">下次還款日</label><input type="date" value={nextPayDate} onChange={e => setNextPayDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm text-gray-600" /></div>
            </>}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleAdd} className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700 flex items-center gap-1"><Check className="w-4 h-4" /> 確認新增</button>
            <button onClick={() => { resetForm(); setIsAdding(false); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300">取消</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {installmentLoans.map(l => (
          <InstallmentLoanCard key={l.id} loan={l} onRecord={() => onRecord(l.id)} onDelete={() => onDelete(l.id, `${l.name}（${l.bank}）`)} onUpdate={data => onUpdate(l.id, data)} />
        ))}
        {revolvingLoans.map(l => (
          <RevolvingLoanCard key={l.id} loan={l} onDelete={() => onDelete(l.id, `${l.name}（${l.bank}）`)} onUpdate={data => onUpdate(l.id, data)} />
        ))}
        {loans_empty(installmentLoans, revolvingLoans) && !isAdding && (
          <div className="py-8 text-center text-gray-400 text-sm bg-white rounded-2xl border border-dashed border-gray-200">尚無信貸項目</div>
        )}
      </div>
    </div>
  );
}

function loans_empty(a: LoanItem[], b: LoanItem[]) { return a.length === 0 && b.length === 0; }

// ─── Installment Loan Card ────────────────────────────────────────────────────

function InstallmentLoanCard({ loan, onRecord, onDelete, onUpdate }: {
  loan: LoanItem; onRecord: () => void; onDelete: () => void; onUpdate: (d: Partial<LoanItem>) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [ep, setEp] = useState(loan.principal.toString());
  const [eip, setEip] = useState((loan.initialPrincipal ?? '').toString());
  const [er, setEr] = useState(loan.interestRate.toString());
  const [em, setEm] = useState(loan.monthlyPayment.toString());
  const [ed, setEd] = useState(loan.paymentDay.toString());
  const [ek, setEk] = useState(loan.remainingPeriods.toString());
  const [eop, setEop] = useState(loan.originalPeriods.toString());
  const [enpd, setEnpd] = useState(loan.nextPaymentDate ?? '');

  const interest = Math.round(loan.principal * loan.interestRate / 100 / 12);
  const principalPart = loan.monthlyPayment - interest;
  const afterPay = Math.max(0, loan.principal - principalPart);
  const progress = loan.originalPeriods > 0 ? ((loan.originalPeriods - loan.remainingPeriods) / loan.originalPeriods) * 100 : 0;
  const isPaidOff = loan.principal <= 0 || loan.remainingPeriods <= 0;
  const endDate = calcEndDate(loan.nextPaymentDate, loan.remainingPeriods);
  const isDue = !isPaidOff && isPaymentDue(loan.nextPaymentDate);
  const schedule = isExpanded ? generateSchedule(loan) : [];
  const paidCount = loan.originalPeriods - loan.remainingPeriods;

  const handleSave = () => {
    onUpdate({
      principal: Number(ep) || 0,
      initialPrincipal: eip ? Number(eip) : undefined,
      interestRate: Number(er) || 0,
      monthlyPayment: Number(em) || 0,
      paymentDay: Number(ed) || 0,
      remainingPeriods: Number(ek) || 0,
      originalPeriods: Number(eop) || 0,
      nextPaymentDate: enpd || undefined,
    });
    setIsEditing(false);
  };

  if (isEditing) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex justify-between items-center mb-3">
        <span className="font-bold text-gray-800">{loan.name}（{loan.bank}）</span>
        <button onClick={onDelete} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><label className="block text-xs text-gray-500 mb-1">初始貸款金額</label><input type="number" value={eip} onChange={e => setEip(e.target.value)} className="w-full border rounded-lg p-2 text-sm" placeholder="選填" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">目前餘額</label><input type="number" value={ep} onChange={e => setEp(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">年利率 (%)</label><input type="number" step="0.01" value={er} onChange={e => setEr(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">月還款額</label><input type="number" value={em} onChange={e => setEm(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">繳款日（幾號）</label><input type="number" value={ed} min="1" max="31" onChange={e => setEd(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">剩餘期數</label><input type="number" value={ek} onChange={e => setEk(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">初始總期數</label><input type="number" value={eop} onChange={e => setEop(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">下次還款日</label><input type="date" value={enpd} onChange={e => setEnpd(e.target.value)} className="w-full border rounded-lg p-2 text-sm text-gray-600" /></div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 flex items-center gap-1"><Check className="w-4 h-4" /> 儲存</button>
        <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm flex items-center gap-1"><X className="w-4 h-4" /> 取消</button>
      </div>
    </div>
  );

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isPaidOff ? 'border-emerald-200' : 'border-gray-100'}`}>
      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100">
        <div className="h-1.5 bg-rose-400 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="p-5">
        {/* ── Top row ── */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-9 h-9 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="font-bold text-gray-900">{loan.name}</span>
            <span className="text-xs text-gray-400">{loan.bank}</span>
            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-full">分期</span>
            {isPaidOff
              ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">已清償</span>
              : <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-full">{Math.round(progress)}% 已還</span>
            }
            {isDue && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full animate-pulse">還款日已到</span>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!isPaidOff && (
              confirming ? (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5 text-sm">
                  <span className="text-rose-700 font-medium">負債 −{loan.monthlyPayment.toLocaleString()}</span>
                  <button onClick={() => { onRecord(); setConfirming(false); }} className="text-rose-600 hover:text-rose-800"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setConfirming(false)} className="text-gray-400"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <button onClick={() => setConfirming(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" /> 記錄還款
                </button>
              )
            )}
            <button onClick={() => setIsEditing(true)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => setIsExpanded(v => !v)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── Key metrics (always visible) ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">初始貸款</p>
            <p className="font-bold text-gray-700">{(loan.initialPrincipal ?? loan.principal).toLocaleString('en-US')}</p>
          </div>
          <div className="bg-rose-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">目前餘額</p>
            <p className="font-bold text-rose-600">{loan.principal.toLocaleString('en-US')}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">每月還款</p>
            <p className="font-bold text-gray-700">{loan.monthlyPayment.toLocaleString('en-US')}</p>
          </div>
          <div className="bg-indigo-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">預計到期</p>
            <p className="font-bold text-indigo-600">{endDate}</p>
          </div>
        </div>

        {/* ── Expandable details ── */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
            {/* Detail grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">年利率</span>
                <b className="text-amber-600">{loan.interestRate}%</b>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">繳款日</span>
                <b>每月 {loan.paymentDay} 日</b>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">下次還款</span>
                <b className={isDue ? 'text-amber-600' : 'text-indigo-600'}>{loan.nextPaymentDate || '—'}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">剩餘 / 總期數</span>
                <b>{loan.remainingPeriods}<span className="text-gray-400 font-normal"> / {loan.originalPeriods}</span></b>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">本月利息</span>
                <b className="text-rose-500">{interest.toLocaleString('en-US')}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">還款後餘額</span>
                <b className="text-gray-700">{afterPay.toLocaleString('en-US')}</b>
              </div>
            </div>

            {/* Amortization schedule */}
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">攤還表</span>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {paidCount > 0 && (
                    <button onClick={() => setShowHistory(v => !v)} className="text-indigo-500 hover:text-indigo-700 font-medium">
                      {showHistory ? '隱藏已還' : `顯示已還 ${paidCount} 期`}
                    </button>
                  )}
                  <span>{loan.remainingPeriods} 期待還</span>
                </div>
              </div>
              <div className="overflow-y-auto max-h-64">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white border-b border-gray-100">
                    <tr className="text-gray-400">
                      <th className="px-4 py-2 text-left font-medium">期別</th>
                      <th className="px-4 py-2 text-left font-medium">還款日</th>
                      <th className="px-4 py-2 text-right font-medium">貸款餘額</th>
                      <th className="px-4 py-2 text-right font-medium">每月應付 (本金/利息)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {schedule
                      .filter(row => showHistory || !row.isPaid)
                      .map(row => (
                        <tr key={row.period} className={row.isPaid ? 'opacity-40' : row.period === paidCount + 1 ? 'bg-amber-50' : ''}>
                          <td className="px-4 py-2 font-medium text-gray-700">
                            {String(row.period).padStart(4, '0')}
                            {row.isPaid && <span className="ml-1 text-emerald-500 text-[10px]">✓</span>}
                            {row.period === paidCount + 1 && !row.isPaid && <span className="ml-1 text-amber-500 text-[10px]">← 本期</span>}
                          </td>
                          <td className="px-4 py-2 text-gray-500">{row.date}</td>
                          <td className="px-4 py-2 text-right text-gray-700 font-medium">${row.endingBalance.toLocaleString('en-US')}</td>
                          <td className="px-4 py-2 text-right">
                            <div className="font-bold text-gray-900">${row.payment.toLocaleString('en-US')}</div>
                            <div className="text-[10px] text-gray-400">${row.principal.toLocaleString('en-US')} / ${row.interest.toLocaleString('en-US')}</div>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Revolving Loan Card ──────────────────────────────────────────────────────

function RevolvingLoanCard({ loan, onDelete, onUpdate }: {
  loan: LoanItem; onDelete: () => void; onUpdate: (d: Partial<LoanItem>) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [ep, setEp] = useState(loan.principal.toString());
  const [er, setEr] = useState(loan.interestRate.toString());
  const [em, setEm] = useState(loan.monthlyPayment.toString());

  const handleSave = () => {
    onUpdate({ principal: Number(ep) || 0, interestRate: Number(er) || 0, monthlyPayment: Number(em) || 0 });
    setIsEditing(false);
  };

  if (isEditing) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex justify-between items-center mb-3">
        <span className="font-bold text-gray-800">{loan.name}（{loan.bank}）</span>
        <button onClick={onDelete} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="block text-xs text-gray-500 mb-1">目前借款餘額</label><input type="number" value={ep} onChange={e => setEp(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">年利率 (%)</label><input type="number" step="0.01" value={er} onChange={e => setEr(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">每月扣息</label><input type="number" value={em} onChange={e => setEm(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 flex items-center gap-1"><Check className="w-4 h-4" /> 儲存</button>
        <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm flex items-center gap-1"><X className="w-4 h-4" /> 取消</button>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center shrink-0">
          <CreditCard className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900">{loan.name}</span>
            <span className="text-xs text-gray-400">{loan.bank}</span>
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full">循環</span>
          </div>
          <div className="flex flex-wrap gap-3 mt-1.5 text-sm">
            <span className="text-gray-500">借款餘額 <b className="text-gray-900">{loan.principal.toLocaleString('en-US')}</b></span>
            <span className="text-gray-500">利率 <b className="text-amber-600">{loan.interestRate}%</b></span>
            <span className="text-gray-500">每月扣息 <b className="text-rose-600">{loan.monthlyPayment.toLocaleString('en-US')}</b></span>
          </div>
          <p className="mt-1 text-xs text-gray-400">循環利息，本金不自動調降。如有還本請點編輯手動修改餘額。</p>
        </div>
      </div>
      <button onClick={() => setIsEditing(true)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg self-start lg:self-auto">
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAKING SECTION (借款型 or 收益型)
// ═══════════════════════════════════════════════════════════════════════════════

function StakingSection({ title, accentColor, type, items, onAdd, onUpdate, onDelete, extra }: {
  title: string; accentColor: string; type: StakingType;
  items: StakingItem[];
  onAdd: (item: Omit<StakingItem, 'id'>) => void;
  onUpdate: (id: string, data: Partial<StakingItem>) => void;
  onDelete: (id: string, name: string) => void;
  extra?: React.ReactNode;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState('');
  const [amount, setAmount] = useState('');
  const [value, setValue] = useState('');
  const [apy, setApy] = useState('');
  const [borrowDate, setBorrowDate] = useState('');
  const [repayDate, setRepayDate] = useState('');

  const isBorrow = type === 'borrow';
  const btnColor = isBorrow ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100';
  const confirmColor = isBorrow ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700';

  const handleAdd = () => {
    if (!name.trim() || !value) return;
    onAdd({ name, protocol: protocol || 'Custom', amount: Number(amount) || 0, value: Number(value) || 0, apy: Number(apy) || 0, stakingType: type, borrowDate, repayDate });
    setName(''); setProtocol(''); setAmount(''); setValue(''); setApy(''); setBorrowDate(''); setRepayDate('');
    setIsAdding(false);
  };

  return (
    <div>
      <SectionHeader title={title} color={accentColor}>
        <button onClick={() => setIsAdding(v => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${btnColor}`}>
          <Plus className="w-3.5 h-3.5" /> 新增
        </button>
      </SectionHeader>

      {extra && <div className="mb-4">{extra}</div>}

      {isAdding && (
        <div className={`mb-4 rounded-2xl border p-5 ${isBorrow ? 'bg-indigo-50/50 border-indigo-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="col-span-2 lg:col-span-1"><label className="block text-xs text-gray-500 mb-1">名稱</label><input autoFocus type="text" value={name} onChange={e => setName(e.target.value)} placeholder="名稱" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">平台</label><input type="text" value={protocol} onChange={e => setProtocol(e.target.value)} placeholder="Lido" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">數量</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="數量" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">{isBorrow ? '借款金額' : '存入金額'}</label><input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="TWD" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">{isBorrow ? '借款利率' : '年化收益率'} (%)</label><input type="number" value={apy} onChange={e => setApy(e.target.value)} placeholder="APY" className="w-full border rounded-lg p-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">{isBorrow ? '借款日' : '開始日'}</label><input type="date" value={borrowDate} onChange={e => setBorrowDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm text-gray-600" /></div>
            {isBorrow && <div><label className="block text-xs text-gray-500 mb-1">最後償還日</label><input type="date" value={repayDate} onChange={e => setRepayDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm text-gray-600" /></div>}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleAdd} className={`px-4 py-2 text-white rounded-lg text-sm flex items-center gap-1 ${confirmColor}`}><Check className="w-4 h-4" /> 確認新增</button>
            <button onClick={() => setIsAdding(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm">取消</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {items.map(item => (
          <StakingRow key={item.id} item={item} type={type} onUpdate={data => onUpdate(item.id, data)} onDelete={() => onDelete(item.id, item.name)} />
        ))}
        {items.length === 0 && !isAdding && (
          <div className="py-8 text-center text-gray-400 text-sm">尚無項目</div>
        )}
      </div>
    </div>
  );
}

// ─── Staking Row ──────────────────────────────────────────────────────────────

function StakingRow({ item, type, onUpdate, onDelete }: {
  item: StakingItem; type: StakingType;
  onUpdate: (d: Partial<StakingItem>) => void; onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [eName, setEName] = useState(item.name);
  const [eProtocol, setEProtocol] = useState(item.protocol);
  const [eAmount, setEAmount] = useState(item.amount.toString());
  const [eValue, setEValue] = useState(item.value.toString());
  const [eApy, setEApy] = useState(item.apy.toString());
  const [eBorrowDate, setEBorrowDate] = useState(item.borrowDate || '');
  const [eRepayDate, setERepayDate] = useState(item.repayDate || '');

  const isBorrow = type === 'borrow';
  const monthly = Math.round(item.value * item.apy / 100 / 12);

  const handleSave = () => {
    onUpdate({ name: eName, protocol: eProtocol, amount: Number(eAmount) || 0, value: Number(eValue) || 0, apy: Number(eApy) || 0, borrowDate: eBorrowDate, repayDate: eRepayDate });
    setIsEditing(false);
  };

  if (isEditing) return (
    <div className="p-5 bg-gray-50 border-b border-gray-100">
      <div className="flex justify-between mb-3">
        <span className="text-sm font-bold text-gray-700">編輯</span>
        <button onClick={onDelete} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="col-span-2 lg:col-span-1"><label className="block text-xs text-gray-500 mb-1">名稱</label><input type="text" value={eName} onChange={e => setEName(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">平台</label><input type="text" value={eProtocol} onChange={e => setEProtocol(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">數量</label><input type="number" value={eAmount} onChange={e => setEAmount(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">{isBorrow ? '借款金額' : '存入金額'}</label><input type="number" value={eValue} onChange={e => setEValue(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">{isBorrow ? '借款利率' : '收益率'} (%)</label><input type="number" value={eApy} onChange={e => setEApy(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">{isBorrow ? '借款日' : '開始日'}</label><input type="date" value={eBorrowDate} onChange={e => setEBorrowDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
        {isBorrow && <div><label className="block text-xs text-gray-500 mb-1">償還日</label><input type="date" value={eRepayDate} onChange={e => setERepayDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>}
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 flex items-center gap-1"><Check className="w-4 h-4" /> 儲存</button>
        <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm flex items-center gap-1"><X className="w-4 h-4" /> 取消</button>
      </div>
    </div>
  );

  return (
    <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
      <div className="flex items-start gap-3 mb-3 xl:mb-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${isBorrow ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
          {item.name.charAt(0)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">{item.name}</span>
            <span className="text-xs text-gray-400">via {item.protocol}</span>
          </div>
          {(item.borrowDate || item.repayDate) && (
            <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
              {item.borrowDate && <span>{isBorrow ? '借款' : '開始'}: {item.borrowDate}</span>}
              {item.repayDate && <span>償還: {item.repayDate}</span>}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0 shrink-0">
        <div className="w-16 px-2"><p className="text-xs text-gray-500">數量</p><p className="font-medium tabular-nums">{item.amount.toLocaleString()}</p></div>
        <div className="w-28 px-2"><p className="text-xs text-gray-500">{isBorrow ? '借款金額' : '存入金額'}</p><p className="font-medium tabular-nums">{(item.value / 10000).toLocaleString('zh-TW', { maximumFractionDigits: 1 })} 萬</p></div>
        <div className="w-20 px-2"><p className="text-xs text-gray-500">{isBorrow ? '借款利率' : '收益率'}</p><p className={`font-bold ${isBorrow ? 'text-rose-600' : 'text-emerald-600'}`}>{item.apy}%</p></div>
        <div className="w-24 px-2"><p className="text-xs text-gray-500">{isBorrow ? '月利息支出' : '月收益'}</p><p className={`font-bold tabular-nums ${isBorrow ? 'text-rose-600' : 'text-emerald-600'}`}>{monthly.toLocaleString()}</p></div>
        <div className="px-2">
          <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 border border-indigo-200 text-indigo-600 rounded-lg text-sm hover:bg-indigo-50 flex items-center gap-1">
            <Pencil className="w-3.5 h-3.5" /> 管理
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quota Bar ────────────────────────────────────────────────────────────────

function QuotaBar({ limit, setLimit, totalBorrow }: {
  limit: number; setLimit: (v: number) => void; totalBorrow: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [input, setInput] = useState((limit / 10000).toString());
  const available = limit - totalBorrow;
  const availableWan = (Math.abs(available) / 10000).toLocaleString('zh-TW', { maximumFractionDigits: 1 });
  const limitWan = (limit / 10000).toLocaleString('zh-TW', { maximumFractionDigits: 1 });

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2 text-indigo-600">
        <ShieldCheck className="w-4 h-4" />
        <span className="text-sm font-medium">剩餘可借款額度</span>
        {limit > 0 && (
          <span className={`text-lg font-bold ${available < 0 ? 'text-rose-600' : 'text-indigo-700'}`}>
            {available < 0 && '−'}{availableWan} 萬
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm text-indigo-500">
        <span>總額度：</span>
        {isEditing ? (
          <>
            <input type="number" value={input} onChange={e => setInput(e.target.value)} className="w-20 border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white outline-none" autoFocus placeholder="萬" />
            <span className="text-xs text-indigo-400">萬</span>
            <button onClick={() => { setLimit((Number(input) || 0) * 10000); setIsEditing(false); }} className="text-indigo-600"><Check className="w-4 h-4" /></button>
            <button onClick={() => setIsEditing(false)} className="text-gray-400"><X className="w-4 h-4" /></button>
          </>
        ) : (
          <button onClick={() => { setInput((limit / 10000).toString()); setIsEditing(true); }} className="font-bold text-indigo-700 hover:underline">
            {limit > 0 ? `${limitWan} 萬` : '點擊設定'}
          </button>
        )}
      </div>
    </div>
  );
}
