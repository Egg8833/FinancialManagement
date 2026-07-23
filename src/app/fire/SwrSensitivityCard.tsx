import { calculateFire } from '../../lib/fireCalc';

const SWR_OPTIONS = [3.5, 4.0, 4.5];

interface SwrSensitivityCardProps {
  currentAge: number;
  targetRetirementAge: number;
  currentNetWorth: number;
  monthlyInvestment: number;
  extraMonthly: number;
  retirementMonthlyExpense: number;
  annualReturnRate: number;
  inflationRate: number;
  swr: number;
  onSelectSwr: (rate: number) => void;
  formatAmount: (v: number) => string;
}

export function SwrSensitivityCard({
  currentAge, targetRetirementAge, currentNetWorth, monthlyInvestment, extraMonthly,
  retirementMonthlyExpense, annualReturnRate, inflationRate, swr, onSelectSwr, formatAmount,
}: SwrSensitivityCardProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <h3 className="font-bold text-gray-900 mb-3 text-sm">SWR 敏感度分析</h3>
      <div className="grid grid-cols-3 gap-3">
        {SWR_OPTIONS.map(rate => {
          const r = calculateFire({
            currentAge, targetRetirementAge, currentNetWorth,
            monthlyInvestment: monthlyInvestment + extraMonthly,
            retirementMonthlyExpense,
            annualReturnRate: annualReturnRate / 100,
            inflationRate: inflationRate / 100,
            safeWithdrawalRate: rate / 100,
          });
          const isSelected = Math.abs(swr - rate) < 0.05;
          return (
            <button
              key={rate}
              onClick={() => onSelectSwr(rate)}
              className={`rounded-xl p-3 text-center transition-all border ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:border-indigo-200'}`}
            >
              <p className={`text-xs font-bold mb-1 ${isSelected ? 'text-indigo-600' : 'text-gray-500'}`}>{rate}% SWR</p>
              <p className="text-sm font-black text-gray-900">{formatAmount(r.fireNumber)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {r.neutralFireYear ? `${r.neutralFireYear} 達成` : '60年內不達'}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
