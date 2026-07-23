const MILESTONES = [
  { pct: 0.1, label: '安全墊達成', color: 'indigo' },
  { pct: 0.25, label: '咖啡自由', color: 'emerald' },
  { pct: 0.5, label: '半退休目標', color: 'sky' },
  { pct: 1.0, label: '完全財務自由', color: 'amber' },
] as const;

interface FireMilestonesProps {
  currentNetWorth: number;
  fireNumber: number;
  formatAmount: (v: number) => string;
}

export function FireMilestones({ currentNetWorth, fireNumber, formatAmount }: FireMilestonesProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {MILESTONES.map(m => {
        const reached = currentNetWorth >= fireNumber * m.pct;
        return (
          <div key={m.pct} className={`bg-white border rounded-xl p-3 text-center transition-all ${reached ? `border-${m.color}-500 bg-${m.color}-50` : 'border-gray-100 opacity-60'}`}>
            <p className={`text-[10px] font-bold uppercase mb-1 ${reached ? `text-${m.color}-600` : 'text-gray-400'}`}>
              {m.label} ({m.pct * 100}%)
            </p>
            <p className="text-sm font-black text-gray-900">{formatAmount(fireNumber * m.pct)}</p>
            {reached && <span className="text-[10px] font-bold text-emerald-600 block mt-1">✓ 已達成</span>}
          </div>
        );
      })}
    </div>
  );
}
