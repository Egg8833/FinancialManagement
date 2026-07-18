"use client";

import { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { LogIn, LogOut, Cloud } from 'lucide-react';

export function AuthButton() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  if (status === 'loading') return null;

  if (!session) {
    return (
      <button
        onClick={() => signIn('google')}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <LogIn size={16} />
        <span className="hidden sm:inline">登入</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button onClick={() => setMenuOpen(o => !o)} className="flex items-center gap-2">
        {session.user?.image ? (
          <img src={session.user.image} alt="頭像" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <Cloud size={18} className="text-indigo-500" />
        )}
      </button>
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
          <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
            <div className="font-medium text-gray-800 truncate">{session.user?.name}</div>
            <div className="truncate">{session.user?.email}</div>
            <div className="mt-1 text-emerald-600 flex items-center gap-1"><Cloud size={12} />雲端同步中</div>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <LogOut size={14} />登出
          </button>
        </div>
      )}
    </div>
  );
}
