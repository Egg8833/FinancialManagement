"use client";

import { createContext, useContext, ReactNode } from 'react';
import { useStickyState } from '../hooks/useStickyState';
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
  const [showValues, setShowValues] = useStickyState<boolean>(true, 'app-show-values');
  const [userName, setUserName] = useStickyState<string>('', 'app-user-name-v1');
  const [userEmail, setUserEmail] = useStickyState<string>('', 'app-user-email-v1');
  const [usdToTwd, setUsdToTwd] = useStickyState<number>(32, 'app-usd-twd-v1');
  const [reportSchedule, setReportSchedule] = useStickyState<'none' | 'weekly' | 'monthly'>('none', 'app-report-schedule-v1');
  const [lastReportSent, setLastReportSent] = useStickyState('', 'app-last-report-sent-v1');
  const [netWorthGoal, setNetWorthGoal] = useStickyState<number>(0, 'app-net-worth-goal-v1');
  const [fireSettings, setFireSettings] = useStickyState<FireSettings>(DEFAULT_FIRE, 'app-fire-settings-v1');
  const [lifeEvents, setLifeEvents] = useStickyState<LifeEvent[]>([], 'app-life-events-v1');
  const [onboardingDone, setOnboardingDone] = useStickyState<boolean>(false, 'assetdash-onboarding-done');
  const [enablePledgeTracking, setEnablePledgeTracking] = useStickyState<boolean>(false, 'app-enable-pledge-tracking-v1');
  const [pledgeAlertLastSent, setPledgeAlertLastSent] = useStickyState<Record<'warning' | 'danger', string>>(
    { warning: '', danger: '' }, 'app-pledge-alert-v1'
  );
  const [lastExportDate, setLastExportDate] = useStickyState<string>('', 'app-last-export-v1');

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
