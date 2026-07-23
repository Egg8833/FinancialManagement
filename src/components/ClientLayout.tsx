"use client";

import { ReactNode, useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import { Navbar } from './Navbar';
import { DataManager } from './DataManager';
import { EmailReportSender } from './EmailReportSender';
import { BackupBanner } from './BackupBanner';
import { AppProvider, useAppContext } from '../context/AppContext';
import { StockProvider } from '../context/StockContext';
import { ToastProvider } from '../context/ToastContext';
import { RepositoryProvider } from '../context/RepositoryContext';
import { AppStateProvider } from '../context/AppStateContext';
import { OnboardingWizard } from './OnboardingWizard';
import { ImportPromptModal } from './ImportPromptModal';
import BottomTabBar from './BottomTabBar';

// ─── 頂部 Progress Bar ─────────────────────────────────────────────────────────

function RouteProgressBar() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (pathname === prevPathRef.current) return;
    prevPathRef.current = pathname;

    // 開始 loading
    setProgress(0);
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);

    // 模擬進度：快速到 80%，然後停住等頁面完成
    let p = 0;
    const tick = () => {
      p = p < 70 ? p + 15 : p < 85 ? p + 3 : p;
      setProgress(p);
      if (p < 85) timerRef.current = setTimeout(tick, 80);
    };
    tick();

    // 頁面 children 更新後完成
    const done = setTimeout(() => {
      setProgress(100);
      setTimeout(() => setVisible(false), 300);
    }, 350);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      clearTimeout(done);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 z-100 h-0.5 bg-indigo-500 transition-all duration-200 ease-out"
      style={{ width: `${progress}%`, opacity: progress >= 100 ? 0 : 1 }}
    />
  );
}

function ClientLayoutContent({ children }: { children: ReactNode }) {
  const { showValues, setShowValues } = useAppContext();
  const pathname = usePathname();
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
      <RouteProgressBar />
      <Navbar showValues={showValues} onToggleValues={() => setShowValues(!showValues)} />
      <BackupBanner />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 flex justify-end gap-2">
        <EmailReportSender />
        <DataManager />
      </div>
      <main key={pathname} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-16 md:pb-5 page-enter">
        {children}
      </main>
      <OnboardingWizard />
      <ImportPromptModal />
      <BottomTabBar />
    </div>
  );
}

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <RepositoryProvider>
          <AppStateProvider>
            <StockProvider>
              <AppProvider>
                <ClientLayoutContent>{children}</ClientLayoutContent>
              </AppProvider>
            </StockProvider>
          </AppStateProvider>
        </RepositoryProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
