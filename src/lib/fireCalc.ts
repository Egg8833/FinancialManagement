export type FireScenario = 'conservative' | 'neutral' | 'optimistic';

// ─── Monte Carlo ──────────────────────────────────────────────────────────────

export type MonteCarloInput = {
  currentAge: number;
  currentNetWorth: number;
  monthlyInvestment: number;
  retirementMonthlyExpense: number;
  annualReturnRate: number;
  inflationRate: number;
  safeWithdrawalRate: number;
  volatility: number;       // e.g. 0.12 (12% annual std dev)
  simulations?: number;     // default 500
  maxYears?: number;        // default 50
};

export type MonteCarloYearData = {
  year: number;
  age: number;
  successRate: number;
  p10: number; p25: number; p50: number; p75: number; p90: number;
};

export type MonteCarloResult = {
  byYear: MonteCarloYearData[];
  fireNumber: number;
  medianFireAge: number | null;
  successRateAt10: number;
  successRateAt20: number;
  successRateAt30: number;
};

function normalRandom(mean: number, std: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function percentile(sorted: number[], pct: number): number {
  const idx = Math.floor((pct / 100) * (sorted.length - 1));
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export function runMonteCarlo(input: MonteCarloInput): MonteCarloResult {
  const swr = input.safeWithdrawalRate;
  const fireNumber = input.retirementMonthlyExpense * 12 / swr;
  const numSim = input.simulations ?? 500;
  const maxYears = input.maxYears ?? 50;
  const currentYear = new Date().getFullYear();
  const startWealth = Math.max(0, input.currentNetWorth);

  // Run all simulations
  const paths: number[][] = Array.from({ length: numSim }, () => {
    const path: number[] = [startWealth];
    let w = startWealth;
    for (let y = 1; y <= maxYears; y++) {
      const annualReturn = normalRandom(input.annualReturnRate, input.volatility);
      const mRate = Math.pow(1 + Math.max(-0.99, annualReturn), 1 / 12) - 1;
      for (let m = 0; m < 12; m++) w = w * (1 + mRate) + input.monthlyInvestment;
      path.push(Math.max(0, w));
    }
    return path;
  });

  const byYear: MonteCarloYearData[] = [];
  for (let y = 0; y <= maxYears; y++) {
    const sorted = paths.map(p => p[y]).sort((a, b) => a - b);
    const successCount = sorted.filter(w => w >= fireNumber).length;
    byYear.push({
      year: currentYear + y,
      age: input.currentAge + y,
      successRate: (successCount / numSim) * 100,
      p10: percentile(sorted, 10),
      p25: percentile(sorted, 25),
      p50: percentile(sorted, 50),
      p75: percentile(sorted, 75),
      p90: percentile(sorted, 90),
    });
  }

  const medianFireYear = byYear.find(y => y.successRate >= 50)?.year ?? null;
  return {
    byYear,
    fireNumber,
    medianFireAge: medianFireYear !== null ? input.currentAge + (medianFireYear - currentYear) : null,
    successRateAt10: byYear[Math.min(10, byYear.length - 1)]?.successRate ?? 0,
    successRateAt20: byYear[Math.min(20, byYear.length - 1)]?.successRate ?? 0,
    successRateAt30: byYear[Math.min(30, byYear.length - 1)]?.successRate ?? 0,
  };
}

export type FireInput = {
  currentAge: number;
  targetRetirementAge: number;
  currentNetWorth: number;
  monthlyInvestment: number;
  retirementMonthlyExpense: number;
  annualReturnRate: number;   // e.g. 0.06
  inflationRate: number;      // e.g. 0.02
  safeWithdrawalRate?: number; // e.g. 0.04 (4% rule), default 0.04
};

export type FireYearData = {
  year: number;
  age: number;
  conservative: number;
  neutral: number;
  optimistic: number;
};

export type FireResult = {
  fireNumber: number;
  projectionData: FireYearData[];
  neutralFireYear: number | null;
  neutralFireAge: number | null;
  conservativeFireYear: number | null;
  conservativeFireAge: number | null;
  optimisticFireYear: number | null;
  optimisticFireAge: number | null;
};

type Rates = { returnRate: number; inflationRate: number };

function scenarioRates(input: FireInput, scenario: FireScenario): Rates {
  switch (scenario) {
    case 'conservative':
      return {
        returnRate: Math.max(0, input.annualReturnRate - 0.02),
        inflationRate: input.inflationRate + 0.005,
      };
    case 'optimistic':
      return {
        returnRate: input.annualReturnRate + 0.02,
        inflationRate: Math.max(0, input.inflationRate - 0.005),
      };
    default:
      return { returnRate: input.annualReturnRate, inflationRate: input.inflationRate };
  }
}

function calcFireNumber(monthlyExpense: number, inflationRate: number, yearsToRetire: number, swr = 0.04): number {
  const realMonthlyExpense = monthlyExpense * Math.pow(1 + inflationRate, Math.max(0, yearsToRetire));
  return realMonthlyExpense * 12 / swr;
}

function projectWealth(start: number, monthlyContrib: number, monthlyRate: number, months: number): number {
  let fv = start;
  for (let m = 0; m < months; m++) {
    fv = fv * (1 + monthlyRate) + monthlyContrib;
  }
  return Math.round(fv);
}

const SCENARIOS: FireScenario[] = ['conservative', 'neutral', 'optimistic'];
const MAX_YEARS = 60;

export function calculateFire(input: FireInput): FireResult {
  const currentYear = new Date().getFullYear();
  const swr = input.safeWithdrawalRate ?? 0.04;
  const yearsToRetire = Math.max(0, input.targetRetirementAge - input.currentAge);
  const neutralRates = scenarioRates(input, 'neutral');
  const fireNumber = calcFireNumber(input.retirementMonthlyExpense, neutralRates.inflationRate, yearsToRetire, swr);

  const fireYears: Record<FireScenario, number | null> = {
    conservative: null, neutral: null, optimistic: null,
  };
  const projectionData: FireYearData[] = [];
  const startWealth = Math.max(0, input.currentNetWorth);

  for (let year = 0; year <= MAX_YEARS; year++) {
    const entry: FireYearData = {
      year: currentYear + year,
      age: input.currentAge + year,
      conservative: 0, neutral: 0, optimistic: 0,
    };

    for (const scenario of SCENARIOS) {
      const rates = scenarioRates(input, scenario);
      const value = projectWealth(startWealth, input.monthlyInvestment, rates.returnRate / 12, year * 12);
      entry[scenario] = value;

      if (fireYears[scenario] === null) {
        const targetFireNumber = calcFireNumber(
          input.retirementMonthlyExpense,
          rates.inflationRate,
          Math.max(0, yearsToRetire - year),
          swr,
        );
        if (value >= targetFireNumber) {
          fireYears[scenario] = currentYear + year;
        }
      }
    }

    projectionData.push(entry);

    // 所有情境都找到後，再多投影 5 年供圖表參考
    if (year > 5 && SCENARIOS.every(s => fireYears[s] !== null)) {
      const maxFireYear = Math.max(...SCENARIOS.map(s => fireYears[s] ?? 0));
      if (currentYear + year >= maxFireYear + 5) break;
    }
  }

  return {
    fireNumber,
    projectionData,
    neutralFireYear: fireYears.neutral,
    neutralFireAge: fireYears.neutral !== null ? input.currentAge + (fireYears.neutral - currentYear) : null,
    conservativeFireYear: fireYears.conservative,
    conservativeFireAge: fireYears.conservative !== null ? input.currentAge + (fireYears.conservative - currentYear) : null,
    optimisticFireYear: fireYears.optimistic,
    optimisticFireAge: fireYears.optimistic !== null ? input.currentAge + (fireYears.optimistic - currentYear) : null,
  };
}
