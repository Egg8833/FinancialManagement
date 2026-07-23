interface FireProgressCardProps {
  fireProgress: number;
  currentNetWorth: number;
  fireGap: number;
  fireNumber: number;
  formatAmount: (v: number) => string;
}

export function FireProgressCard({ fireProgress, currentNetWorth, fireGap, fireNumber, formatAmount }: FireProgressCardProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-gray-700">FIRE 達成進度</p>
        <p className="text-sm font-bold text-indigo-600">{fireProgress.toFixed(1)}%</p>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-700"
          style={{ width: `${fireProgress}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>目前淨資產：{formatAmount(currentNetWorth)}</span>
        <span>還差 {formatAmount(fireGap)}</span>
        <span>FIRE 目標：{formatAmount(fireNumber)}</span>
      </div>
    </div>
  );
}
