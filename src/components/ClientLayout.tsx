"use client";

import { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { AppProvider, useAppContext } from '../context/AppContext';

function ClientLayoutContent({ children }: { children: ReactNode }) {
  const { showValues, setShowValues } = useAppContext();

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-gray-900 pb-24">
      <Navbar showValues={showValues} onToggleValues={() => setShowValues(!showValues)} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <ClientLayoutContent>{children}</ClientLayoutContent>
    </AppProvider>
  );
}
