export type FireScenario = 'conservative' | 'neutral' | 'optimistic';

export type FireInput = {
  currentAge: number;
  targetRetirementAge: number;
  currentNetWorth: number;
  monthlyInvestment: number;
  retirementMonthlyExpense: number;
  annualReturnRate: number;   // e.g. 0.06
  inflationRate: number;      // e.g. 0.02
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

function calcFireNumber(monthlyExpense: number, inflationRate: number, yearsToRetire: number): number {
  const realMonthlyExpense = monthlyExpense * Math.pow(1 + inflationRate, Math.max(0, yearsToRetire));
  return realMonthlyExpense * 12 * 25;
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
  const yearsToRetire = Math.max(0, input.targetRetirementAge - input.currentAge);
  const neutralRates = scenarioRates(input, 'neutral');
  const fireNumber = calcFireNumber(input.retirementMonthlyExpense, neutralRates.inflationRate, yearsToRetire);

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
    neutralFireAge: fireYears.neutral ? input.currentAge + (fireYears.neutral - currentYear) : null,
    conservativeFireYear: fireYears.conservative,
    conservativeFireAge: fireYears.conservative ? input.currentAge + (fireYears.conservative - currentYear) : null,
    optimisticFireYear: fireYears.optimistic,
    optimisticFireAge: fireYears.optimistic ? input.currentAge + (fireYears.optimistic - currentYear) : null,
  };
}
