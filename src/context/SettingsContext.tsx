"use client";

import { createContext, useContext, ReactNode } from 'react';
import { useStickyState } from '../hooks/useStickyState';
import { useSyncedState } from '../hooks/useSyncedState';
import type { FireSettings, LifeEvent } from '../types';

interface SettingsContextType {
  showValues: boolean;
  setShowValues: (v: boolean | ((p: boolean) => boolean)) => void;
  userName: string;
  setUserName: (v: string | ((p: string) => string)) => void;
  userEmail: string;
  setUserEmail: (v: string | ((p: string) => string)) => void;
  usdToTwd: number;
  setUsdToTwd: (v: number | ((p: number) => number)) => void;
  reportSchedule: 'none' | 'weekly' | 'monthly';
  setReportSchedule: (v: 'none' | 'weekly' | 'monthly') => void;
  lastReportSent: string;
  setLastReportSent: (v: string) => void;
  netWorthGoal: number;
  setNetWorthGoal: (v: number | ((p: number) => number)) => void;
  fireSettings: FireSettings;
  setFireSettings: (v: FireSettings | ((p: FireSettings) => FireSettings)) => void;
  lifeEvents: LifeEvent[];
  setLifeEvents: (v: LifeEvent[] | ((p: LifeEvent[]) => LifeEvent[])) => void;
  onboardingDone: boolean;
  setOnboardingDone: (v: boolean) => void;
  enablePledgeTracking: boolean;
  setEnablePledgeTracking: (v: boolean) => void;
  pledgeAlertLastSent: Record<'warning' | 'danger', string>;
  setPledgeAlertLastSent: (v: Record<'warning' | 'danger', string> | ((p: Record<'warning' | 'danger', string>) => Record<'warning' | 'danger', string>)) => void;
  lastExportDate: string;
  setLastExportDate: (v: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettingsContext() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettingsContext must be used within a SettingsProvider');
  return ctx;
}

const DEFAULT_FIRE: FireSettings = {
  currentAge: 30, targetRetirementAge: 55,
  annualReturnRate: 6, inflationRate: 2, swr: 4, taxRate: 0,
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  // 裝置專屬，刻意不雲端同步：showValues（隱私顯示開關，各裝置各自獨立較合理）、
  // userName/userEmail（登入時改由 Google 帳號同步，見 AppContext）、
  // lastExportDate（本機操作紀錄）、onboardingDone（已由 hasAnyData 判斷取代，見 OnboardingWizard）
  // lastReportSent 改為雲端同步（見下方 useSyncedState）：伺服器 cron 與任何裝置手動寄送報表都要共用同一個
  // 「今天寄過了沒」狀態，才能避免跨裝置/跨 cron 重複寄信。
  const [showValues, setShowValues] = useStickyState<boolean>(true, 'app-show-values');
  const [userName, setUserName] = useStickyState<string>('', 'app-user-name-v1');
  const [userEmail, setUserEmail] = useStickyState<string>('', 'app-user-email-v1');
  const [lastReportSent, setLastReportSent] = useSyncedState<string>('lastReportSent', '', 'app-last-report-sent-v1');
  const [onboardingDone, setOnboardingDone] = useStickyState<boolean>(false, 'assetdash-onboarding-done');
  const [lastExportDate, setLastExportDate] = useStickyState<string>('', 'app-last-export-v1');

  // 以下登入時雲端同步
  const [usdToTwd, setUsdToTwd] = useSyncedState<number>('usdToTwd', 32, 'app-usd-twd-v1');
  const [reportSchedule, setReportSchedule] = useSyncedState<'none' | 'weekly' | 'monthly'>('reportSchedule', 'none', 'app-report-schedule-v1');
  const [netWorthGoal, setNetWorthGoal] = useSyncedState<number>('netWorthGoal', 0, 'app-net-worth-goal-v1');
  const [fireSettings, setFireSettings] = useSyncedState<FireSettings>('fireSettings', DEFAULT_FIRE, 'app-fire-settings-v1');
  const [lifeEvents, setLifeEvents] = useSyncedState<LifeEvent[]>('lifeEvents', [], 'app-life-events-v1');
  const [enablePledgeTracking, setEnablePledgeTracking] = useSyncedState<boolean>('enablePledgeTracking', false, 'app-enable-pledge-tracking-v1');
  const [pledgeAlertLastSent, setPledgeAlertLastSent] = useSyncedState<Record<'warning' | 'danger', string>>(
    'pledgeAlertLastSent', { warning: '', danger: '' }, 'app-pledge-alert-v1'
  );

  return (
    <SettingsContext.Provider value={{
      showValues, setShowValues,
      userName, setUserName,
      userEmail, setUserEmail,
      usdToTwd, setUsdToTwd,
      reportSchedule, setReportSchedule,
      lastReportSent, setLastReportSent,
      netWorthGoal, setNetWorthGoal,
      fireSettings, setFireSettings,
      lifeEvents, setLifeEvents,
      onboardingDone, setOnboardingDone,
      enablePledgeTracking, setEnablePledgeTracking,
      pledgeAlertLastSent, setPledgeAlertLastSent,
      lastExportDate, setLastExportDate,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}
