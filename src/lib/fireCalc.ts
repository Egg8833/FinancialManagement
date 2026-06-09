import { LifeEvent } from '../types';

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
  taxRate?: number;         // e.g. 0.05 (5% effective tax)
  lifeEvents?: LifeEvent[];
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
  const numSim = input.simulations ?? 500;
  const maxYears = input.maxYears ?? 50;
  const currentYear = new Date().getFullYear();
  const startWealth = Math.max(0, input.currentNetWorth);
  const taxFactor = 1 - (input.taxRate ?? 0);

  // Run all simulations
  const paths: number[][] = Array.from({ length: numSim }, () => {
    const path: number[] = [startWealth];
    let w = startWealth;
    let currentMonthlyInvestment = input.monthlyInvestment;
    // retirement expense changes via life events are tracked but not yet applied to simulation


    for (let y = 1; y <= maxYears; y++) {
      const age = input.currentAge + y;
      
      // Apply life events for this YEAR (age reaching)
      const events = input.lifeEvents?.filter(e => e.age === age) ?? [];
      let extraLumpSum = 0;
      events.forEach(e => {
        if (e.type === 'income_jump') currentMonthlyInvestment += e.amount;
if (e.type === 'one_time_lump_sum') extraLumpSum += e.amount;
      });

      const annualReturn = normalRandom(input.annualReturnRate, input.volatility);
      // Simplified tax: apply to growth
      const afterTaxReturn = annualReturn > 0 ? annualReturn * taxFactor : annualReturn;
      const mRate = Math.pow(1 + Math.max(-0.99, afterTaxReturn), 1 / 12) - 1;
      
      w += extraLumpSum;
      for (let m = 0; m < 12; m++) w = w * (1 + mRate) + currentMonthlyInvestment;
      path.push(Math.max(0, w));
    }
    return path;
  });

  const fireNumber = input.retirementMonthlyExpense * 12 / swr;

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
  taxRate?: number;
  lifeEvents?: LifeEvent[];
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

const SCENARIOS: FireScenario[] = ['conservative', 'neutral', 'optimistic'];
const MAX_YEARS = 60;

export function calculateFire(input: FireInput): FireResult {
  const currentYear = new Date().getFullYear();
  const swr = input.safeWithdrawalRate ?? 0.04;
  const yearsToRetire = Math.max(0, input.targetRetirementAge - input.currentAge);
  const neutralRates = scenarioRates(input, 'neutral');
  const fireNumber = calcFireNumber(input.retirementMonthlyExpense, neutralRates.inflationRate, yearsToRetire, swr);
  const taxFactor = 1 - (input.taxRate ?? 0);

  const fireYears: Record<FireScenario, number | null> = {
    conservative: null, neutral: null, optimistic: null,
  };
  const projectionData: FireYearData[] = [];
  
  // Track wealth per scenario
  const currentWealth: Record<FireScenario, number> = {
    conservative: Math.max(0, input.currentNetWorth),
    neutral: Math.max(0, input.currentNetWorth),
    optimistic: Math.max(0, input.currentNetWorth),
  };

  // Track monthly investment/expense per scenario
  const currentMonthlyInvestment: Record<FireScenario, number> = {
    conservative: input.monthlyInvestment,
    neutral: input.monthlyInvestment,
    optimistic: input.monthlyInvestment,
  };
  const currentBaseMonthlyExpense: Record<FireScenario, number> = {
    conservative: input.retirementMonthlyExpense,
    neutral: input.retirementMonthlyExpense,
    optimistic: input.retirementMonthlyExpense,
  };

  for (let year = 0; year <= MAX_YEARS; year++) {
    const age = input.currentAge + year;
    const entry: FireYearData = {
      year: currentYear + year,
      age: age,
      conservative: Math.round(currentWealth.conservative),
      neutral: Math.round(currentWealth.neutral),
      optimistic: Math.round(currentWealth.optimistic),
    };

    projectionData.push(entry);

    // Apply life events for the NEXT year's growth
    const events = input.lifeEvents?.filter(e => e.age === age + 1) ?? [];
    
    for (const scenario of SCENARIOS) {
      const rates = scenarioRates(input, scenario);
      const targetFireNumber = calcFireNumber(
        currentBaseMonthlyExpense[scenario],
        rates.inflationRate,
        Math.max(0, input.targetRetirementAge - age),
        swr,
      );

      if (fireYears[scenario] === null && currentWealth[scenario] >= targetFireNumber) {
        fireYears[scenario] = currentYear + year;
      }

      // Project one year ahead
      let lumpSum = 0;
      events.forEach(e => {
        if (e.type === 'income_jump') currentMonthlyInvestment[scenario] += e.amount;
        if (e.type === 'expense_jump') currentBaseMonthlyExpense[scenario] += e.amount;
        if (e.type === 'one_time_lump_sum') lumpSum += e.amount;
      });

      const afterTaxReturn = rates.returnRate > 0 ? rates.returnRate * taxFactor : rates.returnRate;
      const mRate = afterTaxReturn / 12;
      
      let w = currentWealth[scenario] + lumpSum;
      for (let m = 0; m < 12; m++) {
        w = w * (1 + mRate) + currentMonthlyInvestment[scenario];
      }
      currentWealth[scenario] = w;
    }

    // Stop if all scenarios reached and we projected enough
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
