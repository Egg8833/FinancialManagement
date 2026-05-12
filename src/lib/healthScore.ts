type Snapshot = { netWorth: number };

export type HealthScoreInput = {
  totalMonthlyIncome: number;
  totalMonthlyExpense: number;
  monthlyNetCashFlow: number;
  totalAssets: number;
  totalLiabilities: number;
  liquidAssets: number;
  investmentAssets: number;
  snapshots: Snapshot[];
};

export type MetricResult = {
  key: string;
  label: string;
  score: number;
  rawValue: number;
  benchmark: string;
  advice: string;
};

export type HealthScoreResult = {
  totalScore: number;
  grade: '優秀' | '良好' | '普通' | '警示' | '危險';
  metrics: MetricResult[];
};

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function toScore(value: number, zeroBound: number, hundredBound: number): number {
  if (hundredBound === zeroBound) return value >= hundredBound ? 100 : 0;
  return clamp(Math.round(((value - zeroBound) / (hundredBound - zeroBound)) * 100));
}

const WEIGHTS: Record<string, number> = {
  savings: 0.25,
  liquidity: 0.20,
  debt: 0.25,
  investment: 0.15,
  cashflow: 0.10,
  growth: 0.05,
};

function calcSavings(input: HealthScoreInput): MetricResult {
  const rate = input.totalMonthlyIncome > 0 ? input.monthlyNetCashFlow / input.totalMonthlyIncome : 0;
  const score = toScore(rate, 0, 0.3);
  return {
    key: 'savings', label: '儲蓄率', score, rawValue: rate,
    benchmark: '建議 ≥ 30%',
    advice: score < 60 ? '建議減少非必要支出或增加收入，目標儲蓄率 20% 以上' : '',
  };
}

function calcLiquidity(input: HealthScoreInput): MetricResult {
  const months = input.totalMonthlyExpense > 0 ? input.liquidAssets / input.totalMonthlyExpense : 0;
  const score = toScore(months, 1, 6);
  return {
    key: 'liquidity', label: '緊急備用金', score, rawValue: months,
    benchmark: '建議 ≥ 6 個月支出',
    advice: score < 60 ? `流動資金可支撐 ${months.toFixed(1)} 個月，建議增至 6 個月` : '',
  };
}

function calcDebt(input: HealthScoreInput): MetricResult {
  const ratio = input.totalAssets > 0 ? input.totalLiabilities / input.totalAssets : 0;
  const score = toScore(ratio, 0.7, 0.2);
  return {
    key: 'debt', label: '負債比率', score, rawValue: ratio,
    benchmark: '建議 ≤ 20%',
    advice: score < 60 ? `負債佔資產 ${(ratio * 100).toFixed(1)}%，建議優先還清高利率債務` : '',
  };
}

function calcInvestment(input: HealthScoreInput): MetricResult {
  const ratio = input.totalAssets > 0 ? input.investmentAssets / input.totalAssets : 0;
  const score = toScore(ratio, 0, 0.4);
  return {
    key: 'investment', label: '投資比率', score, rawValue: ratio,
    benchmark: '建議 ≥ 40%',
    advice: score < 60 ? '可將閒置現金配置至長期投資，提升資產增值效率' : '',
  };
}

function calcCashFlow(input: HealthScoreInput): MetricResult {
  const rate = input.totalMonthlyIncome > 0 && input.monthlyNetCashFlow > 0
    ? input.monthlyNetCashFlow / input.totalMonthlyIncome : 0;
  const score = toScore(rate, 0, 0.2);
  return {
    key: 'cashflow', label: '現金流健康度', score, rawValue: input.monthlyNetCashFlow,
    benchmark: '月盈餘 ≥ 月收入 20%',
    advice: score < 60
      ? (input.monthlyNetCashFlow < 0 ? '月現金流為負，需立即檢視支出結構' : '月盈餘偏低，建議提高儲蓄比例')
      : '',
  };
}

function calcGrowth(input: HealthScoreInput): MetricResult {
  const recent = input.snapshots.slice(-3);
  let score = 50;
  if (recent.length >= 2) {
    const allUp = recent.every((s, i) => i === 0 || s.netWorth >= recent[i - 1].netWorth);
    const allDown = recent.every((s, i) => i === 0 || s.netWorth <= recent[i - 1].netWorth);
    if (allUp) score = 100;
    else if (allDown) score = 0;
  }
  return {
    key: 'growth', label: '淨資產成長趨勢', score, rawValue: recent.length,
    benchmark: '近 3 個月持續上升',
    advice: score < 60 ? '近期淨資產呈下降趨勢，建議檢視資產與負債變化' : '',
  };
}

function toGrade(score: number): HealthScoreResult['grade'] {
  if (score >= 90) return '優秀';
  if (score >= 75) return '良好';
  if (score >= 60) return '普通';
  if (score >= 40) return '警示';
  return '危險';
}

export function calculateHealthScore(input: HealthScoreInput): HealthScoreResult {
  const metrics = [
    calcSavings(input),
    calcLiquidity(input),
    calcDebt(input),
    calcInvestment(input),
    calcCashFlow(input),
    calcGrowth(input),
  ];
  const totalScore = Math.round(
    metrics.reduce((sum, m) => sum + m.score * WEIGHTS[m.key], 0)
  );
  return { totalScore, grade: toGrade(totalScore), metrics };
}
