"use client";

import { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { DataManager } from './DataManager';
import { BackupBanner } from './BackupBanner';
import { AppProvider, useAppContext } from '../context/AppContext';
import { ToastProvider } from '../context/ToastContext';

function ClientLayoutContent({ children }: { children: ReactNode }) {
  const { showValues, setShowValues } = useAppContext();

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-gray-900 pb-24">
      <Navbar showValues={showValues} onToggleValues={() => setShowValues(!showValues)} />
      <BackupBanner />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 flex justify-end">
        <DataManager />
      </div>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {children}
      </main>
    </div>
  );
}

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <ToastProvider>
        <ClientLayoutContent>{children}</ClientLayoutContent>
      </ToastProvider>
    </AppProvider>
  );
}
