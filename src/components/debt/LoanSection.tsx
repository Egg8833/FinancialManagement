"use client";
import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { type LoanItem, type LoanType } from '../../context/AppContext';
import { SectionHeader } from './SectionHeader';
import { InstallmentLoanCard } from './InstallmentLoanCard';
import { RevolvingLoanCard } from './RevolvingLoanCard';

export function LoanSection({ installmentLoans, revolvingLoans, onRecord, onDelete, onUpdate, onAdd }: {
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
        {installmentLoans.length === 0 && revolvingLoans.length === 0 && !isAdding && (
          <div className="py-8 text-center text-gray-400 text-sm bg-white rounded-2xl border border-dashed border-gray-200">尚無信貸項目</div>
        )}
      </div>
    </div>
  );
}
