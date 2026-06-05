import type { FireSettings, LifeEvent } from '../types';

const KEYS = {
  showValues:           'app-show-values',
  userName:             'app-user-name-v1',
  userEmail:            'app-user-email-v1',
  usdToTwd:             'app-usd-twd-v1',
  reportSchedule:       'app-report-schedule-v1',
  netWorthGoal:         'app-net-worth-goal-v1',
  fireSettings:         'app-fire-settings-v1',
  lifeEvents:           'app-life-events-v1',
  onboardingDone:       'assetdash-onboarding-done',
  enablePledgeTracking: 'app-enable-pledge-tracking-v1',
  pledgeAlertLastSent:  'app-pledge-alert-v1',
  lastExportDate:       'app-last-export-v1',
  lastReportSent:       'app-last-report-sent-v1',
} as const;

const DEFAULT_FIRE: FireSettings = {
  currentAge: 30, targetRetirementAge: 55,
  annualReturnRate: 6, inflationRate: 2, swr: 4, taxRate: 0,
};

function read<T>(key: string, fallback: T): T {
  const stored = localStorage.getItem(key);
  return stored !== null ? JSON.parse(stored) : fallback;
}
function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const settingsService = {
  getShowValues:           () => read<boolean>(KEYS.showValues, true),
  saveShowValues:          (v: boolean) => write(KEYS.showValues, v),
  getUserName:             () => read<string>(KEYS.userName, ''),
  saveUserName:            (v: string) => write(KEYS.userName, v),
  getUserEmail:            () => read<string>(KEYS.userEmail, ''),
  saveUserEmail:           (v: string) => write(KEYS.userEmail, v),
  getUsdToTwd:             () => read<number>(KEYS.usdToTwd, 32),
  saveUsdToTwd:            (v: number) => write(KEYS.usdToTwd, v),
  getReportSchedule:       () => read<'none' | 'weekly' | 'monthly'>(KEYS.reportSchedule, 'none'),
  saveReportSchedule:      (v: 'none' | 'weekly' | 'monthly') => write(KEYS.reportSchedule, v),
  getNetWorthGoal:         () => read<number>(KEYS.netWorthGoal, 0),
  saveNetWorthGoal:        (v: number) => write(KEYS.netWorthGoal, v),
  getFireSettings:         () => read<FireSettings>(KEYS.fireSettings, DEFAULT_FIRE),
  saveFireSettings:        (v: FireSettings) => write(KEYS.fireSettings, v),
  getLifeEvents:           () => read<LifeEvent[]>(KEYS.lifeEvents, []),
  saveLifeEvents:          (v: LifeEvent[]) => write(KEYS.lifeEvents, v),
  getOnboardingDone:       () => read<boolean>(KEYS.onboardingDone, false),
  saveOnboardingDone:      (v: boolean) => write(KEYS.onboardingDone, v),
  getEnablePledgeTracking: () => read<boolean>(KEYS.enablePledgeTracking, false),
  saveEnablePledgeTracking:(v: boolean) => write(KEYS.enablePledgeTracking, v),
  getPledgeAlertLastSent:  () => read<Record<'warning'|'danger', string>>(KEYS.pledgeAlertLastSent, { warning: '', danger: '' }),
  savePledgeAlertLastSent: (v: Record<'warning'|'danger', string>) => write(KEYS.pledgeAlertLastSent, v),
  getLastExportDate:       () => read<string>(KEYS.lastExportDate, ''),
  saveLastExportDate:      (v: string) => write(KEYS.lastExportDate, v),
  getLastReportSent:       () => read<string>(KEYS.lastReportSent, ''),
  saveLastReportSent:      (v: string) => write(KEYS.lastReportSent, v),
};
