import { formatTWD } from './shared';

interface CoastFireCardProps {
  currentNetWorth: number;
  coastFireNumber: number;
  coastFireProgress: number;
  coastAchieved: boolean;
  fireNumber: number;
  annualReturnRate: number;
  targetRetirementAge: number;
  formatAmount: (v: number) => string;
}

export function CoastFireCard({
  currentNetWorth, coastFireNumber, coastFireProgress, coastAchieved, fireNumber,
  annualReturnRate, targetRetirementAge, formatAmount,
}: CoastFireCardProps) {
  return (
    <div className={`rounded-2xl p-5 shadow-sm mb-6 ${
      coastAchieved
        ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white'
        : 'bg-white border border-gray-100'
    }`}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${coastAchieved ? 'text-white/70' : 'text-gray-400'}`}>
            Coast FIRE 數字
          </p>
          <p className={`text-2xl font-black ${coastAchieved ? 'text-white' : 'text-gray-900'}`}>
            {formatAmount(coastFireNumber)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {coastAchieved && (
            <span className="px-3 py-1.5 bg-white/20 rounded-full text-xs font-bold text-white">
              ✓ 已達成 Coast FIRE
            </span>
          )}
          <div className={`text-right ${coastAchieved ? 'text-white/70' : 'text-gray-400'}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider">vs FIRE 目標</p>
            <p className={`text-sm font-bold ${coastAchieved ? 'text-white' : 'text-indigo-600'}`}>
              {formatAmount(fireNumber)}
            </p>
          </div>
        </div>
      </div>

      {!coastAchieved && (
        <>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 transition-all duration-700"
              style={{ width: `${coastFireProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>目前 {formatTWD(currentNetWorth)}</span>
            <span className="font-bold text-teal-600">{coastFireProgress.toFixed(1)}%</span>
            <span>Coast 目標 {formatTWD(coastFireNumber)}</span>
          </div>
        </>
      )}

      {coastAchieved ? (
        <p className="text-sm text-white/80 mt-2">
          恭喜！你已達到 Coast FIRE。即使今天停止投入，以 {annualReturnRate}% 年化報酬自然成長，也能在 {targetRetirementAge} 歲達成財務自由目標。
        </p>
      ) : (
        <p className="text-xs text-gray-400 mt-2">
          只需存到此金額，之後無需再追加投入，靠複利自然成長即可在 {targetRetirementAge} 歲達成 FIRE 目標金額。
        </p>
      )}
    </div>
  );
}
