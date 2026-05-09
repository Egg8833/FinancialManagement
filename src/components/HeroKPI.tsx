import { Wallet, ArrowUpRight } from 'lucide-react';

interface HeroKPIProps {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  formatCurrency: (amount: number) => string;
}

export function HeroKPI({ netWorth, totalAssets, totalLiabilities, formatCurrency }: HeroKPIProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white rounded-2xl p-6 shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Wallet className="w-24 h-24 text-indigo-600" />
        </div>
        <p className="text-sm font-medium text-gray-500 mb-2">我的淨資產 (TWD)</p>
        <h2 className="text-4xl font-bold text-gray-900 mb-4">{formatCurrency(netWorth)}</h2>
        <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
          <span className="flex items-center bg-emerald-50 px-2 py-1 rounded-md">
            <ArrowUpRight className="w-4 h-4 mr-1" />
            即時計算
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-gray-100 relative overflow-hidden">
        <p className="text-sm font-medium text-gray-500 mb-2">總資產</p>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">{formatCurrency(totalAssets)}</h2>
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2 overflow-hidden">
          <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-gray-100 relative overflow-hidden">
        <p className="text-sm font-medium text-gray-500 mb-2">總負債</p>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">{formatCurrency(totalLiabilities)}</h2>
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2 overflow-hidden">
          <div className="bg-rose-400 h-1.5 rounded-full" style={{ width: totalAssets > 0 ? `${Math.min((totalLiabilities / totalAssets) * 100, 100)}%` : '0%' }}></div>
        </div>
        <div className="flex gap-3 text-xs text-gray-400">
          <span>負債比: {totalAssets > 0 ? ((totalLiabilities / totalAssets) * 100).toFixed(1) : '—'}%</span>
          <span className="text-gray-200">|</span>
          <span>D/E 比: {netWorth > 0 ? (totalLiabilities / netWorth).toFixed(2) : netWorth < 0 ? '資不抵債' : '—'}</span>
        </div>
      </div>
    </div>
  );
}
