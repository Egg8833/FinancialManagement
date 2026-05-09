"use client";

import { useState } from 'react';
import {
  Coins, Plus, Check, X, Trash2, Pencil, RefreshCw,
  CreditCard, TrendingUp, TrendingDown, ShieldCheck, Zap,
} from 'lucide-react';
import {
  useAppContext,
  type StakingItem, type StakingType,
  type LoanItem, type LoanType,
} from '../../context/AppContext';

// ─── helpers ──────────────────────────────────────────────────────────────────

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

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function BorrowingPage() {
  const {
    loans, setLoans, recordLoanPayment, undoLoanPayment,
    stakingItems, setStakingItems,
    borrowingLimit, setBorrowingLimit,
  } = useAppContext();

  const installmentLoans = loans.filter(l => l.loanType === 'installment');
  const revolvingLoans   = loans.filter(l => l.loanType === 'revolving');
  const borrowStaking    = stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'borrow');
  const earnStaking      = stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'earn');

  // KPI
  const totalLoanPrincipal  = loans.reduce((s, l) => s + l.principal, 0);
  const totalLoanMonthly    = loans.reduce((s, l) => s + l.monthlyPayment, 0);
  const totalBorrowValue    = borrowStaking.reduce((s, i) => s + i.value, 0);
  const totalBorrowInterest = borrowStaking.reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0);
  const totalEarnValue      = earnStaking.reduce((s, i) => s + i.value, 0);
  const totalEarnIncome     = earnStaking.reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0);

  // Loan handlers
  const handleDeleteLoan = (id: string) => setLoans(prev => prev.filter(l => l.id !== id));
  const handleUpdateLoan = (id: string, data: Partial<LoanItem>) =>
    setLoans(prev => prev.map(l => l.id === id ? { ...l, ...data } : l));
  const handleAddLoan = (loan: Omit<LoanItem, 'id'>) =>
    setLoans(prev => [...prev, { ...loan, id: Date.now().toString() }]);

  // Staking handlers
  const handleDeleteStaking = (id: string) => setStakingItems(prev => prev.filter(i => i.id !== id));
  const handleUpdateStaking = (id: string, data: Partial<StakingItem>) =>
    setStakingItems(prev => prev.map(i => i.id === id ? { ...i, ...data } : i));
  const handleAddStaking = (item: Omit<StakingItem, 'id'>) =>
    setStakingItems(prev => [...prev, { ...item, id: Date.now().toString() }]);

  return (
    <>
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

      {/* ════════════ 質押借款 ════════════ */}
      <StakingSection
        title="質押借款"
        accentColor="bg-indigo-500"
        type="borrow"
        items={borrowStaking}
        onAdd={handleAddStaking}
        onUpdate={handleUpdateStaking}
        onDelete={handleDeleteStaking}
        extra={
          <QuotaBar
            borrowingLimit={borrowingLimit}
            setBorrowingLimit={setBorrowingLimit}
            totalBorrow={totalBorrowValue}
          />
        }
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
  onDelete: (id: string) => void;
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
              <button onClick={() => setNewLoanType('revolving')}   className={`px-3 py-1.5 ${newLoanType === 'revolving'   ? 'bg-rose-500 text-white' : 'bg-white text-gray-600 hover:bg-rose-50'}`}>循環借款</button>
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
          <InstallmentLoanCard key={l.id} loan={l} onRecord={() => onRecord(l.id)} onDelete={() => onDelete(l.id)} onUpdate={data => onUpdate(l.id, data)} />
        ))}
        {revolvingLoans.map(l => (
          <RevolvingLoanCard key={l.id} loan={l} onDelete={() => onDelete(l.id)} onUpdate={data => onUpdate(l.id, data)} />
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
  const [confirming, setConfirming] = useState(false);
  const [ep,   setEp]   = useState(loan.principal.toString());
  const [eip,  setEip]  = useState((loan.initialPrincipal ?? '').toString());
  const [er,   setEr]   = useState(loan.interestRate.toString());
  const [em,   setEm]   = useState(loan.monthlyPayment.toString());
  const [ed,   setEd]   = useState(loan.paymentDay.toString());
  const [ek,   setEk]   = useState(loan.remainingPeriods.toString());
  const [eop,  setEop]  = useState(loan.originalPeriods.toString());
  const [enpd, setEnpd] = useState(loan.nextPaymentDate ?? '');

  const interest  = loan.principal * loan.interestRate / 100 / 12;
  const principal = Math.max(0, loan.monthlyPayment - interest);
  const progress  = loan.originalPeriods > 0 ? ((loan.originalPeriods - loan.remainingPeriods) / loan.originalPeriods) * 100 : 0;
  const isPaidOff = loan.principal <= 0 || loan.remainingPeriods <= 0;

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
      <div className="h-1.5 bg-gray-100">
        <div className="h-1.5 bg-rose-400 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center shrink-0">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900">{loan.name}</span>
              <span className="text-xs text-gray-400">{loan.bank}</span>
              <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-full">分期</span>
              {isPaidOff && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">已清償</span>}
            </div>
            <div className="flex flex-wrap gap-3 mt-1.5 text-sm">
              {loan.initialPrincipal && (
                <span className="text-gray-500">初始 <b className="text-gray-700">{loan.initialPrincipal.toLocaleString('en-US')}</b></span>
              )}
              <span className="text-gray-500">餘額 <b className="text-gray-900">{loan.principal.toLocaleString('en-US')}</b></span>
              <span className="text-gray-500">利率 <b className="text-amber-600">{loan.interestRate}%</b></span>
              <span className="text-gray-500">月繳 <b className="text-gray-900">{loan.monthlyPayment.toLocaleString('en-US')}</b>{loan.paymentDay > 0 && <span className="text-gray-400 text-xs ml-1">（{loan.paymentDay}日）</span>}</span>
              <span className="text-gray-500">期數 <b className="text-indigo-600">{loan.remainingPeriods}</b><span className="text-gray-400">/{loan.originalPeriods}</span></span>
              {loan.nextPaymentDate && (
                <span className="text-gray-500">下次還款 <b className="text-indigo-600">{loan.nextPaymentDate}</b></span>
              )}
            </div>
            <div className="flex gap-3 mt-1 text-xs text-gray-400">
              <span>本月利息 <span className="text-rose-500 font-medium">{Math.round(interest).toLocaleString('en-US')}</span></span>
              <span>攤本 <span className="text-indigo-500 font-medium">{Math.round(principal).toLocaleString('en-US')}</span></span>
              <span className="text-gray-300">→ 還款後餘額 <span className="text-gray-500 font-medium">{Math.max(0, Math.round(loan.principal - principal)).toLocaleString('en-US')}</span></span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setIsEditing(true)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Pencil className="w-4 h-4" /></button>

          {!isPaidOff && (
            confirming ? (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-sm">
                <span className="text-rose-700 font-medium">負債 −{Math.round(principal).toLocaleString()}</span>
                <button onClick={() => { onRecord(); setConfirming(false); }} className="text-rose-600 hover:text-rose-800"><Check className="w-4 h-4" /></button>
                <button onClick={() => setConfirming(false)} className="text-gray-400"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <button onClick={() => setConfirming(true)} className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> 記錄還款
              </button>
            )
          )}
        </div>
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
  onDelete: (id: string) => void;
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
          <StakingRow key={item.id} item={item} type={type} onUpdate={data => onUpdate(item.id, data)} onDelete={() => onDelete(item.id)} />
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
  const monthly  = Math.round(item.value * item.apy / 100 / 12);

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
    <div className="p-5 flex flex-col xl:flex-row xl:items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
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
      <div className="flex flex-wrap gap-6 items-center">
        <div><p className="text-xs text-gray-500">數量</p><p className="font-medium">{item.amount.toLocaleString()}</p></div>
        <div><p className="text-xs text-gray-500">{isBorrow ? '借款金額' : '存入金額'}</p><p className="font-medium">{item.value.toLocaleString()}</p></div>
        <div><p className="text-xs text-gray-500">{isBorrow ? '借款利率' : '收益率'}</p><p className={`font-bold ${isBorrow ? 'text-rose-600' : 'text-emerald-600'}`}>{item.apy}%</p></div>
        <div><p className="text-xs text-gray-500">{isBorrow ? '月利息支出' : '月收益'}</p><p className={`font-bold ${isBorrow ? 'text-rose-600' : 'text-emerald-600'}`}>{monthly.toLocaleString()}</p></div>
        <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 border border-indigo-200 text-indigo-600 rounded-lg text-sm hover:bg-indigo-50 flex items-center gap-1">
          <Pencil className="w-3.5 h-3.5" /> 管理
        </button>
      </div>
    </div>
  );
}

// ─── Quota Bar ────────────────────────────────────────────────────────────────

function QuotaBar({ borrowingLimit, setBorrowingLimit, totalBorrow }: {
  borrowingLimit: number; setBorrowingLimit: (v: number | ((p: number) => number)) => void; totalBorrow: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [input, setInput] = useState(borrowingLimit.toString());
  const available = borrowingLimit - totalBorrow;

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2 text-indigo-600">
        <ShieldCheck className="w-4 h-4" />
        <span className="text-sm font-medium">剩餘可借款額度</span>
        <span className={`text-lg font-bold ${available < 0 ? 'text-rose-600' : 'text-indigo-700'}`}>
          {available < 0 && '−'}{Math.abs(available).toLocaleString('en-US')}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm text-indigo-500">
        <span>總額度：</span>
        {isEditing ? (
          <>
            <input type="number" value={input} onChange={e => setInput(e.target.value)} className="w-28 border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white outline-none" autoFocus />
            <button onClick={() => { setBorrowingLimit(Number(input) || 0); setIsEditing(false); }} className="text-indigo-600"><Check className="w-4 h-4" /></button>
            <button onClick={() => setIsEditing(false)} className="text-gray-400"><X className="w-4 h-4" /></button>
          </>
        ) : (
          <button onClick={() => setIsEditing(true)} className="font-bold text-indigo-700 hover:underline">{borrowingLimit.toLocaleString('en-US')}</button>
        )}
      </div>
    </div>
  );
}
