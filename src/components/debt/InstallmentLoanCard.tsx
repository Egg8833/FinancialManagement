"use client";
import { useState, memo } from 'react';
import { CreditCard, Pencil, Trash2, Check, X, ChevronDown, RefreshCw } from 'lucide-react';
import { useAppContext, type LoanItem } from '../../context/AppContext';
import { calcEndDate, generateSchedule, isPaymentDue } from '../../lib/loanUtils';

export const InstallmentLoanCard = memo(function InstallmentLoanCard({ loan, onRecord, onDelete, onUpdate }: {
  loan: LoanItem; onRecord: () => void; onDelete: () => void; onUpdate: (d: Partial<LoanItem>) => void;
}) {
  const { showValues } = useAppContext();
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

  const initPrincipal = loan.initialPrincipal ?? loan.principal;
  const paidAmount = initPrincipal - loan.principal;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isPaidOff ? 'border-emerald-200' : 'border-gray-100'}`}>
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
              : null
            }
            {isDue && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full animate-pulse">還款日已到</span>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!isPaidOff && (
              confirming ? (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5 text-sm">
                  <span className="text-rose-700 font-medium">負債 −{showValues ? loan.monthlyPayment.toLocaleString('en-US') : '****'}</span>
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

        {/* ── Repayment progress ── */}
        {isPaidOff ? (
          <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
            <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs shrink-0">✓</div>
            <span className="text-sm font-medium text-emerald-700">此筆貸款已完全清償</span>
          </div>
        ) : (
          <div className="mb-4 bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">還款進度</span>
              <span className="text-sm font-bold text-rose-600 tabular-nums">{Math.round(progress)}%</span>
            </div>
            <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-3 bg-gradient-to-r from-rose-400 to-rose-500 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
              {[25, 50, 75].map(pct => (
                <div key={pct} className="absolute inset-y-0 w-px bg-white/60" style={{ left: `${pct}%` }} />
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-gray-500">
                已還 <b className="text-gray-700 tabular-nums">{paidCount}</b> 期
                {loan.initialPrincipal && (
                  <span className="text-gray-400 ml-1">（−{paidAmount.toLocaleString('en-US')}）</span>
                )}
              </span>
              <span className="text-gray-500">
                剩餘 <b className="text-rose-600 tabular-nums">{loan.remainingPeriods}</b>
                <span className="text-gray-400"> / {loan.originalPeriods} 期</span>
              </span>
            </div>
          </div>
        )}

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
                          <td className="px-4 py-2 text-right text-gray-700 font-medium">{showValues ? `$${row.endingBalance.toLocaleString('en-US')}` : '****'}</td>
                          <td className="px-4 py-2 text-right">
                            <div className="font-bold text-gray-900">{showValues ? `$${row.payment.toLocaleString('en-US')}` : '****'}</div>
                            <div className="text-[10px] text-gray-400">
                              {showValues ? `$${row.principal.toLocaleString('en-US')} / $${row.interest.toLocaleString('en-US')}` : '****'}
                            </div>
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
});
