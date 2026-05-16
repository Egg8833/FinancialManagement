"use client";

import { ReactNode, useEffect, useState } from 'react';
import { Navbar } from './Navbar';
import { DataManager } from './DataManager';
import { EmailReportSender } from './EmailReportSender';
import { BackupBanner } from './BackupBanner';
import { AppProvider, useAppContext } from '../context/AppContext';
import { StockProvider } from '../context/StockContext';
import { ToastProvider } from '../context/ToastContext';
import { OnboardingWizard } from './OnboardingWizard';

function ClientLayoutContent({ children }: { children: ReactNode }) {
  const { showValues, setShowValues } = useAppContext();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 全局快捷鍵 Alt + P 切換隱私模式
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setShowValues(!showValues);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showValues, setShowValues]);

  // 閒置自動隱私模式 (5分鐘)
  useEffect(() => {
    if (!showValues) return;
    
    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setShowValues(false), 5 * 60 * 1000);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keypress', resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keypress', resetTimer);
    };
  }, [showValues, setShowValues]);

  if (!mounted) {
    return <div className="min-h-screen bg-gray-50/50" />;
  }

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-gray-900 pb-24">
      <Navbar showValues={showValues} onToggleValues={() => setShowValues(!showValues)} />
      <BackupBanner />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 flex justify-end gap-2">
        <EmailReportSender />
        <DataManager />
      </div>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {children}
      </main>
      <OnboardingWizard />
    </div>
  );
}

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <StockProvider>
      <AppProvider>
        <ToastProvider>
          <ClientLayoutContent>{children}</ClientLayoutContent>
        </ToastProvider>
      </AppProvider>
    </StockProvider>
  );
}
